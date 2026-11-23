/*
  Rep detail: one reach, replayed. The 3D figure, the trunk-lean trace and the
  wrist trace all follow one clock; time 0 is the hand leaving HOME.
*/
import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { TARGET_NAME, TARGET_REACH } from '../lib/stats'
import { EXERCISES, exerciseOf } from '../lib/exercises'
import { useWidth } from '../lib/useWidth'
import { cn, indexAt, phaseName, sampleAt } from '../lib/utils'
import type { Rep, Session } from '../types'
import { HoloReplay } from './HoloReplay'
import { Button, FOCUS, Mark, Panel, PanelTitle, Readout, ResultTag, Segmented, Select } from './ui'

const reduceMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/** A clock that runs from `start` to `end` seconds while playing. */
function usePlayback(start: number, end: number) {
  const [t, setT] = useState(end)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState<'0.5' | '1'>('1')
  const last = useRef<number | null>(null)

  useEffect(() => {
    if (!playing) return
    let frame = 0
    const tick = (now: number) => {
      const dt = last.current === null ? 0 : (now - last.current) / 1000
      last.current = now
      let stop = false
      setT((prev) => {
        const next = Math.max(prev, start) + dt * Number(speed)
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
    if (!playing && t >= end) setT(start)
    setPlaying((p) => !p)
  }, [playing, t, start, end])

  return { t, setT, playing, setPlaying, toggle, speed, setSpeed }
}

/** A trace over time with the reach shaded, the limit dashed and a playhead. */
function Trace({ rep, field, unit, t, threshold, label, marks = ['leaves HOME', 'presses target'] }: {
  rep: Rep
  field: 'trunkDeg' | 'wristDps'
  unit: string
  t: number
  threshold?: number
  label: string
  /** the words under the shaded band's start and end */
  marks?: [string, string]
}) {
  const tr = rep.trace!
  const [ref, w] = useWidth<HTMLDivElement>()
  const H = 220
  const pad = { l: 58, r: 14, t: 12, b: 30 }
  const t0 = tr.t[0], t1 = tr.t[tr.t.length - 1]
  const vals = tr[field]
  const top = Math.max(threshold ?? 0, ...vals)
  const step = field === 'trunkDeg' ? 5 : top > 200 ? 100 : 50
  const yMax = Math.ceil((top * 1.08) / step) * step || step
  const x = (v: number) => pad.l + ((v - t0) / (t1 - t0)) * (w - pad.l - pad.r)
  const y = (v: number) => pad.t + (1 - v / yMax) * (H - pad.t - pad.b)
  const path = tr.t.map((tt, i) => `${i ? 'L' : 'M'}${x(tt).toFixed(1)},${y(vals[i]).toFixed(1)}`).join('')
  const ticks = Array.from({ length: Math.floor(yMax / step) + 1 }, (_, i) => i * step).filter((v) => v <= yMax)
  const now = sampleAt(tr.t, vals, t)
  const over = threshold !== undefined && now > threshold

  return (
    <div ref={ref} className="w-full">
      <svg width={w} height={H} role="img" aria-label={label} className="block">
        <rect x={x(0)} y={pad.t} width={Math.max(0, x(tr.reachEndS) - x(0))} height={H - pad.t - pad.b} fill="var(--color-wash)" />
        {ticks.map((v) => (
          <g key={v}>
            <line x1={pad.l} x2={w - pad.r} y1={y(v)} y2={y(v)} stroke="var(--color-grid)" />
            <text x={pad.l - 8} y={y(v) + 4} textAnchor="end" className="fill-forest-2 font-readout text-[12px] tabular-nums">{v}{unit}</text>
          </g>
        ))}
        {threshold !== undefined && (
          <line x1={pad.l} x2={w - pad.r} y1={y(threshold)} y2={y(threshold)} stroke="var(--color-forest)" strokeDasharray="6 5" strokeWidth={1.5} />
        )}
        <path d={path} fill="none" stroke="var(--color-forest)" strokeWidth={2.5} strokeLinejoin="round" />
        <line x1={x(t)} x2={x(t)} y1={pad.t} y2={H - pad.b} stroke="var(--color-forest-2)" strokeWidth={1.2} />
        <circle cx={x(t)} cy={y(now)} r={5} fill={over ? 'var(--color-terra)' : 'var(--color-panel)'} stroke="var(--color-forest)" strokeWidth={2} />
        {/* the reach's two moments, under the shaded band */}
        <text x={x(0)} y={H - 9} textAnchor="start" className="fill-forest-2 text-[12px]">{marks[0]}</text>
        <text x={x(tr.reachEndS)} y={H - 9} textAnchor="end" className="fill-forest-2 text-[12px]">{marks[1]}</text>
      </svg>
    </div>
  )
}

export function RepDetail({ sessions, sessionId, repN, onPick }: {
  sessions: Session[]
  sessionId: string
  repN: number | null
  onPick: (sessionId: string, rep: number) => void
}) {
  const session = sessions.find((s) => s.id === sessionId) ?? sessions[sessions.length - 1]
  const reps = session.reps
  const fallback = [...reps].sort((a, b) => b.peakDeg - a.peakDeg)[0]
  const rep = reps.find((r) => r.rep === repN) ?? fallback
  const ex = EXERCISES[exerciseOf(session)]
  const marks: [string, string] = ex.targets ? ['leaves HOME', 'presses target'] : ['starts', ex.id === 'hand-to-mouth' ? 'at the mouth' : 'turned']
  const idx = reps.indexOf(rep)
  const tr = rep.trace
  const start = tr ? tr.t[0] : 0
  const end = tr ? tr.t[tr.t.length - 1] : 1
  const clock = usePlayback(start, end)
  const t = Math.min(Math.max(clock.t, start), end)

  // a new rep opens paused on its first frame, so Play runs the whole reach
  useEffect(() => { clock.setPlaying(false); clock.setT(start) }, [rep.rep, session.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const trunk = tr ? sampleAt(tr.t, tr.trunkDeg, t) : 0
  const over = trunk > session.thresholdDeg
  const wrist = tr ? sampleAt(tr.t, tr.wristDps, t) : 0
  const phase = tr ? (t >= end ? 'Back on HOME' : phaseName(tr.state[indexAt(tr.t, t)], ex.figure === 'mouth' ? 'mouth' : ex.figure === 'turn' ? 'turn' : 'reach')) : ''

  // play, restart, speed and scrub: one clock for the figure and the traces
  const controls = (
    <div className={cn('flex flex-wrap items-center gap-3 px-4 py-3', ex.figure && 'border-t border-wall')}>
      <Button primary onClick={clock.toggle}>
        {clock.playing ? <Pause className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />}
        {clock.playing ? 'Pause' : 'Play'}
      </Button>
      <Button label="Replay from the start" onClick={() => { clock.setT(start); clock.setPlaying(!reduceMotion) }} className="w-10 px-0">
        <RotateCcw className="size-4" aria-hidden />
      </Button>
      <Segmented label="Speed" value={clock.speed} onChange={clock.setSpeed} options={[{ value: '0.5', label: '½×' }, { value: '1', label: '1×' }]} />
      <input type="range" aria-label="Scrub through the rep" min={start} max={end} step={0.01} value={t}
        onChange={(e) => { clock.setPlaying(false); clock.setT(Number(e.target.value)) }}
        className={cn('h-10 min-w-32 flex-1 cursor-pointer accent-forest', FOCUS)} />
      <span className="w-16 text-right font-readout text-sm text-forest-2 tabular-nums">{t >= 0 ? '+' : '−'}{Math.abs(t).toFixed(2)} s</span>
    </div>
  )
  const traces = tr && (
    <>
      <Panel label="Trunk lean over the rep" className="p-5">
        <PanelTitle as="h3" title="Trunk lean" />
        <div className="mt-3"><Trace rep={rep} field="trunkDeg" unit="°" t={t} threshold={session.thresholdDeg} marks={marks} label={`Trunk lean over time for rep ${rep.rep}, peak ${rep.peakDeg.toFixed(1)} degrees`} /></div>
      </Panel>
      <Panel label="Wrist rotation speed over the rep" className="p-5">
        <PanelTitle as="h3" title="Wrist rotation speed" />
        <div className="mt-3"><Trace rep={rep} field="wristDps" unit="°/s" t={t} marks={marks} label={`Wrist rotation speed over time for rep ${rep.rep}`} /></div>
      </Panel>
    </>
  )

  return (
    <div className="flex flex-col gap-6">
      {/*
        One header, each fact once: the rep (its title is the rep picker, with
        previous/next beside it) and its result right next to it; the target under
        it; which session, on the right.
      */}
      <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <h2 className="sr-only">Rep {rep.rep} of {reps.length}</h2>
            <div className="flex items-center gap-1">
              <Button label="Previous rep" onClick={() => onPick(session.id, reps[idx - 1].rep)} disabled={idx <= 0} className="w-10 px-0">
                <ChevronLeft className="size-5" aria-hidden />
              </Button>
              <Select label={`Rep ${rep.rep} of ${reps.length}. Choose a rep`} value={String(rep.rep)} onChange={(v) => onPick(session.id, Number(v))}
                display={<>Rep {rep.rep} <span className="text-forest-2">of {reps.length}</span></>}
                options={reps.map((r) => ({
                  value: String(r.rep),
                  label: <>
                    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden className="shrink-0"><Mark cx={7} cy={7} r={4.4} compensated={r.compensated} /></svg>
                    <span className="flex-1">Rep {r.rep}<span className="sr-only">, {r.compensated ? 'compensated' : 'clean'}</span></span>
                    <span className="font-readout text-sm text-forest-2 tabular-nums">{r.peakDeg.toFixed(1)}°</span>
                  </>,
                }))}
                triggerClassName="h-11 border-transparent bg-transparent px-2 font-display text-[1.6rem] font-medium hover:border-wall hover:bg-panel" />
              <Button label="Next rep" onClick={() => onPick(session.id, reps[idx + 1].rep)} disabled={idx >= reps.length - 1} className="w-10 px-0">
                <ChevronRight className="size-5" aria-hidden />
              </Button>
            </div>
            <ResultTag compensated={rep.compensated} pill className="text-[15px]" />
          </div>
          <p className="mt-1.5 text-[17px] text-pretty text-forest-2">
            {ex.targets ? <>{TARGET_NAME[rep.target]} target · {TARGET_REACH[rep.target]} of comfortable reach</> : ex.name}
          </p>
        </div>
        <Select label="Session" value={session.id} onChange={(id) => onPick(id, -1)}
          options={[...sessions].reverse().map((s) => ({ value: s.id, label: s.label }))} className="w-52" />
      </div>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-5 border-y border-wall py-5 sm:grid-cols-4">
        <Readout size="md" label="Peak lean" value={`${rep.peakDeg.toFixed(1)}°`} note={`limit ${session.thresholdDeg}°`} tone={rep.compensated ? 'comp' : undefined} />
        <Readout size="md" label="Reaction" value={`${rep.reactMs} ms`} note={ex.targets ? 'target lit → leaves HOME' : 'cue → starts moving'} />
        <Readout size="md" label={ex.targets ? 'Reach' : ex.time} value={`${(rep.reachMs / 1000).toFixed(2)} s`} note={`${marks[0]} → ${ex.targets ? 'press' : marks[1]}`} />
        <Readout size="md" label="Wrist bursts" value={String(rep.bursts)} />
      </dl>

      {tr && !ex.figure ? (
        <div className="flex flex-col gap-4">
          <Panel label="Playback" className="overflow-hidden">{controls}</Panel>
          <div className="grid gap-4 xl:grid-cols-2">{traces}</div>
        </div>
      ) : tr ? (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <Panel label="Replay" className="flex flex-col overflow-hidden">
            <div className="relative aspect-[4/3] cursor-grab bg-forest-deep active:cursor-grabbing xl:aspect-auto xl:min-h-[340px] xl:flex-1">
              <HoloReplay trace={tr} t={t} target={rep.target} threshold={session.thresholdDeg} peakDeg={rep.peakDeg} motion={ex.figure ?? 'reach'} />
              <div className="pointer-events-none absolute top-4 left-5 flex gap-6" aria-live="off">
                <div>
                  <p className="text-sm font-bold text-plaster/75">Trunk lean</p>
                  <p className={cn('font-readout text-[2.5rem] leading-none tabular-nums', over ? 'text-[#ee8a5f]' : 'text-plaster')}>{trunk.toFixed(1)}°</p>
                </div>
                <div>
                  <p className="text-sm font-bold text-plaster/75">Wrist</p>
                  <p className="font-readout text-[1.5rem] leading-none text-[#9cc9e6] tabular-nums">{Math.round(wrist)}<span className="ml-1 text-[0.6em]">°/s</span></p>
                </div>
              </div>
              <p className="pointer-events-none absolute top-4 right-5 rounded-md bg-plaster/10 px-2.5 py-1 text-sm font-semibold text-plaster">{phase}</p>
            </div>
            {ex.figure === 'turn' && (
              <p className="border-t border-wall px-4 py-2 text-[13px] leading-snug text-pretty text-forest-2">
                The wrist sensor measures how fast the forearm turns; the replay draws the turn from palm down to palm up, timed by the rep.
              </p>
            )}
            {ex.figure === 'side' && (
              <p className="border-t border-wall px-4 py-2 text-[13px] leading-snug text-pretty text-forest-2">
                The chest sensor measures how far the trunk tilts, not which way, so the replay draws the lean towards the reaching side.
              </p>
            )}
            {controls}
          </Panel>
          <div className="flex min-w-0 flex-col gap-4">{traces}</div>
        </div>
      ) : (
        <Panel className="px-6 py-10 text-center">
          <p className="font-bold">No samples were recorded for this rep.</p>
          <p className="mt-1 text-forest-2">Keep sample streaming on (send D1) while recording, then export again.</p>
        </Panel>
      )}
    </div>
  )
}
