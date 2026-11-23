/*
  The dashboard's sign-in: email and password, or "Try a 1-hour demo", which always does the
  same thing: fills the form with a demo account, then the visitor signs in with it. A browser
  that already has a demo running gets that same demo filled in again (server/api.ts allows
  one live demo per browser). One message line at most: the newest replaces the last.

  The room's wall, as on the dashboard, with the form on a plaster plate hung on it.
*/
import { ArrowRight, Eye, EyeOff } from 'lucide-react'
import { type FormEvent, useEffect, useId, useRef, useState } from 'react'
import { type Me, requestDemo, signIn } from '../lib/account'
import { cn } from '../lib/utils'
import { FOCUS } from './ui'
import { WallFacets } from './WallFacets'

const FIELD = 'h-12 w-full rounded-[10px] border border-forest/25 bg-panel px-3.5 text-[17px] text-forest transition-colors duration-150 hover:border-forest/45 focus-visible:border-eucalyptus focus-visible:outline-3 focus-visible:outline-offset-0 focus-visible:outline-eucalyptus/35'
const at = (t: number) => new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

type Message = { kind: 'info' | 'error'; text: string }

export function SignIn({ note, onSignedIn }: { note?: string; onSignedIn: (me: Me) => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(false)
  const [show, setShow] = useState(false)
  const [demo, setDemo] = useState(false)           // the form holds a demo account
  const [busy, setBusy] = useState<'signin' | 'demo' | null>(null)
  const [message, setMessage] = useState<Message | null>(note ? { kind: 'info', text: note } : null)
  const submit = useRef<HTMLButtonElement>(null)
  const ids = { email: useId(), password: useId(), remember: useId(), message: useId() }
  useEffect(() => { document.title = 'Sign in · ReMotion' }, [])

  // typing over a filled-in demo account makes it an ordinary sign-in again
  const edit = (set: (v: string) => void) => (v: string) => { set(v); if (demo) { setDemo(false); setMessage(null) } }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy('signin')
    try {
      onSignedIn(await signIn(email, password, remember))
    } catch (err) {
      setMessage({ kind: 'error', text: (err as Error).message })
      setBusy(null)
    }
  }

  async function onDemo() {
    setBusy('demo')
    try {
      const d = await requestDemo()
      setEmail(d.email); setPassword(d.password); setShow(true); setRemember(false); setDemo(true)
      setMessage({ kind: 'info', text: `Demo account · deleted at ${at(d.expiresAt)}` })
      setBusy(null)
      submit.current?.focus()                        // the next step: Sign in
    } catch (err) {
      setMessage({ kind: 'error', text: (err as Error).message })
      setBusy(null)
    }
  }

  return (
    <div className="dash-wall flex min-h-dvh flex-col">
      <WallFacets />
      <header className="px-6 pt-6 sm:px-10">
        <a href="/" className={cn('rounded-md font-display text-[1.6rem] font-semibold tracking-[-0.02em] text-forest', FOCUS)}>ReMotion</a>
      </header>
      <main className="mx-auto grid w-full max-w-[27rem] flex-1 items-center px-6 pt-6 pb-16">
        <form onSubmit={onSubmit} noValidate aria-describedby={message ? ids.message : undefined}
          className="signin-rise flex flex-col gap-5 rounded-[18px] border border-transparent bg-plaster p-6 shadow-[0_0_0_1px_rgb(31_45_39/0.1),0_2px_4px_rgb(31_45_39/0.08),0_16px_36px_-18px_rgb(31_45_39/0.45)] sm:p-8">
          <h1 className="font-display text-[1.75rem] leading-tight font-medium tracking-[-0.015em] text-forest">Sign in</h1>

          <div className="flex flex-col gap-2">
            <label htmlFor={ids.email} className="text-[15px] font-bold text-forest">Email</label>
            <input id={ids.email} type="email" autoComplete="username" required value={email}
              onChange={(e) => edit(setEmail)(e.target.value)} className={FIELD} />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor={ids.password} className="text-[15px] font-bold text-forest">Password</label>
            <div className="relative">
              <input id={ids.password} type={show ? 'text' : 'password'} autoComplete="current-password" required value={password}
                onChange={(e) => edit(setPassword)(e.target.value)} className={cn(FIELD, 'pr-14')} />
              <button type="button" onClick={() => setShow((v) => !v)} aria-pressed={show} aria-label={show ? 'Hide password' : 'Show password'}
                className={cn('absolute inset-y-1 right-1 grid w-11 cursor-pointer place-items-center rounded-lg text-forest-2 transition-colors duration-150 hover:bg-wash hover:text-forest', FOCUS)}>
                {show ? <EyeOff className="size-5" aria-hidden /> : <Eye className="size-5" aria-hidden />}
              </button>
            </div>
          </div>

          {/* one line: what just happened, or what went wrong */}
          {message && (
            <p id={ids.message} role={message.kind === 'error' ? 'alert' : 'status'}
              className={cn('-mt-1 text-[15px] leading-snug tabular-nums', message.kind === 'error' ? 'font-bold text-terra-deep' : 'text-forest')}>
              {message.text}
            </p>
          )}
          {!demo && (
            <label htmlFor={ids.remember} className="-mt-1 flex cursor-pointer items-center gap-3 self-start text-[16px] text-forest">
              <input id={ids.remember} type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)}
                className="size-5 cursor-pointer accent-forest" />
              Keep me signed in
            </label>
          )}

          <button ref={submit} type="submit" disabled={busy !== null || !email || !password}
            className={cn('inline-flex h-12 w-full cursor-pointer items-center justify-center gap-2.5 rounded-xl bg-forest px-5 text-[17px] font-bold text-plaster shadow-[0_1px_2px_rgb(31_45_39/0.18),0_6px_18px_-8px_rgb(31_45_39/0.45)] transition-[background-color,translate] duration-150 hover:bg-forest-deep active:translate-y-px disabled:cursor-not-allowed disabled:opacity-55', FOCUS)}>
            {busy === 'signin' ? 'Signing in…' : 'Sign in'} <ArrowRight className="size-5" aria-hidden />
          </button>

          <div className="flex items-center gap-3 text-[14px] text-forest-2" aria-hidden>
            <span className="h-px flex-1 bg-wall" /> or <span className="h-px flex-1 bg-wall" />
          </div>

          {/* once a demo account is filled in, the next step is Sign in: this one greys out */}
          <button type="button" onClick={onDemo} disabled={busy !== null || demo}
            className={cn('inline-flex h-12 w-full cursor-pointer items-center justify-center rounded-xl border-[1.5px] border-forest/30 px-5 text-[16px] font-bold text-forest transition-colors duration-150 hover:border-forest/60 hover:bg-wash disabled:cursor-not-allowed disabled:opacity-55', FOCUS)}>
            {busy === 'demo' ? 'Getting a demo account…' : 'Try a 1-hour demo'}
          </button>
        </form>
      </main>
    </div>
  )
}
