/*
  The numbers the therapist dashboard shows, worked out from sessions.json.
  Kept here (not in the components) so every view says the same thing.
*/
import type { Rep, Session } from '../types'

export function median(xs: number[]): number | null {
  if (!xs.length) return null
  const s = [...xs].sort((a, b) => a - b)
  const m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

/** The typical lean of the reps that stayed within the limit (median peak). */
export function cleanLean(s: Session): number | null {
  return median(s.reps.filter((r) => !r.compensated).map((r) => r.peakDeg))
}

export const pct = (s: Session) => s.summary.pctCompensated
export const reach = (s: Session) => s.summary.medianReachS

/** "Nov 02, 10:08" -> "Nov 02" */
export const day = (s: Session) => s.label.split(',')[0]

/** Whole days between two sessions (by their YYYYMMDD ids). */
export function daysBetween(a: Session, b: Session): number {
  const d = (s: Session) => {
    const m = /^(\d{4})(\d{2})(\d{2})/.exec(s.id)
    return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : 0
  }
  return Math.round(Math.abs(d(b) - d(a)) / 86_400_000)
}

/** The sentence at the top of Progress. Says plainly if things got worse. */
export function headline(base: Session, latest: Session): string {
  const a = Math.round(pct(base)), b = Math.round(pct(latest))
  if (base.id === latest.id) return `${b}% of reps compensated in this session`
  if (Math.abs(b - a) < 5) return `Compensation held at about ${b}% of reps`
  return b < a ? `Compensation fell from ${a}% to ${b}% of reps` : `Compensation rose from ${a}% to ${b}% of reps`
}

/** One plain sentence under the headline about reach time. */
export function reachNote(base: Session, latest: Session): string {
  const d = reach(latest) - reach(base)
  if (Math.abs(d) < 0.15) return 'Reach time held steady.'
  return d > 0 ? `Reaches got slower by ${d.toFixed(2)} s.` : `Reaches got faster by ${(-d).toFixed(2)} s.`
}

export type Better = 'better' | 'worse' | 'same' | 'neutral'

/** How a change reads for the therapist. Less leaning is better; reach time has no good direction here. */
export function judge(delta: number | null, kind: 'pct' | 'deg' | 'time'): Better {
  if (delta === null) return 'same'
  const small = kind === 'pct' ? 5 : kind === 'deg' ? 0.5 : 0.15
  if (Math.abs(delta) < small) return 'same'
  if (kind === 'time') return 'neutral'
  return delta < 0 ? 'better' : 'worse'
}

export const TARGETS = ['GREEN', 'BLUE', 'RED'] as const
export const TARGET_NAME: Record<Rep['target'], string> = { GREEN: 'Green', BLUE: 'Blue', RED: 'Red' }
/** Where each target sits on the mat, as a share of comfortable arm reach. */
export const TARGET_REACH: Record<Rep['target'], string> = { GREEN: '40%', BLUE: '70%', RED: '100%' }

/** Is compensation going down? Compares the first session with the latest. */
export type Trend = 'improving' | 'steady' | 'worsening' | 'too-early'
export function trendOf(sessions: Session[]): Trend {
  if (sessions.length < 2) return 'too-early'
  const d = pct(sessions[sessions.length - 1]) - pct(sessions[0])
  return d <= -10 ? 'improving' : d >= 10 ? 'worsening' : 'steady'
}

/** The sessions within `days` days of the latest one (by their YYYYMMDD ids). */
export function sessionsWithin(sessions: Session[], days: number): Session[] {
  const last = sessions[sessions.length - 1]
  return sessions.filter((s) => daysBetween(s, last) < days)
}

/** The measures a trend chart can show. */
export type Measure = 'pct' | 'lean' | 'reach'
export const MEASURES: { value: Measure; label: string; short: string; unit: string; get: (s: Session) => number | null }[] = [
  { value: 'pct', label: 'Compensated reps', short: 'Compensated', unit: '%', get: pct },
  { value: 'lean', label: 'Clean-rep lean', short: 'Lean', unit: '°', get: cleanLean },
  { value: 'reach', label: 'Reach time', short: 'Reach', unit: ' s', get: reach },
]
