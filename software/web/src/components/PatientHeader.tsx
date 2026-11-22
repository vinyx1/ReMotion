/*
  The top of every patient view, hung on the wall (Shell's header band): who, what
  they practise and where they stand, optional readout plates (the Overview's
  measures), then the tabs on the horizon. The active tab is plaster and rises out
  of the floor, so the page below reads as its continuation.
*/
import { ChevronLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { pct, trendOf, type Trend } from '../lib/stats'
import { href, type Route } from '../lib/route'
import type { Patient } from '../lib/patients'
import { cn } from '../lib/utils'
import { Avatar } from './Avatar'
import { ExerciseBadge, ExerciseIcon } from './ExerciseIcon'
import { EXERCISES } from '../lib/exercises'
import type { ExerciseId } from '../types'
import type { Session } from '../types'

/*
  Where the leaning is heading, as a flat tag: the trend in words and the figures
  behind it ("Leaning less · 64% → 10%"), on a pale tint of its own hue. No outline,
  no arrow icon: the words and the numbers carry the direction.
*/
const TREND: Record<Trend, { label: string; cls: string }> = {
  improving: { label: 'Leaning less', cls: 'bg-[color-mix(in_oklab,var(--color-lake)_14%,var(--color-plaster))] text-[color-mix(in_oklab,var(--color-lake),black_18%)]' },
  steady: { label: 'About the same', cls: 'bg-plaster text-forest' },
  worsening: { label: 'Leaning more', cls: 'bg-[color-mix(in_oklab,var(--color-terra)_14%,var(--color-plaster))] text-terra-deep' },
  'too-early': { label: 'One session so far', cls: 'bg-plaster text-forest' },
}

export function TrendPill({ sessions, className }: { sessions: Session[]; className?: string }) {
  const trend = trendOf(sessions)
  const t = TREND[trend]
  const first = sessions[0], last = sessions[sessions.length - 1]
  return (
    <span className={cn('inline-flex items-baseline gap-2 rounded-md px-2 py-1 text-sm leading-none font-bold whitespace-nowrap', t.cls, className)}>
      {t.label}
      {trend !== 'too-early' && first && last && (
        <span className="font-medium tabular-nums opacity-85">{Math.round(pct(first))}% → {Math.round(pct(last))}%</span>
      )}
    </span>
  )
}

/** The tabs: the overview of everything, all sessions, one tab per exercise the patient does, then the profile. */
const TABS = (pid: string, exercises: ExerciseId[]): { key: string; label: string; short: string; exercise?: ExerciseId; to: Route }[] => [
  { key: 'overview', label: 'Overview', short: 'Overview', to: { name: 'overview', pid } as Route },
  { key: 'sessions', label: 'Sessions', short: 'Sessions', to: { name: 'sessions', pid } as Route },
  ...exercises.map((id) => ({ key: id, label: EXERCISES[id].short, short: EXERCISES[id].short, exercise: id, to: { name: 'exercise', pid, exercise: id } as Route })),
  { key: 'profile', label: 'Profile & settings', short: 'Profile', to: { name: 'profile', pid } as Route },
]

export function PatientHeader({ patient, sessions, section, plates, exercise }: {
  patient: Patient
  /** the sessions in view: one exercise's inside an exercise, else all of them */
  sessions: Session[]
  /** the tab to light: in the patient, 'overview', 'sessions', 'profile' or an exercise id; inside an exercise, 'overview', 'sessions' or 'replay' */
  section: string
  plates?: ReactNode
  /** set inside one exercise (its overview, sessions, a session, a rep): the header becomes that exercise's */
  exercise?: ExerciseId
}) {
  const last = sessions[sessions.length - 1]
  const limit = last?.thresholdDeg
  const facts: [string, string][] = [
    ['Lean limit', limit === undefined ? '—' : `${limit}°`],
    ['Sessions', String(sessions.length)],
    ['Last session', last ? last.label : 'None yet'],
  ]
  const tabs: { key: string; label: string; short: string; exercise?: ExerciseId; to: Route }[] = exercise
    ? [
        { key: 'overview', label: 'Overview', short: 'Overview', to: { name: 'exercise', pid: patient.id, exercise, view: 'overview' } as Route },
        { key: 'sessions', label: 'Sessions', short: 'Sessions', to: { name: 'exercise', pid: patient.id, exercise, view: 'sessions' } as Route },
        { key: 'replay', label: 'Rep replay', short: 'Replay', to: { name: 'exercise', pid: patient.id, exercise, view: 'replay' } as Route },
      ]
    : TABS(patient.id, patient.exercises)
  return (
    <div className="flex flex-col pt-6 sm:pt-8">
      <div className="flex items-start gap-4 sm:items-center sm:gap-5">
        {exercise ? (
          <>
            {/* back to the patient: a small round button before the exercise's icon (same row, so the banner keeps its height) */}
            <a href={href({ name: 'overview', pid: patient.id })} aria-label={`Back to ${patient.name}`} title={`Back to ${patient.name}`}
              className="-mr-1 hidden size-9 shrink-0 place-items-center rounded-full border border-forest/15 bg-plaster/55 text-forest transition-colors duration-150 hover:border-forest/35 hover:bg-plaster/85 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-forest sm:grid">
              <ChevronLeft className="size-5" aria-hidden />
            </a>
            <ExerciseBadge exercise={exercise} size={64} className="hidden shadow-[0_2px_4px_rgb(31_45_39/0.12)] sm:grid" />
          </>
        ) : <Avatar patient={patient} size={64} className="hidden shadow-[0_2px_4px_rgb(31_45_39/0.12)] sm:inline-grid" />}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <h1 className="font-display text-[1.75rem] leading-tight font-medium tracking-[-0.02em] sm:text-[2.5rem]">
              {exercise ? EXERCISES[exercise].name : patient.name}
            </h1>
            {/* a trend only means something within one exercise */}
            {exercise && <TrendPill sessions={sessions} className="translate-y-0.5 sm:translate-y-1" />}
          </div>
          <dl className="mt-1.5 flex flex-wrap items-center gap-x-6 gap-y-1 text-[15px] text-forest">
            {!exercise && (
              <div className="flex gap-1.5">
                <dt className="text-forest/75">{patient.exercises.length === 1 ? 'Exercise' : 'Exercises'}</dt>
                <dd className="font-semibold tabular-nums">{patient.exercises.length === 1 ? EXERCISES[patient.exercises[0]].name : patient.exercises.length || 'None yet'}</dd>
              </div>
            )}
            {exercise && (
              <div className="flex gap-1.5">
                <dt className="text-forest/75">Patient</dt>
                <dd><a href={href({ name: 'overview', pid: patient.id })} className="font-semibold underline decoration-forest/25 underline-offset-[5px] hover:decoration-forest">{patient.name}</a></dd>
              </div>
            )}
            {facts.map(([k, v]) => (
              <div key={k} className="flex gap-1.5">
                <dt className="text-forest/75">{k}</dt>
                <dd className="font-semibold tabular-nums">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
      {plates && <div className="mt-6 sm:mt-7">{plates}</div>}
      {/* padded so the active tab's shadow and floor flares aren't clipped by the scroll box; the negative margin keeps the tabs on the text edge */}
      {/* keyed by the tab set, so going into or out of an exercise remounts the row and its tabs rise in quickly; switching tabs within a set doesn't */}
      <nav key={exercise ?? 'patient'} aria-label={exercise ? `${EXERCISES[exercise].name} views` : `${patient.name} views`} className="-mx-3 mt-4 -mb-px flex gap-1 overflow-x-auto px-3 pt-2 sm:mt-5">
        {tabs.map((t, i) => {
          const on = section === t.key
          return (
            <a key={t.key} href={href(t.to)} aria-current={on ? 'page' : undefined} style={{ '--i': i } as React.CSSProperties}
              className={cn(
                'wall-tab tab-in shrink-0 rounded-t-[10px] px-3 pt-2.5 pb-3 text-[15px] whitespace-nowrap transition-[color,background-color] duration-150 sm:px-4',
                'focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-forest',
                on ? 'font-bold text-forest' : 'font-semibold text-forest/75 hover:bg-plaster/35 hover:text-forest',
              )}>
              <span className="inline-flex items-center gap-1.5">
                {'exercise' in t && t.exercise && <span style={{ color: EXERCISES[t.exercise].color }}><ExerciseIcon exercise={t.exercise} className="size-[18px]" /></span>}
                <span className="sm:hidden">{t.short}</span><span className="hidden sm:inline">{t.label}</span>
              </span>
            </a>
          )
        })}
      </nav>
    </div>
  )
}
