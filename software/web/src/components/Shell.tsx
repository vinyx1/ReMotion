/*
  The dashboard's frame: a forest sidebar of patient files (paper folders; the open
  one holds that patient's sessions), a breadcrumb bar over the content, and on
  phones a compact top bar. A patient's own sub-views are tabs on the patient page.
*/
import { ChevronRight, FileText, Users } from 'lucide-react'
import { type ReactNode, useEffect, useRef, useState } from 'react'
import { timeLeft, useAccount } from '../lib/account'
import { href, type Route } from '../lib/route'
import type { Patient } from '../lib/patients'
import { cn } from '../lib/utils'
import type { Session } from '../types'
import { Avatar } from './Avatar'
import { WallFacets } from './WallFacets'

export interface Crumb { label: string; to?: Route }

const NAV_FOCUS = 'focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-plaster'
const FOLDER_FOCUS = 'focus-visible:outline-3 focus-visible:outline-offset-1 focus-visible:outline-eucalyptus'

function NavLink({ to, active, icon: Icon, children, sub }: {
  to: Route
  active: boolean
  icon: typeof Users
  children: ReactNode
  sub?: boolean
}) {
  return (
    <a
      href={href(to)}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex items-center gap-3 rounded-lg px-3 py-2 text-[15px] font-semibold transition-colors duration-150',
        sub && 'pl-4',
        active ? 'bg-plaster/12 text-plaster' : 'text-plaster/75 hover:bg-plaster/8 hover:text-plaster',
        NAV_FOCUS,
      )}
    >
      <Icon className="size-[18px] shrink-0" aria-hidden />
      {children}
    </a>
  )
}

/** Says whether the sessions are simulated or recorded, in plain words (not a chip). */
function DataChip({ simulated, className }: { simulated: boolean; className?: string }) {
  return (
    <span className={cn('text-[13px] font-bold text-plaster', className)}>
      {simulated ? 'Simulated data' : 'Recorded data'}
    </span>
  )
}

/** "Nov 21, 23:15 (session 2)" -> { d: "Nov 21", t: "23:15 (2)" }: short enough for one line (the link's aria-label keeps the full label). */
function when(s: Session) {
  const [d, t = ''] = s.label.split(', ')
  return { d, t: t.replace(/ \(session (\d+)\)$/, ' ($1)') }
}

