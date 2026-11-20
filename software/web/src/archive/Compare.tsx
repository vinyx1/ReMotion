/*
  ARCHIVED 2026-11-20: Compare (two chosen sessions side by side, the change between
  them spelled out, then the trend). It used to live at Sessions > Compare; it was
  taken out of the dashboard because the Overview covers progress. It is not routed
  anywhere. To bring it back, render <Progress> from App.tsx again.
*/
import { ArrowDown, ArrowUp, Minus } from 'lucide-react'
import { useState } from 'react'
import {
  type Better, cleanLean, daysBetween, headline, judge, type Measure, MEASURES, pct, reach, reachNote,
} from '../lib/stats'
import { cn } from '../lib/utils'
import type { Session } from '../types'
import { RepStrip } from '../components/RepStrip'
import { TrendChart } from '../components/TrendChart'
import { Legend, Panel, PanelTitle, Readout, Segmented, Select } from '../components/ui'

function SessionColumn({ role, session, sessions, onPick, yMax, onOpenRep }: {
  role: 'Baseline' | 'Compared with'
  session: Session
  sessions: Session[]
  onPick: (id: string) => void
  yMax: number
  onOpenRep: (rep: number) => void
}) {
  const s = session.summary
  const lean = cleanLean(session)
  return (
    <Panel label={`${role} session`} className="flex flex-col gap-5 p-5 sm:p-6">
      <label className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="text-[15px] font-bold text-forest-2">{role}</span>
        <Select
          label={`${role} session`}
          value={session.id}
          onChange={onPick}
          options={[...sessions].reverse().map((o) => ({ value: o.id, label: o.label }))}
          triggerClassName="text-[17px] font-bold"
          className="w-56"
        />
      </label>
      <dl className="grid grid-cols-3 items-end gap-3 sm:gap-4">
        <Readout label="Compensated" value={`${Math.round(s.pctCompensated)}%`} note={`${s.compensated} of ${s.reps} reps`} />
        <Readout label="Clean-rep lean" value={lean === null ? '—' : `${lean.toFixed(1)}°`} note="median peak" />
        <Readout label="Reach time" value={`${s.medianReachS.toFixed(2)} s`} note="median" />
      </dl>
      <div>
        <RepStrip reps={session.reps} threshold={session.thresholdDeg} yMax={yMax} onOpen={onOpenRep} />
        <p className="mt-2 text-sm text-forest-2">Peak lean of each rep, in order. Select a rep to open it.</p>
      </div>
    </Panel>
  )
}

const TONE: Record<Better, string> = {
  better: 'text-eucalyptus', worse: 'text-terra-deep', same: 'text-forest-2', neutral: 'text-forest',
}

function Change({ value, unit, words, better }: { value: number | null; unit: string; words: string; better: Better }) {
  const Icon = better === 'same' || value === null || Math.abs(value) < 1e-9 ? Minus : value < 0 ? ArrowDown : ArrowUp
  const sign = value === null ? '' : value > 0 ? '+' : value < 0 ? '−' : '±'
  return (
    <div className={cn('flex min-w-0 flex-col items-center gap-0.5 text-center', TONE[better])}>
      <Icon className="size-5" aria-hidden />
      <span className="font-readout text-xl whitespace-nowrap tabular-nums">
        {value === null ? '—' : `${sign}${Math.abs(value).toFixed(unit === ' s' ? 2 : unit === '°' ? 1 : 0)}${unit}`}
      </span>
      <span className="text-sm font-bold text-balance">{words}</span>
    </div>
  )
}

