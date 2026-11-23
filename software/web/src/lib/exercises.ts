/*
  The exercises a session can be (AGENTS.md section 1), and what each one measures,
  so a view can show only what applies: the reaches have target buttons and a reach
  time; hand to mouth and forearm rotation have no targets, and their timed part is
  getting to the mouth or turning the forearm.
*/
import type { ExerciseId, Session } from '../types'

export interface Exercise {
  id: ExerciseId
  name: string
  /** the tab label */
  short: string
  /** the exercise has target buttons (GREEN/BLUE/RED) */
  targets: boolean
  /** what the timed part of a rep is called */
  time: string
  /**
    What the 3D replay's figure does with its arm: 'reach' (HOME to the lit target on
    the mat), 'mouth' (HOME up to its own mouth), 'side' (out to the side, the mat along
    the table edge, the trunk leaning that way), 'turn' (the forearm turning palm down to
    palm up, elbow at the side), or null (no 3D replay).
  */
  figure: 'reach' | 'mouth' | 'side' | 'turn' | null
  /**
    Its identifying colour (icon, tab, overview row). Checked with the dataviz palette
    validator: every pair stays apart for colour-blind readers (worst ΔE 16.7) and each
    is ≥ 3:1 on plaster. Never terracotta, which means a compensated rep.
  */
  color: string
}

export const EXERCISES: Record<ExerciseId, Exercise> = {
  'forward-reach': { id: 'forward-reach', name: 'Seated forward reach', short: 'Forward reach', targets: true, time: 'Reach time', figure: 'reach', color: '#2f8a5a' },
  'sideways-reach': { id: 'sideways-reach', name: 'Sideways reach', short: 'Sideways reach', targets: true, time: 'Reach time', figure: 'side', color: '#2f6fb0' },
  'hand-to-mouth': { id: 'hand-to-mouth', name: 'Hand to mouth', short: 'Hand to mouth', targets: false, time: 'Time to mouth', figure: 'mouth', color: '#b07a1e' },
  'forearm-rotation': { id: 'forearm-rotation', name: 'Forearm rotation', short: 'Forearm rotation', targets: false, time: 'Turn time', figure: 'turn', color: '#8a4fa0' },
}

export const ORDER: ExerciseId[] = ['forward-reach', 'sideways-reach', 'hand-to-mouth', 'forearm-rotation']

/** A session's exercise; older exports have none, and were all the forward reach. */
export const exerciseOf = (s: Session): ExerciseId => s.exercise ?? 'forward-reach'

/** The exercises a patient has sessions of, in the standard order. */
export const exercisesIn = (sessions: Session[]): ExerciseId[] => ORDER.filter((id) => sessions.some((s) => exerciseOf(s) === id))
