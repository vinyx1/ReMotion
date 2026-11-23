/*
  The dashboard's sign-in page. An email and password (the owner's account), or
  "Request a 1-hour demo login": the server makes a demo account with two example
  patients, its details fill the form for the visitor to see, and they sign in with it.
  The demo and everything added to it is deleted after the hour (server/accounts.ts).

  The room's wall, as on the dashboard: the headline on the wall, the form on a plaster
  plate hung on it (the plate is one of the two things the design lets lift).
*/
import { ArrowRight, Eye, EyeOff } from 'lucide-react'
import { type FormEvent, useEffect, useId, useRef, useState } from 'react'
import { type Me, requestDemo, signIn } from '../lib/account'
import { cn } from '../lib/utils'
import { FOCUS } from './ui'
import { WallFacets } from './WallFacets'

const FIELD = 'h-12 w-full rounded-[10px] border border-forest/25 bg-panel px-3.5 text-[17px] text-forest placeholder:text-forest-2/70 transition-colors duration-150 hover:border-forest/45 focus-visible:border-eucalyptus focus-visible:outline-3 focus-visible:outline-offset-0 focus-visible:outline-eucalyptus/35'
const at = (t: number) => new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

export function SignIn({ note, onSignedIn }: { note?: string; onSignedIn: (me: Me) => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(false)
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState<'signin' | 'demo' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [demoUntil, setDemoUntil] = useState<number | null>(null)
  const submit = useRef<HTMLButtonElement>(null)
  const ids = { email: useId(), password: useId(), remember: useId(), status: useId() }
  useEffect(() => { document.title = 'Sign in · Re:Motion' }, [])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy('signin'); setError(null)
    try {
      onSignedIn(await signIn(email, password, remember))
    } catch (err) {
      setError((err as Error).message)
      setBusy(null)
    }
  }

  async function onDemo() {
    setBusy('demo'); setError(null)
    try {
      const d = await requestDemo()
      setEmail(d.email); setPassword(d.password); setShow(true); setRemember(false)
      setDemoUntil(d.expiresAt)
      submit.current?.focus()          // the next step is right there: Sign in
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="dash-wall flex min-h-dvh flex-col">
      <WallFacets />
      <header className="px-6 pt-6 sm:px-10">
        <a href="/" className={cn('rounded-md font-display text-[1.6rem] font-semibold tracking-[-0.02em] text-forest', FOCUS)}>Re:Motion</a>
      </header>
      <main className="mx-auto grid w-full max-w-[1120px] flex-1 items-center gap-10 px-6 pt-10 pb-16 sm:px-10 lg:grid-cols-[1fr_minmax(0,33rem)] lg:gap-14">
        <section className="signin-rise max-w-[34rem]">
          <h1 className="font-display text-[2.4rem] leading-[1.06] font-medium tracking-[-0.02em] text-balance text-forest sm:text-[3.25rem]">
            Sign in to the dashboard
          </h1>
          <p className="mt-5 max-w-[40ch] text-[1.15rem] leading-relaxed text-pretty text-forest">
            See how each patient reached, session by session: when the trunk did the arm’s work, and whether that is changing.
          </p>
          <p className="mt-4 max-w-[44ch] text-[1.05rem] leading-relaxed text-pretty text-forest">
            No account? Request a demo login. It comes with two example patients, and you can add your own and connect the phone app.
          </p>
        </section>

        <form onSubmit={onSubmit} noValidate aria-describedby={note ? ids.status : undefined} style={{ '--i': 1 } as React.CSSProperties}
          className="signin-rise flex flex-col gap-5 rounded-[18px] border border-transparent bg-plaster p-6 shadow-[0_0_0_1px_rgb(31_45_39/0.1),0_2px_4px_rgb(31_45_39/0.08),0_16px_36px_-18px_rgb(31_45_39/0.45)] sm:p-8">
          {note && (
            <p id={ids.status} role="status" className="rounded-[10px] bg-wash px-4 py-3 text-[15px] leading-snug font-bold text-forest">{note}</p>
          )}
          <div className="flex flex-col gap-2">
            <label htmlFor={ids.email} className="text-[15px] font-bold text-forest">Email</label>
            <input id={ids.email} type="email" autoComplete="username" required value={email}
              onChange={(e) => { setEmail(e.target.value); setDemoUntil(null) }} className={FIELD} />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor={ids.password} className="text-[15px] font-bold text-forest">Password</label>
            <div className="relative">
              <input id={ids.password} type={show ? 'text' : 'password'} autoComplete="current-password" required value={password}
                onChange={(e) => { setPassword(e.target.value); setDemoUntil(null) }} className={cn(FIELD, 'pr-14 font-readout tabular-nums')} />
              <button type="button" onClick={() => setShow((v) => !v)} aria-pressed={show} aria-label={show ? 'Hide password' : 'Show password'}
                className={cn('absolute inset-y-1 right-1 grid w-11 cursor-pointer place-items-center rounded-lg text-forest-2 transition-colors duration-150 hover:bg-wash hover:text-forest', FOCUS)}>
                {show ? <EyeOff className="size-5" aria-hidden /> : <Eye className="size-5" aria-hidden />}
              </button>
            </div>
          </div>
          {demoUntil === null && (
            <label htmlFor={ids.remember} className="-mt-1 flex cursor-pointer items-center gap-3 self-start text-[16px] text-forest">
              <input id={ids.remember} type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)}
                className="size-5 cursor-pointer accent-forest" />
              Keep me signed in for 30 days
            </label>
          )}
          {demoUntil !== null && (
            <p role="status" className="-mt-1 text-[15px] leading-snug text-pretty text-forest">
              <span className="font-bold">Demo login ready.</span> It and anything you add to it is deleted at{' '}
              <span className="tabular-nums">{at(demoUntil)}</span>.
            </p>
          )}
          {error && <p role="alert" className="text-[15px] leading-snug font-bold text-terra-deep">{error}</p>}
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button ref={submit} type="submit" disabled={busy !== null || !email || !password}
              className={cn('inline-flex h-12 cursor-pointer items-center gap-2.5 rounded-xl bg-forest px-5 text-[17px] font-bold text-plaster shadow-[0_1px_2px_rgb(31_45_39/0.18),0_6px_18px_-8px_rgb(31_45_39/0.45)] transition-[background-color,translate] duration-150 hover:bg-forest-deep active:translate-y-px disabled:cursor-not-allowed disabled:opacity-55', FOCUS)}>
              {busy === 'signin' ? 'Signing in…' : 'Sign in'} <ArrowRight className="size-5" aria-hidden />
            </button>
            <button type="button" onClick={onDemo} disabled={busy !== null}
              className={cn('inline-flex h-12 cursor-pointer items-center rounded-xl border-[1.5px] border-forest/30 px-4 text-[16px] font-bold text-forest transition-colors duration-150 hover:border-forest/60 hover:bg-wash disabled:cursor-not-allowed disabled:opacity-55', FOCUS)}>
              {busy === 'demo' ? 'Making a demo login…' : 'Request a 1-hour demo login'}
            </button>
          </div>
        </form>
      </main>
    </div>
  )
}
