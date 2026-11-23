/*
  The rep replay as a hologram: the landing page's rigged 3D man (SkinnedHumanoid,
  look 'holo'), see-through with his wireframe facets glowing, on a dark grid stage,
  driven by the logged samples.

  What is measured and what is drawn (the caption under the replay says the same):
    MEASURED  the trunk tilt, sample by sample (100 a second), wobble included
    MEASURED  how fast the wrist was rotating: it drives the hand's tremble here
    DRAWN     the hand's path, HOME to target, timed by the button presses
    DRAWN     for the sideways reach, which way the trunk leans (towards the reaching
              side; the sensor measures how far it tilts, not which way)
    DRAWN     the direction of the tremble (the sensor gives a speed, not a direction)

  A faint ghost marks the rep's peak lean: it appears once he passes the peak, stays
  behind as he straightens up, then fades out a moment later. A short trail follows the
  hand. Everything turns terracotta while the trunk is past the limit.
*/
import { Edges, Grid, OrbitControls } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { Suspense, useMemo, useRef } from 'react'
import { HOME, HOME_X, pose, progress, SEAT_HEIGHT, SHOULDER_HALF_WIDTH, TABLE, TARGET_X, targetAt, TURN_WRIST, type V3 } from '../lib/figure'
import { sampleAt } from '../lib/utils'
import { type BodyInput, SkinnedHumanoid } from '../landing/SkinnedHumanoid'
import type { Target, Trace } from '../types'

const HOLO = '#9cc9e6'          // light lake: the hologram at rest
const STAGE = '#14201b'         // forest-deep
const TARGET_COLOR: Record<Target, string> = { GREEN: '#5fbf8f', BLUE: '#6f9fdc', RED: '#e0675d' }

/** A small deterministic wobble, so a replay looks the same every time it plays. */
const wobble = (x: number) => Math.sin(x) * 0.55 + Math.sin(2.31 * x + 1.7) * 0.3 + Math.sin(5.13 * x + 0.4) * 0.15

/** Tremble of the hand at time t: amplitude from the measured wrist rotation speed, direction drawn. */
function tremble(trace: Trace, t: number): V3 {
  const dps = sampleAt(trace.t, trace.wristDps, t)
  const a = Math.min(dps / 260, 1) * 0.016 // metres at full speed
  return [a * wobble(t * 41), a * wobble(t * 37 + 2.1), a * wobble(t * 43 + 4.2)]
}

/*
  The peak-lean ghost over time: hidden until the replay reaches the peak, held for
  GHOST_HOLD_S as he straightens up, then faded out over GHOST_FADE_S (eased, so it
  lingers then goes). Scrubbing back before the fade brings it back.
*/
const GHOST_HOLD_S = 0.35
const GHOST_FADE_S = 0.6
function ghostFade(t: number, peakT: number) {
  const since = t - peakT
  if (since < 0) return 0
  if (since <= GHOST_HOLD_S) return 1
  const k = Math.min(1, (since - GHOST_HOLD_S) / GHOST_FADE_S)
  return 1 - k * k * (3 - 2 * k) // smoothstep out
}

const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]

/*
  The table top sits where the 3D man's fingertips land on the mat: his wrist is aimed
  just above the mat height in lib/figure, and the hand tips down from the wrist, so
  the drawn table is lowered by this much to meet the fingers.
*/
const TABLE_DROP = 0.03

/** The furniture and mat, drawn as faint wireframe so the body stays the subject. */
function Room({ target, targets = true, side = false }: { target: Target; targets?: boolean; side?: boolean }) {
  const width = TABLE.far - TABLE.near
  const line = '#4f6f5f'
  return (
    <group>
      <mesh position={[TABLE.near + width / 2, TABLE.height - TABLE_DROP - 0.01, 0]}>
        <boxGeometry args={[width, 0.02, 1.1]} />
        <meshBasicMaterial color={line} transparent opacity={0.08} depthWrite={false} />
        <Edges color={line} />
      </mesh>
      <mesh position={[-0.02, SEAT_HEIGHT - 0.06, 0]}>
        <boxGeometry args={[0.42, 0.035, 0.44]} />
        <meshBasicMaterial color={line} transparent opacity={0.08} depthWrite={false} />
        <Edges color={line} />
      </mesh>
      <mesh position={[-0.24, SEAT_HEIGHT + 0.22, 0]}>
        <boxGeometry args={[0.035, 0.52, 0.44]} />
        <meshBasicMaterial color={line} transparent opacity={0.08} depthWrite={false} />
        <Edges color={line} />
      </mesh>
      <mesh position={[HOME_X, TABLE.height - TABLE_DROP + 0.006, SHOULDER_HALF_WIDTH]}>
        <cylinderGeometry args={[0.026, 0.026, 0.012, 24]} />
        <meshBasicMaterial color="#e8ece6" />
      </mesh>
      {targets && (Object.keys(TARGET_X) as Target[]).map((name) => {
        const lit = name === target
        return (
          <mesh key={name} position={[targetAt(name, side)[0], TABLE.height - TABLE_DROP + 0.008, targetAt(name, side)[2]]}>
            <cylinderGeometry args={[lit ? 0.03 : 0.022, lit ? 0.03 : 0.022, 0.014, 24]} />
            <meshBasicMaterial color={TARGET_COLOR[name]} transparent opacity={lit ? 1 : 0.35} />
          </mesh>
        )
      })}
    </group>
  )
}

