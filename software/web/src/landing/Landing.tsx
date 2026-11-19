/*
  Re:Motion landing page (served at /).

  The first screen is the device working: a 3D figure at the button mat that the
  visitor leans themselves. Scrolling keeps the room on screen and walks the
  figure through a session (calibrate, clean reach, lean), then hands over to
  the information sections and the dashboard.
*/
import '@fontsource-variable/literata/opsz.css'
import '@fontsource-variable/atkinson-hyperlegible-next'
import '@fontsource-variable/atkinson-hyperlegible-mono'
import './landing.css'

import { ArrowDown, ArrowRight, CircleCheck, CircleX, Timer, Volume2, VolumeX } from 'lucide-react'
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { SessionsFile } from '../types'
import { FallbackFigure } from './FallbackFigure'
import { LIMIT_DEG, type SceneInput } from './lean'

const LeanScene = lazy(() => import('./LeanScene').then((m) => ({ default: m.LeanScene })))

// ---------- small hooks ----------

function useReducedMotion() {
  const [reduced, setReduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const on = () => setReduced(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return reduced
}

function hasWebGL() {
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch {
    return false
  }
}

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x))
const ease = (x: number) => {
  const t = clamp(x, 0, 1)
  return t * t * (3 - 2 * t)
}

// ---------- the buzzer (opt-in sound, the firmware's 2400 Hz tone) ----------

function useBuzzer(enabled: boolean, flagged: boolean) {
  const ctx = useRef<AudioContext | null>(null)
  useEffect(() => {
    if (!enabled || !flagged) return
    ctx.current ??= new AudioContext()
    const ac = ctx.current
    const osc = ac.createOscillator()
    const gain = ac.createGain()
    osc.type = 'square'
    osc.frequency.value = 2400
    gain.gain.value = 0
    osc.connect(gain).connect(ac.destination)
    osc.start()
    // beep-beep: 120 ms on, 120 ms off, quietly
    let on = false
    const id = window.setInterval(() => {
      on = !on
      gain.gain.setTargetAtTime(on ? 0.035 : 0, ac.currentTime, 0.004)
    }, 120)
    return () => {
      window.clearInterval(id)
      gain.gain.setTargetAtTime(0, ac.currentTime, 0.004)
      osc.stop(ac.currentTime + 0.05)
    }
  }, [enabled, flagged])
}

// ---------- the story: one sticky room, five steps ----------

const STEPS = 5 // hero, calibrate, clean, lean, data

function Readout({ valueRef, flagged, deg, onKey, label, calibrating }: {
  valueRef: React.RefObject<HTMLSpanElement | null>
  flagged: boolean
  deg: number
  onKey: (e: React.KeyboardEvent) => void
  label: string
  calibrating: boolean
}) {
  return (
    <div
      role="slider"
      tabIndex={0}
      aria-label="Trunk lean"
      aria-valuemin={0}
      aria-valuemax={30}
      aria-valuenow={Math.round(deg * 10) / 10}
      aria-valuetext={`${deg.toFixed(1)} degrees, ${flagged ? 'past the 10 degree limit, compensated' : 'within the limit'}`}
      onKeyDown={onKey}
      className={`lp-readout ${flagged ? 'is-flagged' : ''}`}
    >
      <span className="lp-readout-label">Trunk lean</span>
      <span className="lp-readout-value">
        <span ref={valueRef}>0.0</span>
        <span className="lp-readout-unit">°</span>
      </span>
      <span className="lp-readout-limit">limit {LIMIT_DEG}°</span>
      <span className="lp-readout-state">
        {flagged ? <CircleX aria-hidden className="size-5" /> : calibrating ? <Timer aria-hidden className="size-5" /> : <CircleCheck aria-hidden className="size-5" />}
        {flagged ? 'Compensated' : label}
      </span>
    </div>
  )
}