function ChangeColumn({ base, other }: { base: Session; other: Session }) {
  const dp = pct(other) - pct(base)
  const la = cleanLean(base), lb = cleanLean(other)
  const dl = la === null || lb === null ? null : lb - la
  const dr = reach(other) - reach(base)
  const jp = judge(dp, 'pct'), jl = judge(dl, 'deg'), jr = judge(dr, 'time')
  return (
    <section aria-label="Change between the two sessions"
      className="flex flex-row items-start justify-around gap-4 py-2 lg:flex-col lg:items-center lg:justify-center lg:gap-7 lg:py-0">
      <h2 className="sr-only">Change</h2>
      <Change value={dp} unit=" pts" better={jp}
        words={jp === 'same' ? 'about the same' : dp < 0 ? 'fewer compensated' : 'more compensated'} />
      <Change value={dl} unit="°" better={jl}
        words={jl === 'same' ? 'about the same' : (dl ?? 0) < 0 ? 'less lean' : 'more lean'} />
      <Change value={dr} unit=" s" better={jr}
        words={jr === 'same' ? 'about the same' : dr > 0 ? 'slower' : 'faster'} />
    </section>
  )
}

function Trend({ sessions, baseId, otherId, threshold, onOpenSession }: {
  sessions: Session[]
  baseId: string
  otherId: string
  threshold: number
  onOpenSession: (id: string) => void
}) {
  const [measure, setMeasure] = useState<Measure>('pct')
  const span = daysBetween(sessions[0], sessions[sessions.length - 1])
  return (
    <Panel label="Across all sessions" className="p-5 sm:p-6">
      <PanelTitle
        as="h3"
        title="Across all sessions"
        caption={`${sessions.length} sessions over ${span} days. Select a session to open it.`}
        right={<Segmented label="Measure" value={measure} onChange={setMeasure} options={MEASURES.map(({ value, label, short }) => ({ value, label, short }))} />}
      />
      <TrendChart sessions={sessions} measure={measure} baseId={baseId} otherId={otherId} threshold={threshold} onOpenSession={onOpenSession} className="mt-4" />
    </Panel>
  )
}

export function Progress({ sessions, baseId, otherId, setBase, setOther, onOpenSession, onOpenRep }: {
  sessions: Session[]
  baseId: string
  otherId: string
  setBase: (id: string) => void
  setOther: (id: string) => void
  onOpenSession: (id: string) => void
  onOpenRep: (sessionId: string, rep: number) => void
}) {
  const base = sessions.find((s) => s.id === baseId) ?? sessions[0]
  const other = sessions.find((s) => s.id === otherId) ?? sessions[sessions.length - 1]
  const yMax = Math.ceil(Math.max(base.thresholdDeg, ...[...base.reps, ...other.reps].map((r) => r.peakDeg)) / 5) * 5
  const single = sessions.length < 2

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
        <div className="min-w-0">
          <h2 className="font-display text-[1.6rem] leading-[1.15] font-medium tracking-[-0.01em] text-balance">
            {headline(base, other)}
          </h2>
          <p className="mt-2 text-[17px] text-pretty text-forest-2">
            {single
              ? 'Only one session so far. Record another to see a change.'
              : `${base.label} against ${other.label}. ${reachNote(base, other)}`}
          </p>
        </div>
        <Legend threshold={other.thresholdDeg} />
      </div>

      {single ? (
        <SessionColumn role="Baseline" session={base} sessions={sessions} onPick={setBase} yMax={yMax} onOpenRep={(n) => onOpenRep(base.id, n)} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_8.5rem_minmax(0,1fr)] lg:gap-5">
          <SessionColumn role="Baseline" session={base} sessions={sessions} onPick={setBase} yMax={yMax} onOpenRep={(n) => onOpenRep(base.id, n)} />
          <ChangeColumn base={base} other={other} />
          <SessionColumn role="Compared with" session={other} sessions={sessions} onPick={setOther} yMax={yMax} onOpenRep={(n) => onOpenRep(other.id, n)} />
        </div>
      )}

      <div className="grid gap-4">
        {!single && (
          <Trend sessions={sessions} baseId={base.id} otherId={other.id} threshold={other.thresholdDeg} onOpenSession={onOpenSession} />
        )}
      </div>
    </div>
  )
}
