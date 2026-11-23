/*
  The dashboard's API, under /api. The same handler runs in `npm run dev` (as a Vite plugin,
  below) and in production (server/index.ts).

    GET  /api/me                      who's signed in, and their patients          401 if no one
    POST /api/demo                    a new 1-hour demo account: { email, password, expiresAt }
    POST /api/login                   { email, password, remember } -> sign-in cookie
    POST /api/logout                  sign out
    POST /api/demo/end                sign out and delete this demo account now
    GET  /api/sessions                the account's sessions.json
    POST /api/patients                { name } -> a new patient
    POST /api/patients/<id>/pair      a code (and the link in the phone's QR code) for that patient
    POST /api/patients/<id>/delete    delete that patient (server/accounts.ts, deletePatient)
    POST /api/summary                 a Claude summary (server/summary.ts)
    POST /api/phone/lines             lines from the phone app (server/phone.ts)

  Signing in sets an HttpOnly cookie; the browser never sees the token's meaning, and the
  server keeps only its hash (server/accounts.ts).
*/
import { readFile } from 'node:fs/promises'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'
import {
  type Account, accountFor, addPatient, createDemo, deleteDemo, deletePatient, hiddenPatients, ownerAccount, pairCode,
  patients, sessionsFile, signIn, signOut,
} from './accounts.ts'
import { clearSessionCookie, cookie, COOKIE, HttpError, origin, readJson, send, setSessionCookie } from './http.ts'
import { phoneLines } from './phone.ts'
import { summarize } from './summary.ts'

/** At most this many demo requests per address per hour (a public page could otherwise fill the server). */
const DEMOS_PER_HOUR = 20
const demoRequests = new Map<string, number[]>()

function clientAddress(req: IncomingMessage) {
  const fwd = req.headers['x-forwarded-for']
  return (Array.isArray(fwd) ? fwd[0] : fwd)?.split(',')[0].trim() ?? req.socket.remoteAddress ?? '?'
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
    const ip = clientAddress(req)
    const recent = (demoRequests.get(ip) ?? []).filter((t) => t > Date.now() - 3_600_000)
    if (recent.length >= DEMOS_PER_HOUR) throw new HttpError(429, 'Too many demo logins from here. Try again later.')
    demoRequests.set(ip, [...recent, Date.now()])
    try {
      return send(res, 200, await createDemo())
    } catch (e) {
      throw new HttpError(503, e instanceof Error ? e.message : 'Couldn’t make a demo account.')
    }
  }

  if (path === '/api/login' && post) {
    const b = await readJson(req)
    if (typeof b.email !== 'string' || typeof b.password !== 'string') throw new HttpError(400, 'Send an email and a password.')
    const s = await signIn(b.email, b.password, b.remember === true)
    if (!s) throw new HttpError(401, 'That email and password don’t match an account. A demo login lasts an hour.')
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
    const b = await readJson(req)
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

  if (path === '/api/summary') return summarize(req, res, await signedIn(req))

  if (path === '/api/phone/lines') {
    // until phones sign in with a patient's QR code: the signed-in account, else the owner's
    const a = (await accountFor(cookie(req, COOKIE))) ?? (await ownerAccount())
    if (!a) throw new HttpError(503, 'No account to store phone sessions in yet (run server/set-owner.ts).')
    return phoneLines(req, res, a)
  }

  throw new HttpError(404, 'No such API.')
}

/** Handle a request under /api; anything else is left alone (returns false). */
export async function api(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  if (!req.url?.startsWith('/api/')) return false
  try {
    await route(req, res)
  } catch (e) {
    if (e instanceof HttpError) send(res, e.status, { error: e.message })
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