/*
  A patient's file, drawn as a paper folder on the forest sidebar: a tab with their
  picture and name, a couple of sheets peeking out of the folder below the tab (never
  over it), and the sessions inside as files, newest first. The open folder is the
  patient you are looking at.
*/
function PatientFolder({ patient, sessions, route }: { patient: Patient; sessions: Session[]; route: Route }) {
  const files = [...sessions].reverse()
  const shown = files.slice(0, 7)
  const sid = route.name === 'session' || route.name === 'rep' ? route.sid : null
  const onPatient = route.name !== 'patients' && route.pid === patient.id
  return (
    <div data-open-folder className="relative mt-2">
      {/* the back of the folder, with its tab */}
      <a href={href({ name: 'overview', pid: patient.id })} aria-current={onPatient && route.name === 'overview' ? 'page' : undefined}
        className={cn('relative z-10 flex h-[38px] w-fit max-w-[92%] items-center gap-2 rounded-t-[10px] bg-folder pr-3 pl-1.5 text-forest', FOLDER_FOCUS)}>
        <Avatar patient={patient} size={26} />
        <span className="truncate text-[15px] font-bold">{patient.name}</span>
      </a>
      <span aria-hidden className="absolute inset-x-0 top-[37px] bottom-0 rounded-tr-[10px] rounded-b-[10px] bg-folder" />
      {/* the sheets inside: they rise out of the folder's mouth, under the tab line */}
      <span aria-hidden className="absolute top-[40px] right-2 left-[52%] h-8 rotate-[2.5deg] rounded-t-[3px] bg-plaster shadow-[0_-1px_2px_rgb(31_45_39/0.25)]" />
      <span aria-hidden className="absolute top-[46px] right-3 left-3 h-8 -rotate-[0.8deg] rounded-t-[3px] bg-panel shadow-[0_-1px_2px_rgb(31_45_39/0.25)]" />
      {/* the front of the folder, holding the session files */}
      <div className="relative mt-[16px] rounded-[10px] bg-wash px-1.5 pt-2 pb-1.5 text-forest shadow-[0_-1px_0_rgb(255_255_255/0.5)_inset,0_10px_22px_-14px_rgb(0_0_0/0.6)]">
        <p className="px-2 pt-0.5 pb-2 text-[13px] text-forest-2">{sessionLine(sessions)}</p>
        {sessions.length === 0 ? (
          <p className="px-2 pb-1.5 text-[13px] text-forest-2">No sessions yet.</p>
        ) : (
          <ul aria-label={`${patient.name}'s sessions`} className="flex flex-col border-t border-wall pt-1">
            {shown.map((s) => {
              const w = when(s)
              const active = sid === s.id
              const n = s.summary.compensated
              return (
                <li key={s.id}>
                  <a href={href({ name: 'session', pid: patient.id, sid: s.id })} aria-current={active ? 'page' : undefined}
                    aria-label={`${s.label}: ${n} of ${s.summary.reps} reps compensated`}
                    className={cn('flex items-center gap-2 rounded-md px-2 py-1.5 text-[14px] transition-colors duration-150',
                      active ? 'bg-panel font-bold shadow-[0_1px_2px_rgb(31_45_39/0.18)]' : 'hover:bg-panel/70', FOLDER_FOCUS)}>
                    <FileText className="size-3.5 shrink-0 text-forest-2" aria-hidden />
                    <span className="font-readout whitespace-nowrap tabular-nums">{w.d}</span>
                    <span className="font-readout whitespace-nowrap text-forest-2 tabular-nums">{w.t}</span>
                    <span className="ml-auto inline-flex items-center gap-1 font-readout text-[13px] tabular-nums">
                      <svg className="size-2.5" viewBox="0 0 10 10" aria-hidden>
                        {n > 0
                          ? <path d="M5 0.5L9.5 5L5 9.5L0.5 5Z" fill="var(--color-terra)" />
                          : <circle cx="5" cy="5" r="3.6" fill="none" stroke="var(--color-forest)" strokeWidth="1.4" />}
                      </svg>
                      {n}/{s.summary.reps}
                    </span>
                  </a>
                </li>
              )
            })}
          </ul>
        )}
        {files.length > shown.length && (
          <a href={href({ name: 'sessions', pid: patient.id })}
            className={cn('mt-0.5 block rounded-md px-2 py-1.5 text-[13px] font-bold text-eucalyptus underline underline-offset-4', FOLDER_FOCUS)}>
            All {files.length} sessions
          </a>
        )}
      </div>
    </div>
  )
}

/** "8 sessions · last Nov 18": what is in a patient's file, in one line. */
function sessionLine(sessions: Session[]) {
  const last = sessions[sessions.length - 1]
  const count = `${sessions.length} ${sessions.length === 1 ? 'session' : 'sessions'}`
  return last ? `${count} · last ${when(last).d}` : count
}

/*
  Another patient's file, closed: the folder face as one solid card (no tab stub),
  with their picture, name, and what is in the file.
*/
function ClosedFolder({ patient, sessions }: { patient: Patient; sessions: Session[] }) {
  return (
    <a href={href({ name: 'overview', pid: patient.id })}
      className={cn('mt-2 flex items-center gap-3 rounded-[10px] bg-folder-shut px-2.5 py-2 text-plaster transition-colors duration-150 hover:bg-folder-shut-hi', NAV_FOCUS)}>
      <Avatar patient={patient} size={34} />
      <span className="min-w-0">
        <span className="block truncate text-[15px] font-bold">{patient.name}</span>
        <span className="block truncate text-[13px] text-plaster/65 tabular-nums">{sessionLine(sessions)}</span>
      </span>
    </a>
  )
}

