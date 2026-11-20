// Shape of public/sessions.json, written by `python -m software.dashboard.export`.

export type Target = 'GREEN' | 'BLUE' | 'RED'

/** Session blocks, in order. The buzzer only sounds in TRAINING. */
export type Phase = 'PRACTICE' | 'BASELINE' | 'TRAINING' | 'POST'

export interface PhaseSummary {
  phase: Phase
  reps: number
  compensated: number
  pctCompensated: number
  medianPeakDeg: number
  buzzer: boolean
}

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
  phase: Phase | null   // null for logs from before the firmware had blocks
  trace: Trace | null
}

export interface Session {
  id: string
  label: string
  simulated: boolean
  thresholdDeg: number
  reps: Rep[]
  phases: PhaseSummary[]   // in session order; [] for logs from before blocks existed
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
