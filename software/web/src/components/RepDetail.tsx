/*
  One rep in detail: trunk lean and wrist speed over time.
*/
import { useState } from 'react'
import {
  CartesianGrid, Line, LineChart, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import type { Rep, Session } from '../types'
import { Card, CardHeader, Eyebrow, ResultBadge, Select } from './ui'

const AXIS = { fill: 'var(--color-ink-3)', fontSize: 12, fontFamily: 'var(--font-mono)' }

function TraceChart({ rep, field, unit, threshold }: {
  rep: Rep
  field: 'trunkDeg' | 'wristDps'
  unit: string
  threshold?: number
}) {
  const tr = rep.trace!
  const data = tr.t.map((t, i) => ({ t, v: tr[field][i] }))
  return (
    <div className="h-64 px-2 pb-3">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 12, right: 16, bottom: 8, left: 0 }}>
          <CartesianGrid stroke="var(--color-line-2)" vertical={false} />
          <ReferenceArea x1={0} x2={tr.reachEndS} fill="var(--color-line-2)" fillOpacity={1} ifOverflow="hidden" />
          <XAxis type="number" dataKey="t" domain={['dataMin', 'dataMax']} tickFormatter={(v: number) => `${v.toFixed(1)} s`}
            tick={AXIS} axisLine={{ stroke: 'var(--color-line)' }} tickLine={false} />
          <YAxis domain={[0, 'auto']} tick={AXIS} axisLine={false} tickLine={false} width={unit.length > 2 ? 68 : 44} unit={unit} />
          {threshold !== undefined && <ReferenceLine y={threshold} stroke="var(--color-ink-3)" strokeDasharray="4 4" />}
          <Tooltip
            cursor={{ stroke: 'var(--color-ink-3)' }}
            content={({ active, payload }) =>
              active && payload?.length ? (
                <div className="rounded-lg border border-line bg-surface px-3 py-1.5 font-mono text-xs shadow-md tabular-nums">
                  {(payload[0].payload as { t: number }).t.toFixed(2)} s · {Number(payload[0].value).toFixed(1)}{unit}
                </div>
              ) : null}
          />
          <Line type="monotone" dataKey="v" stroke="var(--color-clean)" strokeWidth={2} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

export function RepDetail({ session }: { session: Session }) {
  const biggest = [...session.reps].sort((a, b) => b.peakDeg - a.peakDeg)[0]
  const [n, setN] = useState(biggest.rep)
  const rep = session.reps.find((r) => r.rep === n) ?? biggest

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
        <div>
          <Eyebrow>Rep</Eyebrow>
          <Select
            label="Rep"
            value={String(rep.rep)}
            onChange={(v) => setN(Number(v))}
            options={session.reps.map((r) => ({ value: String(r.rep), label: `Rep ${r.rep} · ${r.target} · ${r.peakDeg.toFixed(1)}°` }))}
            className="mt-1 w-56"
          />
        </div>
        <dl className="flex flex-wrap gap-x-8 gap-y-2">
          {[
            ['Target', rep.target],
            ['Peak lean', `${rep.peakDeg.toFixed(1)}°`],
            ['Reaction', `${rep.reactMs} ms`],
            ['Reach', `${(rep.reachMs / 1000).toFixed(2)} s`],
            ['Wrist bursts', String(rep.bursts)],
          ].map(([k, v]) => (
            <div key={k}>
              <dt className="text-xs font-medium text-ink-3">{k}</dt>
              <dd className="mt-1 font-mono text-lg tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
        <ResultBadge compensated={rep.compensated} className="mb-1" />
      </div>

      {rep.trace ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader title="Trunk lean" caption="Shaded: hand leaves HOME → target press. Dashed: the limit." />
            <TraceChart rep={rep} field="trunkDeg" unit="°" threshold={session.thresholdDeg} />
          </Card>
          <Card>
            <CardHeader title="Wrist rotation speed" caption="Fewer separate bursts = a smoother reach." />
            <TraceChart rep={rep} field="wristDps" unit=" °/s" />
          </Card>
        </div>
      ) : (
        <Card className="px-6 py-10 text-center">
          <p className="font-medium">No samples were recorded for this rep.</p>
          <p className="mt-1 text-sm text-ink-3">Keep sample streaming on (D1) while recording.</p>
        </Card>
      )}
    </div>
  )
}
