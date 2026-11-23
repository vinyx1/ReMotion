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
import { ArrowRight, ChevronRight } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import {
  type Better, cleanLean, day, judge, type Measure, pct, reach, TARGET_NAME, TARGET_REACH, TARGETS,
} from '../lib/stats'
import { href } from '../lib/route'
import { EXERCISES, exerciseOf } from '../lib/exercises'
import type { Patient } from '../lib/patients'
import { TrendPill } from './PatientHeader'
import { PracticeCalendar } from './PracticeCalendar'
import { ExerciseBadge } from './ExerciseIcon'
import { cn } from '../lib/utils'
import type { Session } from '../types'
import { TrendChart } from './TrendChart'
import { RepStrip } from './RepStrip'
import { FOCUS, Legend, Mark, Panel, Segmented } from './ui'


/*
  One measure as two overlapping square-ended bars on a scale from 0: a soft lake
  blue bar behind (the average of every session, or the previous session, as the
  toggle above chooses) and the latest session in forest (terracotta when worse)
  on top. The lean row adds the limit as a dashed line. Hovering a bar shows its
  figure at its end, in a tooltip of that bar's colour; focusing the row lists both.
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
  const latestTone = better === 'worse' ? 'bg-terra text-plaster' : 'bg-forest text-plaster'
  const parts: { key: Part; value: number | null; name: string; cls: string; tip: string }[] = [
    { key: 'other', value: other, name: otherName, cls: 'inset-y-0 bg-lake-soft/55', tip: 'bg-lake-soft text-forest' },
    { key: 'latest', value: latest, name: `Latest session, ${latestDay}`, cls: cn('inset-y-[5px]', better === 'worse' ? 'bg-terra' : 'bg-forest'), tip: latestTone },
  ]
  const shown = parts.find((p) => p.key === tip)
  const all = parts.filter((p) => p.value !== null).reverse()
  return (
    <div className="grid grid-cols-[9.5rem_minmax(0,1fr)_4.5rem] items-center gap-x-4 sm:grid-cols-[11rem_minmax(0,1fr)_5rem]">
      <dt className="text-[15px] font-bold">{label}</dt>
      <dd tabIndex={0} aria-label={`${label}: ${all.map((p) => `${p.name.toLowerCase()} ${f(p.value)}`).join(', ')}${limit !== undefined ? `, limit ${limit}${unit}` : ''}`}
        onMouseLeave={() => setTip(null)}
        className="group relative h-5 rounded-md outline-none focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-eucalyptus">
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
          <span role="tooltip" className={cn('pointer-events-none absolute bottom-full z-20 mb-1.5 -translate-x-1/2 rounded-md px-2.5 py-1 text-[13px] whitespace-nowrap shadow-[0_6px_16px_-8px_rgb(31_45_39/0.6)]', shown.tip)}
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
  const ex = EXERCISES[exerciseOf(sessions[sessions.length - 1])]
  return {
    exercise: ex.name,
    leanLimitDeg: sessions[sessions.length - 1].thresholdDeg,
    sessions: sessions.map((s) => ({
      date: s.label,
      reps: s.summary.reps,
      compensatedReps: s.summary.compensated,
      compensatedPct: Math.round(pct(s)),
      cleanRepLeanDeg: cleanLean(s) === null ? null : Number(cleanLean(s)!.toFixed(1)),
      highestLeanDeg: s.summary.maxPeakDeg,
      medianReachS: Number(reach(s).toFixed(2)),
      ...(ex.targets ? {} : { note: 'this exercise has no targets' }),
      compensatedByTarget: !ex.targets ? undefined : Object.fromEntries(TARGETS.map((t) => [TARGET_NAME[t], s.reps.filter((r) => r.target === t && r.compensated).length])),
    })),
  }
}

type SummaryState =
  | { status: 'checking' } | { status: 'idle' } | { status: 'loading' }
  | { status: 'done'; text: string; createdAt?: string } | { status: 'error'; message: string }

// notes already fetched this visit, by the exact figures sent: switching tabs doesn't ask again
const notes = new Map<string, { text: string; createdAt?: string }>()

const written = (iso?: string) => (!iso ? null : new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }))

/*
  The Claude-written summary, through the dev server's /api/summary. The server keeps
  each note under a hash of the figures sent, so the same data never calls Claude
  twice; new sessions change the figures and get a new note. With `auto` the note is
  written on open; without it a stored note shows on open and the button writes one.
  Once the note matches the data there is no button: asking again would return it.
*/
function AISummary({ payload, auto = false, plain = false }: { payload: object; auto?: boolean; plain?: boolean }) {
  const body = JSON.stringify(payload)
  // keyed by the figures: new data starts a fresh note instead of resetting state in an effect
  return <SummaryNote key={body} body={body} auto={auto} plain={plain} />
}