function TraceFigure() {
  // One reach, drawn the way the dashboard draws it (illustrative, simulated).
  const pts = useMemo(() => {
    const out: string[] = []
    for (let i = 0; i <= 60; i++) {
      const x = i / 60
      const lean = x < 0.15 ? 0.3 : x < 0.75 ? 14.1 * ease((x - 0.15) / 0.5) : 14.1 * (1 - ease((x - 0.75) / 0.22))
      out.push(`${(20 + x * 460).toFixed(1)},${(170 - lean * 9).toFixed(1)}`)
    }
    return out.join(' ')
  }, [])
  return (
    <figure className="lp-trace">
      <svg viewBox="0 0 500 200" role="img" aria-label="Trunk angle over one reach: it rises past the 10 degree limit to 14.1 degrees and returns">
        <line x1="20" y1="170" x2="480" y2="170" className="lp-trace-axis" />
        <line x1="20" y1={170 - LIMIT_DEG * 9} x2="480" y2={170 - LIMIT_DEG * 9} className="lp-trace-limit" />
        <text x="484" y={174 - LIMIT_DEG * 9} className="lp-trace-tick">10°</text>
        <polyline points={pts} className="lp-trace-line" />
        <circle cx={20 + 0.65 * 460} cy={170 - 14.1 * 9} r="6" className="lp-trace-peak" />
        <text x={20 + 0.65 * 460 + 14} y={170 - 14.1 * 9 - 10} className="lp-trace-tick">14.1°</text>
      </svg>
      <figcaption>Trunk angle during one reach, sampled 100 times a second. Simulated.</figcaption>
    </figure>
  )
}

