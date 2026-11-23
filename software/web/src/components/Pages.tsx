/*
  The pages that came with patient profiles: the patient list and the profile page.
*/
import { Plus, RefreshCw, Smartphone, Trash2 } from 'lucide-react'
import { AlertDialog, Popover } from 'radix-ui'
import QRCode from 'qrcode'
import { type FormEvent, useEffect, useId, useState } from 'react'
import { addPatient, deletePatient, pairCode, useAccount } from '../lib/account'
import { day, pct, TARGET_NAME, TARGET_REACH, TARGETS, type Trend, trendOf } from '../lib/stats'
import { go, href } from '../lib/route'
import type { Patient } from '../lib/patients'
import { cn } from '../lib/utils'
import { EXERCISES, exerciseOf } from '../lib/exercises'
import type { ExerciseId, Session } from '../types'
import { ExerciseIcon } from './ExerciseIcon'
import { Avatar } from './Avatar'
import { FOCUS, Panel, PanelTitle } from './ui'

const TH = 'px-3 py-2.5 text-left text-sm font-bold text-forest-2 whitespace-nowrap'
const TD = 'px-3 py-3 font-readout tabular-nums whitespace-nowrap'

/* ---------- all patients ---------- */

/*
  How one exercise is going, in words: its icon (in its colour), its name, then
  Improving / Steady / Getting worse / New, and the compensated reps it is based on
  (first session → latest). The word carries the meaning; its colour only echoes it.
*/
const PROGRESS: Record<Trend, { word: string; cls: string }> = {
  improving: { word: 'Improving', cls: 'text-[color-mix(in_oklab,var(--color-lake),black_18%)]' },
  steady: { word: 'Steady', cls: 'text-forest' },
  worsening: { word: 'Getting worse', cls: 'text-terra-deep' },
  'too-early': { word: 'New', cls: 'text-forest-2' },
}

function ExerciseProgress({ exercise, sessions }: { exercise: ExerciseId; sessions: Session[] }) {
  const t = PROGRESS[trendOf(sessions)]
  const first = sessions[0], last = sessions[sessions.length - 1]
  return (
    <li className="flex items-center gap-2 whitespace-nowrap">
      <span style={{ color: EXERCISES[exercise].color }}><ExerciseIcon exercise={exercise} className="size-[18px]" /></span>
      <span>{EXERCISES[exercise].short}</span>
      <span className="text-forest-2">·</span>
      <span className={cn('font-bold', t.cls)}>{t.word}</span>
      {last && (
        <span className="text-[14px] text-forest-2 tabular-nums">
          {sessions.length > 1 ? `${Math.round(pct(first))}% → ${Math.round(pct(last))}%` : `${Math.round(pct(last))}%`}
        </span>
      )}
    </li>
  )
}

