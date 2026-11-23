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
import type { SessionsFile, Target } from '../types'
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
          <a className="lp-btn" href="/dashboard">Try the demo <ArrowRight aria-hidden className="size-5" /></a>
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
              How often ReMotion agrees with a blind label from side-view video. Target: about 90% over about 60 reps
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

function Close() {
  return (
    <footer className="lp-close">
      <div className="lp-wrap">
        <h2 className="lp-close-h">See a whole session.</h2>
        <a className="lp-btn lp-btn-light" href="/dashboard">Try the demo <ArrowRight aria-hidden className="size-5" /></a>
        <div className="lp-credits">
          <p><strong>ReMotion</strong> · ECE 198, University of Waterloo · Group 19</p>
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
