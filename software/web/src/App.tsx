/*
  The therapist dashboard (/dashboard), built from public/sessions.json.

  A clinic-style frame: a sidebar that lists the patients, and a page per patient
  with sub-views (Overview, Sessions, Rep replay, Profile & settings). Sessions and
  reps open on their own pages. Where you are lives in the URL hash (lib/route.ts).
  The look is Rehab Studio (DESIGN.md) at working density.
*/
import { useEffect, useState } from 'react'
import { PatientHeader } from './components/PatientHeader'
import { Overview } from './components/Overview'
import { PatientsHeader, PatientsPage, ProfilePage } from './components/Pages'
import { RepDetail } from './components/RepDetail'
import { SessionDetail, SessionPlates, SessionTable } from './components/Sessions'
import { type Crumb, Shell } from './components/Shell'
import { patientsFrom, sessionsOf } from './lib/patients'
import { go, type Route, useRoute } from './lib/route'
import { trendOf } from './lib/stats'
import type { SessionsFile } from './types'

type Load = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; data: SessionsFile }

function useSessions(): Load {
  const [state, setState] = useState<Load>({ status: 'loading' })
  useEffect(() => {
    fetch('/sessions.json', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data: SessionsFile) => setState({ status: 'ready', data }))
      .catch((e: Error) => setState({ status: 'error', message: e.message }))
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
  const sessions = sessionsOf(patient, all)
  const pid = patient.id
  const crumbs: Crumb[] = [{ label: 'Patients', to: { name: 'patients' } }]

  if (route.name === 'patients') {
    return (
      <Shell route={route} patients={patients} patient={patient} crumbs={crumbs} sessionsFor={(p) => sessionsOf(p, all)}
        header={<PatientsHeader count={patients.length} />}>
        <PatientsPage patients={patients} sessionsFor={(p) => sessionsOf(p, all)} />
      </Shell>
    )
  }

  crumbs.push({ label: patient.name, to: { name: 'overview', pid } })
  const openSession = (sid: string) => go({ name: 'session', pid, sid })
  const openRep = (sid: string, rep: number) => go({ name: 'rep', pid, sid, rep })

  if (!sessions.length) {
    return (
      <Shell route={route} patients={patients} patient={patient} crumbs={crumbs} sessionsFor={(p) => sessionsOf(p, all)}
        header={<PatientHeader patient={patient} sessions={sessions} section="overview" />}>
        <div className="py-16 text-center">
          <h2 className="font-display text-2xl font-medium">No sessions yet</h2>
          <p className="mt-2 text-[17px] text-forest-2">
            Record one with <code className={code}>python -m software.tools.logger</code>, then run{' '}
            <code className={code}>python -m software.dashboard.export</code> and reload.
          </p>
        </div>
      </Shell>
    )
  }

  const last = sessions[sessions.length - 1]
  let section = 'overview'
  let body: React.ReactNode

  switch (route.name) {
    case 'overview':
      body = <Overview sessions={sessions} pid={pid} onOpenSession={openSession} onOpenRep={openRep} />
      break
    case 'sessions':
      section = 'sessions'
      crumbs.push({ label: 'Sessions' })
      body = (
        <div className="flex flex-col gap-4">
          <p className="text-[17px] text-forest-2">{sessions.length} sessions, newest first. Select one to open it.</p>
          <SessionTable sessions={sessions} onPick={openSession} />
        </div>
      )
      break
    case 'session': {
      section = 'sessions'
      const i = Math.max(0, sessions.findIndex((s) => s.id === route.sid))
      const s = sessions[i]
      crumbs.push({ label: 'Sessions', to: { name: 'sessions', pid } }, { label: s.label })
      body = <SessionDetail session={s} prev={sessions[i - 1]} next={sessions[i + 1]} onGo={openSession} onOpenRep={(n) => openRep(s.id, n)} />
      break
    }
    case 'rep':
    case 'replay': {
      section = 'replay'
      const sid = route.name === 'rep' ? route.sid : last.id
      const s = sessions.find((x) => x.id === sid) ?? last
      const repN = route.name === 'rep' ? route.rep : null
      crumbs.push({ label: 'Sessions', to: { name: 'sessions', pid } }, { label: s.label, to: { name: 'session', pid, sid: s.id } }, { label: 'Rep replay' })
      body = (
        <RepDetail sessions={sessions} sessionId={s.id} repN={repN}
          onPick={(id, n) => go({ name: 'rep', pid, sid: id, rep: n < 0 ? null : n } as Route)} />
      )
      break
    }
    case 'profile':
      section = 'profile'
      crumbs.push({ label: 'Profile & settings' })
      body = <ProfilePage patient={patient} sessions={sessions} />
      break
  }

  // what hangs on the wall besides the patient: one session's numbers, on a session's page
  const shown = route.name === 'session' ? sessions.find((x) => x.id === route.sid) ?? sessions[0] : null
  const plates = shown ? <SessionPlates session={shown} /> : undefined

  return (
    <Shell route={route} patients={patients} patient={patient} crumbs={crumbs} sessionsFor={(p) => sessionsOf(p, all)}
      mood={trendOf(sessions) === 'worsening' ? 'warm' : trendOf(sessions) === 'improving' ? 'cool' : undefined}
      header={
        <PatientHeader patient={patient} sessions={sessions} section={section}
          plates={plates} />
      }>
      {body}
    </Shell>
  )
}
