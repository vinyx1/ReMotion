/*
  The trend chart: one measure (compensated reps, clean-rep lean or reach time)
  across every session, one point per session, two of them tagged (first and
  latest on the Overview). Points are buttons that open their session.
*/
import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, Tooltip, XAxis, YAxis } from 'recharts'
import { day, type Measure, MEASURES } from '../lib/stats'
import type { Session } from '../types'
import { ChartBox } from './ui'

// the line draws itself in from the first session to the latest; still for reduced motion
const DRAW = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  ? { isAnimationActive: false }
  : { isAnimationActive: true, animationDuration: 900, animationEasing: 'ease-out' as const }

const AXIS = { fill: 'var(--color-forest-2)', fontSize: 13, fontFamily: 'var(--font-readout)' }

/** One measure across every session, one point per session; two points carry a tag. */
export function TrendChart({ sessions, measure, baseId, otherId, tags = ['Baseline', 'Compared'], threshold, onOpenSession, height = 256, className }: {
  sessions: Session[]
  measure: Measure
  baseId: string
  otherId: string
  tags?: [string, string]
  threshold: number
  onOpenSession: (id: string) => void
  height?: number
  className?: string
}) {
  const m = MEASURES.find((x) => x.value === measure)!
  const data = sessions.map((s) => ({ id: s.id, day: day(s), label: s.label, v: m.get(s), reps: s.summary.reps }))
  const fmt = (v: number) => (m.unit === ' s' ? `${v.toFixed(2)} s` : m.unit === '°' ? `${v.toFixed(1)}°` : `${Math.round(v)}%`)
  const domain: [number, number] = measure === 'pct' ? [0, 100] : measure === 'lean' ? [0, Math.max(threshold + 2, 6)] : [0, 'auto' as unknown as number]

  return (
      <ChartBox height={height} className={className}>
        {(w, h) => { const wide = w >= 500; return (
          <ComposedChart width={w} height={h} data={data} margin={{ top: 26, right: w < 500 ? 24 : 92, bottom: 4, left: 4 }}>
            <defs>
              <linearGradient id={`trend-wash-${measure}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-eucalyptus)" stopOpacity={0.55} />
                <stop offset="60%" stopColor="var(--color-eucalyptus)" stopOpacity={0.2} />
                <stop offset="100%" stopColor="var(--color-eucalyptus)" stopOpacity={0.06} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="var(--color-grid)" vertical={false} />
            <XAxis dataKey="day" tick={AXIS} axisLine={{ stroke: 'var(--color-wall)' }} tickLine={false} interval="preserveStartEnd" minTickGap={28} />
            <YAxis domain={domain} tick={AXIS} axisLine={false} tickLine={false} width={w < 500 ? 46 : 60} tickFormatter={(v: number) => fmt(v)} />
            {measure === 'lean' && <ReferenceLine y={threshold} stroke="var(--color-forest)" strokeDasharray="6 5" strokeWidth={1.5} />}
            <Tooltip
              cursor={{ stroke: 'var(--color-wall)' }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const p = payload[0].payload as (typeof data)[number]
                return (
                  <div className="rounded-lg border border-wall bg-panel px-3 py-2 text-sm text-forest shadow-[0_2px_4px_rgb(31_45_39/0.08),0_10px_24px_-14px_rgb(31_45_39/0.5)]">
                    <p className="font-bold">{p.label}</p>
                    <p className="font-readout tabular-nums">{p.v === null ? 'no clean reps' : fmt(p.v)} · {p.reps} reps</p>
                  </div>
                )
              }}
            />
            {/* a eucalyptus wash under the line, so the trend reads as a shape and not only a stroke */}
            <Area type="linear" dataKey="v" stroke="none" fill={`url(#trend-wash-${measure})`} {...DRAW} connectNulls activeDot={false} tooltipType="none" />
            <Line
              type="linear" dataKey="v" stroke="var(--color-forest)" strokeWidth={3} {...DRAW} connectNulls
              activeDot={false}
              dot={(p: { cx?: number; cy?: number; index?: number; payload?: (typeof data)[number] }) => {
                const d = p.payload
                if (p.cx === undefined || p.cy === undefined || !d || d.v === null) return <g key={p.index} />
                const tag = d.id === baseId ? tags[0] : d.id === otherId ? tags[1] : null
                return (
                  <g
                    key={p.index}
                    role="button"
                    tabIndex={0}
                    aria-label={`${d.label}: ${fmt(d.v)}. Open session.`}
                    onClick={() => onOpenSession(d.id)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenSession(d.id) } }}
                    className="group cursor-pointer outline-none"
                  >
                    <circle cx={p.cx} cy={p.cy} r={14} fill="transparent" />
                    <circle cx={p.cx} cy={p.cy} r={11} fill="none" stroke="var(--color-eucalyptus)" strokeWidth={2.5}
                      className="opacity-0 group-hover:opacity-60 group-focus-visible:opacity-100" />
                    <circle cx={p.cx} cy={p.cy} r={tag ? 6.5 : 5} fill={tag ? 'var(--color-forest)' : 'var(--color-panel)'}
                      stroke="var(--color-forest)" strokeWidth={2.2} />
                    {tag && (
                      // The tag sits where the line leaves room: above-right of the first point (clear of
                      // the axis), beside the last point (in the right margin when the chart is wide, else
                      // on its left), and above or below a middle point
                      // depending on its neighbour. A panel-coloured halo keeps it readable over the line.
                      <text
                        x={p.index === 0 ? p.cx + 10 : p.index === data.length - 1 ? (wide ? p.cx + 12 : p.cx - 14) : p.cx}
                        y={(() => {
                          if (p.index === data.length - 1) return p.cy + 4 // beside the last point, left of it
                          const n = data[p.index === 0 ? 1 : (p.index ?? 0) - 1]?.v
                          const below = n !== null && n !== undefined && d.v < n && p.cy < h - 40
                          return below ? p.cy + 26 : p.cy - 14
                        })()}
                        textAnchor={p.index === 0 || (wide && p.index === data.length - 1) ? 'start' : p.index === data.length - 1 ? 'end' : 'middle'}
                        stroke="var(--color-panel)" strokeWidth={5} strokeLinejoin="round" paintOrder="stroke"
                        className="fill-forest text-[13px] font-bold">{tag}</text>
                    )}
                  </g>
                )
              }}
            />
          </ComposedChart>
        ) }}
      </ChartBox>
  )
}
