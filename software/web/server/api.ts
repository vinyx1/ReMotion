/*
  The dashboard's API, under /api. The same handler runs in `npm run dev` (as a Vite plugin,
  below) and in production (server/index.ts).

    GET  /api/me                      who's signed in, and their patients          401 if no one
    POST /api/demo                    a 1-hour demo account: { email, password, expiresAt }; one live demo per
                                      browser: if this browser has one, that one, with a fresh password
    POST /api/login                   { email, password, remember } -> sign-in cookie
    POST /api/logout                  sign out
    POST /api/demo/end                sign out and delete this demo account now
    GET  /api/sessions                the account's sessions.json
    POST /api/patients                { name } -> a new patient
    POST /api/patients/<id>/pair      a code (and the link in the phone's QR code) for that patient
    POST /api/patients/<id>/delete    delete that patient (server/accounts.ts, deletePatient)
    POST /api/summary                 a Claude summary (server/summary.ts)
    POST /api/phone/pair              { code } from a patient's profile -> { token, patient, kind, expiresAt } for the app
    GET  /api/phone/me                the app's sign-in: { patient, kind, expiresAt }          401 if it ended
    POST /api/phone/logout            the app signs out
    POST /api/phone/lines             lines from the phone app (server/phone.ts), with its token

  Signing in sets an HttpOnly cookie; the browser never sees the token's meaning, and the
  server keeps only its hash (server/accounts.ts).

  Every request passes server/security.ts first: a per-address rate limit, a same-origin check
  for browser POSTs, and the security headers. Sign-in, demos, phone codes, summaries, new
  patients and phone uploads have their own limits (LIMITS there).
*/
import { readFile } from 'node:fs/promises'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'
import {
  type Account, accountFor, addPatient, claimCode, createDemo, deleteDemo, deletePatient, demoForClaim, deviceFor,
  freshDemoPassword, hiddenPatients, pairCode, patients, sessionsFile, signIn, signOut, signOutDevice,
} from './accounts.ts'
import {
  addCookie, clearSessionCookie, cookie, COOKIE, DEMO_COOKIE, HttpError, origin, readJson, send, setSessionCookie,
} from './http.ts'
import { phoneLines } from './phone.ts'
import { clientAddress, LIMITS, sameOrigin, securityHeaders } from './security.ts'
import { summarize } from './summary.ts'

/** The phone's token, from "Authorization: Bearer <token>". */
function bearer(req: IncomingMessage) {
  const h = req.headers.authorization
  return h?.startsWith('Bearer ') ? h.slice(7).trim() : undefined
}


async function me(a: Account) {
  return { email: a.email, kind: a.kind, expiresAt: a.expiresAt, patients: await patients(a) }
}

async function signedIn(req: IncomingMessage): Promise<Account> {
  const a = await accountFor(cookie(req, COOKIE))
  if (!a) throw new HttpError(401, 'Not signed in.')
  return a
}

