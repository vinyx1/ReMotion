/*
  ReMotion landing page (served at /).

  The first screen is the device working: a 3D figure at the button mat that the
  visitor leans themselves. Scrolling keeps the room on screen and walks the
  figure through a session (calibrate, clean reach, lean), then hands over to
  the information sections and the dashboard.
*/
import '@fontsource-variable/literata/opsz.css'
import '@fontsource-variable/atkinson-hyperlegible-next'
import '@fontsource-variable/atkinson-hyperlegible-mono'
import './landing.css'

import { ArrowDown, ArrowRight, ArrowUpRight } from 'lucide-react'
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Target } from '../types'
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

// ---------- the story: one sticky room, five steps ----------

const STEPS = 5 // hero, calibrate, clean, lean, data

/*
  The instrument on the wall: the trunk angle as a big number, with a scale under it
  (0 to 30 degrees, the limit marked, a needle at the live angle) so the number
  always reads against the limit. The needle moves through the --lean custom
  property, set every frame by onMeasure without a React render.
*/
const SCALE_MAX = 30

function Readout({ valueRef, plateRef, flagged, deg, onKey, label }: {
  valueRef: React.RefObject<HTMLSpanElement | null>
  plateRef: React.RefObject<HTMLDivElement | null>
  flagged: boolean
  deg: number
  onKey: (e: React.KeyboardEvent) => void
  label: string
}) {
  return (
    <div
      ref={plateRef}
      role="slider"
      tabIndex={0}
      aria-label="Trunk lean"
      aria-valuemin={0}
      aria-valuemax={30}
      aria-valuenow={Math.round(deg * 10) / 10}
      aria-valuetext={`${deg.toFixed(1)} degrees, ${flagged ? 'past the 10 degree limit, compensated' : 'within the limit'}`}
      onKeyDown={onKey}
      className={`lp-readout ${flagged ? 'is-flagged' : ''}`}
      style={{ '--lean': 0, '--limit': LIMIT_DEG / SCALE_MAX } as React.CSSProperties}
    >
      <div className="lp-readout-head">
        <span className="lp-readout-label">Trunk lean</span>
        <span className="lp-readout-state">{flagged ? 'Compensated' : label}</span>
      </div>
      <span className="lp-readout-value">
        <span ref={valueRef}>0.0</span>
        <span className="lp-readout-unit">°</span>
      </span>
      <div className="lp-scale" aria-hidden>
        <div className="lp-scale-track">
          <span className="lp-scale-over" />
          <span className="lp-scale-fill" />
          <span className="lp-scale-limit" />
          <span className="lp-scale-needle" />
        </div>
        <div className="lp-scale-ticks">
          <span>0°</span>
          <span className="lp-scale-limit-label"><span className="lp-scale-limit-word">limit </span>{LIMIT_DEG}°</span>
          <span>{SCALE_MAX}°</span>
        </div>
      </div>
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
  const plateRef = useRef<HTMLDivElement>(null)
  const input = useRef<SceneInput>({ trunkDeg: 0, reach: 0, target: 'RED', homeLit: false, calibrating: false, camera: 0 })
  const [step, setStep] = useState(0)
  const stepEls = useRef<(HTMLDivElement | null)[]>([])
  const stepRef = useRef(0)
  const [flagged, setFlagged] = useState(false)
  const [deg, setDeg] = useState(0)
  const dragDeg = useRef(0)
  const touched = useRef(false)
  const lastDeg = useRef(-1)
  const lastFlag = useRef(false)

  // One scroll gesture = one step. Inside the story, a wheel notch, a trackpad swipe, a touch
  // swipe or Page Down / arrow keys glide to the next step (or back) and the momentum that
  // follows is swallowed, so a swipe can never skip a step. Past the last step the page
  // scrolls normally again; scrolling back up re-enters the steps.
  useEffect(() => {
    const el = section.current
    if (!el) return
    let animating = false
    let lastWheel = 0
    let raf = 0
    const vh = () => window.innerHeight
    const top = () => el.offsetTop
    const last = STEPS - 1
    const at = () => (window.scrollY - top()) / vh()             // 0 = hero, 1 = calibrate, ...
    const inStory = () => window.scrollY >= top() - 2 && at() <= last + 0.02
    const glide = (to: number) => {
      const from = window.scrollY, dest = top() + to * vh()
      if (Math.abs(dest - from) < 2) return
      if (reducedMotion) { window.scrollTo({ top: dest, behavior: 'instant' }); return }
      animating = true
      const t0 = performance.now(), dur = 850
      const ease = (u: number) => (u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2)
      const frame = (now: number) => {
        const u = Math.min(1, (now - t0) / dur)
        window.scrollTo({ top: from + (dest - from) * ease(u), behavior: 'instant' })
        if (u < 1) raf = requestAnimationFrame(frame)
        else animating = false
      }
      raf = requestAnimationFrame(frame)
    }
    /** Step by `dir`; returns false when the page should scroll normally instead. */
    const step = (dir: 1 | -1) => {
      if (!inStory()) return false
      const now = Math.round(at())
      if (dir > 0 && at() >= last - 0.02) return false            // leaving the story downward
      if (dir < 0 && at() <= 0.02) return false                    // already at the top
      glide(dir > 0 ? Math.min(last, Math.floor(at() + 0.02) + 1) : Math.max(0, Math.ceil(at() - 0.02) - 1))
      return now >= 0
    }
    // A gesture is one stream of wheel events; it ends after 200 ms of quiet. It fires one step
    // on its first event that has a real direction (trackpads often open with a zero-delta event),
    // and the rest of it, momentum included, is swallowed. A fresh swipe during leftover momentum
    // shows up as a jump in speed and counts as a new gesture.
    let fired = false, prevAbs = 0
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) < Math.abs(e.deltaX)) return
      const t = performance.now()
      const abs = Math.abs(e.deltaY)
      if (t - lastWheel > 200) fired = false
      else if (fired && !animating && abs > prevAbs * 1.8 + 4) fired = false
      lastWheel = t
      prevAbs = abs
      if (!inStory()) return
      const dir = e.deltaY > 0 ? 1 : e.deltaY < 0 ? -1 : 0
      // let the page scroll normally out of the bottom of the story, and at the very top
      if (dir > 0 && at() >= last - 0.02) return
      if (dir < 0 && at() <= 0.02) return
      e.preventDefault()
      if (fired || animating || dir === 0 || abs < 2) return
      fired = true
      step(dir)
    }
    let touchY: number | null = null, touchX = 0
    const onTouchStart = (e: TouchEvent) => { touchY = e.touches[0].clientY; touchX = e.touches[0].clientX }
    const onTouchMove = (e: TouchEvent) => {
      if (touchY === null || !inStory()) return
      const dy = touchY - e.touches[0].clientY, dx = touchX - e.touches[0].clientX
      if (Math.abs(dy) < Math.abs(dx)) return                     // sideways: the hero's drag-to-lean
      const dir = dy > 0 ? 1 : -1
      if ((dir > 0 && at() >= last - 0.02) || (dir < 0 && at() <= 0.02)) return
      e.preventDefault()
      if (!animating && Math.abs(dy) > 36) { step(dir); touchY = null }
    }
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t.closest('input,textarea,select,[role="slider"],[contenteditable="true"]')) return
      const dir = ['ArrowDown', 'PageDown', ' '].includes(e.key) && !e.shiftKey ? 1
        : ['ArrowUp', 'PageUp'].includes(e.key) || (e.key === ' ' && e.shiftKey) ? -1 : 0
      if (!dir || !inStory()) return
      if ((dir > 0 && at() >= last - 0.02) || (dir < 0 && at() <= 0.02)) return
      e.preventDefault()
      if (!animating) step(dir as 1 | -1)
    }
    window.addEventListener('wheel', onWheel, { passive: false })
    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchmove', onTouchMove, { passive: false })
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('wheel', onWheel)
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('keydown', onKey)
      cancelAnimationFrame(raf)
    }
  }, [reducedMotion])

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
      setStep(s)
      stepRef.current = s
      const inp = input.current
      inp.camera = clamp(p - 0.5, 0, STEPS - 1)
      // The text is pinned with the room and crossfades: one step at a time, never under the nav.
      stepEls.current.forEach((el, i) => {
        if (!el) return
        const d = p - (i + 0.5)
        const o = clamp(1 - (Math.abs(d) - 0.26) / 0.34, 0, 1)
        el.style.opacity = String(o)
        el.style.visibility = o > 0.01 ? 'visible' : 'hidden'
        el.style.transform = reducedMotion ? '' : `translateY(${(-d * 48).toFixed(1)}px)`
      })
      inp.calibrating = s === 1
      // The figure follows the scroll continuously, like the camera: each step has a pose at its
      // centre and the scroll blends between neighbours, so nothing snaps at a boundary. Between
      // two reaches the arm plays a whole rep: back to HOME, then out to the next target, with
      // the lit button changing while the hand is home.
      const c = clamp(p - 0.5, 0, STEPS - 1)
      const i = Math.min(Math.floor(c), STEPS - 2)
      const t = c - i
      const sm = (x: number) => { const y = clamp(x, 0, 1); return y * y * (3 - 2 * y) }
      const heroDeg = dragDeg.current, heroReach = clamp(dragDeg.current / 14, 0, 1)
      // pose at each step's centre: [trunk degrees, reach, lit target]
      const POSE: [number, number, Target | null][] = [
        [heroDeg, heroReach, 'RED'], [0, 0, null], [2.8, 1, 'GREEN'], [14.1, 1, 'RED'], [14.1, 1, 'RED'],
      ]
      const [d0, r0, g0] = POSE[i], [d1, r1, g1] = POSE[i + 1]
      inp.trunkDeg = d0 + (d1 - d0) * sm(t)
      if (g0 !== g1 && r0 > 0 && r1 > 0) {
        // reach to reach with a different target: home at the midpoint, the light swaps there.
        // The trunk follows the arm: upright as the hand comes home, leaning as it reaches out.
        inp.reach = t < 0.5 ? r0 * (1 - sm(t / 0.5)) : r1 * sm((t - 0.5) / 0.5)
        inp.target = t < 0.5 ? g0 : g1
        inp.trunkDeg = t < 0.5 ? d0 * (1 - sm(t / 0.5)) : d1 * sm((t - 0.5) / 0.5)
      } else {
        inp.reach = r0 + (r1 - r0) * sm(t)
        // swap the light at whichever end the hand is home
        inp.target = r1 > r0 ? g1 : r0 > r1 ? (t < 0.98 ? g0 : g1) : (t < 0.5 ? g0 : g1)
      }
      // HOME blinks around calibration, fading out of it as the reach starts
      inp.homeLit = (i === 0 && t > 0.6) || (i === 1 && t < 0.35)
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
  }, [reducedMotion])

  // An idle demonstration on the first screen, until the visitor takes over.
  useEffect(() => {
    if (reducedMotion || step !== 0) return
    let raf = 0
    const start = performance.now() + 1800
    const loop = (now: number) => {
      if (touched.current) return
      const t = (now - start) / 1000
      // only while the page rests on the first screen: once a scroll starts, the scroll owns the
      // pose (two writers fighting each frame is what flickered between steps)
      if (t > 0 && input.current.camera < 0.005) {
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

  // Drag on the figure (the hit area over him) to lean the trunk; let go and they sit back up.
  const hitArea = useRef<HTMLDivElement>(null)
  const drag = useRef<{ x: number; d: number } | null>(null)
  const [dragging, setDragging] = useState(false)
  const onPointerDown = (e: React.PointerEvent) => {
    if (step !== 0) return
    drag.current = { x: e.clientX, d: dragDeg.current }
    setDragging(true)
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return
    setLean(drag.current.d + (e.clientX - drag.current.x) / 14)
  }
  const onPointerUp = () => {
    if (!drag.current) return
    drag.current = null
    setDragging(false)
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
      plateRef.current?.style.setProperty('--lean', String(clamp(rounded, 0, SCALE_MAX) / SCALE_MAX))
      setDeg((prev) => (Math.abs(prev - rounded) >= 0.5 || rounded === 0 ? rounded : prev)) // aria value, coarse
    }
    if (f !== lastFlag.current) { lastFlag.current = f; setFlagged(f) }
  }, [])

  const stateLabel = step === 1 ? 'Calibrating' : deg < 0.5 ? 'Upright' : 'Within the limit'

  return (
    <section ref={section} id="how" className="lp-story" style={{ height: `${STEPS * 100}svh` }} aria-label="How ReMotion works">
      <div
        className={`lp-stage ${flagged ? 'is-flagged' : ''} ${step === 0 ? 'is-hero' : ''}`}
      >
        <div className="lp-canvas" aria-hidden>
          {webgl ? (
            <Suspense fallback={null}>
              <LeanScene input={input} onMeasure={onMeasure} reducedMotion={reducedMotion} hitArea={hitArea} />
            </Suspense>
          ) : (
            <FallbackFigure input={input} onMeasure={onMeasure} />
          )}
        </div>
        {/* the drag area: only over the figure, kept in place by the 3D scene */}
        <div
          ref={hitArea}
          className={`lp-hit ${step === 0 ? '' : 'is-off'} ${dragging ? 'is-dragging' : ''}`}
          aria-hidden
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />
        <div className="lp-instrument">
          <Readout valueRef={valueRef} plateRef={plateRef} flagged={flagged} deg={deg} onKey={onKey} label={stateLabel} />
        </div>
        <a
          href="#calibrate"
          className={`lp-scroll ${step === 0 ? '' : 'is-hidden'}`}
          tabIndex={step === 0 ? 0 : -1}
          onClick={(e) => {
            const el = section.current
            if (!el) return
            e.preventDefault()
            window.scrollTo({ top: el.offsetTop + window.innerHeight, behavior: reducedMotion ? 'auto' : 'smooth' })
          }}
        >
          <ArrowDown aria-hidden className="size-4" /> Scroll to watch a session
        </a>
        <div className="lp-steps">
          <div className="lp-step lp-step-hero" ref={(el) => { stepEls.current[0] = el }}>
            <h1 className="lp-h1">Relearning to reach, the right way.</h1>
            <p className="lp-lede">
              Rehab scores check whether a reach was completed. ReMotion’s two sensors notice when the trunk leans in to do the arm’s work.
            </p>
            <div className="lp-actions">
              <a className="lp-btn" href="/dashboard">Try the demo <ArrowRight aria-hidden className="size-5" /></a>
              <span className="lp-cue">{reducedMotion ? 'Drag the figure, or focus the readout and use the arrow keys, to lean.' : 'Drag the figure to lean it.'}</span>
            </div>
          </div>
          <div className="lp-step" id="calibrate" ref={(el) => { stepEls.current[1] = el }}>
            <h2 className="lp-h2">Three seconds of sitting still.</h2>
            <p>The HOME button blinks while the chest sensor learns what upright means for this person, in this harness, today. Every angle after that is measured from here.</p>
          </div>
          <div className="lp-step" ref={(el) => { stepEls.current[2] = el }}>
            <h2 className="lp-h2">A clean reach.</h2>
            <p>The green target lights. The arm does the work and the trunk barely moves, under 3°. A green light on the table says the rep was clean.</p>
          </div>
          <div className="lp-step" ref={(el) => { stepEls.current[3] = el }}>
            <h2 className="lp-h2">The lean.</h2>
            <p>Red, at arm’s length. The trunk tips forward to make up the distance. Past {LIMIT_DEG}° for 200 ms, the buzzer sounds while it happens, and the rep is marked compensated.</p>
          </div>
          <div className="lp-step" ref={(el) => { stepEls.current[4] = el }}>
            <h2 className="lp-h2">Every rep becomes data.</h2>
            <TraceFigure />
          </div>
        </div>
      </div>

    </section>
  )
}

// ---------- information sections ----------

/*
  "Is it getting better?" answered with one example patient: Margaret (simulated, from
  software/dashboard/fake_history.py, sim-a's forward reach), whose share of leaned reaches
  falls over three weeks. Built in, so the deployed page shows it without any data file; the
  caption says it's simulated. A dashed least-squares line shows the direction through the
  session-to-session noise.
*/
const EXAMPLE = [
  { day: 'Nov 2', pct: 33 }, { day: 'Nov 4', pct: 43 }, { day: 'Nov 6', pct: 33 }, { day: 'Nov 9', pct: 24 },
  { day: 'Nov 11', pct: 5 }, { day: 'Nov 13', pct: 29 }, { day: 'Nov 16', pct: 19 }, { day: 'Nov 18', pct: 5 },
]

function Progress() {
  const W = 640, H = 260, left = 52, right = 24, top = 20, bottom = 40, max = 50
  const xs = (i: number) => left + (i / (EXAMPLE.length - 1)) * (W - left - right)
  const ys = (pct: number) => top + (1 - pct / max) * (H - top - bottom)
  // straight line of best fit through the sessions
  const n = EXAMPLE.length, mx = (n - 1) / 2, my = EXAMPLE.reduce((a, p) => a + p.pct, 0) / n
  const slope = EXAMPLE.reduce((a, p, i) => a + (i - mx) * (p.pct - my), 0) / EXAMPLE.reduce((a, _, i) => a + (i - mx) ** 2, 0)
  const fit = (i: number) => my + slope * (i - mx)

  return (
    <section className="lp-section lp-progress" aria-labelledby="progress-h">
      <div className="lp-wrap lp-split">
        <div>
          <p className="lp-kicker">The question a therapist asks</p>
          <h2 id="progress-h" className="lp-h2">Is it getting better?</h2>
          <p>
            Between appointments, ReMotion records every reach at home. The dashboard turns that into an answer: how
            often the trunk leaned in to help, how far it went, and how long each reach took, session by session.
          </p>
          <a className="lp-btn" href="/dashboard">Try the demo <ArrowRight aria-hidden className="size-5" /></a>
        </div>
        <figure className="lp-chart">
          <div className="lp-chart-head">
            <p className="lp-chart-who">Margaret · forward reach</p>
            <p className="lp-chart-stat">About <strong>1 in 3</strong> reaches leaned at first, <strong>1 in 20</strong> by week three</p>
          </div>
          <svg viewBox={`0 0 ${W} ${H}`} role="img"
            aria-label="Share of reaches where the trunk leaned, per session, from 33% on November 2 to 5% on November 18, trending down">
            {[0, 25, 50].map((v) => (
              <g key={v}>
                <line x1={left} x2={W - right} y1={ys(v)} y2={ys(v)} className="lp-grid" />
                <text x={left - 10} y={ys(v) + 5} className="lp-axis" textAnchor="end">{v}%</text>
              </g>
            ))}
            <line x1={xs(0)} y1={ys(fit(0))} x2={xs(n - 1)} y2={ys(fit(n - 1))} className="lp-trend" />
            <polyline className="lp-line" points={EXAMPLE.map((p, i) => `${xs(i)},${ys(p.pct)}`).join(' ')} />
            {EXAMPLE.map((p, i) => <circle key={p.day} cx={xs(i)} cy={ys(p.pct)} r="5.5" className="lp-dot" />)}
            <text x={xs(0)} y={H - 10} className="lp-axis">{EXAMPLE[0].day}</text>
            <text x={xs(n - 1)} y={H - 10} className="lp-axis" textAnchor="end">{EXAMPLE[n - 1].day}</text>
          </svg>
          <figcaption>
            Share of reaches where the trunk leaned past the limit, each session. The dashed line is the trend.
            <strong className="lp-sim"> Simulated example patient.</strong>
          </figcaption>
        </figure>
      </div>
    </section>
  )
}

/*
  The studies behind the claim, from docs/research/stroke-compensations.md (titles, venues and
  links exactly as there). Each card is its headline figure and what it measures, then a small
  source card that opens the paper itself (its limits are in the research notes).
*/
const STUDIES = [
  {
    who: 'Gabler et al., 2026',
    // ROC-AUC above 0.93: given one leaned and one upright reach, how often it ranks the leaned one higher
    figure: '93', of: 'in 100',
    measure: 'times it picked out the leaned reach, shown one leaned and one upright',
    title: 'Machine Learning-Based Real-Time Detection of Compensatory Trunk Movements Using Trunk-Wrist Inertial Measurement Units',
    kind: 'Preprint',
    venue: 'arXiv',
    id: 'arXiv:2604.12591',
    href: 'https://arxiv.org/abs/2604.12591',
  },
  {
    who: 'Ranganathan et al., 2017',
    figure: 'About 9', of: 'in 10',
    measure: 'reaches labelled the same as a motion-capture lab',
    title: 'Identifying compensatory movement patterns in the upper extremity using a wearable sensor system',
    kind: 'Journal article',
    venue: 'Physiological Measurement',
    id: 'DOI 10.1088/1361-6579/aa9835',
    href: 'https://doi.org/10.1088/1361-6579/aa9835',
  },
  {
    who: 'Seo et al., 2024',
    figure: '92', of: 'in 100',
    measure: 'movements rated the same as a therapist watching the video',
    title: 'Wearable Sensor to Monitor Quality of Upper Limb Task Practice for Stroke Survivors at Home',
    kind: 'Journal article',
    venue: 'Sensors',
    id: 'DOI 10.3390/s24020554',
    href: 'https://doi.org/10.3390/s24020554',
  },
]

function Evidence() {
  return (
    <section id="evidence" className="lp-section lp-evidence" aria-labelledby="evidence-h">
      <div className="lp-wrap">
        <h2 id="evidence-h" className="lp-h2">What the research says is possible.</h2>
        <p className="lp-measure lp-lede">
          After a stroke, leaning the trunk to make up for a weaker arm is well documented
          (<a href="https://doi.org/10.1093/brain/123.5.940" target="_blank" rel="noreferrer">Cirstea &amp; Levin, 2000</a>).
          Wearable sensors have already been shown to catch it.
        </p>
        <ol className="lp-studies">
          {STUDIES.map((s) => (
            <li key={s.who}>
              <h3>{s.who}</h3>
              <p className="lp-figure"><span>{s.figure} <small>{s.of}</small></span> {s.measure}</p>
              <a className="lp-source" href={s.href} target="_blank" rel="noreferrer">
                <span className="lp-source-kind">{s.kind}<ArrowUpRight aria-hidden /></span>
                <span className="lp-source-title">{s.title}</span>
                <span className="lp-source-meta"><span>{s.venue}</span><bdi>{s.id}</bdi></span>
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            </li>
          ))}
        </ol>
        <div className="lp-ours">
          <div>
            <h3>Our own number</h3>
            <p>
              How often ReMotion agrees with a blind label from side-view video. Target: about 9 in 10, over about 60 reps
              from three or more testers.
            </p>
          </div>
          <p className="lp-ours-value">To be measured</p>
        </div>
        <p className="lp-honest">
          ReMotion is a student prototype, tested only on team members, never on patients. It is not a certified medical device.
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

/** GitHub's mark (lucide no longer ships brand icons), drawn in the text colour. */
function GitHubMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden className={className} fill="currentColor">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  )
}

/** The team, as on GitHub (AGENTS.md "Who owns what"). */
const TEAM = [
  { name: 'Vincent Jiang', github: 'vinyx1' },
  { name: 'Yousuf Hamoda', github: 'Yousuf-Hamoda' },
  { name: 'Preston Baichoo', github: 'prestonbaichoo3' },
]

/*
  The page's footer: what ReMotion is and for whom, the team with their GitHub profiles, the
  project's links, and the honest line about what it is not. The demo button lives in the nav
  and here as a plain link; the page doesn't end on a second, repeated call to action.
*/
function Close() {
  return (
    <footer className="lp-close">
      <div className="lp-wrap">
        <div className="lp-foot">
          <div className="lp-foot-about">
            <p className="lp-foot-mark">ReMotion</p>
            <p>A seated reach trainer that catches the trunk leaning in to help a weaker arm, and shows it to the therapist between appointments.</p>
            <p className="lp-foot-meta">ECE 198, University of Waterloo · Group 19 · Fall 2026<br />Built for the CCCARE challenge on at-home rehab.</p>
          </div>
          <nav aria-labelledby="foot-team" className="lp-foot-col">
            <h2 id="foot-team">Team</h2>
            <ul>
              {TEAM.map((m) => (
                <li key={m.github}>
                  <a href={`https://github.com/${m.github}`} target="_blank" rel="noreferrer">
                    <GitHubMark className="lp-foot-icon" />
                    <span className="lp-foot-person"><span>{m.name}</span><span className="lp-foot-handle">@{m.github}</span></span>
                    <span className="sr-only"> on GitHub (opens in a new tab)</span>
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <nav aria-labelledby="foot-project" className="lp-foot-col">
            <h2 id="foot-project">Project</h2>
            <ul>
              <li><a href="https://github.com/vinyx1/ReMotion" target="_blank" rel="noreferrer"><GitHubMark className="lp-foot-icon" /><span>Source on GitHub</span><span className="sr-only"> (opens in a new tab)</span></a></li>
              <li><a href="/dashboard"><span>Try the demo</span></a></li>
              <li><a href="#how"><span>How it works</span></a></li>
              <li><a href="#evidence"><span>Evidence</span></a></li>
              <li><a href="#hardware"><span>Hardware</span></a></li>
            </ul>
          </nav>
        </div>
        <p className="lp-foot-legal">A student prototype, tested only on team members. Not a medical device.</p>
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
    document.title = 'ReMotion: the reach, measured'
    document.documentElement.classList.add('lp-root')
    return () => document.documentElement.classList.remove('lp-root')
  }, [])
  return (
    <div className="lp">
      <a className="lp-skip" href="#main">Skip to content</a>
      <header className={`lp-nav ${solidNav ? 'is-solid' : ''}`}>
        <a href="/" className="lp-mark">ReMotion</a>
        <nav aria-label="Sections">
          <a href="#how">How it works</a>
          <a href="#evidence">Evidence</a>
          <a href="#hardware">Hardware</a>
          <a className="lp-nav-btn" href="/dashboard">Demo</a>
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
