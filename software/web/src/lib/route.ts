/*
  Where the dashboard is, kept in the URL hash so every view can be bookmarked and
  the browser's back button works:

    #/patients                         all patients
    #/p/<pid>                          a patient's overview of every exercise (the default view)
    #/p/<pid>/x/<exercise>             one exercise's overview (e.g. #/p/sim-a/x/hand-to-mouth)
    #/p/<pid>/x/<exercise>/sessions    that exercise's sessions
    #/p/<pid>/x/<exercise>/replay      that exercise's rep replay (its latest session)
    #/p/<pid>/sessions                 their sessions, every exercise
    #/p/<pid>/sessions/<sid>           one session
    #/p/<pid>/sessions/<sid>/reps/<n>  one rep, replayed
    #/p/<pid>/replay                   rep replay (opens the latest session's highest-lean rep; kept for old links)
    #/p/<pid>/profile                  profile and settings
*/
import { useEffect, useState } from 'react'
import type { ExerciseId } from '../types'

/** The pages inside one exercise. */
export type ExerciseView = 'overview' | 'sessions' | 'replay'

export type Route =
  | { name: 'patients' }
  | { name: 'overview'; pid: string }
  | { name: 'exercise'; pid: string; exercise: ExerciseId; view?: ExerciseView }
  | { name: 'sessions'; pid: string }
  | { name: 'session'; pid: string; sid: string }
  | { name: 'rep'; pid: string; sid: string; rep: number | null }
  | { name: 'replay'; pid: string }
  | { name: 'profile'; pid: string }

export function parse(hash: string, defaultPid: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent)
  if (parts[0] === 'patients') return { name: 'patients' }
  if (parts[0] !== 'p' || !parts[1]) return { name: 'overview', pid: defaultPid }
  const pid = parts[1]
  switch (parts[2]) {
    case 'sessions':
      if (!parts[3]) return { name: 'sessions', pid }
      if (parts[4] === 'reps') return { name: 'rep', pid, sid: parts[3], rep: parts[5] ? Number(parts[5]) : null }
      return { name: 'session', pid, sid: parts[3] }
    case 'x': {
      if (!parts[3]) return { name: 'overview', pid }
      const view: ExerciseView = parts[4] === 'sessions' || parts[4] === 'replay' ? parts[4] : 'overview'
      return { name: 'exercise', pid, exercise: parts[3] as ExerciseId, view }
    }
    case 'replay': return { name: 'replay', pid }
    case 'profile': return { name: 'profile', pid }
    default: return { name: 'overview', pid }
  }
}

export function href(r: Route): string {
  const e = encodeURIComponent
  switch (r.name) {
    case 'patients': return '#/patients'
    case 'overview': return `#/p/${e(r.pid)}`
    case 'exercise': return `#/p/${e(r.pid)}/x/${e(r.exercise)}${r.view && r.view !== 'overview' ? `/${r.view}` : ''}`
    case 'sessions': return `#/p/${e(r.pid)}/sessions`
    case 'session': return `#/p/${e(r.pid)}/sessions/${e(r.sid)}`
    case 'rep': return `#/p/${e(r.pid)}/sessions/${e(r.sid)}/reps${r.rep === null ? '' : `/${r.rep}`}`
    case 'replay': return `#/p/${e(r.pid)}/replay`
    case 'profile': return `#/p/${e(r.pid)}/profile`
  }
}

export function go(r: Route) {
  window.location.hash = href(r)
}

export function useRoute(defaultPid: string): Route {
  const [hash, setHash] = useState(() => window.location.hash)
  useEffect(() => {
    const on = () => {
      setHash(window.location.hash)
      window.scrollTo({ top: 0 })
    }
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return parse(hash, defaultPid)
}