async function route(req: IncomingMessage, res: ServerResponse) {
  const path = (req.url ?? '').split('?')[0].replace(/\/+$/, '')
  const post = req.method === 'POST'

  if (path === '/api/me' && req.method === 'GET') return send(res, 200, await me(await signedIn(req)))

  if (path === '/api/demo' && post) {
    // one live demo per browser: asking again fills in the same demo (a fresh password; the old one isn't kept)
    const mine = await demoForClaim(cookie(req, DEMO_COOKIE))
    if (mine) return send(res, 200, await freshDemoPassword(mine))
    LIMITS.demos.take(clientAddress(req), 'Too many demo logins from here. Try again later.')
    try {
      const { claim, ...demo } = await createDemo()
      addCookie(req, res, DEMO_COOKIE, claim, (demo.expiresAt - Date.now()) / 1000)
      return send(res, 200, demo)
    } catch (e) {
      throw new HttpError(503, e instanceof Error ? e.message : 'Couldn’t make a demo account.')
    }
  }

  if (path === '/api/login' && post) {
    const b = await readJson(req, 4_000)
    if (typeof b.email !== 'string' || typeof b.password !== 'string') throw new HttpError(400, 'Send an email and a password.')
    // failed sign-ins are limited per address and per email; a success clears the email's count
    const ip = clientAddress(req), email = b.email.trim().toLowerCase().slice(0, 254)
    const wait = Math.max(LIMITS.loginPerAddress.wait(ip), LIMITS.loginPerEmail.wait(email))
    if (wait > 0) throw new HttpError(429, `Too many tries. Wait ${Math.ceil(wait / 60)} min, then try again.`, wait)
    const s = await signIn(email, b.password, b.remember === true)
    if (!s) {
      LIMITS.loginPerAddress.hit(ip)
      LIMITS.loginPerEmail.hit(email)
      throw new HttpError(401, 'Incorrect email or password.')
    }
    LIMITS.loginPerEmail.reset(email)
    setSessionCookie(req, res, s.token, s.cookieMaxAgeS)
    return send(res, 200, await me(s.account))
  }

  if (path === '/api/logout' && post) {
    await signOut(cookie(req, COOKIE))
    clearSessionCookie(req, res)
    return send(res, 200, { ok: true })
  }

  if (path === '/api/demo/end' && post) {
    const a = await signedIn(req)
    if (a.kind !== 'demo') throw new HttpError(400, 'Only a demo account can be ended.')
    await deleteDemo(a)
    clearSessionCookie(req, res)
    addCookie(req, res, DEMO_COOKIE, '', 0)          // this browser may request a new demo now
    return send(res, 200, { ok: true })
  }

  if (path === '/api/sessions' && req.method === 'GET') {
    const a = await signedIn(req)
    let text: string
    try { text = await readFile(sessionsFile(a), 'utf8') } catch { text = JSON.stringify({ generated: '', sessions: [] }) }
    // patients deleted from this account whose sessions live in shared files stay out of sight
    const hidden = await hiddenPatients(a)
    if (hidden.length) {
      const data = JSON.parse(text) as { sessions: { patient?: string }[] }
      data.sessions = data.sessions.filter((s) => !hidden.includes(s.patient ?? ''))
      text = JSON.stringify(data)
    }
    res.statusCode = 200
    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Cache-Control', 'no-store')
    return res.end(text)
  }

  if (path === '/api/patients' && post) {
    const a = await signedIn(req)
    LIMITS.newPatients.take(a.id, 'Too many new patients for now. Try again later.')
    const b = await readJson(req, 4_000)
    if (typeof b.name !== 'string') throw new HttpError(400, 'Send the patient’s name.')
    try { return send(res, 200, await addPatient(a, b.name)) } catch (e) { throw new HttpError(400, (e as Error).message) }
  }

  const pair = /^\/api\/patients\/([a-z0-9-]{1,32})\/pair$/.exec(path)
  if (pair && post) {
    const a = await signedIn(req)
    try {
      const { code, expiresAt } = await pairCode(a, pair[1])
      return send(res, 200, { code, expiresAt, url: `${origin(req)}/pair?code=${code}` })
    } catch (e) {
      throw new HttpError(404, (e as Error).message)
    }
  }

  const del = /^\/api\/patients\/([a-z0-9-]{1,32})\/delete$/.exec(path)
  if (del && post) {
    const a = await signedIn(req)
    try { await deletePatient(a, del[1]) } catch (e) { throw new HttpError(404, (e as Error).message) }
    return send(res, 200, await me(a))
  }

  if (path === '/api/summary') {
    const a = await signedIn(req)
    LIMITS.summaries.take(a.id, 'Too many summaries at once. Wait a minute.')
    return summarize(req, res, a)
  }

  // ---- the phone app: signs in as one patient with the code from their profile
  if (path === '/api/phone/pair' && post) {
    LIMITS.pairTries.take(clientAddress(req), 'Too many tries. Wait a while, then try again.')
    const b = await readJson(req, 4_000)
    const c = typeof b.code === 'string' ? await claimCode(b.code) : null
    if (!c) throw new HttpError(404, 'That code didn’t work. Codes last 10 minutes: ask for a new one.')
    return send(res, 200, { token: c.token, patient: c.patient, kind: c.account.kind, expiresAt: c.account.expiresAt })
  }
  if (path.startsWith('/api/phone/')) {
    const token = bearer(req)
    const d = await deviceFor(token)
    if (path === '/api/phone/logout' && post) { await signOutDevice(token); return send(res, 200, { ok: true }) }
    if (!d) throw new HttpError(401, 'This phone isn’t signed in.')
    if (path === '/api/phone/me' && req.method === 'GET') {
      return send(res, 200, { patient: d.patient, kind: d.account.kind, expiresAt: d.account.expiresAt })
    }
    if (path === '/api/phone/lines') {
      LIMITS.phoneBatches.take(`${d.account.id}/${d.patient.id}/${token}`, 'Sending too fast. Slow down.')
      return phoneLines(req, res, d.account, d.patient.id)
    }
  }

  throw new HttpError(404, 'No such API.')
}

/** Handle a request under /api; anything else is left alone (returns false). */
export async function api(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  if (!req.url?.startsWith('/api/')) return false
  securityHeaders(req, res)
  try {
    LIMITS.api.take(clientAddress(req), 'Too many requests. Slow down.')
    if (!req.url.startsWith('/api/phone/')) sameOrigin(req)       // the phone app uses a token, not cookies
    await route(req, res)
  } catch (e) {
    if (e instanceof HttpError) {
      if (e.retryAfterS) res.setHeader('Retry-After', String(e.retryAfterS))
      send(res, e.status, { error: e.message })
    }
    else {
      console.error('[api]', e)
      send(res, 500, { error: 'Something went wrong on the server.' })
    }
  }
  return true
}

/** Vite plugin: the same API in `npm run dev` and `npm run preview`. */
export function remotionApi(): Plugin {
  const mount = (server: { middlewares: { use: (fn: (req: IncomingMessage, res: ServerResponse, next: () => void) => void) => void } }) => {
    server.middlewares.use((req, res, next) => { void api(req, res).then((handled) => { if (!handled) next() }) })
  }
  return { name: 'remotion-api', configureServer: mount, configurePreviewServer: mount }
}
