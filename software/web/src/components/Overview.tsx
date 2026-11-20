/*
  A patient's Overview, in two parts.

  1. Summary: how they are doing in the exercise. A data-written verdict, how often
     they practise, where the leaning still happens, and four plates (compensated
     reps, clean-rep lean, reach time, sessions this week) with the change since the
     first session. The plates only show; they are not controls.
  2. Graphs: a row of buttons, one per graph, each asking the question its graph
     answers with a thumbnail drawn from the data; the chosen graph opens below
     with a sentence on how to read it.
*/
import { ArrowRight } from 'lucide-react'
import { useState } from 'react'
import {
  type Better, cleanLean, day, judge, type Measure, pct, reach, TARGET_NAME, TARGET_REACH, TARGETS,
} from '../lib/stats'
import { href } from '../lib/route'
import { cn } from '../lib/utils'
import type { Session } from '../types'
import { TrendChart } from './TrendChart'
import { RepStrip } from './RepStrip'
import { FOCUS, Legend, Mark, Panel, Segmented } from './ui'


/*
  One measure as two overlapping square-ended bars on a scale from 0: a light,
  transparent blue bar behind (the average of every session, or the previous
  session, as the toggle above chooses) and the latest session solid on top. The
  lean row adds the limit as a dashed line. Hovering a bar shows its figure at its
  end; focusing the row lists both.
*/
type Part = 'latest' | 'other'

function MeasureBar({ label, unit, latest, other, otherName, max, limit, better, fmt, latestDay, row = 0 }: {
  label: string
  unit: string
  latest: number | null
  other: number | null
  otherName: string
  max: number
  limit?: number
  better: Better
  fmt: (v: number) => string
  latestDay: string
  /** position in the list, for the staggered grow-in */
  row?: number
}) {
  const [tip, setTip] = useState<Part | null>(null)
  const pctOf = (v: number) => Math.min(100, (v / max) * 100)
  const f = (v: number | null) => (v === null ? '—' : `${fmt(v)}${unit}`)
  const parts: { key: Part; value: number | null; name: string; cls: string }[] = [
    { key: 'other', value: other, name: otherName, cls: 'inset-y-0 bg-lake/15' },
    { key: 'latest', value: latest, name: `Latest session, ${latestDay}`, cls: cn('inset-y-[7px]', better === 'worse' ? 'bg-terra' : 'bg-forest') },
  ]
  const shown = parts.find((p) => p.key === tip)
  const all = parts.filter((p) => p.value !== null).reverse()
  return (
    <div className="grid grid-cols-[9.5rem_minmax(0,1fr)_4.5rem] items-center gap-x-4 sm:grid-cols-[11rem_minmax(0,1fr)_5rem]">
      <dt className="text-[15px] font-bold">{label}</dt>
      <dd tabIndex={0} aria-label={`${label}: ${all.map((p) => `${p.name.toLowerCase()} ${f(p.value)}`).join(', ')}${limit !== undefined ? `, limit ${limit}${unit}` : ''}`}
        onMouseLeave={() => setTip(null)}
        className="group relative h-7 rounded-md outline-none focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-eucalyptus">
        <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-wall" />
        {parts.map((p) => p.value !== null && (
          <span key={p.key} onMouseEnter={() => setTip(p.key)}
            className={cn('measure-bar grow-x absolute left-0 cursor-default', p.cls, tip === p.key && 'brightness-90')}
            // the average/previous bar grows first, the latest session lands on top of it
            style={{ width: `${pctOf(p.value)}%`, '--delay': `${row * 70 + (p.key === 'latest' ? 140 : 0)}ms` } as React.CSSProperties} />
        ))}
        {limit !== undefined && (
          <span onMouseEnter={() => setTip(null)} className="pointer-events-none absolute -inset-y-1 w-0 border-l-2 border-dashed border-forest" style={{ left: `${pctOf(limit)}%` }} />
        )}
        {/* the hovered bar's figure, at its end */}
        {shown && shown.value !== null && (
          <span role="tooltip" className="pointer-events-none absolute bottom-full z-20 mb-1.5 -translate-x-1/2 rounded-md bg-forest px-2.5 py-1 text-[13px] whitespace-nowrap text-plaster shadow-[0_6px_16px_-8px_rgb(31_45_39/0.6)]"
            style={{ left: `${Math.max(8, Math.min(92, pctOf(shown.value)))}%` }}>
            {shown.name}: <span className="font-readout font-semibold tabular-nums">{f(shown.value)}</span>
          </span>
        )}
        {/* keyboard: all the figures at once */}
        {!shown && (
          <span role="tooltip" className="pointer-events-none absolute bottom-full left-0 z-20 mb-1.5 hidden rounded-md bg-forest px-2.5 py-1.5 text-[13px] text-plaster group-focus-visible:block">
            {all.map((p) => <span key={p.key} className="block whitespace-nowrap">{p.name}: <span className="font-readout tabular-nums">{f(p.value)}</span></span>)}
          </span>
        )}
      </dd>
      <dd className={cn('text-right font-readout text-[1.35rem] leading-none tracking-[-0.02em] tabular-nums', better === 'worse' && 'text-terra')}>
        {latest === null ? '—' : fmt(latest)}<span className="ml-0.5 align-[0.55em] text-[0.55em]">{unit.trim()}</span>
      </dd>
    </div>
  )
}