const bullets = (text: string) => text.split('\n').map((l) => l.replace(/^\s*[-•*]\s*/, '').trim()).filter(Boolean)

/* `plain`: the note as page text (the patient Overview), not a panel beside the bars */
function SummaryNote({ body, auto, plain }: { body: string; auto: boolean; plain: boolean }) {
  const [state, setState] = useState<SummaryState>(() => {
    const hit = notes.get(body)
    return hit ? { status: 'done', ...hit } : { status: auto ? 'loading' : 'checking' }
  })

  const ask = useCallback(async (cachedOnly: boolean, signal?: AbortSignal): Promise<SummaryState> => {
    try {
      const r = await fetch('/api/summary', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data: JSON.parse(body), cachedOnly }), signal })
      const data = await r.json().catch(() => null) as { text?: string | null; createdAt?: string; error?: string } | null
      if (r.ok && data?.text) {
        notes.set(body, { text: data.text, createdAt: data.createdAt })
        return { status: 'done', text: data.text, createdAt: data.createdAt }
      }
      if (r.ok && cachedOnly) return { status: 'idle' }
      // a quiet lookup that fails (e.g. the static build, no server) just leaves the button
      if (cachedOnly) return { status: 'idle' }
      return { status: 'error', message: data?.error ?? (r.status === 404 ? 'Summaries need the dev or preview server (npm run dev).' : `The summary failed (HTTP ${r.status}).`) }
    } catch (e) {
      if ((e as Error).name === 'AbortError') throw e
      return cachedOnly ? { status: 'idle' } : { status: 'error', message: 'Could not reach the summary service.' }
    }
  }, [body])

  useEffect(() => {
    if (notes.has(body)) return
    const ctrl = new AbortController()
    ask(!auto, ctrl.signal).then(setState, () => { /* aborted: the page moved on */ })
    return () => ctrl.abort()
  }, [body, auto, ask])

  const run = async () => { setState({ status: 'loading' }); setState(await ask(false)) }

  if (plain) {
    return (
      <div aria-live="polite" aria-busy={state.status === 'loading'} className="min-w-0">
        {(state.status === 'loading' || state.status === 'checking') && (
          <div className="flex flex-col gap-2.5 pt-1.5 motion-safe:animate-pulse" role="status">
            <span className="sr-only">Writing summary…</span>
            <span className="h-3.5 w-11/12 rounded bg-wall" aria-hidden /><span className="h-3.5 w-4/5 rounded bg-wall" aria-hidden /><span className="h-3.5 w-3/5 rounded bg-wall" aria-hidden />
          </div>
        )}
        {state.status === 'done' && (
          <div key={state.text} className="rise-in">
            <ul className="flex list-disc flex-col gap-1 pl-5 text-[15px] leading-normal text-pretty marker:text-forest-2">
              {bullets(state.text).map((l, i) => <li key={i}>{l}</li>)}
            </ul>
            {written(state.createdAt) && <p className="mt-2 text-[13px] text-forest-2 tabular-nums">Summary written {written(state.createdAt)}</p>}
          </div>
        )}
        {(state.status === 'idle' || state.status === 'error') && (
          <p className="text-[15px]">
            {state.status === 'error' && <span className="text-terra-deep">{state.message} </span>}
            <button type="button" onClick={run} className={cn('cursor-pointer font-semibold text-forest underline underline-offset-3 hover:text-forest-deep', FOCUS)}>
              {state.status === 'error' ? 'Try again' : 'Generate summary'}
            </button>
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="flex min-w-0 flex-col items-start gap-3 lg:items-stretch">
      {(state.status === 'idle' || state.status === 'error') && (
        <button type="button" onClick={run}
          className={cn('inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg bg-forest px-4 text-[15px] font-semibold text-plaster transition-colors duration-150 hover:bg-forest-deep lg:self-end', FOCUS)}>
          {state.status === 'error' ? 'Try again' : 'Generate summary'}
        </button>
      )}
      <div aria-live="polite" aria-busy={state.status === 'loading'} className="w-full">
        {state.status === 'loading' && (
          <div className="rounded-xl border border-wall bg-panel px-4 py-3.5">
            <p className="text-sm text-forest-2">Writing summary…</p>
            <div className="mt-2.5 flex flex-col gap-2 motion-safe:animate-pulse" aria-hidden>
              <span className="h-3 w-11/12 rounded bg-wall" /><span className="h-3 w-4/5 rounded bg-wall" /><span className="h-3 w-3/5 rounded bg-wall" />
            </div>
          </div>
        )}
        {state.status === 'done' && (
          <div key={state.text} className="rise-in rounded-xl border border-wall bg-panel px-4 py-3.5">
            {/* point form: one bullet per line the model wrote ("- ..."); a stray paragraph still shows */}
            <ul className="flex list-disc flex-col gap-1.5 pl-5 text-[15px] leading-snug text-pretty marker:text-forest-2">
              {bullets(state.text).map((l, i) => <li key={i}>{l}</li>)}
            </ul>
            {written(state.createdAt) && <p className="mt-2.5 text-[13px] text-forest-2 tabular-nums">Written {written(state.createdAt)}</p>}
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
  const ex = EXERCISES[exerciseOf(last)]
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
  const payload = summaryPayload(sessions)
  return (
    <section aria-labelledby="summary-title" className="grid gap-x-12 gap-y-5 pt-1 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <div className="min-w-0">
        <h2 id="summary-title" className="font-display text-[1.6rem] leading-[1.15] font-medium tracking-[-0.01em] sm:text-[1.9rem]">Overview</h2>
        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-x-6 gap-y-2.5">
          {/* the key */}
          <ul className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm">
            <li className="inline-flex items-center gap-2"><span className="h-2 w-6 bg-forest" aria-hidden /><span><span className="font-bold">Latest session</span> <span className="text-forest-2">{day(last)}</span></span></li>
            {prev && (
              <li className="inline-flex items-center gap-2"><span className="h-3.5 w-6 bg-lake-soft/55" aria-hidden /><span className="font-bold">{refName}</span></li>
            )}
          </ul>
          {prev && (
            <Segmented label="Compare the latest session with" value={compare} onChange={setCompare}
              options={[{ value: 'average', label: 'Show average' }, { value: 'previous', label: 'Show previous' }]} />
          )}
        </div>
        <dl className="mt-3 flex flex-col gap-2">
          <MeasureBar label="Compensated reps" unit="%" latest={pct(last)} other={refOf(pct)} {...common}
            max={100} better={judgeVs(pct(last), prev ? pct(prev) : null, 'pct')} fmt={(v) => `${Math.round(v)}`} />
          <MeasureBar row={1} label="Clean-rep lean" unit="°" latest={cleanLean(last)} other={refOf(cleanLean)} {...common}
            max={leanMax} limit={last.thresholdDeg} better={judgeVs(cleanLean(last), prev ? cleanLean(prev) : null, 'deg')} fmt={(v) => v.toFixed(1)} />
          <MeasureBar row={2} label={ex.time} unit=" s" latest={reach(last)} other={refOf(reach)} {...common}
            max={reachMax} better="same" fmt={(v) => v.toFixed(2)} />
        </dl>
      </div>
      <AISummary payload={payload} />
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
  { value: 'latest', question: 'How did the last session go?', what: 'Each rep of the latest session', trend: false },
  { value: 'targets', question: 'Where does the leaning happen?', what: 'Compensated reps by target', trend: false },
  { value: 'pct', question: 'Is the leaning going down?', what: 'Compensated reps, each session', trend: true },
  { value: 'lean', question: 'How far do clean reps lean?', what: 'Clean-rep lean, each session', trend: true },
  { value: 'reach', question: 'Are reaches getting quicker?', what: 'Reach time, each session', trend: true },
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
    const x = (i: number) => 5 + (i * (TW - 10)) / Math.max(1, n - 1)
    // up to ~20 reps there is room for each rep's mark; beyond that the marks would pile
    // up, so each rep becomes a thin stem up to its peak (above the dashed limit = compensated)
    const dense = n > 20
    return (
      <svg viewBox={`0 0 ${TW} ${TH}`} className="h-10 w-full" aria-hidden>
        {dense && last.reps.map((r, i) => (
          <line key={r.rep} x1={x(i)} x2={x(i)} y1={TH - 3} y2={y(r.peakDeg)} strokeLinecap="round"
            stroke={r.compensated ? 'var(--color-terra)' : 'var(--color-forest)'} strokeWidth={r.compensated ? 1.3 : 1} opacity={r.compensated ? 1 : 0.55} />
        ))}
        <line x1={0} x2={TW} y1={y(last.thresholdDeg)} y2={y(last.thresholdDeg)} stroke="var(--color-forest)" strokeWidth={1} strokeDasharray="4 3" />
        {!dense && last.reps.map((r, i) => <Mark key={r.rep} cx={x(i)} cy={y(r.peakDeg)} r={2.6} compensated={r.compensated} />)}
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
  // the three trends compare sessions, so with one session they are shown greyed out, not hidden;
  // the target view only exists for exercises with targets, and the time trend takes the exercise's word
  const single = sessions.length < 2
  const first = sessions[0], last = sessions[sessions.length - 1]
  const ex = EXERCISES[exerciseOf(last)]
  const views = VIEWS
    .filter((v) => v.value !== 'targets' || ex.targets)
    .map((v) => (v.value === 'reach' && !ex.targets ? { ...v, question: 'Is the movement getting quicker?', what: `${ex.time}, each session` } : v))
  const [picked, setView] = useState<View>('latest')
  const view: View = views.some((v) => v.value === picked) ? picked : 'latest'
  const yMax = Math.ceil(Math.max(last.thresholdDeg, ...last.reps.map((r) => r.peakDeg)) / 5) * 5
  const current = views.find((v) => v.value === view)!
  // under each graph's title, only the facts it is drawn from (no how-to-read text)
  const caption: Record<View, React.ReactNode> = {
    pct: `${sessions.length} sessions`,
    lean: <>{sessions.length} sessions · limit <span className="tabular-nums">{last.thresholdDeg}°</span></>,
    reach: `${sessions.length} sessions`,
    latest: <>{last.label} · <span className={cn('font-bold tabular-nums', last.summary.compensated ? 'text-terra-deep' : 'text-forest')}>{last.summary.compensated} of {last.summary.reps} reps</span> past the limit</>,
    targets: `Last ${Math.min(3, sessions.length)} ${Math.min(3, sessions.length) === 1 ? 'session' : 'sessions'}`,
  }
  return (
    <section aria-labelledby="graphs-title" className="flex flex-col gap-4">
      <h2 id="graphs-title" className="font-display text-xl leading-tight font-medium">Graphs</h2>
      <div role="group" aria-label="Graph to show" className={cn('grid grid-cols-2 gap-2.5 sm:gap-3', views.length === 4 ? 'lg:grid-cols-4' : 'sm:grid-cols-3 lg:grid-cols-5')}>
        {views.map((v) => {
          const on = v.value === view
          const off = single && v.trend
          return (
            <button key={v.value} type="button" aria-pressed={on} disabled={off} onClick={() => setView(v.value)}
              className={cn(
                'flex min-w-0 flex-col gap-2.5 rounded-xl border-[1.5px] p-3 text-left transition-[background-color,border-color] duration-150 sm:p-3.5',
                off ? 'cursor-not-allowed border-dashed border-wall bg-transparent'
                  : on ? 'cursor-pointer border-forest bg-panel' : 'cursor-pointer border-wall bg-plaster hover:border-eucalyptus hover:bg-panel',
                'focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-eucalyptus',
              )}>
              {off
                ? <svg viewBox={`0 0 ${TW} ${TH}`} className="h-10 w-full" aria-hidden><line x1={4} x2={TW - 4} y1={TH / 2} y2={TH / 2} stroke="var(--color-wall)" strokeWidth={1.5} strokeDasharray="4 4" /></svg>
                : <Thumb view={v.value} sessions={sessions} />}
              <span>
                <span className={cn('block text-[15px] leading-snug font-bold text-pretty', off && 'text-forest-2')}>{v.question}</span>
                <span className="mt-0.5 block text-[13px] leading-snug text-forest-2">{off ? 'Needs a second session' : v.what}</span>
              </span>
            </button>
          )
        })}
      </div>

      <Panel label={current.question} className="px-5 pt-5 pb-5 sm:px-6 sm:pt-6">
        <div key={view} className="rise-in">
        <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
          <div className="min-w-0">
            <h3 className="font-display text-xl leading-tight font-medium text-balance">{current.question}</h3>
            <p className="mt-1 text-[15px] text-pretty text-forest-2">{caption[view]}</p>
          </div>
          {view === 'latest' && (
            <a href={href({ name: 'session', pid, sid: last.id })} onClick={(e) => { e.preventDefault(); onOpenSession(last.id) }}
              className={cn('mt-0.5 inline-flex shrink-0 items-center gap-1.5 rounded text-[15px] font-bold whitespace-nowrap text-eucalyptus underline decoration-eucalyptus/40 underline-offset-4 hover:decoration-eucalyptus', FOCUS)}>
              Open session <ArrowRight className="size-4" aria-hidden />
            </a>
          )}
        </header>

        {(view === 'pct' || view === 'lean' || view === 'reach') && (
          <TrendChart sessions={sessions} measure={view} baseId={first.id} otherId={last.id} tags={['First', 'Latest']}
            threshold={last.thresholdDeg} onOpenSession={onOpenSession} className="mt-4" height={300} />
        )}
        {view === 'latest' && (
          <div className="mt-4">
            <RepStrip reps={last.reps} threshold={last.thresholdDeg} yMax={yMax} onOpen={(n) => onOpenRep(last.id, n)} height={220} />
            <Legend threshold={last.thresholdDeg} className="mt-3" />
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
    <div className="flex flex-col gap-12">
      <Summary sessions={sessions} />
      <Graphs sessions={sessions} pid={pid} onOpenSession={onOpenSession} onOpenRep={onOpenRep} />
    </div>
  )
}

/*
  The patient's overview across every exercise: one row each, with where it stands
  now (compensated reps in the latest session), which way it is heading, a sparkline
  of compensated reps per session, and how much practice it has had. A row opens
  that exercise's tab. The summary (written on open, then kept until the data
  changes) is one point-form note covering every exercise.
*/
export function AllExercises({ patient, sessions }: { patient: Patient; sessions: Session[] }) {
  const rows = patient.exercises.map((id) => ({ ex: EXERCISES[id], ss: sessions.filter((s) => exerciseOf(s) === id) })).filter((r) => r.ss.length)
  const payload = { exercises: rows.map(({ ss }) => summaryPayload(ss)) }
  return (
    <section aria-labelledby="all-title" className="pt-1">
      {/* the summary, with the month of practice beside it (below it on narrow screens) */}
      <div className="grid gap-x-10 gap-y-6 lg:grid-cols-[minmax(0,1fr)_16rem] lg:items-start">
        <div className="min-w-0">
          <h2 id="all-title" className="font-display text-[1.6rem] leading-[1.15] font-medium tracking-[-0.01em] sm:text-[1.9rem]">Overview</h2>
          <div className="mt-3">
            <AISummary auto plain payload={payload} />
          </div>
        </div>
        <PracticeCalendar sessions={sessions} />
      </div>
      <div className="min-w-0">
        <ul className="@container mt-7 flex flex-col divide-y divide-wall overflow-hidden rounded-xl border border-wall bg-panel">
          {rows.map(({ ex, ss }) => {
            const last = ss[ss.length - 1]
            return (
              <li key={ex.id}>
                <a href={href({ name: 'exercise', pid: patient.id, exercise: ex.id })}
                  className={cn('group grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-5 py-4 transition-colors duration-150 hover:bg-plaster @xl:grid-cols-[auto_minmax(0,1fr)_8rem_5.5rem_auto]', FOCUS, 'focus-visible:-outline-offset-3')}>
                  <ExerciseBadge exercise={ex.id} size={44} />
                  <span className="min-w-0">
                    <span className="block text-[17px] font-bold">{ex.name}</span>
                    <span className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[14px] text-forest-2 tabular-nums">
                      <TrendPill sessions={ss} className="text-[13px]" />
                      <span>{ss.length} {ss.length === 1 ? 'session' : 'sessions'} · last {day(last)}</span>
                    </span>
                  </span>
                  <span className="hidden @xl:block" aria-hidden><Thumb view="pct" sessions={ss} /></span>
                  <span className="text-right">
                    <span className="block font-readout text-[1.35rem] leading-none tabular-nums">{Math.round(pct(last))}<span className="ml-0.5 align-[0.55em] text-[0.55em]">%</span></span>
                    <span className="mt-1 block text-[13px] text-forest-2">compensated</span>
                  </span>
                  <ChevronRight className="hidden size-5 text-forest-2 transition-transform duration-150 group-hover:translate-x-0.5 @xl:block" aria-hidden />
                </a>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