export function HoloReplay({ trace, t, target, threshold, peakDeg, motion = 'reach' }: {
  trace: Trace
  t: number
  target: Target
  threshold: number
  peakDeg: number
  /**
    'reach': the hand travels HOME to the lit target (forward reach). 'mouth': it rises
    from HOME to the figure's own mouth (hand to mouth), arriving at the logged time;
    the mat shows only HOME, and there is no hand trail (the path is the figure's own).
    'side': the sideways reach: the mat along the table edge, the hand out to the side,
    the trunk leaning towards the reaching side; seen from the front.
    'turn': forearm rotation: the elbow at the side, the forearm level, the hand turning palm
    down to palm up, arriving at the logged time; seen from in front and to the side.
  */
  motion?: 'reach' | 'mouth' | 'side' | 'turn'
}) {
  const turning = motion === 'turn'
  const toMouth = motion === 'mouth'
  const side = motion === 'side'
  const trunk = sampleAt(trace.t, trace.trunkDeg, t)
  const over = trunk > threshold

  const p = useMemo(() => pose(trunk, t, trace.reachEndS, target, side), [trunk, t, trace.reachEndS, target, side])
  const shake = tremble(trace, t)
  const hand = add(toMouth ? HOME : turning ? TURN_WRIST : p.hand, shake)

  // the hand's last 0.6 s, as a fading trail
  const trail = useMemo(() => {
    const out: { at: V3; age: number }[] = []
    if (toMouth || turning) return out
    for (let k = 1; k <= 18; k++) {
      const tk = t - k * 0.035
      if (tk < trace.t[0]) break
      const pk = pose(sampleAt(trace.t, trace.trunkDeg, tk), tk, trace.reachEndS, target, side)
      out.push({ at: add(pk.hand, tremble(trace, tk)), age: k / 18 })
    }
    return out
  }, [t, trace, target, toMouth, turning, side])

  // what the 3D man is asked to do this frame (read by SkinnedHumanoid every frame)
  const liveBody = useRef<BodyInput>({ lean: 0, wrist: hand, alarm: 0 })
  liveBody.current = {
    lean: (trunk * Math.PI) / 180, wrist: hand, alarm: over ? 1 : 0, mouth: toMouth ? progress(t, trace.reachEndS) : undefined,
    sideways: side ? progress(t, trace.reachEndS) : undefined,
    turn: turning ? progress(t, trace.reachEndS) : undefined,
  }
  const ghostPose = useMemo(() => pose(peakDeg, 0, trace.reachEndS, target, side), [peakDeg, trace.reachEndS, target, side])
  // when the logged trunk was at its highest: the ghost appears from there
  const peakT = useMemo(() => {
    let i = 0
    trace.trunkDeg.forEach((v, k) => { if (v > trace.trunkDeg[i]) i = k })
    return trace.t[i]
  }, [trace])
  const ghostBody = useRef<BodyInput>({ lean: 0, wrist: ghostPose.hand, alarm: 0 })
  ghostBody.current = {
    lean: (peakDeg * Math.PI) / 180, wrist: toMouth ? HOME : turning ? TURN_WRIST : ghostPose.hand, alarm: peakDeg > threshold ? 1 : 0, fade: ghostFade(t, peakT),
    mouth: toMouth ? progress(peakT, trace.reachEndS) : undefined,
    sideways: side ? 0 : undefined,
    turn: turning ? progress(peakT, trace.reachEndS) : undefined,
  }

  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ position: side ? [3.0, 1.15, 1.25] : turning ? [2.1, 1.25, 2.4] : [0.42, 1.0, 3.25], fov: 30 }}   // sideways reach: from the front, so the reach and the lean read
      onCreated={({ gl }) => gl.setClearColor(STAGE)}
      aria-label="Holographic replay of the reach: trunk tilt and wrist movement from the logged samples"
      role="img"
    >
      <Grid position={[0.3, 0, 0]} args={[4, 4]} cellSize={0.1} cellThickness={0.6} cellColor="#2b3d35"
        sectionSize={0.5} sectionThickness={1} sectionColor="#4f6f5f" fadeDistance={4.5} fadeStrength={1.2} infiniteGrid />
      {/* drag to turn the view around the figure; no zoom (the wheel keeps scrolling the page) and no panning, so he stays centred */}
      <OrbitControls target={side ? [0.2, 0.7, 0.18] : turning ? [0.22, 0.74, 0.12] : [0.32, 0.68, 0]} enablePan={false} enableZoom={false} enableDamping dampingFactor={0.12}
        minPolarAngle={0.25} maxPolarAngle={Math.PI / 2 - 0.05} rotateSpeed={0.7} />
      <Room target={target} targets={!toMouth && !turning} side={side} />

      <Suspense fallback={null}>
        {/* the peak lean, as a ghost that fades soon after he leans back */}
        <SkinnedHumanoid body={ghostBody} look="ghost" />
        {/* the measured trunk and the reaching hand */}
        <SkinnedHumanoid body={liveBody} look="holo" />
      </Suspense>
      {trail.map((d, i) => (
        <mesh key={i} position={d.at}>
          <sphereGeometry args={[0.007, 8, 8]} />
          <meshBasicMaterial color={HOLO} transparent opacity={0.55 * (1 - d.age)} depthWrite={false} />
        </mesh>
      ))}
    </Canvas>
  )
}