/* The figures the summary button sends to Claude: the same numbers this page shows. */
function summaryPayload(sessions: Session[]) {
  return {
    simulated: sessions.every((s) => s.simulated),
    leanLimitDeg: sessions[sessions.length - 1].thresholdDeg,
    sessions: sessions.map((s) => ({
      date: s.label,
      reps: s.summary.reps,
      compensatedReps: s.summary.compensated,
      compensatedPct: Math.round(pct(s)),
      cleanRepLeanDeg: cleanLean(s) === null ? null : Number(cleanLean(s)!.toFixed(1)),
      highestLeanDeg: s.summary.maxPeakDeg,
      medianReachS: Number(reach(s).toFixed(2)),
      compensatedByTarget: Object.fromEntries(TARGETS.map((t) => [TARGET_NAME[t], s.reps.filter((r) => r.target === t && r.compensated).length])),
    })),
  }
}

type SummaryState = { status: 'idle' } | { status: 'loading' } | { status: 'done'; text: string } | { status: 'error'; message: string }

/** "Generate summary": asks Claude, through the dev server's /api/summary, for a few plain sentences. */
function AISummary({ sessions }: { sessions: Session[] }) {
  const [state, setState] = useState<SummaryState>({ status: 'idle' })
  const run = async () => {
    setState({ status: 'loading' })
    try {
      const r = await fetch('/api/summary', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(summaryPayload(sessions)) })
      const data = await r.json().catch(() => null) as { text?: string; error?: string } | null
      if (!r.ok || !data?.text) {
        setState({ status: 'error', message: data?.error ?? (r.status === 404 ? 'Summaries need the dev or preview server (npm run dev).' : `The summary failed (HTTP ${r.status}).`) })
        return
      }
      setState({ status: 'done', text: data.text })
    } catch {
      setState({ status: 'error', message: 'Could not reach the summary service.' })
    }
  }
  return (
    <div className="flex min-w-0 flex-col items-start gap-3 lg:items-stretch">
      <button type="button" onClick={run} disabled={state.status === 'loading'}
        className={cn('inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg bg-forest px-4 text-[15px] font-semibold text-plaster transition-colors duration-150 hover:bg-forest-deep disabled:cursor-wait disabled:opacity-60 lg:self-end', FOCUS)}>
        {state.status === 'loading' ? 'Writing summary…' : state.status === 'done' ? 'Generate again' : 'Generate summary'}
      </button>
      <div aria-live="polite" className="w-full">
        {state.status === 'done' && (
          <div key={state.text} className="rise-in rounded-xl border border-wall bg-panel px-4 py-3.5">
            <p className="text-[15px] leading-relaxed text-pretty">{state.text}</p>
          </div>
        )}
        {state.status === 'error' && <p className="text-sm text-terra-deep">{state.message}</p>}
      </div>
    </div>
  )
}

type Compare = 'average' | 'previous'

