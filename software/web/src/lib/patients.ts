/*
  Patients: the account's own list (server/api.ts, /api/me), plus anyone with sessions.

  An account lists its patients with their names, including new ones with no sessions
  yet. Session files carry a "patient" id (export.py takes it from the folder); ids with
  no listed name fall back to the names below. Older exports have no patient field; those
  sessions count as "sim-a" when simulated, else "recorded".
*/
import type { PatientEntry } from './account'
import { exercisesIn } from './exercises'
import type { ExerciseId, Session } from '../types'

export interface Patient {
  id: string
  name: string
  initials: string
  /** the exercises they have sessions of, in the standard order (none before their first session) */
  exercises: ExerciseId[]
  simulated: boolean
}

/** Names for ids an account doesn't list. */
const KNOWN: Record<string, { name: string; initials: string }> = {
  // Made-up names for the simulated patients (the pages still say the data is simulated)
  'sim-a': { name: 'Margaret Chen', initials: 'MC' },   // improves
  'sim-b': { name: 'Robert Okafor', initials: 'RO' },   // holds steady
  'sim-c': { name: 'Elena Rossi', initials: 'ER' },     // leans more
  sample: { name: 'Daniel Park', initials: 'DP' },      // one full four-block session (data/sample)
  recorded: { name: 'Recorded sessions', initials: 'R' },
}

export const patientOf = (s: Session) => s.patient ?? (s.simulated ? 'sim-a' : 'recorded')

/** Initials from a name: "Anna Lee" -> "AL", "Cher" -> "CH". */
const initials = (name: string) => {
  const w = name.trim().split(/\s+/)
  return (w.length > 1 ? w[0][0] + w[w.length - 1][0] : name.slice(0, 2)).toUpperCase()
}

/** The account's patients and anyone else with sessions: the most recently active first, then those with none yet. */
export function patientsFrom(sessions: Session[], listed: PatientEntry[] = []): Patient[] {
  const latest = new Map<string, string>()
  for (const s of sessions) {
    const id = patientOf(s)
    if (!latest.has(id) || s.id > latest.get(id)!) latest.set(id, s.id)
  }
  const ids = [...latest.keys()].sort((a, b) => latest.get(b)!.localeCompare(latest.get(a)!))
  ids.push(...listed.map((p) => p.id).filter((id) => !latest.has(id)))   // no sessions yet: listed last
  return ids.map((id) => {
    const own = sessions.filter((s) => patientOf(s) === id)
    const named = listed.find((p) => p.id === id)
    const known = named ? { name: named.name, initials: initials(named.name) } : KNOWN[id] ?? { name: id, initials: initials(id) }
    return {
      id,
      ...known,
      exercises: exercisesIn(own),
      simulated: own.length > 0 && own.every((s) => s.simulated),
    }
  })
}

/** The sessions that belong to a patient, oldest first. */
export function sessionsOf(patient: Patient, sessions: Session[]): Session[] {
  return sessions.filter((s) => patientOf(s) === patient.id)
}
