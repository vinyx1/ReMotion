/*
  One session's reps in order, each at its peak trunk lean, against the limit.
  Laid out in HTML with percentage positions, so it needs no measuring and holds
  its shape through any resize. Every mark is a real button that opens that rep.
*/
import type { Rep } from '../types'
import { FOCUS, Mark } from './ui'
import { cn } from '../lib/utils'

export function RepStrip({ reps, threshold, yMax, onOpen, height = 128 }: {
  reps: Rep[]
  threshold: number
  yMax: number
  onOpen: (rep: number) => void
  height?: number
}) {
  const pad = 12 // px above and below the plot
  const top = (v: number) => pad + (1 - Math.min(v, yMax) / yMax) * (height - 2 * pad)
  const left = (i: number) => (reps.length > 1 ? (i / (reps.length - 1)) * 100 : 50)
  const ticks = [0, threshold, Math.round(yMax / 5) * 5].filter((v, i, a) => v <= yMax && a.indexOf(v) === i)

  return (
    <div role="group" aria-label="Peak lean of each rep, in order" className="flex w-full" style={{ height }}>
      {/* axis labels */}
      <div className="relative w-10 shrink-0" aria-hidden>
        {ticks.map((v) => (
          <span key={v} className={cn('absolute right-2 -translate-y-1/2 font-readout text-[12px] tabular-nums', v === threshold ? 'text-forest' : 'text-forest-2')}
            style={{ top: top(v) }}>{v}°</span>
        ))}
      </div>
      {/* plot: gridlines, the dashed limit, then the marks (inset so edge marks stay inside) */}
      <div className="relative min-w-0 flex-1">
        {ticks.map((v) => v === threshold ? (
          // the limit: the same 1.5px, 6/5 dash as the legend and every other chart
          <svg key={v} aria-hidden width="100%" height="3" className="absolute inset-x-0" style={{ top: top(v) - 1.5 }}>
            <line x1="0" x2="100%" y1="1.5" y2="1.5" stroke="var(--color-forest)" strokeWidth={1.5} strokeDasharray="6 5" />
          </svg>
        ) : (
          <div key={v} aria-hidden className="absolute inset-x-0 border-t border-grid" style={{ top: top(v) }} />
        ))}
        <div className="absolute inset-y-0 right-3 left-3">
          {reps.map((r, i) => (
            <button
              key={r.rep}
              type="button"
              onClick={() => onOpen(r.rep)}
              title={`Rep ${r.rep} · ${r.compensated ? 'Compensated' : 'Clean'} · ${r.peakDeg.toFixed(1)}°`}
              aria-label={`Rep ${r.rep}, ${r.target.toLowerCase()} target, peak lean ${r.peakDeg.toFixed(1)} degrees, ${r.compensated ? 'compensated' : 'clean'}. Open rep.`}
              className={cn('group absolute grid size-7 -translate-x-1/2 -translate-y-1/2 cursor-pointer place-items-center rounded-full hover:bg-eucalyptus/15', FOCUS)}
              style={{ left: `${left(i)}%`, top: top(r.peakDeg) }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden className="pop-in overflow-visible"
                style={{ '--delay': `${Math.min(i * 45, 600)}ms` } as React.CSSProperties}>
                <Mark cx={8} cy={8} compensated={r.compensated} />
              </svg>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
