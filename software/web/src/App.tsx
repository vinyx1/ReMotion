/*
  The therapist dashboard (/dashboard): sign in (components/SignIn.tsx), then the signed-in
  account's patients and sessions from the API (server/api.ts).

  A clinic-style frame: a sidebar that lists the patients, and a page per patient
  with sub-views (Overview, Sessions, Rep replay, Profile & settings). Sessions and
  reps open on their own pages. Where you are lives in the URL hash (lib/route.ts).
  The look is Rehab Studio (DESIGN.md) at working density.
*/
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader } from './components/Loader'
import { SignIn } from './components/SignIn'
import { AccountContext, type AccountApi, ApiError, endDemo, getMe, type Me, signOut } from './lib/account'
import { PatientHeader } from './components/PatientHeader'
import { AllExercises, Overview } from './components/Overview'
import { PatientsHeader, PatientsPage, ProfilePage } from './components/Pages'
import { RepDetail } from './components/RepDetail'
import { SessionDetail, SessionPlates, SessionTable } from './components/Sessions'
import { type Crumb, Shell } from './components/Shell'
import { EXERCISES, exerciseOf } from './lib/exercises'
import { type Patient, patientsFrom, sessionsOf } from './lib/patients'
import { go, href, type Route, useRoute } from './lib/route'
import { trendOf } from './lib/stats'
import type { ExerciseId, SessionsFile } from './types'

type Load = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; data: SessionsFile }

/*
  The account's sessions, read again every 5 s while the page is visible, so a session the
  phone app is recording (server/phone.ts re-exports after each rep) shows up without a
  reload. The page only re-renders when the file changed. A 401 means the sign-in ended
  (a demo's hour is up): onSignedOut.
*/
const POLL_MS = 5000

function useSessions(onSignedOut: () => void, version: number): Load {
  const [state, setState] = useState<Load>({ status: 'loading' })
  useEffect(() => {
    let alive = true
    let last: string | undefined      // the file as last read ("generated" alone only has whole seconds)
    const read = (first: boolean) =>
      fetch('/api/sessions', { cache: 'no-store' })
        .then((r) => {
          if (r.status === 401) { if (alive) onSignedOut(); return null }
          return r.ok ? r.text() : Promise.reject(new Error(`HTTP ${r.status}`))
        })
        .then((text) => {
          if (!alive || text === null || text === last) return
          last = text
          setState({ status: 'ready', data: JSON.parse(text) as SessionsFile })
        })
        .catch((e: Error) => { if (alive && first) setState({ status: 'error', message: e.message }) })
    void read(true)
    const timer = setInterval(() => { if (document.visibilityState === 'visible') void read(false) }, POLL_MS)
    return () => { alive = false; clearInterval(timer) }
  }, [onSignedOut, version])          // a new version (a patient deleted) reads straight away
  return state
}

type Auth = { status: 'checking' } | { status: 'out'; note?: string } | { status: 'in'; me: Me } | { status: 'error'; message: string }

const DEMO_OVER = 'Your demo has ended.'

/** Who's signed in decides what shows: the sign-in page, or the dashboard of their account. */
export default function App() {
  const [auth, setAuth] = useState<Auth>({ status: 'checking' })
  const [version, setVersion] = useState(0)          // bumped after a change, so the sessions are read again now
  useEffect(() => {
    getMe().then((me) => setAuth({ status: 'in', me }))
      .catch((e) => setAuth(e instanceof ApiError && e.status === 401 ? { status: 'out' } : { status: 'error', message: e.message }))
  }, [])

  const me = auth.status === 'in' ? auth.me : null
  const ended = useCallback(() => setAuth({ status: 'out', note: me?.kind === 'demo' ? DEMO_OVER : 'You’ve been signed out.' }), [me?.kind])

  // a demo signs out by itself when its hour is up, even with the page left open
  useEffect(() => {
    if (!me?.expiresAt) return
    const t = setTimeout(ended, Math.max(0, me.expiresAt - Date.now()) + 1000)
    return () => clearTimeout(t)
  }, [me?.expiresAt, ended])

  const account = useMemo<AccountApi | null>(() => me && ({
    me,
    refresh: async () => { const fresh = await getMe(); setAuth({ status: 'in', me: fresh }); setVersion((v) => v + 1) },
    signOut: () => { void signOut().finally(() => { location.hash = ''; setAuth({ status: 'out' }) }) },
    endDemo: () => { void endDemo().finally(() => { location.hash = ''; setAuth({ status: 'out', note: 'Demo ended and deleted.' }) }) },
  }), [me])

  if (auth.status === 'checking') return <Loader label="Checking who’s signed in" />
  if (auth.status === 'error') {
    return <Message title="The dashboard couldn’t start"><p>The server answered with an error ({auth.message}). Reload the page to try again.</p></Message>
  }
  if (auth.status === 'out' || !account) return <SignIn note={auth.status === 'out' ? auth.note : undefined} onSignedIn={(m) => setAuth({ status: 'in', me: m })} />
  return (
    <AccountContext.Provider value={account}>
      <Dashboard me={account.me} onSignedOut={ended} version={version} />
    </AccountContext.Provider>
  )
}

