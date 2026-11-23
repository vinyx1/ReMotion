/*
  Which days a patient practised, as a month: a quiet instrument beside the Overview, not a
  date picker. The count leads ("6 days in November"); a practised day is a solid forest
  disc, and practised days next to each other in a week are joined by a soft band, so a
  streak reads at a glance. Today is a ring, days still to come are faded. Every exercise
  counts. Terracotta stays out: it means leaning, and this is only about showing up.
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
  const done = (d: Date | null) => !!d && perDay.has(keyOf(d))
  return (
    <section aria-label="Days practised" className="flex gap-6 rounded-xl border border-wall bg-panel p-4">
      {/* left: the month, the count, the key */}
      <div className="flex w-[8.5rem] shrink-0 flex-col">
        <h3 className="font-display text-[17px] leading-tight font-semibold text-balance text-forest" aria-live="polite">{MONTH.format(firstDay)}</h3>
        <div className="-ml-2 flex">
          <button type="button" onClick={() => setShown((v) => v - 1)} disabled={shown <= min} aria-label="Previous month" className={cn(nav, FOCUS)}>
            <ChevronLeft className="size-4" aria-hidden />
          </button>
          <button type="button" onClick={() => setShown((v) => v + 1)} disabled={shown >= max} aria-label="Next month" className={cn(nav, FOCUS)}>
            <ChevronRight className="size-4" aria-hidden />
          </button>
        </div>
        <p className="mt-2 text-[14px] leading-snug text-pretty text-forest-2">
          <span className="block font-display text-[2.25rem] leading-none font-semibold text-forest tabular-nums">{practised}</span>
          {practised === 1 ? 'day' : 'days'} practised in {MONTH_ONLY.format(firstDay)}
        </p>
        <div aria-hidden className="mt-auto flex flex-col gap-1.5 pt-3 text-[12.5px] text-forest-2">
          <span className="flex items-center gap-1.5"><span className="size-3 rounded-full bg-forest" />Practised</span>
          <span className="flex items-center gap-1.5"><span className="size-3 rounded-full ring-2 ring-eucalyptus ring-inset" />Today</span>
        </div>
      </div>

      {/* right: the month's days */}
      <div role="grid" aria-label={`Practice in ${MONTH.format(firstDay)}`} className="grid min-w-0 flex-1 grid-cols-7 content-start gap-y-0.5 text-center">
        {WEEKDAYS.map((w, i) => <span key={i} role="columnheader" aria-hidden className="pb-1 text-[11.5px] font-bold text-forest-2">{w}</span>)}
        {cells.map((d, i) => {
          if (!d) return <span key={`gap-${i}`} aria-hidden />
          const k = keyOf(d), n = perDay.get(k) ?? 0, isToday = k === todayKey, future = k > todayKey
          const col = i % 7
          // the streak band: joins this day to a practised neighbour in the same week
          const joinLeft = n > 0 && col > 0 && done(cells[i - 1])
          const joinRight = n > 0 && col < 6 && done(cells[i + 1])
          const label = `${DAY.format(d)}: ${n === 0 ? 'no practice' : n === 1 ? '1 session' : `${n} sessions`}${isToday ? ', today' : ''}`
          return (
            <span key={k} role="gridcell" aria-label={label} title={label} className="relative grid h-8 place-items-center">
              {joinLeft && <span aria-hidden className="absolute inset-y-1 left-0 w-1/2 bg-wall/70" />}
              {joinRight && <span aria-hidden className="absolute inset-y-1 right-0 w-1/2 bg-wall/70" />}
              <span aria-hidden className={cn(
                'relative grid size-7 place-items-center rounded-full text-[13px] tabular-nums',
                n ? 'bg-forest font-bold text-plaster' : future ? 'text-forest-2/45' : 'text-forest-2',
                isToday && (n ? 'ring-2 ring-eucalyptus ring-offset-2 ring-offset-panel' : 'font-bold text-forest ring-2 ring-eucalyptus ring-inset'),
              )}>{d.getDate()}</span>
            </span>
          )
        })}
      </div>
    </section>
  )
}
