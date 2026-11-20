/*
  Replay: a clean rep and a compensated rep, side by side, on ONE clock.
  Time 0 = the hand leaves HOME in both panels, so the two reaches line up.
*/
import { Pause, Play, RotateCcw } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { indexAt, phaseName, sampleAt } from '../lib/utils'
import type { Rep, Session } from '../types'
import { Figure3D } from './Figure3D'
import { Card, ResultBadge, Select } from './ui'

const SPEEDS = [0.5, 1] as const

/** A clock that runs from `start` to `end` seconds when playing. */
function usePlayback(start: number, end: number) {
  const [t, setT] = useState(start)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState<number>(1)
  const last = useRef<number | null>(null)

  useEffect(() => {
    if (!playing) return
    let frame = 0
    const tick = (now: number) => {
      const dt = last.current === null ? 0 : (now - last.current) / 1000
      last.current = now
      let stop = false
      setT((prev) => {
        const next = Math.max(prev, start) + dt * speed
        if (next >= end) { stop = true; return end }
        return next
      })
      if (stop) setPlaying(false)
      else frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => { cancelAnimationFrame(frame); last.current = null }
  }, [playing, speed, start, end])

  const toggle = useCallback(() => {
    if (!playing && t >= end) setT(start)       // at the end: play again from the start
    setPlaying((p) => !p)
  }, [playing, t, start, end])

  const restart = useCallback(() => { setT(start); setPlaying(true) }, [start])

  return { t, setT, playing, setPlaying, toggle, restart, speed, setSpeed }
}

function TraceStrip({ rep, t, domain, yMax, threshold }: {
  rep: Rep
  t: number
  domain: [number, number]
  yMax: number
  threshold: number
}) {
  const trace = rep.trace!
  const W = 600
  const H = 120
  const pad = { l: 34, r: 8, t: 8, b: 22 }
  const x = (v: number) => pad.l + ((v - domain[0]) / (domain[1] - domain[0])) * (W - pad.l - pad.r)
  const y = (v: number) => pad.t + (1 - v / yMax) * (H - pad.t - pad.b)
  const upTo = indexAt(trace.t, t)
  const path = (n: number) => trace.t.slice(0, n).map((tt, i) => `${i ? 'L' : 'M'}${x(tt).toFixed(1)},${y(trace.trunkDeg[i]).toFixed(1)}`).join('')
  const now = sampleAt(trace.t, trace.trunkDeg, t)
  const color = now > threshold ? 'var(--color-comp)' : 'var(--color-clean)'
  const ticks = [0, Math.round(threshold), Math.round(yMax / 10) * 10].filter((v, i, a) => v <= yMax && a.indexOf(v) === i)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Trunk lean over time for rep ${rep.rep}`}>
      {/* the reach itself: leaving HOME -> target press */}
      <rect x={x(0)} y={pad.t} width={x(trace.reachEndS) - x(0)} height={H - pad.t - pad.b} fill="var(--color-line-2)" />
      {ticks.map((v) => (
        <g key={v}>
          <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} stroke="var(--color-line)" strokeWidth={v === 0 ? 1 : 0.5} />
          <text x={pad.l - 6} y={y(v) + 3.5} textAnchor="end" className="fill-ink-3 font-mono text-[10px] tabular-nums">{v}°</text>
        </g>
      ))}
      <line x1={pad.l} x2={W - pad.r} y1={y(threshold)} y2={y(threshold)} stroke="var(--color-ink-3)" strokeDasharray="4 4" />
      {/* full trace faint, played part solid */}
      <path d={path(trace.t.length)} fill="none" stroke="var(--color-line)" strokeWidth={2} />
      <path d={path(upTo + 1)} fill="none" stroke="var(--color-ink-2)" strokeWidth={2} />
      <line x1={x(t)} x2={x(t)} y1={pad.t} y2={H - pad.b} stroke="var(--color-ink-3)" strokeWidth={1} />
      <circle cx={x(t)} cy={y(now)} r={4.5} fill={color} stroke="white" strokeWidth={2} />
      {[domain[0], 0, trace.reachEndS].map((v, i) => (
        <text key={i} x={x(v)} y={H - 6} textAnchor="middle" className="fill-ink-3 font-mono text-[10px] tabular-nums">
          {i === 0 ? 'cue' : i === 1 ? 'leave HOME' : 'press'}
        </text>
      ))}
    </svg>
  )
}

function ReplayPanel({ rep, reps, onPick, t, domain, yMax, threshold, kind }: {
  rep: Rep
  reps: Rep[]
  onPick: (n: number) => void
  t: number
  domain: [number, number]
  yMax: number
  threshold: number
  kind: 'clean' | 'comp'
}) {
  const trace = rep.trace!
  const trunk = sampleAt(trace.t, trace.trunkDeg, t)
  const over = trunk > threshold
  const shown = trace.t.slice(0, indexAt(trace.t, t) + 1).map((_, i) => trace.trunkDeg[i])
  const peak = Math.max(...shown)
  const phase = t > trace.t[trace.t.length - 1] ? 'Done' : phaseName(trace.state[indexAt(trace.t, t)])

  return (
    <Card className="overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3">
        <div className="flex items-center gap-3">
          <h3 className="text-[15px] font-semibold whitespace-nowrap">{kind === 'clean' ? 'Clean reach' : 'Compensated reach'}</h3>
          <ResultBadge compensated={rep.compensated} />
        </div>
        <Select
          label={kind === 'clean' ? 'Clean rep' : 'Compensated rep'}
          value={String(rep.rep)}
          onChange={(v) => onPick(Number(v))}
          options={reps.map((r) => ({ value: String(r.rep), label: `Rep ${r.rep} · ${r.target} · ${r.peakDeg.toFixed(1)}°` }))}
          className="w-full sm:w-52"
        />
      </header>

      <div className="relative bg-surface">
        {/* Readout sits above the figure on phones and over its empty corner from sm up */}
        <div className="px-5 pt-4 sm:pointer-events-none sm:absolute sm:top-4 sm:left-5 sm:p-0">
          <p className="text-xs font-medium text-ink-3">Trunk lean</p>
          <p className={`font-mono text-4xl font-medium tabular-nums ${over ? 'text-comp-text' : 'text-ink'}`}>
            {trunk.toFixed(1)}°
          </p>
          <p className="mt-1 font-mono text-xs text-ink-3 tabular-nums">peak {peak.toFixed(1)}° · limit {threshold}°</p>
        </div>
        <div className="aspect-[16/10]">
          <Figure3D trunkDeg={trunk} t={t} reachEndS={trace.reachEndS} target={rep.target} over={over} />
        </div>
        <p className="pointer-events-none absolute top-4 right-5 rounded-full border border-line bg-surface/90 px-2.5 py-1 text-xs font-medium text-ink-2">
          {phase}
        </p>
      </div>

      <div className="border-t border-line px-3 pt-2 pb-1">
        <TraceStrip rep={rep} t={t} domain={domain} yMax={yMax} threshold={threshold} />
      </div>
    </Card>
  )
}

export function Replay({ session }: { session: Session }) {
  const withTrace = session.reps.filter((r) => r.trace)
  const clean = [...withTrace.filter((r) => !r.compensated)].sort((a, b) => a.peakDeg - b.peakDeg)
  const comp = [...withTrace.filter((r) => r.compensated)].sort((a, b) => b.peakDeg - a.peakDeg)
  const [cleanN, setCleanN] = useState(clean[0]?.rep)
  const [compN, setCompN] = useState(comp[0]?.rep)

  const a = clean.find((r) => r.rep === cleanN) ?? clean[0]
  const b = comp.find((r) => r.rep === compN) ?? comp[0]

  // One shared time axis covering both reps
  const start = a && b ? Math.min(a.trace!.t[0], b.trace!.t[0]) : 0
  const end = a && b ? Math.max(a.trace!.t.at(-1)!, b.trace!.t.at(-1)!) : 1
  const yMax = a && b ? Math.max(a.peakDeg, b.peakDeg, session.thresholdDeg) * 1.2 : 1
  const clock = usePlayback(start, end)

  // Picking another rep rewinds both panels to the start
  const pick = (setter: (n: number) => void) => (n: number) => {
    setter(n)
    clock.setPlaying(false)
    clock.setT(-Infinity)
  }
  const t = Math.min(Math.max(clock.t, start), end)

  if (!a || !b) {
    return (
      <Card className="px-6 py-10 text-center">
        <p className="font-medium">This session needs one clean and one compensated rep to compare.</p>
        <p className="mt-1 text-sm text-ink-3">Pick another session in the header.</p>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* shared controls */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={clock.toggle}
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-brand px-4 text-sm font-medium text-on-brand hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand active:scale-[0.98]"
        >
          {clock.playing ? <Pause className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />}
          {clock.playing ? 'Pause' : 'Play both'}
        </button>
        <button
          type="button"
          onClick={clock.restart}
          aria-label="Restart"
          className="inline-flex size-10 items-center justify-center rounded-lg border border-line bg-surface text-ink-2 hover:bg-line-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          <RotateCcw className="size-4" aria-hidden />
        </button>
        <div className="inline-flex rounded-lg border border-line bg-surface p-0.5" role="group" aria-label="Playback speed">
          {SPEEDS.map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={clock.speed === s}
              onClick={() => clock.setSpeed(s)}
              className={`h-8 rounded-md px-3 font-mono text-xs tabular-nums ${clock.speed === s ? 'bg-line-2 text-ink' : 'text-ink-3 hover:text-ink-2'}`}
            >
              {s}×
            </button>
          ))}
        </div>
        <input
          type="range"
          aria-label="Scrub through the reach"
          min={start}
          max={end}
          step={0.01}
          value={t}
          onChange={(e) => { clock.setPlaying(false); clock.setT(Number(e.target.value)) }}
          className="h-10 min-w-48 flex-1 accent-brand"
        />
        <span className="w-20 text-right font-mono text-sm text-ink-2 tabular-nums">
          {t >= 0 ? '+' : '−'}{Math.abs(t).toFixed(2)} s
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ReplayPanel rep={a} reps={clean} onPick={pick(setCleanN)} t={t} domain={[start, end]} yMax={yMax} threshold={session.thresholdDeg} kind="clean" />
        <ReplayPanel rep={b} reps={comp} onPick={pick(setCompN)} t={t} domain={[start, end]} yMax={yMax} threshold={session.thresholdDeg} kind="comp" />
      </div>

      <p className="max-w-3xl text-sm text-pretty text-ink-3">
        The trunk tilts by the logged trunk angle and turns orange while it is past the limit. The arm is
        illustrative: the sensors don't give hand position, so the hand moves from HOME to the target over the
        logged reach time.
      </p>
    </div>
  )
}