function Summary({ sessions }: { sessions: Session[] }) {
  const last = sessions[sessions.length - 1]
  const prev = sessions.length > 1 ? sessions[sessions.length - 2] : null
  const [compare, setCompare] = useState<Compare>('average')
  const mean = (get: (s: Session) => number | null) => {
    const v = sessions.map(get).filter((x): x is number => x !== null)
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null
  }
  // the light bar: the average of every session, or the session before the latest
  const refOf = (get: (s: Session) => number | null) => (!prev ? null : compare === 'average' ? mean(get) : get(prev))
  const refName = compare === 'average' ? `Average of all ${sessions.length} sessions` : `Previous session, ${prev ? day(prev) : ''}`
  const judgeVs = (a: number | null, b: number | null, kind: 'pct' | 'deg' | 'time') => (a === null || b === null ? 'same' : judge(a - b, kind))
  const leanMax = Math.max(last.thresholdDeg * 1.5, ...sessions.map((s) => cleanLean(s) ?? 0)) * 1.1
  const reachMax = Math.max(...sessions.map(reach)) * 1.15
  const common = { otherName: refName, latestDay: day(last) }
  return (
    <section aria-labelledby="summary-title" className="grid gap-x-12 gap-y-5 pt-1 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <div className="min-w-0">
        <h2 id="summary-title" className="font-display text-[1.6rem] leading-[1.15] font-medium tracking-[-0.01em] sm:text-[1.9rem]">Overview</h2>
        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-x-6 gap-y-2.5">
          {/* the key */}
          <ul className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm">
            <li className="inline-flex items-center gap-2"><span className="h-2.5 w-6 bg-forest" aria-hidden /><span><span className="font-bold">Latest session</span> <span className="text-forest-2">{day(last)}</span></span></li>
            {prev && (
              <li className="inline-flex items-center gap-2"><span className="h-4 w-6 bg-lake/15" aria-hidden /><span className="font-bold">{refName}</span></li>
            )}
          </ul>
          {prev && (
            <Segmented label="Compare the latest session with" value={compare} onChange={setCompare}
              options={[{ value: 'average', label: 'Show average' }, { value: 'previous', label: 'Show previous' }]} />
          )}
        </div>
        <dl className="mt-3 flex flex-col gap-1.5">
          <MeasureBar label="Compensated reps" unit="%" latest={pct(last)} other={refOf(pct)} {...common}
            max={100} better={judgeVs(pct(last), prev ? pct(prev) : null, 'pct')} fmt={(v) => `${Math.round(v)}`} />
          <MeasureBar row={1} label="Clean-rep lean" unit="°" latest={cleanLean(last)} other={refOf(cleanLean)} {...common}
            max={leanMax} limit={last.thresholdDeg} better={judgeVs(cleanLean(last), prev ? cleanLean(prev) : null, 'deg')} fmt={(v) => v.toFixed(1)} />
          <MeasureBar row={2} label="Reach time" unit=" s" latest={reach(last)} other={refOf(reach)} {...common}
            max={reachMax} better="same" fmt={(v) => v.toFixed(2)} />
        </dl>
        <p className="mt-2 text-[13px] text-forest-2">Hover a bar for its figure.</p>
      </div>
      <AISummary sessions={sessions} />
    </section>
  )
}

type View = Measure | 'latest' | 'targets'

/*
  The graphs, one button each. A button asks the question its graph answers and
  carries a thumbnail of that graph drawn from the real data, so the shape hints
  at what you will see before you open it.
*/
const VIEWS: { value: View; question: string; what: string; trend: boolean }[] = [
  { value: 'pct', question: 'Is the leaning going down?', what: 'Compensated reps, each session', trend: true },
  { value: 'lean', question: 'How far do clean reps lean?', what: 'Clean-rep lean, each session', trend: true },
  { value: 'reach', question: 'Are reaches getting quicker?', what: 'Reach time, each session', trend: true },
  { value: 'latest', question: 'How did the last session go?', what: 'Each rep of the latest session', trend: false },
  { value: 'targets', question: 'Where does the leaning happen?', what: 'Compensated reps by target', trend: false },
]

const TW = 120, TH = 40

