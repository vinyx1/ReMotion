/*
  Small helpers shared by the API (server/api.ts): reading a request body, answering
  with JSON, and the sign-in cookie.
*/
import type { IncomingMessage, ServerResponse } from 'node:http'

export class HttpError extends Error {
  status: number
  constructor(status: number, message: string) { super(message); this.status = status }
}

export function readBody(req: IncomingMessage, limit = 200_000): Promise<string> {
  return new Promise((done, fail) => {
    let data = ''
    req.setEncoding('utf8')
    req.on('data', (chunk: string) => {
      data += chunk
      if (data.length > limit) { req.destroy(); fail(new HttpError(413, 'That request is too big.')) }
    })
    req.on('end', () => done(data))
    req.on('error', fail)
  })
}

/** The body as a JSON object, or a 400. */
export async function readJson(req: IncomingMessage, limit?: number): Promise<Record<string, unknown>> {
  try {
    const v = JSON.parse(await readBody(req, limit))
    if (v && typeof v === 'object' && !Array.isArray(v)) return v
  } catch (e) {
    if (e instanceof HttpError) throw e
  }
  throw new HttpError(400, 'The request body was not a JSON object.')
}

export function send(res: ServerResponse, status: number, body: object) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(body))
}

export const COOKIE = 'rm_session'

export function cookie(req: IncomingMessage, name: string): string | undefined {
  for (const part of (req.headers.cookie ?? '').split(';')) {
    const [k, ...v] = part.trim().split('=')
    if (k === name) return decodeURIComponent(v.join('='))
  }
  return undefined
}

/** Over https (Railway sets x-forwarded-proto), cookies are marked Secure. */
export const isHttps = (req: IncomingMessage) =>
  req.headers['x-forwarded-proto'] === 'https' || Boolean((req.socket as { encrypted?: boolean }).encrypted)

/** The sign-in cookie: HttpOnly, SameSite=Lax; maxAgeS null means until the browser closes. */
export function setSessionCookie(req: IncomingMessage, res: ServerResponse, token: string, maxAgeS: number | null) {
  const parts = [`${COOKIE}=${encodeURIComponent(token)}`, 'Path=/', 'HttpOnly', 'SameSite=Lax']
  if (maxAgeS !== null) parts.push(`Max-Age=${Math.max(0, Math.floor(maxAgeS))}`)
  if (isHttps(req)) parts.push('Secure')
  res.setHeader('Set-Cookie', parts.join('; '))
}

export function clearSessionCookie(req: IncomingMessage, res: ServerResponse) { setSessionCookie(req, res, '', 0) }

/** The address the browser used, for links that must point back here (the phone's QR code). */
export function origin(req: IncomingMessage): string {
  const proto = isHttps(req) ? 'https' : 'http'
  const host = req.headers['x-forwarded-host'] ?? req.headers.host ?? 'localhost'
  return `${proto}://${Array.isArray(host) ? host[0] : host}`
}
