/*
  Which days a patient practised, as a month: a quiet instrument beside the Overview, not a
  date picker. The count leads ("6 days in November"); each practised day is a filled forest
  dot under its number, today an open ring, and the rest stay plain. Every exercise counts.
  Terracotta stays out: it means leaning, and this is only about showing up.
*/
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useMemo, useState } from 'react'
import { cn } from '../lib/utils'
import type { Session } from '../types'
import { FOCUS } from './ui'

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
const MONTH = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' })
const MONTH_ONLY = new Intl.DateTimeFormat(undefined, { month: 'long' })
const DAY = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' })

/** "20261118" from a session id ("20261118_112300-1-sim-a"). */
const dayKey = (s: Session) => s.id.slice(0, 8)
const keyOf = (d: Date) => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
const monthIndex = (y: number, m: number) => y * 12 + m

export function PracticeCalendar({ sessions }: { sessions: Session[] }) {
  // sessions per day
  const perDay = useMemo(() => {
    const m = new Map<string, number>()
    for (const s of sessions) m.set(dayKey(s), (m.get(dayKey(s)) ?? 0) + 1)
    return m
  }, [sessions])

  const [today] = useState(() => new Date())          // once: today doesn't change while the page is open
  const last = sessions.length ? sessions[sessions.length - 1].id : keyOf(today)
  const first = sessions.length ? sessions[0].id : keyOf(today)
  // browse from the first session's month to this month; open on the latest session's month
  const min = monthIndex(+first.slice(0, 4), +first.slice(4, 6) - 1)
  const max = Math.max(monthIndex(today.getFullYear(), today.getMonth()), monthIndex(+last.slice(0, 4), +last.slice(4, 6) - 1))
  const [shown, setShown] = useState(() => monthIndex(+last.slice(0, 4), +last.slice(4, 6) - 1))

  const year = Math.floor(shown / 12), month = shown % 12
  const firstDay = new Date(year, month, 1)
  const lead = (firstDay.getDay() + 6) % 7                       // Monday-first
  const days = new Date(year, month + 1, 0).getDate()
  const cells: (Date | null)[] = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => new Date(year, month, i + 1))]
  const practised = cells.filter((d) => d && perDay.has(keyOf(d))).length
  const todayKey = keyOf(today)

  const nav = 'grid size-9 cursor-pointer place-items-center rounded-lg text-forest-2 transition-colors duration-150 hover:bg-wash hover:text-forest disabled:cursor-default disabled:opacity-30 disabled:hover:bg-transparent'
  return (
    <section aria-label="Days practised" className="rounded-xl border border-wall bg-panel px-4 pt-3 pb-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[15px] font-bold" aria-live="polite">{MONTH.format(firstDay)}</h3>
        <div className="-mr-1.5 flex">
          <button type="button" onClick={() => setShown((v) => v - 1)} disabled={shown <= min} aria-label="Previous month" className={cn(nav, FOCUS)}>
            <ChevronLeft className="size-4" aria-hidden />
          </button>
          <button type="button" onClick={() => setShown((v) => v + 1)} disabled={shown >= max} aria-label="Next month" className={cn(nav, FOCUS)}>
            <ChevronRight className="size-4" aria-hidden />
          </button>
        </div>
      </div>

      <p className="mt-1 text-[14px] text-forest-2">
        <span className="font-readout text-[1.35rem] leading-none text-forest tabular-nums">{practised}</span>{' '}
        {practised === 1 ? 'day' : 'days'} practised in {MONTH_ONLY.format(firstDay)}
      </p>

      <div role="grid" aria-label={`Practice in ${MONTH.format(firstDay)}`} className="mt-3 grid grid-cols-7 gap-y-1 text-center">
        {WEEKDAYS.map((w, i) => <span key={i} role="columnheader" aria-hidden className="pb-1 text-[11px] font-bold text-forest-2">{w}</span>)}
        {cells.map((d, i) => {
          if (!d) return <span key={`gap-${i}`} aria-hidden />
          const k = keyOf(d), n = perDay.get(k) ?? 0, isToday = k === todayKey
          const label = `${DAY.format(d)}: ${n === 0 ? 'no practice' : n === 1 ? '1 session' : `${n} sessions`}${isToday ? ', today' : ''}`
          return (
            <span key={k} role="gridcell" aria-label={label} title={label} className="flex flex-col items-center gap-[3px] py-0.5">
              <span className={cn('font-readout text-[12.5px] leading-none tabular-nums', n ? 'font-semibold text-forest' : 'text-forest-2', isToday && 'font-semibold text-forest')}>{d.getDate()}</span>
              {/* the mark: practised = filled dot, today = ring, otherwise nothing */}
              <span aria-hidden className={cn('size-[7px] rounded-full',
                n ? 'bg-forest' : isToday ? 'ring-[1.5px] ring-eucalyptus ring-inset' : 'bg-transparent')} />
            </span>
          )
        })}
      </div>
    </section>
  )
}
