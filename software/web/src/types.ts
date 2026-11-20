// Shape of public/sessions.json, written by `python -m software.dashboard.export`.

export type Target = 'GREEN' | 'BLUE' | 'RED'

export interface Trace {
  reachEndS: number   // target press, in seconds after leaving HOME
  t: number[]         // seconds after leaving HOME (negative = before, while the target is lit)
  trunkDeg: number[]
  wristDps: number[]
  state: string[]
}

export interface Rep {
  rep: number
  target: Target
  reactMs: number
  reachMs: number
  peakDeg: number
  bursts: number
  compensated: boolean
  trace: Trace | null
}

export interface Session {
  id: string
  label: string
  patient?: string    // who did it: 'recorded' (data/raw), or a simulated patient id ('sim-a'...). Missing in older exports.
  simulated: boolean
  thresholdDeg: number
  reps: Rep[]
  summary: {
    reps: number
    compensated: number
    pctCompensated: number
    medianReachS: number
    maxPeakDeg: number
  }
}

export interface SessionsFile {
  generated: string
  sessions: Session[]
}