/** Now, updated every 20 s: enough for a countdown in minutes. */
function useNow(every = 20_000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), every); return () => clearInterval(t) }, [every])
  return now
}

const ACCOUNT_BTN = 'inline-flex h-10 cursor-pointer items-center justify-center rounded-lg border border-plaster/30 px-3 text-[14px] font-bold text-plaster transition-colors duration-150 hover:border-plaster/60 hover:bg-plaster/10'

/**
  Who's signed in, at the foot of the sidebar. A demo shows how long it has left and
  End demo (deletes it now, for the next visitor at the table); the owner, Sign out.
*/
function AccountBlock() {
  const { me, signOut, endDemo } = useAccount()
  const now = useNow()
  const demo = me.kind === 'demo' && me.expiresAt !== null
  return (
    <div className="flex flex-col gap-2.5">
      <p className="min-w-0">
        <span className="block text-[12px] font-bold text-plaster/60">{demo ? 'Demo account' : 'Signed in as'}</span>
        <span className="block truncate text-[14px] font-bold text-plaster" title={me.email}>{me.email}</span>
        {demo && <span className="block text-[13px] text-plaster/75 tabular-nums">Deleted in {timeLeft(me.expiresAt!, now)}</span>}
      </p>
      {demo
        ? <button type="button" onClick={endDemo} className={cn(ACCOUNT_BTN, NAV_FOCUS)}>End demo</button>
        : <button type="button" onClick={signOut} className={cn(ACCOUNT_BTN, NAV_FOCUS)}>Sign out</button>}
    </div>
  )
}

function Sidebar({ route, patients, patient, sessionsFor }: { route: Route; patients: Patient[]; patient?: Patient; sessionsFor: (p: Patient) => Session[] }) {
  const nav = useRef<HTMLElement>(null)
  const openId = patient && route.name !== 'patients' ? patient.id : null

  /*
    Opening a patient brings their folder into view in the list, top first, if it's out of
    sight; one already in view stays put. Only the list scrolls, never the page (the sidebar
    is sticky); smooth unless the reader asked for reduced motion.
  */
  useEffect(() => {
    const list = nav.current
    const folder = list?.querySelector<HTMLElement>('[data-open-folder]')
    if (!list || !folder || !openId) return
    const l = list.getBoundingClientRect(), f = folder.getBoundingClientRect()
    if (f.top >= l.top && f.bottom <= l.bottom) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    list.scrollTo({ top: list.scrollTop + (f.top - l.top) - 8, behavior: reduce ? 'auto' : 'smooth' })
  }, [openId])

  return (
    <aside className="sticky top-0 hidden h-dvh w-[17rem] shrink-0 flex-col bg-forest text-plaster lg:flex">
      <div className="px-5 pt-5 pb-6">
        <a href="/" className={cn('rounded-md font-display text-[1.45rem] font-semibold tracking-[-0.02em]', NAV_FOCUS)}>Re:Motion</a>
      </div>
      <nav ref={nav} aria-label="Patients" className="scroll-quiet flex flex-1 flex-col gap-1 overflow-y-auto px-3 pb-4">
        <NavLink to={{ name: 'patients' }} active={route.name === 'patients'} icon={Users}>All patients</NavLink>
        <p className="mt-5 mb-1 px-3 text-[13px] font-bold text-plaster/60">Patient files · {patients.length}</p>
        {patients.map((p) => (
          patient && route.name !== 'patients' && p.id === patient.id
            ? <PatientFolder key={p.id} patient={p} sessions={sessionsFor(p)} route={route} />
            : <ClosedFolder key={p.id} patient={p} sessions={sessionsFor(p)} />
        ))}
      </nav>
      <div className="flex flex-col gap-4 border-t border-plaster/15 px-5 py-4 text-[13px] text-plaster/75">
        <AccountBlock />
        <p>{patient && sessionsFor(patient).length > 0 && <><DataChip simulated={patient.simulated} /> · </>}Chest and wrist sensors, 100 Hz</p>
      </div>
    </aside>
  )
}

