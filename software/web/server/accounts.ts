/*
  Accounts for the dashboard: the owner's permanent account, and 1-hour demo accounts
  ("sandboxes") that anyone can request from the sign-in page.

  Everything lives in one folder, STATE (REMOTION_STATE, default data/state, git-ignored):

    STATE/accounts.json           every account: email, password hash, kind, expiry
    STATE/signins.json            who is signed in: a hash of each cookie's token, never the token
    STATE/devices.json            phones signed in as a patient (by a code from the patient's profile), by token hash
    STATE/accounts/<id>/
        patients.json             the account's patients (id and name)
        sessions.json             its sessions, written by `python -m software.dashboard.export --data`
        data/                     a demo account's sessions (fake/, phone/, phone-demo/); the owner's
                                  are in the repo's data/ folder (REMOTION_OWNER_DATA)
        incoming/                 raw lines from the phone app, before the logger turns them into files
    STATE/template/               the two example patients every demo starts with, made once

  Passwords are stored as scrypt hashes with a salt. A demo account and everything in it is
  deleted an hour after it was requested; sweep() runs every minute. There is no database:
  demo data only has to last an hour, and the owner's sessions are files as before.
*/
import { createHash, randomBytes, randomInt, scryptSync, timingSafeEqual } from 'node:crypto'
import { existsSync } from 'node:fs'
import { cp, mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { python, REPO } from './python.ts'

export const STATE = process.env.REMOTION_STATE ?? join(REPO, 'data/state')
const OWNER_DATA = process.env.REMOTION_OWNER_DATA ?? join(REPO, 'data')

export const DEMO_MS = 60 * 60 * 1000             // a demo lasts an hour
export const REMEMBER_MS = 30 * 24 * 60 * 60 * 1000  // "Keep me signed in"
const SESSION_ONLY_MS = 24 * 60 * 60 * 1000       // signed in until the browser closes, but at most a day here
const MAX_DEMOS = 100                              // live demo accounts at once
export const DEMO_SUMMARIES = 15                   // Claude summaries a demo account may ask for (it's a public page)
const PAIR_MS = 10 * 60 * 1000                     // a phone's QR code works for 10 minutes

export interface Account {
  id: string
  email: string
  kind: 'owner' | 'demo'
  salt: string
  hash: string
  createdAt: number
  /** demo accounts only: when it and its data are deleted */
  expiresAt: number | null
  /** Claude summaries written for this account (demo accounts are capped) */
  summaries: number
  /** demo accounts: hash of the token the requesting browser keeps, so it can continue this demo instead of making another */
  claimHash?: string
}

export interface PatientEntry { id: string; name: string }

interface SignIn { accountId: string; expiresAt: number }
/** A phone signed in as one patient. Lasts as long as the account (a demo's hour), or until the patient is deleted. */
interface Device { accountId: string; patientId: string; createdAt: number }

let accounts: Account[] = []
let signins: Record<string, SignIn> = {}          // sha256(token) -> sign-in
let devices: Record<string, Device> = {}          // sha256(token) -> phone
const pairCodes = new Map<string, { accountId: string; patientId: string; expiresAt: number }>()

// ---------------------------------------------------------------- files

async function readJsonFile<T>(path: string, fallback: T): Promise<T> {
  try { return JSON.parse(await readFile(path, 'utf8')) as T } catch { return fallback }
}

async function writeJsonFile(path: string, value: unknown) {
  await mkdir(join(path, '..'), { recursive: true })
  const tmp = `${path}.${randomBytes(4).toString('hex')}.tmp`
  await writeFile(tmp, JSON.stringify(value, null, 1))
  await rename(tmp, path)
}

const saveAccounts = () => writeJsonFile(join(STATE, 'accounts.json'), accounts)
const saveSignins = () => writeJsonFile(join(STATE, 'signins.json'), signins)
const saveDevices = () => writeJsonFile(join(STATE, 'devices.json'), devices)

export const accountDir = (a: Account) => join(STATE, 'accounts', a.id)
export const dataDir = (a: Account) => (a.kind === 'owner' ? OWNER_DATA : join(accountDir(a), 'data'))
export const sessionsFile = (a: Account) => join(accountDir(a), 'sessions.json')
const patientsFile = (a: Account) => join(accountDir(a), 'patients.json')
/** Patients deleted from the account whose sessions are in shared files (the committed sample, data/raw): hidden, not removed. */
const hiddenFile = (a: Account) => join(accountDir(a), 'hidden.json')

export const hiddenPatients = (a: Account) => readJsonFile<string[]>(hiddenFile(a), [])

// ---------------------------------------------------------------- passwords

function hashPassword(password: string, salt = randomBytes(16).toString('hex')) {
  return { salt, hash: scryptSync(password, salt, 32).toString('hex') }
}

function passwordMatches(a: Account, password: string) {
  const h = Buffer.from(hashPassword(password, a.salt).hash, 'hex')
  const want = Buffer.from(a.hash, 'hex')
  return h.length === want.length && timingSafeEqual(h, want)
}

const WORDS = ['reach', 'green', 'blue', 'upright', 'wrist', 'table', 'steady', 'button', 'chair', 'morning']
const word = () => WORDS[randomInt(WORDS.length)]
/** Easy to read out and type: "steady-wrist-4821". */
const demoPassword = () => `${word()}-${word()}-${randomInt(1000, 10000)}`
const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex')

// ---------------------------------------------------------------- start-up

/** The names of the owner's patients as they were before accounts (software/web/src/lib/patients.ts). */
const OWNER_PATIENTS: PatientEntry[] = [
  { id: 'vincent', name: 'Vincent Jiang' },
  { id: 'sample', name: 'Daniel Park' },
  { id: 'sim-a', name: 'Margaret Chen' },
  { id: 'sim-b', name: 'Robert Okafor' },
  { id: 'sim-c', name: 'Elena Rossi' },
]
/** The two example patients in every demo: one leaning less over the weeks, one leaning more. */
const DEMO_PATIENTS: PatientEntry[] = [
  { id: 'sim-a', name: 'Margaret Chen' },
  { id: 'sim-c', name: 'Elena Rossi' },
]

let ready: Promise<void> | null = null

/** Load the accounts and sign-ins, and start the minute-by-minute sweep. Safe to call more than once. */
export function init(): Promise<void> {
  ready ??= (async () => {
    await mkdir(STATE, { recursive: true })
    accounts = await readJsonFile(join(STATE, 'accounts.json'), [])
    signins = await readJsonFile(join(STATE, 'signins.json'), {})
    devices = await readJsonFile(join(STATE, 'devices.json'), {})
    await sweep()
    setInterval(() => { void sweep() }, 60_000).unref()
    void template()                                      // the demos' starting point, made in the background
    const owner = accounts.find((a) => a.kind === 'owner')
    if (owner && !existsSync(sessionsFile(owner))) void exportSessions(owner)
  })()
  return ready
}

let templateJob: Promise<string> | null = null

/** STATE/template: the demo patients' sessions and their sessions.json, made once. */
function template(): Promise<string> {
  templateJob ??= (async () => {
    const dir = join(STATE, 'template')
    if (existsSync(join(dir, 'sessions.json'))) return dir
    const all = join(STATE, 'template-build')
    await rm(all, { recursive: true, force: true })
    await python('software.dashboard.fake_history', '--out', join(all, 'every-patient'))
    for (const p of DEMO_PATIENTS) await cp(join(all, 'every-patient', p.id), join(all, 'data/fake', p.id), { recursive: true })
    await python('software.dashboard.export', '--data', join(all, 'data'), '--out', join(all, 'sessions.json'))
    await rm(join(all, 'every-patient'), { recursive: true, force: true })
    await rm(dir, { recursive: true, force: true })
    await rename(all, dir)
    return dir
  })()
  templateJob.catch(() => { templateJob = null })        // try again on the next demo
  return templateJob
}

// ---------------------------------------------------------------- accounts

/** Create the owner's account, or give it a new email and password (server/set-owner.ts). */
export async function setOwner(email: string, password: string): Promise<void> {
  await init()
  let owner = accounts.find((a) => a.kind === 'owner')
  const { salt, hash } = hashPassword(password)
  if (owner) Object.assign(owner, { email: email.toLowerCase(), salt, hash })
  else {
    owner = { id: 'owner', email: email.toLowerCase(), kind: 'owner', salt, hash, createdAt: Date.now(), expiresAt: null, summaries: 0 }
    accounts.push(owner)
  }
  // every sign-in of the old password ends
  for (const [k, s] of Object.entries(signins)) if (s.accountId === owner.id) delete signins[k]
  await saveAccounts()
  await saveSignins()
  if (!existsSync(patientsFile(owner))) await writeJsonFile(patientsFile(owner), OWNER_PATIENTS)
  await exportSessions(owner)
}

/**
  A new 1-hour demo account with the two example patients. Its password is returned once and
  never stored; the claim token goes in the requesting browser's cookie, so that browser gets
  its demo back (demoForClaim) instead of a second one.
*/
export async function createDemo(): Promise<{ email: string; password: string; expiresAt: number; claim: string }> {
  await init()
  if (accounts.filter((a) => a.kind === 'demo').length >= MAX_DEMOS) {
    throw new Error('Too many demos are running right now. Try again in a few minutes.')
  }
  const tpl = await template()
  const id = `demo-${randomBytes(5).toString('hex')}`
  const password = demoPassword()
  const claim = randomBytes(32).toString('base64url')
  const now = Date.now()
  const account: Account = {
    id, email: `guest-${id.slice(5, 9)}@demo.remotion`, kind: 'demo', ...hashPassword(password),
    createdAt: now, expiresAt: now + DEMO_MS, summaries: 0, claimHash: tokenHash(claim),
  }
  await cp(join(tpl, 'data'), dataDir(account), { recursive: true })
  await cp(join(tpl, 'sessions.json'), sessionsFile(account))
  await writeJsonFile(patientsFile(account), DEMO_PATIENTS)
  accounts.push(account)
  await saveAccounts()
  return { email: account.email, password, expiresAt: account.expiresAt!, claim }
}

/**
  A new password for a live demo, for the browser that requested it asking again: the sign-in
  form fills it the same way as a new demo (the old password is never stored, so it can't be
  shown again). Sign-ins made with the old one carry on.
*/
export async function freshDemoPassword(a: Account): Promise<{ email: string; password: string; expiresAt: number }> {
  const password = demoPassword()
  Object.assign(a, hashPassword(password))
  await saveAccounts()
  return { email: a.email, password, expiresAt: a.expiresAt! }
}

/** The live demo a browser's claim token belongs to, if any (ended and expired demos are gone). */
export async function demoForClaim(claim: string | undefined): Promise<Account | null> {
  await init()
  if (!claim) return null
  const h = tokenHash(claim)
  return accounts.find((a) => a.kind === 'demo' && a.claimHash === h && live(a)) ?? null
}

const live = (a: Account) => a.expiresAt === null || a.expiresAt > Date.now()

/** Check an email and password; on success, a new sign-in token for the cookie and how long it lasts. */
export async function signIn(email: string, password: string, remember: boolean) {
  await init()
  const a = accounts.find((x) => x.email === email.trim().toLowerCase())
  if (!a || !live(a) || !passwordMatches(a, password)) return null
  return startSignIn(a, remember)
}

/** A new sign-in for an account already checked (a password, or a demo's claim token). */
export async function startSignIn(a: Account, remember: boolean) {
  const token = randomBytes(32).toString('base64url')
  // a demo's sign-in ends with the demo; the owner's after 30 days, or with the browser
  const expiresAt = a.kind === 'demo' ? a.expiresAt! : Date.now() + (remember ? REMEMBER_MS : SESSION_ONLY_MS)
  signins[tokenHash(token)] = { accountId: a.id, expiresAt }
  await saveSignins()
  return { token, account: a, cookieMaxAgeS: a.kind === 'demo' || remember ? (expiresAt - Date.now()) / 1000 : null }
}

/** The account a cookie's token belongs to, if it's still signed in. */
export async function accountFor(token: string | undefined): Promise<Account | null> {
  await init()
  if (!token) return null
  const s = signins[tokenHash(token)]
  if (!s || s.expiresAt < Date.now()) return null
  const a = accounts.find((x) => x.id === s.accountId)
  return a && live(a) ? a : null
}

export async function signOut(token: string | undefined) {
  if (!token) return
  delete signins[tokenHash(token)]
  await saveSignins()
}

/** Delete a demo account and everything in it (End demo, or its hour is up). */
export async function deleteDemo(a: Account) {
  if (a.kind !== 'demo') return
  accounts = accounts.filter((x) => x.id !== a.id)
  for (const [k, s] of Object.entries(signins)) if (s.accountId === a.id) delete signins[k]
  for (const [code, p] of pairCodes) if (p.accountId === a.id) pairCodes.delete(code)
  for (const [k, d] of Object.entries(devices)) if (d.accountId === a.id) delete devices[k]
  await saveAccounts()
  await saveSignins()
  await saveDevices()
  await rm(accountDir(a), { recursive: true, force: true })
}

/** Every minute: expired demos, sign-ins and phone codes go. */
async function sweep() {
  for (const a of accounts.filter((x) => !live(x))) await deleteDemo(a)
  const now = Date.now()
  let changed = false
  for (const [k, s] of Object.entries(signins)) if (s.expiresAt < now) { delete signins[k]; changed = true }
  if (changed) await saveSignins()
  for (const [code, p] of pairCodes) if (p.expiresAt < now) pairCodes.delete(code)
}

export async function countSummary(a: Account) {
  a.summaries++
  await saveAccounts()
}

// ---------------------------------------------------------------- patients

export async function patients(a: Account): Promise<PatientEntry[]> {
  return readJsonFile(patientsFile(a), a.kind === 'owner' ? OWNER_PATIENTS : [])
}

/** A new patient with no sessions yet. The id comes from the name ("Anna Lee" -> anna-lee, then anna-lee-2). */
export async function addPatient(a: Account, name: string): Promise<PatientEntry> {
  const clean = name.replace(/\s+/g, ' ').trim()
  if (!clean || clean.length > 60) throw new Error('Give the patient a name of up to 60 characters.')
  const list = await patients(a)
  if (list.length >= 50) throw new Error('This account already has 50 patients.')
  const base = clean.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24) || 'patient'
  const hidden = await hiddenPatients(a)
  let id = base
  for (let n = 2; list.some((p) => p.id === id) || hidden.includes(id) || id === 'recorded'; n++) id = `${base}-${n}`
  const entry = { id, name: clean }
  await writeJsonFile(patientsFile(a), [...list, entry])
  return entry
}