function Story({ reducedMotion }: { reducedMotion: boolean }) {
  const webgl = useMemo(() => hasWebGL(), [])
  const section = useRef<HTMLElement>(null)
  const valueRef = useRef<HTMLSpanElement>(null)
  const input = useRef<SceneInput>({ trunkDeg: 0, reach: 0, target: 'RED', homeLit: false, calibrating: false, shot: 'hero' })
  const [step, setStep] = useState(0)
  const stepRef = useRef(0)
  const [flagged, setFlagged] = useState(false)
  const [deg, setDeg] = useState(0)
  const [sound, setSound] = useState(false)
  const dragDeg = useRef(0)
  const touched = useRef(false)
  const lastDeg = useRef(-1)
  const lastFlag = useRef(false)

  useBuzzer(sound, flagged)

  // Scroll position -> which step, and how far through it.
  useEffect(() => {
    let raf = 0
    const tick = () => {
      raf = 0
      const el = section.current
      if (!el) return
      const r = el.getBoundingClientRect()
      const vh = window.innerHeight
      // Each step's text is centred on screen at scroll = step × viewport, so the
      // scene switches half a screen early and peaks while its text is centred.
      const p = clamp(-r.top / vh + 0.5, 0, STEPS - 0.001)
      const s = Math.floor(p)
      const f = p - s
      setStep(s)
      stepRef.current = s
      const inp = input.current
      inp.calibrating = s === 1
      if (s === 0) {
        inp.shot = 'hero'
        inp.trunkDeg = dragDeg.current
        inp.reach = clamp(dragDeg.current / 14, 0, 1)
        inp.target = 'RED'
        inp.homeLit = false
      } else if (s === 1) {
        // close on the chest sensor while HOME blinks
        inp.shot = 'chest'
        inp.trunkDeg = 0; inp.reach = 0; inp.target = null; inp.homeLit = true
      } else if (s === 2) {
        // close on the mat: the green target lights, the arm does the work
        const g = ease(f / 0.5)
        inp.shot = 'mat'
        inp.target = 'GREEN'; inp.homeLit = false
        inp.reach = g; inp.trunkDeg = 2.8 * g
      } else if (s === 3) {
        // pull back for the lean
        const g = ease(f / 0.5)
        inp.shot = 'wide'
        inp.target = 'RED'; inp.homeLit = false
        inp.reach = g; inp.trunkDeg = 14.1 * g
      } else {
        // hold the flagged rep while it becomes data
        inp.shot = 'wide'
        inp.target = 'RED'; inp.homeLit = false; inp.reach = 1; inp.trunkDeg = 14.1
      }
    }
    const on = () => { if (!raf) raf = requestAnimationFrame(tick) }
    tick()
    window.addEventListener('scroll', on, { passive: true })
    window.addEventListener('resize', on)
    return () => {
      window.removeEventListener('scroll', on)
      window.removeEventListener('resize', on)
      cancelAnimationFrame(raf)
    }
  }, [])

  // An idle demonstration on the first screen, until the visitor takes over.
  useEffect(() => {
    if (reducedMotion || step !== 0) return
    let raf = 0
    const start = performance.now() + 1800
    const loop = (now: number) => {
      if (touched.current) return
      const t = (now - start) / 1000
      if (t > 0) {
        const phase = t % 5.5 // lean over 1.6 s, hold, return, rest
        const v = phase < 1.6 ? ease(phase / 1.6) : phase < 2.8 ? 1 : phase < 4 ? 1 - ease((phase - 2.8) / 1.2) : 0
        dragDeg.current = 14.1 * v
        input.current.trunkDeg = dragDeg.current
        input.current.reach = clamp(dragDeg.current / 14, 0, 1)
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [reducedMotion, step])

  const setLean = useCallback((d: number) => {
    touched.current = true
    dragDeg.current = clamp(d, 0, 30)
    if (stepRef.current !== 0) return // further down, the scroll drives the figure
    input.current.trunkDeg = dragDeg.current
    input.current.reach = clamp(dragDeg.current / 14, 0, 1)
  }, [])

  // Drag anywhere on the first screen to lean the trunk; let go and they sit back up.
  const drag = useRef<{ x: number; d: number } | null>(null)
  const onPointerDown = (e: React.PointerEvent) => {
    if (step !== 0 || (e.target as HTMLElement).closest('a,button,[role="slider"]')) return
    drag.current = { x: e.clientX, d: dragDeg.current }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return
    setLean(drag.current.d + (e.clientX - drag.current.x) / 14)
  }
  const onPointerUp = () => {
    if (!drag.current) return
    drag.current = null
    setLean(0)
  }
  const onKey = (e: React.KeyboardEvent) => {
    const steps: Record<string, number> = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1, PageUp: 5, PageDown: -5 }
    if (e.key in steps) { e.preventDefault(); setLean(dragDeg.current + steps[e.key]) }
    else if (e.key === 'Home') { e.preventDefault(); setLean(0) }
    else if (e.key === 'End') { e.preventDefault(); setLean(30) }
  }

  const onMeasure = useCallback((d: number, f: boolean) => {
    const rounded = Math.round(d * 10) / 10
    if (rounded !== lastDeg.current) {
      lastDeg.current = rounded
      if (valueRef.current) valueRef.current.textContent = rounded.toFixed(1).padStart(4, '\u2007')
      setDeg((prev) => (Math.abs(prev - rounded) >= 0.5 || rounded === 0 ? rounded : prev)) // aria value, coarse
    }
    if (f !== lastFlag.current) { lastFlag.current = f; setFlagged(f) }
  }, [])

  const stateLabel = step === 1 ? 'Calibrating' : deg < 0.5 ? 'Upright' : 'Within the limit'

  return (
    <section ref={section} id="how" className="lp-story" style={{ height: `${STEPS * 100}svh` }} aria-label="How Re:Motion works">
      <div
        className={`lp-stage ${flagged ? 'is-flagged' : ''} ${step === 0 ? 'is-hero' : ''}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div className="lp-canvas" aria-hidden>
          {webgl ? (
            <Suspense fallback={null}>
              <LeanScene input={input} onMeasure={onMeasure} reducedMotion={reducedMotion} />
            </Suspense>
          ) : (
            <FallbackFigure input={input} onMeasure={onMeasure} />
          )}
        </div>
        <div className="lp-instrument">
          <Readout valueRef={valueRef} flagged={flagged} deg={deg} onKey={onKey} label={stateLabel} calibrating={step === 1} />
          <button
            type="button"
            className="lp-sound"
            aria-pressed={sound}
            onClick={() => setSound((s) => !s)}
          >
            {sound ? <Volume2 aria-hidden className="size-4" /> : <VolumeX aria-hidden className="size-4" />}
            <span className="lp-sound-long">{sound ? 'Buzzer sound on' : 'Buzzer sound off'}</span>
            <span className="lp-sound-short">{sound ? 'Sound on' : 'Sound off'}</span>
          </button>
        </div>
        <a href="#calibrate" className={`lp-scroll ${step === 0 ? '' : 'is-hidden'}`} tabIndex={step === 0 ? 0 : -1}>
          <ArrowDown aria-hidden className="size-4" /> Scroll to watch a session
        </a>
      </div>

      <div className="lp-steps">
        <div className="lp-step lp-step-hero">
          <h1 className="lp-h1">Relearning to reach, the right way.</h1>
          <p className="lp-lede">
            Rehab scores check whether a reach was completed. Re:Motion’s two sensors notice when the trunk leans in to do the arm’s work.
          </p>
          <div className="lp-actions">
            <a className="lp-btn" href="/dashboard">Open the dashboard <ArrowRight aria-hidden className="size-5" /></a>
            <span className="lp-cue">{reducedMotion ? 'Drag the figure, or focus the readout and use the arrow keys, to lean.' : 'Drag the figure to lean it.'}</span>
          </div>
        </div>
        <div className="lp-step" id="calibrate">
          <h2 className="lp-h2">Three seconds of sitting still.</h2>
          <p>The HOME button blinks while the chest sensor learns what upright means for this person, in this harness, today. Every angle after that is measured from here.</p>
        </div>
        <div className="lp-step">
          <h2 className="lp-h2">A clean reach.</h2>
          <p>The green target lights. The arm does the work and the trunk barely moves, under 3°. A green light on the table says the rep was clean.</p>
        </div>
        <div className="lp-step">
          <h2 className="lp-h2">The lean.</h2>
          <p>Red, at arm’s length. The trunk tips forward to make up the distance. Past {LIMIT_DEG}° for 200 ms, the buzzer sounds while it happens, and the rep is marked compensated.</p>
        </div>
        <div className="lp-step">
          <h2 className="lp-h2">Every rep becomes data.</h2>
          <TraceFigure />
        </div>
      </div>
    </section>
  )
}

// ---------- information sections ----------

function Progress() {
  const [data, setData] = useState<SessionsFile | null>(null)
  useEffect(() => {
    fetch('/sessions.json', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then(setData)
      .catch(() => setData(null))
  }, [])
  const sessions = data?.sessions ?? []
  const simulated = sessions.some((s) => s.simulated)
  const W = 640, H = 240, pad = 36
  const xs = (i: number) => pad + (i / Math.max(1, sessions.length - 1)) * (W - pad * 2)
  const ys = (pct: number) => H - pad - (pct / 100) * (H - pad * 2)

  return (
    <section className="lp-section lp-progress" aria-labelledby="progress-h">
      <div className="lp-wrap lp-split">
        <div>
          <h2 id="progress-h" className="lp-h2">The question a therapist asks: is it getting better?</h2>
          <p>
            The dashboard turns each session into the numbers that matter between appointments: how often the trunk
            took over, how far it leaned, and how long each reach took, rep by rep and week by week.
          </p>
          <a className="lp-btn" href="/dashboard">Open the dashboard <ArrowRight aria-hidden className="size-5" /></a>
        </div>
        <figure className="lp-chart">
          {sessions.length > 1 ? (
            <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Percent of reps compensated across ${sessions.length} sessions, from ${Math.round(sessions[0].summary.pctCompensated)}% to ${Math.round(sessions[sessions.length - 1].summary.pctCompensated)}%`}>
              {[0, 25, 50, 75].map((v) => (
                <g key={v}>
                  <line x1={pad} x2={W - pad} y1={ys(v)} y2={ys(v)} className="lp-grid" />
                  <text x={pad - 8} y={ys(v) + 5} className="lp-axis" textAnchor="end">{v}%</text>
                </g>
              ))}
              <polyline className="lp-line" points={sessions.map((s, i) => `${xs(i)},${ys(s.summary.pctCompensated)}`).join(' ')} />
              {sessions.map((s, i) => (
                <circle key={s.id} cx={xs(i)} cy={ys(s.summary.pctCompensated)} r="5.5" className="lp-dot" />
              ))}
              <text x={xs(0)} y={H - 8} className="lp-axis">{sessions[0].label.split(',')[0]}</text>
              <text x={xs(sessions.length - 1)} y={H - 8} className="lp-axis" textAnchor="end">{sessions[sessions.length - 1].label.split(',')[0]}</text>
            </svg>
          ) : (
            <div className="lp-chart-empty">Session data appears here once <code>sessions.json</code> is exported.</div>
          )}
          <figcaption>
            Reps compensated per session{simulated ? <strong className="lp-sim"> · Simulated data</strong> : null}
          </figcaption>
        </figure>
      </div>
    </section>
  )
}