/** The small screen's version: the demo's time left and End demo, or Sign out. */
function MobileAccount() {
  const { me, signOut, endDemo } = useAccount()
  const now = useNow()
  const demo = me.kind === 'demo' && me.expiresAt !== null
  return (
    <div className="ml-auto flex shrink-0 items-center gap-2">
      {demo && <span className="text-[13px] text-plaster/75 tabular-nums">{timeLeft(me.expiresAt!, now)} left</span>}
      <button type="button" onClick={demo ? endDemo : signOut} className={cn(ACCOUNT_BTN, 'h-9', NAV_FOCUS)}>{demo ? 'End demo' : 'Sign out'}</button>
    </div>
  )
}

function MobileBar({ route }: { route: Route }) {
  return (
    <div className="flex items-center gap-3 bg-forest px-4 py-3 text-plaster lg:hidden">
      <a href="/" className={cn('shrink-0 rounded-md font-display text-[1.2rem] font-semibold tracking-[-0.02em]', NAV_FOCUS)}>Re:Motion</a>
      <a href={href({ name: 'patients' })} aria-current={route.name === 'patients' ? 'page' : undefined}
        className={cn('inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-semibold text-plaster/85 hover:text-plaster', NAV_FOCUS)}>
        <Users className="size-4" aria-hidden /> Patients
      </a>
      <MobileAccount />
    </div>
  )
}

/** Breadcrumbs, set on the wall: forest ink only (the Stage Ink Rule). */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="min-w-0">
      <ol className="flex flex-wrap items-center gap-1.5 text-[15px] text-forest">
        {items.map((c, i) => (
          <li key={i} className="flex min-w-0 items-center gap-1.5">
            {i > 0 && <ChevronRight className="size-4 shrink-0 text-forest/45" aria-hidden />}
            {c.to && i < items.length - 1 ? (
              <a href={href(c.to)} className="truncate rounded underline decoration-forest/30 underline-offset-4 hover:decoration-forest focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-forest">{c.label}</a>
            ) : (
              <span aria-current={i === items.length - 1 ? 'page' : undefined} className={cn('truncate', i === items.length - 1 && 'font-bold')}>{c.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}

export function Shell({ route, patients, patient, crumbs, sessionsFor, header, mood, children }: {
  route: Route
  patients: Patient[]
  /** the patient in view; none when the account has no patients */
  patient?: Patient
  crumbs: Crumb[]
  sessionsFor: (p: Patient) => Session[]
  /** What hangs on the wall: the page or patient header, ending on the horizon. */
  header?: ReactNode
  /** Light the wall: warm (terracotta) when the patient is leaning more, cool (lake blue) when leaning less. */
  mood?: 'warm' | 'cool'
  children: ReactNode
}) {
  return (
    <div className="flex min-h-dvh">
      <Sidebar route={route} patients={patients} patient={patient} sessionsFor={sessionsFor} />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileBar route={route} />
        {/* the wall: the page's header, painted like the landing page's room, meeting the floor at a horizon */}
        <header className={cn('dash-wall', mood === 'warm' && 'is-warm', mood === 'cool' && 'is-cool')}>
          <WallFacets />
          <div className="mx-auto max-w-[1240px] px-5 pt-4 sm:px-8 sm:pt-5">
            <Breadcrumbs items={crumbs} />
            {header}
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1240px] flex-1 px-5 pt-8 pb-16 sm:px-8">{children}</main>
        {patient?.simulated && (
          <footer className="mx-auto w-full max-w-[1240px] px-5 pb-8 sm:px-8">
            <p className="border-t border-wall pt-4 text-sm text-forest-2">
              <span className="font-bold text-forest">Simulated data.</span> These sessions were generated to build and test the
              dashboard. They are not recordings of a person.
            </p>
          </footer>
        )}
      </div>
    </div>
  )
}
