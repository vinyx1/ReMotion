/*
  The pages that came with patient profiles: the patient list and the profile page.
*/
import { Plus } from 'lucide-react'
import { Popover } from 'radix-ui'
import { day, pct, TARGET_NAME, TARGET_REACH, TARGETS } from '../lib/stats'
import { href } from '../lib/route'
import type { Patient } from '../lib/patients'
import { cn } from '../lib/utils'
import type { Session } from '../types'
import { TrendPill } from './PatientHeader'
import { FOCUS, Panel, PanelTitle } from './ui'

const TH = 'px-3 py-2.5 text-left text-sm font-bold text-forest-2 whitespace-nowrap'
const TD = 'px-3 py-3 font-readout tabular-nums whitespace-nowrap'

/* ---------- all patients ---------- */

function AddPatient() {
  return (
    <Popover.Root>
      <Popover.Trigger className={cn('inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg bg-forest px-4 text-[15px] font-semibold text-plaster transition-colors duration-150 hover:bg-forest-deep', FOCUS)}>
        <Plus className="size-4" aria-hidden /> Add patient
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="end" sideOffset={8}
          className="z-50 w-80 rounded-xl border border-wall bg-panel p-4 font-text text-[15px] text-forest shadow-[0_2px_4px_rgb(31_45_39/0.08),0_14px_32px_-18px_rgb(31_45_39/0.5)]">
          <p className="font-bold">Patient profiles are coming</p>
          <p className="mt-1.5 text-forest-2">
            The patients here are simulated. Adding a real patient arrives with the logger update that records who did
            each session.
          </p>
          <Popover.Close className={cn('mt-3 cursor-pointer rounded-md text-sm font-bold text-eucalyptus underline underline-offset-4', FOCUS)}>Got it</Popover.Close>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

/** The Patients page's header, hung on the wall. */
export function PatientsHeader({ count }: { count: number }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 pt-6 pb-8 sm:pt-8 sm:pb-10">
      <div>
        <h1 className="font-display text-[1.75rem] leading-tight font-medium tracking-[-0.02em] sm:text-[2.5rem]">Patients</h1>
        <p className="mt-1 text-[17px] text-forest">{count} {count === 1 ? 'patient file' : 'patient files'}, newest activity first.</p>
      </div>
      <AddPatient />
    </div>
  )
}

export function PatientsPage({ patients, sessionsFor }: { patients: Patient[]; sessionsFor: (p: Patient) => Session[] }) {
  return (
    <div className="flex flex-col gap-6">
      <Panel label="Patients" className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[15px]">
            <caption className="sr-only">Patients. Select a patient to open their overview.</caption>
            <thead className="border-b border-wall">
              <tr>
                <th scope="col" className={cn(TH, 'pl-5')}>Patient</th>
                <th scope="col" className={TH}>Exercise</th>
                <th scope="col" className={TH}>Trend</th>
                <th scope="col" className={cn(TH, 'text-right')}>Compensated, latest</th>
                <th scope="col" className={cn(TH, 'text-right')}>Sessions</th>
                <th scope="col" className={cn(TH, 'pr-5')}>Last session</th>
              </tr>
            </thead>
            <tbody>
              {patients.map((p) => {
                const ss = sessionsFor(p)
                const last = ss[ss.length - 1]
                return (
                  <tr key={p.id} className="border-b border-wall/70 last:border-0 hover:bg-wash/60">
                    <td className="py-2 pl-3">
                      <a href={href({ name: 'overview', pid: p.id })} className={cn('flex items-center gap-3 rounded-md px-2 py-1', FOCUS)}>
                        <span className="font-bold underline decoration-wall underline-offset-4 hover:decoration-forest">{p.name}</span>
                      </a>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">{p.exercise}</td>
                    <td className="px-3 py-3"><TrendPill sessions={ss} /></td>
                    <td className={cn(TD, 'text-right')}>{last ? `${Math.round(pct(last))}%` : '—'}</td>
                    <td className={cn(TD, 'text-right')}>{ss.length}</td>
                    <td className={cn(TD, 'pr-5')}>{last ? last.label : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  )
}

/* ---------- profile & settings ---------- */

function Field({ label, children, mono }: { label: string; children: React.ReactNode; mono?: boolean }) {
  return (
    <div className="grid gap-1 border-b border-wall/70 py-3.5 last:border-0 sm:grid-cols-[10rem_1fr] sm:gap-6">
      <dt className="text-[15px] font-bold text-forest-2">{label}</dt>
      <dd className={cn('text-[15px]', mono && 'font-readout tabular-nums')}>{children}</dd>
    </div>
  )
}

export function ProfilePage({ patient, sessions }: { patient: Patient; sessions: Session[] }) {
  const first = sessions[0], last = sessions[sessions.length - 1]
  const limits = [...new Set(sessions.map((s) => s.thresholdDeg))]
  return (
    <div className="grid items-start gap-4 xl:grid-cols-2">
      <Panel label="Patient" className="p-5 sm:p-6">
        <PanelTitle as="h2" title="Patient" caption="Editing these arrives with patient profiles." />
        <dl className="mt-3">
          <Field label="Name">{patient.name}</Field>
          <Field label="Patient ID" mono>{patient.id}</Field>
          <Field label="Data">{patient.simulated ? 'Simulated: generated to build and test the dashboard' : 'Recorded with the Re:Motion logger'}</Field>
          <Field label="Sessions recorded" mono>{sessions.length}{first && last ? ` · ${day(first)} – ${day(last)}` : ''}</Field>
          <Field label="Notes"><span className="text-forest-2">No notes yet.</span></Field>
        </dl>
      </Panel>
      <Panel label="Exercise settings" className="p-5 sm:p-6">
        <PanelTitle as="h2" title="Exercise settings" caption="As recorded in the sessions. Change the limit on the device (T12 sets 12°)." />
        <dl className="mt-3">
          <Field label="Exercise">{patient.exercise}</Field>
          <Field label="Lean limit" mono>{limits.map((l) => `${l}°`).join(', ')}</Field>
          <Field label="Held for at least" mono>200 ms</Field>
          <Field label="Targets">
            <ul className="flex flex-col gap-1">
              {TARGETS.map((t) => (
                <li key={t}>{TARGET_NAME[t]} <span className="text-forest-2">at <span className="font-readout tabular-nums">{TARGET_REACH[t]}</span> of comfortable reach</span></li>
              ))}
            </ul>
          </Field>
          <Field label="Calibration">3 s sitting upright and still, at the start of each session</Field>
          <Field label="Sensors">Chest (trunk angle) and wrist (rotation speed), 100 samples a second</Field>
        </dl>
      </Panel>
    </div>
  )
}
