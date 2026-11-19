import { FlaskConical, Radio } from 'lucide-react'
import { Tabs } from 'radix-ui'
import { useEffect, useState } from 'react'
import { AllSessions } from './components/AllSessions'
import { Overview } from './components/Overview'
import { RepDetail } from './components/RepDetail'
import { Replay } from './components/Replay'
import { Card, Select } from './components/ui'
import type { Session, SessionsFile } from './types'

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

function Logo() {
  return (
    <svg viewBox="0 0 32 32" className="size-8" aria-hidden>
      <rect width="32" height="32" rx="7" fill="#13243D" />
      <circle cx="13" cy="9" r="3.2" fill="#fff" />
      <path d="M13 13.5 L15.5 23" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
      <path d="M14 16.5 L23 19" stroke="#eb6834" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  )
}

function Stat({ label, value, note, tone }: { label: string; value: string; note?: string; tone?: 'comp' }) {
  return (
    <div className="px-5 py-4">
      <p className="text-xs font-medium text-ink-3">{label}</p>
      <p className={`mt-1.5 font-mono text-[28px] leading-none font-medium tabular-nums ${tone === 'comp' ? 'text-comp' : 'text-ink'}`}>
        {value}
      </p>
      {note && <p className="mt-2 text-xs text-ink-3">{note}</p>}
    </div>
  )
}

function Headline({ session }: { session: Session }) {
  const reps = session.reps
  const cleanPeaks = reps.filter((r) => !r.compensated).map((r) => r.peakDeg).sort((a, b) => a - b)
  const median = (xs: number[]) => {
    const m = xs.length >> 1
    return xs.length % 2 ? xs[m] : (xs[m - 1] + xs[m]) / 2
  }
  const s = session.summary
  return (
    <Card className="grid grid-cols-2 divide-line sm:grid-cols-3 lg:grid-cols-5 lg:divide-x">
      <Stat label="Reps" value={String(s.reps)} />
      <Stat label="Compensated" value={`${Math.round(s.pctCompensated)}%`} note={`${s.compensated} of ${s.reps} reps`} tone="comp" />
      <Stat label="Highest lean" value={`${s.maxPeakDeg.toFixed(1)}°`} note={`limit ${session.thresholdDeg}°`} />
      <Stat label="Typical clean-rep lean" value={cleanPeaks.length ? `${median(cleanPeaks).toFixed(1)}°` : '—'} note="median peak" />
      <Stat label="Median reach time" value={`${s.medianReachS.toFixed(2)} s`} />
    </Card>
  )
}

const TABS = [
  { value: 'replay', label: 'Replay' },
  { value: 'overview', label: 'Session overview' },
  { value: 'rep', label: 'Rep detail' },
  { value: 'all', label: 'All sessions' },
]

export default function App() {
  const load = useSessions()
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [tab, setTab] = useState('replay')

  if (load.status !== 'ready') {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 text-center">
        {load.status === 'loading' ? (
          <p className="text-ink-3">Loading sessions…</p>
        ) : (
          <>
            <p className="font-medium">Couldn't load sessions.json ({load.message}).</p>
            <p className="mt-2 text-sm text-ink-3">
              From the repo root, run <code className="font-mono">python -m software.dashboard.export</code>, then reload.
            </p>
          </>
        )}
      </main>
    )
  }

  const sessions = load.data.sessions
  if (!sessions.length) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 text-center">
        <p className="font-medium">No sessions recorded yet.</p>
        <p className="mt-2 text-sm text-ink-3">
          Record one with <code className="font-mono">python -m software.tools.logger</code>, then run{' '}
          <code className="font-mono">python -m software.dashboard.export</code>.
        </p>
      </main>
    )
  }

  const session = sessions.find((s) => s.id === sessionId) ?? sessions[sessions.length - 1]

  return (
    <div className="min-h-dvh">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-3">
          <a href="/" className="flex items-center gap-3 rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand">
            <Logo />
            <div>
              <p className="text-[15px] leading-tight font-semibold">IMU Reach Tracker</p>
              <p className="text-xs leading-tight text-ink-3">ECE 198 · Group 19</p>
            </div>
          </a>
          <div className="flex items-center gap-3">
            {session.simulated ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-comp/30 bg-comp-soft px-2.5 py-1 text-xs font-medium text-[#a8431a]">
                <FlaskConical className="size-3.5" aria-hidden /> Simulated data
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-clean/30 bg-clean-soft px-2.5 py-1 text-xs font-medium text-[#1d5aa6]">
                <Radio className="size-3.5" aria-hidden /> Recorded session
              </span>
            )}
            <Select
              label="Session"
              value={session.id}
              onChange={setSessionId}
              options={[...sessions].reverse().map((s) => ({ value: s.id, label: s.label }))}
              className="w-56"
            />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-8 px-6 pt-10 pb-16">
        <section className="max-w-3xl">
          <h1 className="text-4xl leading-[1.1] font-semibold text-balance">
            Did the arm reach, or did the trunk lean?
          </h1>
          <p className="mt-3 text-lg text-pretty text-ink-2">
            Clinical scores check <em className="not-italic font-medium text-ink">whether</em> a reach was completed,
            not <em className="not-italic font-medium text-ink">how</em>. Two wearable sensors measure trunk lean during
            every seated reach and flag the reps where the trunk did the work for the arm.
          </p>
        </section>

        <Headline session={session} />

        <Tabs.Root value={tab} onValueChange={setTab}>
          <Tabs.List aria-label="Dashboard views" className="flex gap-1 border-b border-line">
            {TABS.map((t) => (
              <Tabs.Trigger
                key={t.value}
                value={t.value}
                className="relative -mb-px border-b-2 border-transparent px-3 pt-1 pb-3 text-sm font-medium text-ink-3 hover:text-ink-2 focus-visible:outline-2 focus-visible:outline-brand data-[state=active]:border-brand data-[state=active]:text-ink"
              >
                {t.label}
              </Tabs.Trigger>
            ))}
          </Tabs.List>
          <div className="pt-6">
            <Tabs.Content value="replay"><Replay key={session.id} session={session} /></Tabs.Content>
            <Tabs.Content value="overview"><Overview session={session} /></Tabs.Content>
            <Tabs.Content value="rep"><RepDetail key={session.id} session={session} /></Tabs.Content>
            <Tabs.Content value="all">
              <AllSessions sessions={sessions} current={session.id} onPick={(id) => { setSessionId(id); setTab('overview') }} />
            </Tabs.Content>
          </div>
        </Tabs.Root>
      </main>
    </div>
  )
}