function Message({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <div className="bg-forest px-5 py-4 text-plaster sm:px-8">
        <a href="/" className="font-display text-[1.45rem] font-semibold tracking-[-0.02em]">ReMotion</a>
      </div>
      <main className="mx-auto flex max-w-lg flex-col items-center px-6 pt-32 text-center">
        <h1 className="font-display text-2xl font-medium">{title}</h1>
        <div className="mt-3 text-[17px] text-pretty text-forest-2">{children}</div>
      </main>
    </div>
  )
}


function Dashboard({ me, onSignedOut, version }: { me: Me; onSignedOut: () => void; version: number }) {
  useEffect(() => { document.title = 'ReMotion dashboard' }, [])
  const load = useSessions(onSignedOut, version)
  const all = load.status === 'ready' ? load.data.sessions : []
  const patients = patientsFrom(all, me.patients)
  const route = useRoute()

  if (load.status === 'loading') {
    return <Message title="Loading sessions…"><p role="status">Reading this account’s sessions.</p></Message>
  }
  if (load.status === 'error') {
    return (
      <Message title="The sessions couldn't be loaded">
        <p>The server answered with an error ({load.message}). Reload the page to try again.</p>
      </Message>
    )
  }

  const patient = patients.find((p) => route.name !== 'patients' && p.id === route.pid) ?? patients[0]
  const sessionsFor = (p: Patient) => sessionsOf(p, all)
  const crumbs: Crumb[] = [{ label: 'Patients', to: { name: 'patients' } }]

  // the patients page, and the only page there is while an account has no patients
  if (route.name === 'patients' || !patient) {
    return (
      <Shell route={route} patients={patients} patient={patient} crumbs={crumbs} sessionsFor={sessionsFor}
        header={<PatientsHeader count={patients.length} />}>
        <PatientsPage patients={patients} sessionsFor={sessionsFor} />
      </Shell>
    )
  }

  const pid = patient.id
  crumbs.push({ label: patient.name, to: { name: 'overview', pid } })
  const openSession = (sid: string) => go({ name: 'session', pid, sid })
  const openRep = (sid: string, rep: number) => go({ name: 'rep', pid, sid, rep })
  const everything = sessionsOf(patient, all)

  // nothing recorded yet: every page says so, except Profile & settings, where the phone gets connected
  if (!everything.length && route.name !== 'profile') {
    return (
      <Shell route={route} patients={patients} patient={patient} crumbs={crumbs} sessionsFor={sessionsFor}
        header={<PatientHeader patient={patient} sessions={everything} section="overview" />}>
        <div className="py-16 text-center">
          <h2 className="font-display text-2xl font-medium">No sessions yet</h2>
          <p className="mx-auto mt-2 max-w-[46ch] text-[17px] text-pretty text-forest-2">
            Connect {patient.name.split(' ')[0]}’s phone from{' '}
            <a href={href({ name: 'profile', pid })} className="font-bold text-forest underline decoration-forest/30 underline-offset-4 hover:decoration-forest">Profile &amp; settings</a>,
            then start a session on the mat. Each rep shows up here a few seconds after it ends.
          </p>
        </div>
      </Shell>
    )
  }

  /*
    The exercise in view: an exercise tab's own; on a page about one session (or one
    of its reps) that session's; none on the overview, the sessions list and the
    profile, which cover every exercise.
  */
  const latest = everything[everything.length - 1]
  const routeSid = route.name === 'session' || route.name === 'rep' ? route.sid : null
  const routeSession = routeSid ? everything.find((s) => s.id === routeSid) ?? latest : undefined
  const exercise: ExerciseId | undefined =
    route.name === 'exercise' ? (patient.exercises.includes(route.exercise) ? route.exercise : patient.exercises[0])
      : routeSession ? exerciseOf(routeSession)
        : route.name === 'replay' ? exerciseOf(latest)
          : undefined
  const sessions = exercise ? everything.filter((s) => exerciseOf(s) === exercise) : everything
  const last = sessions[sessions.length - 1]
  const exerciseCrumb: Crumb | null = exercise ? { label: EXERCISES[exercise].short, to: { name: 'exercise', pid, exercise } } : null
  // inside an exercise the header shows that exercise's own tabs (Overview, Sessions, Rep replay)
  let section = 'overview'
  let body: React.ReactNode

  switch (route.name) {
    case 'overview':
      body = <AllExercises patient={patient} sessions={everything} />
      break
    case 'exercise': {
      const view = route.view ?? 'overview'
      section = view
      if (view === 'overview') {
        crumbs.push({ label: EXERCISES[exercise!].short })
        body = <Overview sessions={sessions} pid={pid} onOpenSession={openSession} onOpenRep={openRep} />
      } else if (view === 'sessions') {
        crumbs.push(exerciseCrumb!, { label: 'Sessions' })
        body = <SessionTable sessions={sessions} onPick={openSession} />
      } else {
        crumbs.push(exerciseCrumb!, { label: last.label, to: { name: 'session', pid, sid: last.id } }, { label: 'Rep replay' })
        body = (
          <RepDetail sessions={sessions} sessionId={last.id} repN={null}
            onPick={(id, n) => go({ name: 'rep', pid, sid: id, rep: n < 0 ? null : n } as Route)} />
        )
      }
      break
    }
    case 'sessions':
      section = 'sessions'
      crumbs.push({ label: 'Sessions' })
      body = <SessionTable sessions={everything} onPick={openSession} />
      break
    case 'session': {
      section = 'sessions'
      const i = Math.max(0, sessions.findIndex((s) => s.id === routeSession!.id))
      const s = sessions[i]
      crumbs.push(exerciseCrumb!, { label: 'Sessions', to: { name: 'exercise', pid, exercise: exercise!, view: 'sessions' } }, { label: s.label })
      body = <SessionDetail session={s} prev={sessions[i - 1]} next={sessions[i + 1]} onGo={openSession} onOpenRep={(n) => openRep(s.id, n)} />
      break
    }
    case 'rep':
    case 'replay': {
      section = 'replay'
      const s = routeSession ?? last
      const repN = route.name === 'rep' ? route.rep : null
      crumbs.push(exerciseCrumb!, { label: s.label, to: { name: 'session', pid, sid: s.id } }, { label: 'Rep replay' })
      body = (
        <RepDetail sessions={sessions} sessionId={s.id} repN={repN}
          onPick={(id, n) => go({ name: 'rep', pid, sid: id, rep: n < 0 ? null : n } as Route)} />
      )
      break
    }
    case 'profile':
      section = 'profile'
      crumbs.push({ label: 'Profile & settings' })
      body = <ProfilePage patient={patient} sessions={everything} />
      break
  }

  // what hangs on the wall besides the patient: one session's numbers, on a session's page
  const plates = route.name === 'session' && routeSession ? <SessionPlates session={routeSession} /> : undefined
  const trend = exercise ? trendOf(sessions) : null

  return (
    <Shell route={route} patients={patients} patient={patient} crumbs={crumbs} sessionsFor={sessionsFor}
      mood={trend === 'worsening' ? 'warm' : trend === 'improving' ? 'cool' : undefined}
      header={<PatientHeader patient={patient} sessions={sessions} section={section} plates={plates} exercise={exercise} />}>
      {body}
    </Shell>
  )
}
