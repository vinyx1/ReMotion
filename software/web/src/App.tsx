/*
  The therapist dashboard (/dashboard), built from public/sessions.json.

  A clinic-style frame: a sidebar that lists the patients, and a page per patient
  with sub-views (Overview, Sessions, Rep replay, Profile & settings). Sessions and
  reps open on their own pages. Where you are lives in the URL hash (lib/route.ts).
  The look is Rehab Studio (DESIGN.md) at working density.
*/
import { useEffect, useState } from 'react'
import { PatientHeader } from './components/PatientHeader'
import { AllExercises, Overview } from './components/Overview'
import { PatientsHeader, PatientsPage, ProfilePage } from './components/Pages'
import { RepDetail } from './components/RepDetail'
import { SessionDetail, SessionPlates, SessionTable } from './components/Sessions'
import { type Crumb, Shell } from './components/Shell'
import { EXERCISES, exerciseOf } from './lib/exercises'
import { patientsFrom, sessionsOf } from './lib/patients'
import { go, type Route, useRoute } from './lib/route'
import { trendOf } from './lib/stats'
import type { ExerciseId, SessionsFile } from './types'

type Load = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; data: SessionsFile }

/*
  sessions.json, read again every 5 s while the page is visible, so a session the phone app
  is recording (server/phone.ts re-exports after each rep) shows up without a reload. The
  page only re-renders when the file changed.
*/
const POLL_MS = 5000

function useSessions(): Load {
  const [state, setState] = useState<Load>({ status: 'loading' })
  useEffect(() => {
    let alive = true
    let last: string | undefined      // the file as last read ("generated" alone only has whole seconds)
    const read = (first: boolean) =>
      fetch('/sessions.json', { cache: 'no-store' })
        .then((r) => (r.ok ? r.text() : Promise.reject(new Error(`HTTP ${r.status}`))))
        .then((text) => {
          if (!alive || text === last) return
          last = text
          setState({ status: 'ready', data: JSON.parse(text) as SessionsFile })
        })
        .catch((e: Error) => { if (alive && first) setState({ status: 'error', message: e.message }) })
    void read(true)
    const timer = setInterval(() => { if (document.visibilityState === 'visible') void read(false) }, POLL_MS)
    return () => { alive = false; clearInterval(timer) }
  }, [])
  return state
}

function Message({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <div className="bg-forest px-5 py-4 text-plaster sm:px-8">
        <a href="/" className="font-display text-[1.45rem] font-semibold tracking-[-0.02em]">Re:Motion</a>
      </div>
      <main className="mx-auto flex max-w-lg flex-col items-center px-6 pt-32 text-center">
        <h1 className="font-display text-2xl font-medium">{title}</h1>
        <div className="mt-3 text-[17px] text-pretty text-forest-2">{children}</div>
      </main>
    </div>
  )
}

const code = 'rounded bg-wash px-1.5 py-0.5 font-readout text-[15px] text-forest'

export default function App() {
  const load = useSessions()
  const all = load.status === 'ready' ? load.data.sessions : []
  const patients = patientsFrom(all)
  const route = useRoute(patients[0].id)
  useEffect(() => { document.title = 'Re:Motion dashboard' }, [])

  if (load.status === 'loading') {
    return <Message title="Loading sessions…"><p role="status">Reading sessions.json.</p></Message>
  }
  if (load.status === 'error') {
    return (
      <Message title="The sessions couldn't be loaded">
        <p>The dashboard reads <code className={code}>sessions.json</code> and got an error ({load.message}).</p>
        <p className="mt-2">From the repo root, run <code className={code}>python -m software.dashboard.export</code>, then reload this page.</p>
      </Message>
    )
  }

  const patient = patients.find((p) => route.name !== 'patients' && p.id === route.pid) ?? patients[0]
  const pid = patient.id
  const sessionsFor = (p: typeof patient) => sessionsOf(p, all)
  const crumbs: Crumb[] = [{ label: 'Patients', to: { name: 'patients' } }]

  if (route.name === 'patients') {
    return (
      <Shell route={route} patients={patients} patient={patient} crumbs={crumbs} sessionsFor={sessionsFor}
        header={<PatientsHeader count={patients.length} />}>
        <PatientsPage patients={patients} sessionsFor={sessionsFor} />
      </Shell>
    )
  }

  crumbs.push({ label: patient.name, to: { name: 'overview', pid } })
  const openSession = (sid: string) => go({ name: 'session', pid, sid })
  const openRep = (sid: string, rep: number) => go({ name: 'rep', pid, sid, rep })
  const everything = sessionsOf(patient, all)

  if (!everything.length) {
    return (
      <Shell route={route} patients={patients} patient={patient} crumbs={crumbs} sessionsFor={sessionsFor}
        header={<PatientHeader patient={patient} sessions={everything} section="overview" />}>
        <div className="py-16 text-center">
          <h2 className="font-display text-2xl font-medium">No sessions yet</h2>
          <p className="mt-2 text-[17px] text-pretty text-forest-2">
            {patient.id === 'vincent'
              ? 'Start a session in the ReMotion phone app. Each rep shows up here a few seconds after it ends.'
              : <>Record one with <code className={code}>python -m software.tools.logger</code>, then run{' '}
                <code className={code}>python -m software.dashboard.export</code> and reload.</>}
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