/** A thumbnail of one graph, drawn from the same numbers as the graph itself. */
function Thumb({ view, sessions }: { view: View; sessions: Session[] }) {
  const last = sessions[sessions.length - 1]
  if (view === 'pct' || view === 'lean' || view === 'reach') {
    const get = view === 'pct' ? pct : view === 'lean' ? cleanLean : reach
    const vs = sessions.map(get)
    const nums = vs.filter((v): v is number => v !== null)
    const lo = 0
    const hi = view === 'pct' ? 100 : view === 'lean' ? Math.max(last.thresholdDeg + 2, ...nums) : Math.max(...nums) * 1.15
    const x = (i: number) => 4 + (i * (TW - 8)) / Math.max(1, vs.length - 1)
    const y = (v: number) => TH - 4 - ((v - lo) / (hi - lo || 1)) * (TH - 8)
    const pts = vs.map((v, i) => (v === null ? null : [x(i), y(v)] as const)).filter((p): p is readonly [number, number] => p !== null)
    const line = pts.map((p) => p.join(',')).join(' ')
    return (
      <svg viewBox={`0 0 ${TW} ${TH}`} className="h-10 w-full" preserveAspectRatio="none" aria-hidden>
        {view === 'lean' && <line x1={0} x2={TW} y1={y(last.thresholdDeg)} y2={y(last.thresholdDeg)} stroke="var(--color-forest)" strokeWidth={1} strokeDasharray="4 3" vectorEffect="non-scaling-stroke" />}
        {pts.length > 1 && <polygon points={`${pts[0][0]},${TH} ${line} ${pts[pts.length - 1][0]},${TH}`} fill="var(--color-eucalyptus)" opacity={0.18} />}
        <polyline points={line} fill="none" stroke="var(--color-forest)" strokeWidth={2} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      </svg>
    )
  }
  if (view === 'latest') {
    const hi = Math.max(last.thresholdDeg * 1.6, ...last.reps.map((r) => r.peakDeg))
    const y = (v: number) => TH - 5 - (v / hi) * (TH - 10)
    const n = last.reps.length
    return (
      <svg viewBox={`0 0 ${TW} ${TH}`} className="h-10 w-full" aria-hidden>
        <line x1={0} x2={TW} y1={y(last.thresholdDeg)} y2={y(last.thresholdDeg)} stroke="var(--color-forest)" strokeWidth={1} strokeDasharray="4 3" />
        {last.reps.map((r, i) => <Mark key={r.rep} cx={5 + (i * (TW - 10)) / Math.max(1, n - 1)} cy={y(r.peakDeg)} r={2.6} compensated={r.compensated} />)}
      </svg>
    )
  }
  const recent = sessions.slice(-3)
  const rows = TARGETS.map((t) => {
    const reps = recent.flatMap((x) => x.reps.filter((r) => r.target === t))
    return reps.length ? reps.filter((r) => r.compensated).length / reps.length : 0
  })
  return (
    <svg viewBox={`0 0 ${TW} ${TH}`} className="h-10 w-full" aria-hidden>
      {rows.map((v, i) => (
        <g key={i}>
          <rect x={0} y={4 + i * 12} width={TW} height={6} rx={3} fill="var(--color-grid)" />
          <rect x={0} y={4 + i * 12} width={Math.max(6, v * TW)} height={6} rx={3} fill="var(--color-terra)" />
        </g>
      ))}
    </svg>
  )
}

/** Compensated reps by target over the last three sessions: where the leaning still happens. */
function ByTarget({ sessions }: { sessions: Session[] }) {
  const recent = sessions.slice(-3)
  const rows = TARGETS.map((t) => {
    const reps = recent.flatMap((s) => s.reps.filter((r) => r.target === t))
    return { t, n: reps.filter((r) => r.compensated).length, of: reps.length }
  })
  const total = rows.reduce((a, r) => a + r.n, 0)
  const top = [...rows].sort((a, b) => b.n - a.n)[0]
  return (
    <div className="mt-5 max-w-2xl">
      <dl className="flex flex-col gap-4">
        {rows.map((r, i) => (
          <div key={r.t}>
            <div className="flex items-baseline justify-between gap-3 text-[15px]">
              <dt><span className="font-bold">{TARGET_NAME[r.t]}</span> <span className="text-forest-2">· {TARGET_REACH[r.t]} of reach</span></dt>
              <dd className="font-readout tabular-nums">{r.n} of {r.of}</dd>
            </div>
            <div className="mt-1.5 h-2 rounded-full bg-grid" aria-hidden>
              <div className="grow-x h-full rounded-full bg-terra" style={{ width: r.of ? `${(r.n / r.of) * 100}%` : 0, '--delay': `${i * 80}ms` } as React.CSSProperties} />
            </div>
          </div>
        ))}
      </dl>
      <p className="pt-5 text-[15px] text-pretty text-forest-2">
        {total === 0
          ? 'No compensated reps in these sessions.'
          : top.n / total >= 0.5 && total >= 2
            ? <>Most of the leaning is at the <span className="font-bold text-forest">{TARGET_NAME[top.t].toLowerCase()}</span> target.</>
            : 'The leaning is spread across the targets.'}
      </p>
    </div>
  )
}

