import type { Session } from '../types'
import { Card } from './ui'

export function AllSessions({ sessions, current, onPick }: {
  sessions: Session[]
  current: string
  onPick: (id: string) => void
}) {
  return (
    <Card className="overflow-hidden">
      <table className="w-full text-sm">
        <thead className="border-b border-line bg-paper/60 text-left text-xs font-medium text-ink-3">
          <tr>
            <th className="px-5 py-3 font-medium">Session</th>
            <th className="px-5 py-3 text-right font-medium">Reps</th>
            <th className="px-5 py-3 font-medium">Compensated</th>
            <th className="px-5 py-3 text-right font-medium">Median reach</th>
            <th className="px-5 py-3 text-right font-medium">Highest lean</th>
          </tr>
        </thead>
        <tbody>
          {[...sessions].reverse().map((s) => (
            <tr
              key={s.id}
              className={`border-b border-line-2 last:border-0 ${s.id === current ? 'bg-line-2/60' : 'hover:bg-line-2/40'}`}
            >
              <td className="px-5 py-3">
                <button type="button" onClick={() => onPick(s.id)} className="text-left font-medium hover:underline focus-visible:outline-2 focus-visible:outline-brand">
                  {s.label}
                </button>
                {s.simulated && <span className="ml-2 text-xs text-ink-3">simulated</span>}
              </td>
              <td className="px-5 py-3 text-right font-mono tabular-nums">{s.summary.reps}</td>
              <td className="px-5 py-3">
                <div className="flex items-center gap-3">
                  <div className="h-1.5 w-32 overflow-hidden rounded-full bg-line-2" aria-hidden>
                    <div className="h-full rounded-full bg-comp" style={{ width: `${s.summary.pctCompensated}%` }} />
                  </div>
                  <span className="font-mono tabular-nums">
                    {s.summary.compensated}/{s.summary.reps} · {Math.round(s.summary.pctCompensated)}%
                  </span>
                </div>
              </td>
              <td className="px-5 py-3 text-right font-mono tabular-nums">{s.summary.medianReachS.toFixed(2)} s</td>
              <td className="px-5 py-3 text-right font-mono tabular-nums">{s.summary.maxPeakDeg.toFixed(1)}°</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  )
}
