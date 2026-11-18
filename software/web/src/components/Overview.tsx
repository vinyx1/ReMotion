/*
  Session overview: peak lean per target, and reach time across the session.
*/
import {
  CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart,
  Tooltip, XAxis, YAxis,
} from 'recharts'
import { TARGET_REACH } from '../lib/utils'
import type { Rep, Session } from '../types'
import { Card, CardHeader, ResultBadge } from './ui'

const TARGETS = ['GREEN', 'BLUE', 'RED'] as const
const AXIS = { fill: 'var(--color-ink-3)', fontSize: 12, fontFamily: 'var(--font-mono)' }

/** Clean = circle, compensated = diamond (shape as well as colour). */
function Mark({ cx, cy, compensated, size = 6 }: { cx?: number; cy?: number; compensated: boolean; size?: number }) {
  if (cx === undefined || cy === undefined) return null
  if (compensated) {
    const s = size + 1.5
    return <path d={`M${cx},${cy - s}L${cx + s},${cy}L${cx},${cy + s}L${cx - s},${cy}Z`} fill="var(--color-comp)" stroke="white" strokeWidth={1.5} />
  }
  return <circle cx={cx} cy={cy} r={size} fill="var(--color-clean)" stroke="white" strokeWidth={1.5} />
}

function RepTooltip({ active, payload }: { active?: boolean; payload?: { payload: Rep }[] }) {
  if (!active || !payload?.length) return null
  const r = payload[0].payload
  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2 text-sm shadow-md">
      <div className="mb-1.5 flex items-center gap-2">
        <span className="font-medium">Rep {r.rep}</span>
        <span className="text-ink-3">{r.target}</span>
      </div>
      <dl className="grid grid-cols-[auto_auto] gap-x-4 gap-y-0.5 font-mono text-xs tabular-nums">
        <dt className="text-ink-3">peak lean</dt><dd className="text-right">{r.peakDeg.toFixed(1)}°</dd>
        <dt className="text-ink-3">reach</dt><dd className="text-right">{(r.reachMs / 1000).toFixed(2)} s</dd>
        <dt className="text-ink-3">reaction</dt><dd className="text-right">{r.reactMs} ms</dd>
      </dl>
      <ResultBadge compensated={r.compensated} className="mt-2" />
    </div>
  )
}

function Legend({ threshold }: { threshold: number }) {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-ink-2">
      <span className="inline-flex items-center gap-1.5"><svg className="size-3" viewBox="0 0 12 12" aria-hidden><circle cx="6" cy="6" r="5" fill="var(--color-clean)" /></svg>Clean</span>
      <span className="inline-flex items-center gap-1.5"><svg className="size-3" viewBox="0 0 12 12" aria-hidden><path d="M6 0.5L11.5 6L6 11.5L0.5 6Z" fill="var(--color-comp)" /></svg>Compensated</span>
      <span className="inline-flex items-center gap-1.5"><svg className="h-3 w-5" viewBox="0 0 20 12" aria-hidden><line x1="0" x2="20" y1="6" y2="6" stroke="var(--color-ink-3)" strokeDasharray="4 3" strokeWidth="1.5" /></svg>Limit {threshold}°</span>
    </div>
  )
}

export function Overview({ session }: { session: Session }) {
  const reps = session.reps
  const threshold = session.thresholdDeg
  const yMax = Math.ceil(Math.max(threshold, ...reps.map((r) => r.peakDeg)) / 5) * 5 + 5

  // Spread reps sideways within each target so marks don't sit on top of each other
  const placed = reps.map((r) => {
    const group = reps.filter((o) => o.target === r.target)
    const k = group.indexOf(r)
    const offset = group.length > 1 ? (k / (group.length - 1) - 0.5) * 0.4 : 0
    return { ...r, x: TARGETS.indexOf(r.target) + offset }
  })

  return (
    <div className="space-y-4">
      <Legend threshold={threshold} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Peak lean per target" caption="Each mark is one rep. Targets get further away from left to right." />
          <div className="h-72 px-2 pb-3">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 12, right: 16, bottom: 8, left: 0 }}>
                <CartesianGrid stroke="var(--color-line-2)" vertical={false} />
                <XAxis
                  type="number" dataKey="x" domain={[-0.5, 2.5]} ticks={[0, 1, 2]}
                  tickFormatter={(i: number) => `${TARGETS[i]} · ${TARGET_REACH[TARGETS[i]]}`}
                  tick={AXIS} axisLine={{ stroke: 'var(--color-line)' }} tickLine={false}
                />
                <YAxis type="number" dataKey="peakDeg" domain={[0, yMax]} unit="°" tick={AXIS} axisLine={false} tickLine={false} width={44} />
                <ReferenceLine y={threshold} stroke="var(--color-ink-3)" strokeDasharray="4 4" />
                <Tooltip content={<RepTooltip />} cursor={false} />
                <Scatter data={placed} isAnimationActive={false}
                  shape={(p: { cx?: number; cy?: number; payload?: Rep }) => <Mark cx={p.cx} cy={p.cy} compensated={!!p.payload?.compensated} />} />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <CardHeader title="Reach time across the session" caption="Slower reaches late in a session can point to fatigue." />
          <div className="h-72 px-2 pb-3">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={reps.map((r) => ({ ...r, reachS: r.reachMs / 1000 }))} margin={{ top: 12, right: 16, bottom: 8, left: 0 }}>
                <CartesianGrid stroke="var(--color-line-2)" vertical={false} />
                <XAxis dataKey="rep" tick={AXIS} axisLine={{ stroke: 'var(--color-line)' }} tickLine={false}
                  label={{ value: 'Rep', position: 'insideBottomRight', offset: -2, fill: 'var(--color-ink-3)', fontSize: 12 }} />
                <YAxis domain={[0, 'auto']} unit=" s" tick={AXIS} axisLine={false} tickLine={false} width={48} />
                <Tooltip content={<RepTooltip />} cursor={{ stroke: 'var(--color-line)' }} />
                <Line type="linear" dataKey="reachS" stroke="var(--color-line)" strokeWidth={2} isAnimationActive={false}
                  dot={(p: { cx?: number; cy?: number; payload?: Rep; index?: number }) =>
                    <Mark key={p.index} cx={p.cx} cy={p.cy} compensated={!!p.payload?.compensated} size={5.5} />}
                  activeDot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  )
}