function Graphs({ sessions, pid, onOpenSession, onOpenRep }: {
  sessions: Session[]
  pid: string
  onOpenSession: (id: string) => void
  onOpenRep: (sid: string, rep: number) => void
}) {
  const single = sessions.length < 2
  const views = VIEWS.filter((v) => !single || !v.trend)
  const [view, setView] = useState<View>(single ? 'latest' : 'pct')
  const first = sessions[0], last = sessions[sessions.length - 1]
  const yMax = Math.ceil(Math.max(last.thresholdDeg, ...last.reps.map((r) => r.peakDeg)) / 5) * 5
  const current = VIEWS.find((v) => v.value === view)!
  const caption: Record<View, React.ReactNode> = {
    pct: 'The share of reps where the trunk leaned past the limit, one point per session. Lower is better. Select a point to open that session.',
    lean: <>How far the trunk tipped on reps that stayed within the limit (the dashed line, <span className="font-readout tabular-nums">{last.thresholdDeg}°</span>), one point per session. Lower is steadier.</>,
    reach: 'The typical time from leaving HOME to pressing the target, one point per session. Change here is neither good nor bad on its own.',
    latest: <>{last.label}: each rep at its highest lean, in order. <span className="font-readout tabular-nums">{last.summary.compensated} of {last.summary.reps}</span> went past the limit. Select a rep to replay it.</>,
    targets: `Of the reps at each target over the last ${Math.min(3, sessions.length)} sessions, how many were compensated. Targets get further away from top to bottom.`,
  }
  return (
    <section aria-labelledby="graphs-title" className="flex flex-col gap-4">
      <h2 id="graphs-title" className="font-display text-xl leading-tight font-medium">Graphs</h2>
      <div role="group" aria-label="Graph to show" className={cn("grid grid-cols-2 gap-2.5 sm:gap-3", views.length === 4 ? "lg:grid-cols-4" : "sm:grid-cols-3 lg:grid-cols-5")}>
        {views.map((v) => {
          const on = v.value === view
          return (
            <button key={v.value} type="button" aria-pressed={on} onClick={() => setView(v.value)}
              className={cn(
                'flex min-w-0 cursor-pointer flex-col gap-2.5 rounded-xl border-[1.5px] p-3 text-left transition-[background-color,border-color] duration-150 sm:p-3.5',
                on ? 'border-forest bg-panel' : 'border-wall bg-plaster hover:border-eucalyptus hover:bg-panel',
                'focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-eucalyptus',
              )}>
              <Thumb view={v.value} sessions={sessions} />
              <span>
                <span className="block text-[15px] leading-snug font-bold text-pretty">{v.question}</span>
                <span className="mt-0.5 block text-[13px] leading-snug text-forest-2">{v.what}</span>
              </span>
            </button>
          )
        })}
      </div>

      <Panel label={current.question} className="px-5 pt-5 pb-5 sm:px-6 sm:pt-6">
        <div key={view} className="rise-in">
        <h3 className="font-display text-xl leading-tight font-medium">{current.question}</h3>
        <p className="mt-1 max-w-3xl text-[15px] text-pretty text-forest-2">{caption[view]}</p>

        {(view === 'pct' || view === 'lean' || view === 'reach') && (
          <TrendChart sessions={sessions} measure={view} baseId={first.id} otherId={last.id} tags={['First', 'Latest']}
            threshold={last.thresholdDeg} onOpenSession={onOpenSession} className="mt-4" height={300} />
        )}
        {view === 'latest' && (
          <div className="mt-5">
            <RepStrip reps={last.reps} threshold={last.thresholdDeg} yMax={yMax} onOpen={(n) => onOpenRep(last.id, n)} height={220} />
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <Legend threshold={last.thresholdDeg} />
              <a href={href({ name: 'session', pid, sid: last.id })} onClick={(e) => { e.preventDefault(); onOpenSession(last.id) }}
                className={cn('inline-flex items-center gap-1.5 rounded text-[15px] font-bold text-eucalyptus underline underline-offset-4', FOCUS)}>
                Open session <ArrowRight className="size-4" aria-hidden />
              </a>
            </div>
          </div>
        )}
        {view === 'targets' && <ByTarget sessions={sessions} />}
        </div>
      </Panel>
    </section>
  )
}

export function Overview({ sessions, pid, onOpenSession, onOpenRep }: {
  sessions: Session[]
  pid: string
  onOpenSession: (id: string) => void
  onOpenRep: (sid: string, rep: number) => void
}) {
  return (
    <div className="flex flex-col gap-6">
      <Summary sessions={sessions} />
      <Graphs sessions={sessions} pid={pid} onOpenSession={onOpenSession} onOpenRep={onOpenRep} />
    </div>
  )
}