const STUDIES = [
  {
    who: 'Gabler et al., 2026',
    what: 'Two motion sensors, on the wrist and the trunk, detected compensatory trunk movement in real time (ROC-AUC above 0.93).',
    caveat: 'Preprint, not peer reviewed. 10 able-bodied people simulating impairment, plus 4 with neurological conditions, where accuracy was lower. Uses machine learning; we use a readable threshold.',
    href: 'https://arxiv.org/abs/2604.12591',
    src: 'arXiv:2604.12591',
    id: true,
  },
  {
    who: 'Ranganathan et al., 2017',
    what: 'A two-sensor wearable told compensatory from normal reaching with about 90% accuracy, checked against motion capture.',
    caveat: '19 healthy adults, with compensation induced by an elbow brace.',
    href: 'https://doi.org/10.1088/1361-6579/aa9835',
    src: 'Physiological Measurement',
  },
  {
    who: 'Seo et al., 2024',
    what: 'A wrist sensor monitored the quality of 19 stroke survivors’ practice at home, agreeing with therapist video labels 92% of the time.',
    caveat: 'One wrist sensor and a different method; it shows home monitoring is workable.',
    href: 'https://doi.org/10.3390/s24020554',
    src: 'Sensors',
  },
]

function Evidence() {
  return (
    <section id="evidence" className="lp-section lp-evidence" aria-labelledby="evidence-h">
      <div className="lp-wrap">
        <h2 id="evidence-h" className="lp-h2">What the research says is possible.</h2>
        <p className="lp-measure">
          After a stroke, leaning the trunk to make up for a weaker arm is well documented (Cirstea &amp; Levin, 2000).
          Wearable sensors have already been shown to catch it.
        </p>
        <ol className="lp-studies">
          {STUDIES.map((s) => (
            <li key={s.who}>
              <h3>{s.who}</h3>
              <p>{s.what}</p>
              <p className="lp-caveat">{s.caveat}</p>
              <a href={s.href} target="_blank" rel="noreferrer" className={'id' in s ? 'lp-id' : undefined}>{s.src}</a>
            </li>
          ))}
        </ol>
        <div className="lp-ours">
          <div>
            <h3>Our own number</h3>
            <p>
              How often Re:Motion agrees with a blind label from side-view video. Target: about 90% over about 60 reps
              from three or more testers.
            </p>
          </div>
          <p className="lp-ours-value">To be measured</p>
        </div>
        <p className="lp-honest">
          Re:Motion is a student prototype, tested only on team members, never on patients. It is not a certified medical device.
        </p>
      </div>
    </section>
  )
}