/**
  Add a patient: a name, and the new profile opens. It starts with no sessions; its
  Profile & settings page has the QR code that connects the phone app.
*/
function AddPatient() {
  const { refresh } = useAccount()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const id = useId()

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true); setError(null)
    try {
      const p = await addPatient(name)
      await refresh()
      setOpen(false); setName('')
      go({ name: 'overview', pid: p.id })
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Popover.Root open={open} onOpenChange={(o) => { setOpen(o); if (!o) setError(null) }}>
      <Popover.Trigger className={cn('inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg bg-forest px-4 text-[15px] font-semibold text-plaster transition-colors duration-150 hover:bg-forest-deep', FOCUS)}>
        <Plus className="size-4" aria-hidden /> Add patient
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="end" sideOffset={8}
          className="z-50 w-80 rounded-xl border border-wall bg-panel p-4 font-text text-[15px] text-forest shadow-[0_2px_4px_rgb(31_45_39/0.08),0_14px_32px_-18px_rgb(31_45_39/0.5)]">
          <form onSubmit={onSubmit} className="flex flex-col gap-3">
            <label htmlFor={id} className="font-bold">Patient’s name</label>
            <input id={id} value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" maxLength={60} required autoFocus
              className="h-11 rounded-lg border border-forest/25 bg-plaster px-3 text-[16px] hover:border-forest/45 focus-visible:border-eucalyptus focus-visible:outline-3 focus-visible:outline-eucalyptus/35" />
            {error && <p role="alert" className="font-bold text-terra-deep">{error}</p>}
            <div className="flex items-center gap-2">
              <button type="submit" disabled={busy || !name.trim()}
                className={cn('inline-flex h-10 cursor-pointer items-center rounded-lg bg-forest px-4 font-semibold text-plaster hover:bg-forest-deep disabled:cursor-not-allowed disabled:opacity-55', FOCUS)}>
                {busy ? 'Adding…' : 'Add patient'}
              </button>
              <Popover.Close className={cn('h-10 cursor-pointer rounded-lg px-3 font-semibold text-forest hover:bg-wash', FOCUS)}>Cancel</Popover.Close>
            </div>
          </form>
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
        <p className="mt-1 text-[17px] text-forest">{count} {count === 1 ? 'patient file' : 'patient files'}</p>
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
                <th scope="col" className={TH}>Exercises</th>
                <th scope="col" className={cn(TH, 'text-right')}>Sessions</th>
                <th scope="col" className={cn(TH, 'pr-5')}>Last session</th>
              </tr>
            </thead>
            <tbody>
              {!patients.length && (
                <tr><td colSpan={4} className="px-5 py-10 text-center text-[16px] text-forest-2">No patients yet. Add one with Add patient.</td></tr>
              )}
              {patients.map((p) => {
                const ss = sessionsFor(p)
                const last = ss[ss.length - 1]
                return (
                  <tr key={p.id} className="border-b border-wall/70 last:border-0 hover:bg-wash/60">
                    <td className="py-2 pl-3">
                      <a href={href({ name: 'overview', pid: p.id })} className={cn('flex items-center gap-3 rounded-md px-2 py-1', FOCUS)}>
                        <Avatar patient={p} size={32} />
                        <span className="font-bold underline decoration-wall underline-offset-4 hover:decoration-forest">{p.name}</span>
                      </a>
                    </td>
                    <td className="px-3 py-3">
                      {/* one line per exercise: a trend only means something within one exercise */}
                      {!p.exercises.length && <span className="text-forest-2">No sessions yet</span>}
                      <ul className="flex flex-col gap-1.5">
                        {p.exercises.map((id) => <ExerciseProgress key={id} exercise={id} sessions={ss.filter((s) => exerciseOf(s) === id)} />)}
                      </ul>
                    </td>
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

/*
  Connect a phone: a QR code (and the same code in letters) that the Re:Motion phone app
  will exchange for a sign-in as this patient, so what the phone records lands here. A code
  works for 10 minutes (server/accounts.ts); after that, New code.
*/
function ConnectPhone({ patient }: { patient: Patient }) {
  const [pair, setPair] = useState<{ code: string; expiresAt: number; svg: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [expired, setExpired] = useState(false)

  const [round, setRound] = useState(0)                 // New code asks again

  useEffect(() => {
    let alive = true
    pairCode(patient.id)
      .then(async (p) => ({ ...p, svg: await QRCode.toString(p.url, { type: 'svg', margin: 0, errorCorrectionLevel: 'M', color: { dark: '#1f2d27', light: '#00000000' } }) }))
      .then((p) => { if (alive) { setPair(p); setExpired(false); setError(null) } })
      .catch((e: Error) => { if (alive) setError(e.message) })
    return () => { alive = false }
  }, [patient.id, round])
  useEffect(() => {
    if (!pair) return
    const t = setTimeout(() => setExpired(true), Math.max(0, pair.expiresAt - Date.now()))
    return () => clearTimeout(t)
  }, [pair])

  const first = patient.name.split(' ')[0]
  return (
    <Panel label="Connect a phone" className="p-5 sm:p-6 xl:col-span-2">
      <PanelTitle as="h2" title="Connect a phone" caption={`So the Re:Motion app records as ${patient.name}`} />
      <div className="mt-4 flex flex-col gap-6 sm:flex-row sm:items-center">
        <div className="relative grid size-48 shrink-0 place-items-center rounded-xl border border-wall bg-plaster p-3">
          {pair && (
            <div aria-label={`QR code for connecting ${first}’s phone`} role="img"
              className={cn('size-full transition-opacity duration-200 [&>svg]:size-full', expired && 'opacity-15')}
              dangerouslySetInnerHTML={{ __html: pair.svg }} />
          )}
          {!pair && !error && <span className="text-sm text-forest-2" role="status">Making a code…</span>}
          {expired && <span className="absolute inset-0 grid place-items-center text-[15px] font-bold text-forest">Code expired</span>}
        </div>
        <div className="flex max-w-[46ch] flex-col gap-3 text-[16px] text-forest">
          <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-pretty marker:font-bold">
            <li>Open the Re:Motion app on {first}’s phone.</li>
            <li>Tap <span className="font-bold">Scan code</span> and point the phone at this square.</li>
            <li>The app signs in as {patient.name}, and the sessions it records appear here.</li>
          </ol>
          {pair && !expired && (
            <p className="text-forest-2">
              Or type the code <span className="font-readout text-[1.15rem] font-semibold tracking-[0.12em] text-forest tabular-nums">{pair.code.slice(0, 3)} {pair.code.slice(3)}</span>.
              {' '}It works for 10 minutes.
            </p>
          )}
          {error && <p role="alert" className="font-bold text-terra-deep">{error}</p>}
          <button type="button" onClick={() => setRound((n) => n + 1)}
            className={cn('inline-flex h-10 w-fit cursor-pointer items-center gap-2 rounded-lg border-[1.5px] border-forest/30 px-4 text-[15px] font-bold text-forest transition-colors duration-150 hover:border-forest/60 hover:bg-wash', FOCUS)}>
            <RefreshCw className="size-4" aria-hidden /> New code
          </button>
          <p className="flex items-start gap-2 text-[14px] text-forest-2">
            <Smartphone className="mt-0.5 size-4 shrink-0" aria-hidden /> Scanning to sign in arrives in the phone app’s next update.
          </p>
        </div>
      </div>
    </Panel>
  )
}

/*
  Delete the patient, after a confirmation that names them and what goes with them. Their
  sessions leave the dashboard; on the server, recordings only this account holds are kept
  aside (server/accounts.ts, deletePatient), so a slip can still be recovered by the team.
*/
function DeletePatient({ patient, sessions }: { patient: Patient; sessions: number }) {
  const { refresh } = useAccount()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function confirm() {
    setBusy(true); setError(null)
    try {
      await deletePatient(patient.id)
      await refresh()
      setOpen(false)
      go({ name: 'patients' })
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }

  // "Elena Rossi’s profile and all 6 sessions"
  const what = `${patient.name}’s profile` + (sessions === 0 ? '' : sessions === 1 ? ' and their 1 session' : ` and all ${sessions} sessions`)
  return (
    <Panel label="Delete patient" className="p-5 sm:p-6 xl:col-span-2">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="max-w-[60ch]">
          <h2 className="font-display text-[1.25rem] font-medium">Delete patient</h2>
          <p className="mt-1 text-[15px] text-pretty text-forest-2">Removes {what} from this dashboard.</p>
        </div>
        <AlertDialog.Root open={open} onOpenChange={(o) => { if (!busy) { setOpen(o); setError(null) } }}>
          <AlertDialog.Trigger className={cn('inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg border-[1.5px] border-forest/30 px-4 text-[15px] font-bold text-forest transition-colors duration-150 hover:border-forest/60 hover:bg-wash', FOCUS)}>
            <Trash2 className="size-4" aria-hidden /> Delete {patient.name.split(' ')[0]}
          </AlertDialog.Trigger>
          <AlertDialog.Portal>
            <AlertDialog.Overlay className="fixed inset-0 z-50 bg-forest/40" />
            <AlertDialog.Content className="fixed top-1/2 left-1/2 z-50 w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-[14px] bg-plaster p-6 font-text text-forest shadow-[0_2px_4px_rgb(31_45_39/0.08),0_14px_32px_-18px_rgb(31_45_39/0.5)]">
              <AlertDialog.Title className="font-display text-[1.4rem] leading-tight font-medium">Delete {patient.name}?</AlertDialog.Title>
              <AlertDialog.Description className="mt-2 text-[16px] text-pretty">
                {what} will be removed from this dashboard. This can’t be undone here.
              </AlertDialog.Description>
              {error && <p role="alert" className="mt-3 font-bold text-terra-deep">{error}</p>}
              <div className="mt-5 flex flex-wrap justify-end gap-2">
                <AlertDialog.Cancel disabled={busy} className={cn('h-10 cursor-pointer rounded-lg px-4 font-semibold hover:bg-wash disabled:opacity-55', FOCUS)}>Keep {patient.name.split(' ')[0]}</AlertDialog.Cancel>
                {/* not AlertDialog.Action: that would close the dialog before the delete is done */}
                <button type="button" onClick={() => void confirm()} disabled={busy}
                  className={cn('inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg bg-forest px-4 font-semibold text-plaster hover:bg-forest-deep disabled:cursor-wait disabled:opacity-70', FOCUS)}>
                  <Trash2 className="size-4" aria-hidden /> {busy ? 'Deleting…' : `Delete ${patient.name.split(' ')[0]}`}
                </button>
              </div>
            </AlertDialog.Content>
          </AlertDialog.Portal>
        </AlertDialog.Root>
      </div>
    </Panel>
  )
}

export function ProfilePage({ patient, sessions }: { patient: Patient; sessions: Session[] }) {
  const first = sessions[0], last = sessions[sessions.length - 1]
  const limits = [...new Set(sessions.map((s) => s.thresholdDeg))]
  const exercises = patient.exercises.map((id) => EXERCISES[id])
  return (
    <div className="grid items-start gap-4 xl:grid-cols-2">
      <ConnectPhone patient={patient} />
      <Panel label="Patient" className="p-5 sm:p-6">
        <PanelTitle as="h2" title="Patient" />
        <dl className="mt-3">
          <Field label="Name">{patient.name}</Field>
          <Field label="Patient ID" mono>{patient.id}</Field>
          <Field label="Data">{!sessions.length ? 'No sessions yet' : patient.simulated ? 'Simulated: generated to build and test the dashboard' : 'Recorded with the Re:Motion device'}</Field>
          <Field label="Sessions recorded" mono>{sessions.length}{first && last ? ` · ${day(first)} – ${day(last)}` : ''}</Field>
          <Field label="Notes"><span className="text-forest-2">No notes yet.</span></Field>
        </dl>
      </Panel>
      <Panel label="Exercise settings" className="p-5 sm:p-6">
        <PanelTitle as="h2" title="Exercise settings" />
        <dl className="mt-3">
          <Field label={exercises.length === 1 ? 'Exercise' : 'Exercises'}>{exercises.map((e) => e.name).join(', ') || 'None yet'}</Field>
          <Field label="Lean limit" mono>{limits.length ? limits.map((l) => `${l}°`).join(', ') : '10° (the default)'}</Field>
          <Field label="Held for at least" mono>200 ms</Field>
          {exercises.some((e) => e.targets) && (
            <Field label="Targets">
              <ul className="flex flex-col gap-1">
                {TARGETS.map((t) => (
                  <li key={t}>{TARGET_NAME[t]} <span className="text-forest-2">at <span className="tabular-nums">{TARGET_REACH[t]}</span> of comfortable reach</span></li>
                ))}
              </ul>
            </Field>
          )}
          <Field label="Calibration">3 s sitting upright and still, at the start of each session</Field>
          <Field label="Sensors">Chest (trunk angle) and wrist (rotation speed), 100 samples a second</Field>
        </dl>
      </Panel>
      <DeletePatient patient={patient} sessions={sessions.length} />
    </div>
  )
}
