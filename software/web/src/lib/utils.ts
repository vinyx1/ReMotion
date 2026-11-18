import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Where each target sits on the mat, as a fraction of comfortable arm reach. */
export const TARGET_REACH: Record<string, string> = { GREEN: '40%', BLUE: '70%', RED: '100%' }

/** Readable name for a firmware state. */
export function phaseName(state: string): string {
  switch (state) {
    case 'CUED': return 'Target lit'
    case 'REACHING': return 'Reaching'
    case 'RETURNING': return 'Returning'
    case 'WAIT_HOME': return 'On HOME'
    default: return state.charAt(0) + state.slice(1).toLowerCase()
  }
}

/** Value of a trace at time t (linear interpolation, clamped to the ends). */
export function sampleAt(t: number[], values: number[], time: number): number {
  if (time <= t[0]) return values[0]
  if (time >= t[t.length - 1]) return values[values.length - 1]
  let lo = 0
  let hi = t.length - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (t[mid] <= time) lo = mid
    else hi = mid
  }
  const f = (time - t[lo]) / (t[hi] - t[lo])
  return values[lo] + f * (values[hi] - values[lo])
}

/** Index of the last sample at or before time t. */
export function indexAt(t: number[], time: number): number {
  let i = 0
  while (i + 1 < t.length && t[i + 1] <= time) i++
  return i
}
