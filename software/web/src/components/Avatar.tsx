/*
  A patient's picture: their initials on a soft round ground. Each patient keeps the
  same ground colour (picked by id), so the picture works as a quick visual handle
  in the sidebar, the patient header and the patients list.
*/
import type { Patient } from '../lib/patients'
import { cn } from '../lib/utils'

/** Soft grounds from the Rehab Studio palette: sage, lake, clay, sand, stone. Ink stays forest. */
const GROUNDS = ['#d5e1d8', '#d3dfe8', '#ecdcd0', '#e6e0cc', '#dcdfdc']
const BY_ID: Record<string, number> = { 'sim-a': 0, 'sim-b': 1, 'sim-c': 2, sample: 3, recorded: 4 }

function groundFor(id: string) {
  const i = BY_ID[id] ?? [...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % GROUNDS.length
  return GROUNDS[i]
}

export function Avatar({ patient, size = 36, className }: { patient: Pick<Patient, 'id' | 'initials'>; size?: number; className?: string }) {
  return (
    <span aria-hidden
      className={cn('inline-grid shrink-0 place-items-center rounded-full font-text font-bold text-forest select-none', className)}
      style={{ width: size, height: size, background: groundFor(patient.id), fontSize: Math.round(size * 0.4) }}>
      {patient.initials}
    </span>
  )
}
