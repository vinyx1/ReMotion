/*
  Sessions: every session as a row (SessionTable), and one session on its own page
  (SessionDetail): peak lean per target, reach time across the session, every rep.
*/
import { ChevronLeft, ChevronRight } from 'lucide-react'
import {
  CartesianGrid, Line, LineChart, ReferenceLine, Scatter, ScatterChart, Tooltip, XAxis, YAxis,
} from 'recharts'
import { cleanLean, TARGET_NAME, TARGET_REACH, TARGETS } from '../lib/stats'
import { cn } from '../lib/utils'
import type { Rep, Session } from '../types'
import { Button, ChartBox, FOCUS, Legend, Mark, Panel, PanelTitle, ResultTag, FigureStrip } from './ui'

const AXIS = { fill: 'var(--color-forest-2)', fontSize: 13, fontFamily: 'var(--font-readout)' }
const TH = 'px-3 py-2.5 text-left text-sm font-bold text-forest-2 whitespace-nowrap'
const TD = 'px-3 py-2.5 font-readout tabular-nums whitespace-nowrap'

function RepTip({ active, payload }: { active?: boolean; payload?: { payload: Rep }[] }) {
  if (!active || !payload?.length) return null
  const r = payload[0].payload
  return (
    <div className="rounded-lg border border-wall bg-panel px-3 py-2 text-sm text-forest shadow-[0_2px_4px_rgb(31_45_39/0.08),0_10px_24px_-14px_rgb(31_45_39/0.5)]">
      <p className="font-bold">Rep {r.rep} · {TARGET_NAME[r.target]} target</p>
      <p className="font-readout tabular-nums">{r.peakDeg.toFixed(1)}° peak · {(r.reachMs / 1000).toFixed(2)} s reach</p>
      <ResultTag compensated={r.compensated} className="mt-1" />
    </div>
  )
}