const PARTS: [string, string][] = [
  ['Brain', 'Arduino UNO R4 Minima'],
  ['Sensors', '2 × MPU-6050 motion sensors, chest and wrist'],
  ['Sampling', '100 times a second'],
  ['Mat', '5 arcade buttons: HOME, green, blue, red, START'],
  ['Feedback', 'Buzzer at 2400 Hz, green and red result lights'],
  ['Rule', `Trunk past ${LIMIT_DEG}° for 200 ms`],
  ['Cost', 'About $150 in parts'],
]

function Hardware() {
  return (
    <section id="hardware" className="lp-section lp-hardware" aria-labelledby="hardware-h">
      <div className="lp-wrap lp-split">
        <div>
          <h2 id="hardware-h" className="lp-h2">About $150 of parts, one USB cable.</h2>
          <dl className="lp-spec">
            {PARTS.map(([k, v]) => (
              <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
            ))}
          </dl>
        </div>
        <div className="lp-media">
          <figure className="lp-schematic">
            <img src="/schematic.png" alt="KiCad schematic of the IMU Reach Tracker: Arduino, level shifter, two motion sensors, five buttons, transistor drivers and the buzzer" loading="lazy" width="1434" height="974" />
            <figcaption>The circuit, drawn in KiCad by Group 19.</figcaption>
          </figure>
          <div className="lp-slots">
            <div className="lp-slot">Photo of the soldered build, coming from the bench</div>
            <div className="lp-slot">Video of a clean reach and a leaned one</div>
          </div>
        </div>
      </div>
    </section>
  )
}

