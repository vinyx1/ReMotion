/*
  The top of every patient view, hung on the wall (Shell's header band): who, what
  they practise and where they stand, optional readout plates (the Overview's
  measures), then the tabs on the horizon. The active tab is plaster and rises out
  of the floor, so the page below reads as its continuation.
*/
import type { ReactNode } from 'react'
import { pct, trendOf, type Trend } from '../lib/stats'
import { href, type Route } from '../lib/route'
import type { Patient } from '../lib/patients'
import { cn } from '../lib/utils'
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
        <span className="font-readout font-normal tabular-nums opacity-85">{Math.round(pct(first))}% → {Math.round(pct(last))}%</span>
      )}
    </span>
  )
}

const TABS = (pid: string) => [
  { key: 'overview', label: 'Overview', short: 'Overview', to: { name: 'overview', pid } as Route },
  { key: 'sessions', label: 'Sessions', short: 'Sessions', to: { name: 'sessions', pid } as Route },
  { key: 'replay', label: 'Rep replay', short: 'Replay', to: { name: 'replay', pid } as Route },
  { key: 'profile', label: 'Profile & settings', short: 'Profile', to: { name: 'profile', pid } as Route },
]

export function PatientHeader({ patient, sessions, section, plates }: {
  patient: Patient
  sessions: Session[]
  section: string
  plates?: ReactNode
}) {
  const last = sessions[sessions.length - 1]
  const limit = last?.thresholdDeg
  const facts: [string, string][] = [
    ['Exercise', patient.exercise],
    ['Lean limit', limit === undefined ? '—' : `${limit}°`],
    ['Sessions', String(sessions.length)],
    ['Last session', last ? last.label : 'None yet'],
  ]
  return (
    <div className="flex flex-col pt-6 sm:pt-8">
      <div className="flex items-start gap-4 sm:items-center sm:gap-5">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <h1 className="font-display text-[1.75rem] leading-tight font-medium tracking-[-0.02em] sm:text-[2.5rem]">{patient.name}</h1>
            <TrendPill sessions={sessions} />
          </div>
          <dl className="mt-1.5 flex flex-wrap gap-x-6 gap-y-1 text-[15px] text-forest">
            {facts.map(([k, v]) => (
              <div key={k} className="flex gap-1.5">
                <dt>{k}</dt>
                <dd className={cn('font-bold', /\d/.test(v) && 'font-readout font-normal tabular-nums')}>{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
      {plates && <div className="mt-6 sm:mt-7">{plates}</div>}
      <nav aria-label={`${patient.name} views`} className="mt-6 -mb-px flex gap-1 overflow-x-auto sm:mt-7">
        {TABS(patient.id).map((t) => {
          const on = section === t.key
          return (
            <a key={t.key} href={href(t.to)} aria-current={on ? 'page' : undefined}
              className={cn(
                'shrink-0 rounded-t-[10px] px-3 pt-2.5 pb-3 sm:px-4 text-[15px] font-bold whitespace-nowrap text-forest transition-colors duration-150',
                'focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-forest',
                on ? 'bg-plaster' : 'hover:bg-plaster/45',
              )}>
              <span className="sm:hidden">{t.short}</span><span className="hidden sm:inline">{t.label}</span>
            </a>
          )
        })}
      </nav>
    </div>
  )
}