export function SessionTable({ sessions, onPick }: { sessions: Session[]; onPick: (id: string) => void }) {
  return (
    <Panel label="All sessions" className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[15px]">
          <caption className="sr-only">All sessions, newest first. Select a session to open it.</caption>
          <thead className="border-b border-wall">
            <tr>
              <th scope="col" className={cn(TH, 'pl-5')}>Session</th>
              <th scope="col" className={cn(TH, 'text-right')}>Reps</th>
              <th scope="col" className={TH}>Each rep</th>
              <th scope="col" className={TH}>Compensated</th>
              <th scope="col" className={cn(TH, 'text-right')}>Clean-rep lean</th>
              <th scope="col" className={cn(TH, 'text-right')}>Highest lean</th>
              <th scope="col" className={cn(TH, 'pr-5 text-right')}>Reach time</th>
            </tr>
          </thead>
          <tbody>
            {[...sessions].reverse().map((s) => {
              const lean = cleanLean(s)
              return (
                <tr key={s.id} className="border-b border-wall/70 last:border-0 hover:bg-wash/60">
                  <td className="py-0 pl-2">
                    <button type="button" onClick={() => onPick(s.id)}
                      className={cn('flex w-full cursor-pointer items-center gap-2 rounded-md px-3 py-2.5 text-left font-bold underline decoration-wall underline-offset-4 hover:decoration-forest', FOCUS)}>
                      {s.label}
                    </button>
                  </td>
                  <td className={cn(TD, 'text-right')}>{s.summary.reps}</td>
                  <td className="px-3 py-2.5">
                    {/* the session at a glance: each rep in order, clean circle or compensated diamond */}
                    <svg width={s.reps.length * 13} height={14} aria-label={`${s.summary.compensated} of ${s.summary.reps} reps compensated`} role="img" className="block">
                      {s.reps.map((r, i) => <Mark key={r.rep} cx={6.5 + i * 13} cy={7} r={4} compensated={r.compensated} />)}
                    </svg>
                  </td>
                  <td className={TD}>
                    <span className="inline-flex items-center gap-3">
                      <span className="w-10 text-right">{Math.round(s.summary.pctCompensated)}%</span>
                      <span className="relative h-2 w-24 rounded-full bg-grid" aria-hidden>
                        <span className="absolute inset-y-0 left-0 rounded-full bg-terra" style={{ width: `${s.summary.pctCompensated}%` }} />
                      </span>
                    </span>
                  </td>
                  <td className={cn(TD, 'text-right')}>{lean === null ? '—' : `${lean.toFixed(1)}°`}</td>
                  <td className={cn(TD, 'text-right')}>{s.summary.maxPeakDeg.toFixed(1)}°</td>
                  <td className={cn(TD, 'pr-5 text-right')}>{s.summary.medianReachS.toFixed(2)} s</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Panel>
  )
}

function PerTarget({ session }: { session: Session }) {
  const reps = session.reps
  const yMax = Math.ceil(Math.max(session.thresholdDeg, ...reps.map((r) => r.peakDeg)) / 5) * 5 + 5
  // spread reps sideways within each target so marks don't sit on top of each other
  const placed = reps.map((r) => {
    const group = reps.filter((o) => o.target === r.target)
    const k = group.indexOf(r)
    return { ...r, x: TARGETS.indexOf(r.target) + (group.length > 1 ? (k / (group.length - 1) - 0.5) * 0.44 : 0) }
  })
  return (
    <Panel label="Peak lean per target" className="p-5">
      <PanelTitle as="h3" title="Peak lean per target" caption="Targets sit further away from left to right." />
      <ChartBox height={288} className="mt-3">
        {(w, h) => (
          <ScatterChart width={w} height={h} margin={{ top: 10, right: 12, bottom: 4, left: 0 }}>
            <CartesianGrid stroke="var(--color-grid)" vertical={false} />
            <XAxis type="number" dataKey="x" domain={[-0.5, 2.5]} ticks={[0, 1, 2]}
              tickFormatter={(i: number) => `${TARGET_NAME[TARGETS[i]]} · ${TARGET_REACH[TARGETS[i]]}`}
              tick={AXIS} axisLine={{ stroke: 'var(--color-wall)' }} tickLine={false} />
            <YAxis type="number" dataKey="peakDeg" domain={[0, yMax]} ticks={Array.from({ length: yMax / 5 + 1 }, (_, i) => i * 5)}
              tick={AXIS} axisLine={false} tickLine={false} width={44}
              tickFormatter={(v: number) => `${v}°`} />
            <ReferenceLine y={session.thresholdDeg} stroke="var(--color-forest)" strokeDasharray="6 5" strokeWidth={1.5} />
            <Tooltip content={<RepTip />} cursor={false} />
            <Scatter data={placed} isAnimationActive={false}
              shape={(p: { cx?: number; cy?: number; payload?: Rep }) =>
                p.cx === undefined || p.cy === undefined ? <g /> : <Mark cx={p.cx} cy={p.cy} compensated={!!p.payload?.compensated} />} />
          </ScatterChart>
        )}
      </ChartBox>
    </Panel>
  )
}

function ReachTime({ session }: { session: Session }) {
  const data = session.reps.map((r) => ({ ...r, reachS: r.reachMs / 1000 }))
  return (
    <Panel label="Reach time across the session" className="p-5">
      <PanelTitle as="h3" title="Reach time across the session" caption="Slower reaches late in a session can point to fatigue." />
      <ChartBox height={288} className="mt-3">
        {(w, h) => (
          <LineChart width={w} height={h} data={data} margin={{ top: 10, right: 12, bottom: 4, left: 0 }}>
            <CartesianGrid stroke="var(--color-grid)" vertical={false} />
            <XAxis dataKey="rep" tick={AXIS} axisLine={{ stroke: 'var(--color-wall)' }} tickLine={false}
              tickFormatter={(v: number) => `#${v}`} />
            <YAxis domain={[0, Math.ceil(Math.max(...data.map((d) => d.reachS)) * 2) / 2]} allowDecimals tickCount={4}
              tick={AXIS} axisLine={false} tickLine={false} width={60} tickFormatter={(v: number) => `${v.toFixed(1)} s`} />
            <Tooltip content={<RepTip />} cursor={{ stroke: 'var(--color-wall)' }} />
            <Line type="linear" dataKey="reachS" stroke="var(--color-wall)" strokeWidth={2.5} isAnimationActive={false} activeDot={false}
              dot={(p: { cx?: number; cy?: number; payload?: Rep; index?: number }) =>
                p.cx === undefined || p.cy === undefined ? <g key={p.index} /> : <Mark key={p.index} cx={p.cx} cy={p.cy} compensated={!!p.payload?.compensated} r={4.5} />} />
          </LineChart>
        )}
      </ChartBox>
    </Panel>
  )
}

function RepTable({ session, onOpenRep }: { session: Session; onOpenRep: (rep: number) => void }) {
  return (
    <Panel label="Reps in this session" className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[15px]">
          <caption className="sr-only">Every rep in {session.label}. Select a rep to open its detail.</caption>
          <thead className="border-b border-wall">
            <tr>
              <th scope="col" className={cn(TH, 'pl-5')}>Rep</th>
              <th scope="col" className={TH}>Target</th>
              <th scope="col" className={cn(TH, 'text-right')}>Peak lean</th>
              <th scope="col" className={cn(TH, 'text-right')}>Reaction</th>
              <th scope="col" className={cn(TH, 'text-right')}>Reach</th>
              <th scope="col" className={cn(TH, 'text-right')}>Wrist bursts</th>
              <th scope="col" className={cn(TH, 'pr-5')}>Result</th>
            </tr>
          </thead>
          <tbody>
            {session.reps.map((r) => (
              <tr key={r.rep} className="border-b border-wall/70 last:border-0 hover:bg-plaster">
                <td className="py-0 pl-2">
                  <button type="button" onClick={() => onOpenRep(r.rep)}
                    className={cn('flex cursor-pointer items-center gap-2 rounded-md px-3 py-2.5 font-bold underline decoration-wall underline-offset-4 hover:decoration-forest', FOCUS)}>
                    Rep {r.rep}
                  </button>
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap">{TARGET_NAME[r.target]} <span className="font-readout text-forest-2 tabular-nums">· {TARGET_REACH[r.target]}</span></td>
                <td className={cn(TD, 'text-right', r.compensated && 'text-terra-deep')}>{r.peakDeg.toFixed(1)}°</td>
                <td className={cn(TD, 'text-right')}>{r.reactMs} ms</td>
                <td className={cn(TD, 'text-right')}>{(r.reachMs / 1000).toFixed(2)} s</td>
                <td className={cn(TD, 'text-right')}>{r.bursts}</td>
                <td className="px-3 py-2.5 pr-5"><ResultTag compensated={r.compensated} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  )
}

/** One session: its numbers, peak lean per target, reach time, and every rep. */
/** One session's numbers in one strip, hung on the wall in the patient header. */
export function SessionPlates({ session }: { session: Session }) {
  const s = session.summary
  const lean = cleanLean(session)
  const over = s.maxPeakDeg > session.thresholdDeg
  return (
    <FigureStrip label={`${session.label} at a glance`} className="grid-cols-2 sm:grid-cols-5" items={[
      { label: 'Reps', value: String(s.reps), note: 'in this session' },
      { label: 'Compensated', value: `${Math.round(s.pctCompensated)}%`, note: `${s.compensated} of ${s.reps} reps` },
      { label: 'Clean-rep lean', short: 'Clean lean', value: lean === null ? '—' : `${lean.toFixed(1)}°`, note: 'median peak' },
      { label: 'Highest lean', value: `${s.maxPeakDeg.toFixed(1)}°`, note: over ? 'past the limit' : 'within the limit', tone: over ? 'comp' : undefined },
      { label: 'Reach time', value: `${s.medianReachS.toFixed(2)} s`, note: 'median' },
    ]} />
  )
}

export function SessionDetail({ session, prev, next, onGo, onOpenRep }: {
  session: Session
  prev?: Session
  next?: Session
  onGo: (id: string) => void
  onOpenRep: (rep: number) => void
}) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-3">
        <div className="flex items-center gap-2">
          <Button label="Previous session" onClick={() => prev && onGo(prev.id)} disabled={!prev} className="w-10 px-0">
            <ChevronLeft className="size-5" aria-hidden />
          </Button>
          <h2 className="px-1 font-display text-[1.75rem] leading-tight font-medium tracking-[-0.01em]">{session.label}</h2>
          <Button label="Next session" onClick={() => next && onGo(next.id)} disabled={!next} className="w-10 px-0">
            <ChevronRight className="size-5" aria-hidden />
          </Button>
        </div>
        <Legend threshold={session.thresholdDeg} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <PerTarget session={session} />
        <ReachTime session={session} />
      </div>
      <RepTable session={session} onOpenRep={onOpenRep} />
    </div>
  )
}