function Close() {
  return (
    <footer className="lp-close">
      <div className="lp-wrap">
        <h2 className="lp-close-h">See a whole session.</h2>
        <a className="lp-btn lp-btn-light" href="/dashboard">Open the dashboard <ArrowRight aria-hidden className="size-5" /></a>
        <div className="lp-credits">
          <p><strong>Re:Motion</strong> · ECE 198, University of Waterloo · Group 19</p>
          <p>Built for the CCCARE course challenge on at-home rehab.</p>
          <a href="https://github.com/vinyx1/ReMotion" target="_blank" rel="noreferrer">Source on GitHub</a>
        </div>
      </div>
    </footer>
  )
}

export default function Landing() {
  const reducedMotion = useReducedMotion()
  // Over the 3D room the nav floats; past it, it becomes a solid bar so it never sits on content.
  const [solidNav, setSolidNav] = useState(false)
  useEffect(() => {
    const on = () => {
      const story = document.getElementById('how')
      setSolidNav(!!story && story.getBoundingClientRect().bottom < 80)
    }
    on()
    window.addEventListener('scroll', on, { passive: true })
    return () => window.removeEventListener('scroll', on)
  }, [])
  useEffect(() => {
    document.title = 'Re:Motion: the reach, measured'
    document.documentElement.classList.add('lp-root')
    return () => document.documentElement.classList.remove('lp-root')
  }, [])
  return (
    <div className="lp">
      <a className="lp-skip" href="#main">Skip to content</a>
      <header className={`lp-nav ${solidNav ? 'is-solid' : ''}`}>
        <a href="/" className="lp-mark">Re:Motion</a>
        <nav aria-label="Sections">
          <a href="#how">How it works</a>
          <a href="#evidence">Evidence</a>
          <a href="#hardware">Hardware</a>
          <a className="lp-nav-btn" href="/dashboard">Dashboard</a>
        </nav>
      </header>
      <main id="main">
        <Story reducedMotion={reducedMotion} />
        <Progress />
        <Evidence />
        <Hardware />
      </main>
      <Close />
    </div>
  )
}
