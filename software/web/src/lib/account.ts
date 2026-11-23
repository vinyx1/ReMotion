/*
  The signed-in account, from the dashboard's API (server/api.ts), and the calls that
  change it. The cookie that keeps someone signed in is HttpOnly: this code never sees it.
*/
import { createContext, useContext } from 'react'

export interface PatientEntry { id: string; name: string }

export interface Me {
  email: string
  kind: 'owner' | 'demo'
  /** demo accounts: when the account and everything in it is deleted (ms since 1970) */
  expiresAt: number | null
  /** the account's patients, including ones with no sessions yet */
  patients: PatientEntry[]
}

export class ApiError extends Error {
  status: number
  /** the rest of the server's answer (e.g. the demo this browser already has) */
  data: Record<string, unknown>
  constructor(status: number, message: string, data: Record<string, unknown> = {}) { super(message); this.status = status; this.data = data }
}

async function call<T>(path: string, body?: object): Promise<T> {
  const r = await fetch(path, {
    method: body ? 'POST' : 'GET',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  })
  const data = await r.json().catch(() => ({}))
  if (!r.ok) throw new ApiError(r.status, (data as { error?: string }).error ?? `The server answered ${r.status}.`, data as Record<string, unknown>)
  return data as T
}

export const getMe = () => call<Me>('/api/me')
export const requestDemo = () => call<{ email: string; password: string; expiresAt: number }>('/api/demo', {})
export const signIn = (email: string, password: string, remember: boolean) => call<Me>('/api/login', { email, password, remember })
export const signOut = () => call('/api/logout', {})
export const endDemo = () => call('/api/demo/end', {})
export const addPatient = (name: string) => call<PatientEntry>('/api/patients', { name })
export const deletePatient = (pid: string) => call<Me>(`/api/patients/${encodeURIComponent(pid)}/delete`, {})
export const pairCode = (pid: string) => call<{ code: string; expiresAt: number; url: string }>(`/api/patients/${encodeURIComponent(pid)}/pair`, {})

/** The account and what the dashboard can do with it, for components deep in the page (the sidebar, Add patient). */
export interface AccountApi {
  me: Me
  /** read the account again (after adding a patient) */
  refresh: () => Promise<void>
  signOut: () => void
  endDemo: () => void
}

export const AccountContext = createContext<AccountApi | null>(null)

export function useAccount(): AccountApi {
  const a = useContext(AccountContext)
  if (!a) throw new Error('useAccount outside the signed-in dashboard')
  return a
}

/** "52 min", "1 min", or "less than a minute" until a time. */
export function timeLeft(until: number, now = Date.now()): string {
  const min = Math.floor((until - now) / 60_000)
  return min >= 1 ? `${min} min` : 'less than a minute'
}