/**
  Delete a patient from the account. Their sessions that only this account holds (phone/,
  phone-demo/, fake/ in its data folder, and the phone's raw lines) are moved to
  <account>/deleted/<id>-<time>/, out of the dashboard but recoverable on the server; a demo's
  go with the demo anyway. Sessions in shared files (the committed sample, data/raw) can't be
  removed for one account, so the patient is hidden instead. The sessions are exported again
  before this returns, so the dashboard never shows the patient again.
*/
export async function deletePatient(a: Account, patientId: string): Promise<void> {
  const list = await patients(a)
  const hidden = await hiddenPatients(a)
  if (!list.some((p) => p.id === patientId) && !hidden.includes(patientId)) {
    // a patient with sessions but no listed name can be deleted too
    const known = JSON.parse(await readFile(sessionsFile(a), 'utf8').catch(() => '{"sessions":[]}')) as { sessions: { patient?: string }[] }
    if (!known.sessions.some((s) => s.patient === patientId)) throw new Error('No such patient.')
  }
  await writeJsonFile(patientsFile(a), list.filter((p) => p.id !== patientId))
  // their phone is signed out
  for (const [k, d] of Object.entries(devices)) if (d.accountId === a.id && d.patientId === patientId) delete devices[k]
  await saveDevices()

  const trash = join(accountDir(a), 'deleted', `${patientId}-${new Date().toISOString().replace(/[:.]/g, '-')}`)
  const moves: [string, string][] = ['fake', 'phone', 'phone-demo'].map((root) => [join(dataDir(a), root, patientId), join(trash, root)])
  const incoming = join(accountDir(a), 'incoming')
  for (const kind of await readdir(incoming).catch(() => [] as string[])) moves.push([join(incoming, kind, patientId), join(trash, 'incoming', kind)])
  for (const [from, to] of moves) {
    if (!existsSync(from)) continue
    await mkdir(join(to, '..'), { recursive: true })
    await rename(from, to)
  }
  await exportSessions(a)

  // anything still left is in shared files: hide it from this account
  const after = JSON.parse(await readFile(sessionsFile(a), 'utf8').catch(() => '{"sessions":[]}')) as { sessions: { patient?: string }[] }
  if (after.sessions.some((s) => s.patient === patientId) && !hidden.includes(patientId)) {
    await writeJsonFile(hiddenFile(a), [...hidden, patientId])
  }
}

