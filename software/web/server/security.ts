/*
  The server's defences against abuse, in one place (used by server/api.ts and server/index.ts).

    clientAddress   who is asking. Behind a proxy (Railway), set TRUST_PROXY=1 and the address
                    comes from the last X-Forwarded-For entry, the one the proxy itself added;
                    the earlier entries are whatever the client sent, so trusting the first one
                    (as before) let anyone dodge every per-address limit by sending a fake one.
                    Without TRUST_PROXY, the socket's address.
    Limiter         a sliding-window counter per key (an address, an email, an account, a phone),
                    kept in memory and swept so it can't grow without bound.
    LIMITS          every limit, with the reason. A refused request gets 429 and Retry-After.
    sameOrigin      a backstop to the SameSite cookies against cross-site requests: a browser
                    POST whose Origin isn't this site, or whose Sec-Fetch-Site says cross-site,
                    is refused. The phone app (no cookies, a Bearer token) isn't affected.
    securityHeaders sent with every response: no framing (clickjacking), no MIME sniffing, a
                    strict referrer policy, no camera/microphone/location for the page, HSTS over
                    https, and a Content-Security-Policy for the pages.
*/
import type { IncomingMessage, ServerResponse } from 'node:http'
import { HttpError, isHttps } from './http.ts'

const TRUST_PROXY = process.env.TRUST_PROXY === '1'

export function clientAddress(req: IncomingMessage): string {
  if (TRUST_PROXY) {
    const fwd = req.headers['x-forwarded-for']
    const list = (Array.isArray(fwd) ? fwd.join(',') : fwd ?? '').split(',').map((s) => s.trim()).filter(Boolean)
    if (list.length) return list[list.length - 1]
  }
  return req.socket.remoteAddress ?? '?'
}

/** At most `max` events per key within `windowMs`. */
export class Limiter {
  private hits = new Map<string, number[]>()
  private sweptAt = Date.now()
  readonly max: number
  readonly windowMs: number
  constructor(max: number, windowMs: number) { this.max = max; this.windowMs = windowMs }

  private recent(key: string, now: number) {
    return (this.hits.get(key) ?? []).filter((t) => t > now - this.windowMs)
  }

  /** Seconds until `key` may try again, or 0 if it may now. */
  wait(key: string): number {
    const now = Date.now()
    const r = this.recent(key, now)
    return r.length < this.max ? 0 : Math.ceil((r[0] + this.windowMs - now) / 1000)
  }

  /** Count one event for `key`. */
  hit(key: string) {
    const now = Date.now()
    this.hits.set(key, [...this.recent(key, now), now])
    if (now - this.sweptAt > 60_000) {                      // forget keys that have gone quiet
      this.sweptAt = now
      for (const [k, v] of this.hits) if (!v.some((t) => t > now - this.windowMs)) this.hits.delete(k)
    }
  }

  /** Count one event, or refuse with 429 if `key` is over the limit. */
  take(key: string, message: string) {
    const s = this.wait(key)
    if (s > 0) throw new HttpError(429, message, s)
    this.hit(key)
  }

  /** Forget `key` (a successful sign-in clears its failures). */
  reset(key: string) { this.hits.delete(key) }
}

const MIN = 60_000
export const LIMITS = {
  /** Any API request, per address: generous for a person and the dashboard's 5 s polling, not for a script. */
  api: new Limiter(300, MIN),
  /** Failed sign-ins per address, and per email (so spreading over many addresses doesn't help either). */
  loginPerAddress: new Limiter(10, 15 * MIN),
  loginPerEmail: new Limiter(5, 15 * MIN),
  /** Demo accounts requested per address per hour (each one is a folder of files and a Python export). */
  demos: new Limiter(20, 60 * MIN),
  /** Phone codes tried per address per hour: 6 letters from 31 can't be guessed at this rate. */
  pairTries: new Limiter(30, 60 * MIN),
  /** Claude summaries per account per minute (each costs money; demos also have a total cap). */
  summaries: new Limiter(6, MIN),
  /** Upload batches per phone per minute: the app sends about one a second. */
  phoneBatches: new Limiter(240, MIN),
  /** New patients per account per hour. */
  newPatients: new Limiter(30, 60 * MIN),
  /** Phone app downloads per address per hour (each is a few MB). */
  appDownloads: new Limiter(10, 60 * MIN),
}

/** Refuse a cross-site browser request that would act with the visitor's cookie. */
export function sameOrigin(req: IncomingMessage) {
  if (req.method === 'GET' || req.method === 'HEAD') return
  if (req.headers['sec-fetch-site'] === 'cross-site') throw new HttpError(403, 'Cross-site requests aren’t allowed.')
  const from = req.headers.origin
  if (!from) return                                       // not a browser page (the phone app, curl)
  const host = TRUST_PROXY ? (req.headers['x-forwarded-host'] ?? req.headers.host) : req.headers.host
  let ok = false
  try { ok = new URL(from).host === (Array.isArray(host) ? host[0] : host) } catch { ok = false }
  if (!ok) throw new HttpError(403, 'Cross-site requests aren’t allowed.')
}

/*
  The pages' Content-Security-Policy: scripts, styles, fonts, images, 3D models and API calls
  from this site only. Inline styles are allowed (React sets style attributes), inline scripts
  and JavaScript eval aren't; WebAssembly is (the 3D figure's mesh decoder needs it). blob: covers the 3D replay's textures and workers; data: small inline images/fonts.
*/
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval'",          // WebAssembly only (the 3D model's decoder); JS eval stays blocked
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' blob: data:",
  "worker-src 'self' blob:",
  "media-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ')

export function securityHeaders(req: IncomingMessage, res: ServerResponse, page = false) {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()')
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin')
  if (isHttps(req)) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  if (page) res.setHeader('Content-Security-Policy', CSP)
}
