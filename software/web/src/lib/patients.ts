/*
  Patients, read from the "patient" id that export.py writes on every session.

  The logger doesn't record who did a session yet, so the ids come from where the
  files were: "recorded" for real recordings in data/raw, and "sim-a", "sim-b",
  "sim-c" for the simulated patients made by fake_history.py, and "sample" for the
  committed example session in data/sample (one full four-block session). Older exports have no
  patient field; those sessions count as "sim-a" when simulated, else "recorded".
*/
import { exercisesIn } from './exercises'
import type { ExerciseId, Session } from '../types'

export interface Patient {
  id: string
  name: string
  initials: string
  /** the exercises they have sessions of, in the standard order */
  exercises: ExerciseId[]
  simulated: boolean
}

const KNOWN: Record<string, { name: string; initials: string }> = {
  // Made-up names for the simulated patients (the pages still say the data is simulated)
  'sim-a': { name: 'Margaret Chen', initials: 'MC' },   // improves
  'sim-b': { name: 'Robert Okafor', initials: 'RO' },   // holds steady
  'sim-c': { name: 'Elena Rossi', initials: 'ER' },     // leans more
  sample: { name: 'Daniel Park', initials: 'DP' },      // one full four-block session (data/sample)
  recorded: { name: 'Recorded sessions', initials: 'R' },
}

export const patientOf = (s: Session) => s.patient ?? (s.simulated ? 'sim-a' : 'recorded')

/** Every patient with at least one session, the most recently active first. */
export function patientsFrom(sessions: Session[]): Patient[] {
  const latest = new Map<string, string>()
  for (const s of sessions) {
    const id = patientOf(s)
    if (!latest.has(id) || s.id > latest.get(id)!) latest.set(id, s.id)
  }
  const ids = [...latest.keys()].sort((a, b) => latest.get(b)!.localeCompare(latest.get(a)!))
  if (!ids.length) ids.push('sim-a')            // nothing loaded yet: one placeholder patient
  return ids.map((id) => {
    const own = sessions.filter((s) => patientOf(s) === id)
    const known = KNOWN[id] ?? { name: id, initials: id.slice(0, 2).toUpperCase() }
    return {
      id,
      ...known,
      exercises: own.length ? exercisesIn(own) : ['forward-reach'],
      simulated: own.length ? own.every((s) => s.simulated) : true,
    }
  })
}

/** The sessions that belong to a patient, oldest first. */
export function sessionsOf(patient: Patient, sessions: Session[]): Session[] {
  return sessions.filter((s) => patientOf(s) === patient.id)
}