// ---------------------------------------------------------------- the phone's QR code

const CODE_LETTERS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'       // no 0/O, 1/I/L

/** A short code the phone app will exchange for a sign-in to this patient (the exchange comes next). */
export async function pairCode(a: Account, patientId: string) {
  if (!(await patients(a)).some((p) => p.id === patientId)) throw new Error('No such patient.')
  let code = ''
  do code = Array.from({ length: 6 }, () => CODE_LETTERS[randomInt(CODE_LETTERS.length)]).join('')
  while (pairCodes.has(code))
  const expiresAt = Date.now() + PAIR_MS
  pairCodes.set(code, { accountId: a.id, patientId, expiresAt })
  return { code, expiresAt }
}

/**
  The phone's side of the QR code: a code from a patient's profile becomes that phone's
  sign-in as the patient (a token it keeps; the server keeps its hash). Each code works once.
*/
export async function claimCode(raw: string) {
  await init()
  const code = raw.toUpperCase().replace(/[^A-Z0-9]/g, '')
  const p = pairCodes.get(code)
  if (!p || p.expiresAt < Date.now()) return null
  pairCodes.delete(code)
  const a = accounts.find((x) => x.id === p.accountId)
  const patient = a && live(a) ? (await patients(a)).find((x) => x.id === p.patientId) : undefined
  if (!a || !patient) return null
  const token = randomBytes(32).toString('base64url')
  devices[tokenHash(token)] = { accountId: a.id, patientId: patient.id, createdAt: Date.now() }
  await saveDevices()
  return { token, account: a, patient }
}

/** The account and patient a phone's token is signed in as, if it still is. */
export async function deviceFor(token: string | undefined) {
  await init()
  if (!token) return null
  const d = devices[tokenHash(token)]
  const a = d && accounts.find((x) => x.id === d.accountId)
  if (!d || !a || !live(a)) return null
  const patient = (await patients(a)).find((x) => x.id === d.patientId)
  return patient ? { account: a, patient } : null
}

export async function signOutDevice(token: string | undefined) {
  if (!token) return
  delete devices[tokenHash(token)]
  await saveDevices()
}

// ---------------------------------------------------------------- sessions

/** Rebuild an account's sessions.json from its data folder. */
export function exportSessions(a: Account): Promise<void> {
  return python('software.dashboard.export', '--data', dataDir(a), '--out', sessionsFile(a))
}

/** The owner's account, for phone uploads that don't say whose they are yet (before phones sign in). */
export async function ownerAccount(): Promise<Account | null> {
  await init()
  return accounts.find((a) => a.kind === 'owner') ?? null
}
