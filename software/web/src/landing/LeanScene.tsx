/*
  The landing page's room: a low-poly man seated at the four-target mat, wearing
  the chest and wrist sensors, with the table unit and its buzzer beside the mat.
  The person is in SkinnedHumanoid.tsx, the furniture and devices in Props.tsx.

  The room is a corner of graph paper in 3D (Props.tsx), so the grid turns in
  perspective as the camera orbits; fog fades it into the page's paper colour.

  The parent says where the trunk should be and how far through the story the page is
  (which sets the camera's place on its orbit). This scene
  springs the displayed angle toward it, applies the firmware's lean rule (past
  the limit for at least 200 ms) and reports the measured angle and the flag.
*/
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Suspense, useMemo, useRef } from 'react'
import {
  Color, type DirectionalLight, type HemisphereLight, type Mesh,
  type MeshStandardMaterial, Vector3,
} from 'three'
import { HOME_X, pose, SHOULDER_HALF_WIDTH, TABLE, type V3 } from '../lib/figure'
import { type BodyInput, SkinnedHumanoid } from './SkinnedHumanoid'
import { BUZZER, Furniture, PAPER, Room } from './Props'
import { LIMIT_DEG, type SceneInput, SUSTAIN_MS } from './lean'
import type { Target } from '../types'

const TARGETS: Target[] = ['GREEN', 'BLUE', 'RED']

const C = {
  terra: '#b4532f',
  shadow: '#1f2d27',
}
const SKY = new Color('#f5f6f2'), SKY_WARM = new Color('#f7ddcf')
const GROUND = new Color('#9fb0a6'), GROUND_WARM = new Color('#c9a796')
const KEY = new Color('#ffffff'), KEY_WARM = new Color('#ffd8c3')


// The camera orbits the figure as the page scrolls. One keyframe per story step (hero,
// calibrate, clean reach, lean, data), in orbit terms around a look-at point:
// az = angle round from his front (+x) toward his reaching side (+z), el = height angle,
// dist = metres. The scroll position blends between neighbouring keyframes.
interface Orbit { az: number; el: number; dist: number; look: V3 }
const D = Math.PI / 180
const ORBIT: Orbit[] = [
  { az: 53 * D, el: 13 * D, dist: 3.85, look: [-0.3, 0.6, 0.05] },   // hero: three-quarter front
  { az: 28 * D, el: 7 * D, dist: 1.85, look: [-0.18, 0.95, 0.05] },  // calibrate: in close on the chest sensor
  { az: 78 * D, el: 24 * D, dist: 2.35, look: [0.05, 0.74, 0.12] },  // clean reach: over the mat, from his reaching side
  { az: 96 * D, el: 9 * D, dist: 3.7, look: [-0.42, 0.66, 0.05] },   // the lean: side on, where the angle reads
  { az: 66 * D, el: 17 * D, dist: 4.2, look: [-0.3, 0.6, 0.05] },    // data: pulled back
]
/** Narrower screens: further out, figure nearer the centre (or the top half on phones). */
const BANDS = {
  wide: { dist: 1, look: [0, 0, 0] as V3 },
  mid: { dist: 1.1, look: [0.22, 0, 0] as V3 },
  narrow: { dist: 1.5, look: [0.55, -0.18, 0] as V3 },
}

const smooth = (f: number) => f * f * (3 - 2 * f)
function orbitAt(t: number, band: keyof typeof BANDS, pos: Vector3, look: Vector3) {
  const i = Math.max(0, Math.min(ORBIT.length - 2, Math.floor(t)))
  const f = smooth(Math.max(0, Math.min(1, t - i)))
  const a = ORBIT[i], b = ORBIT[i + 1]
  const mix = (x: number, y: number) => x + (y - x) * f
  const az = mix(a.az, b.az), el = mix(a.el, b.el), dist = mix(a.dist, b.dist) * BANDS[band].dist
  look.set(...a.look).lerp(tmpC.set(...b.look), f).add(tmpC.set(...BANDS[band].look))
  pos.set(Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az)).multiplyScalar(dist).add(look)
}

const tmpA = new Vector3()
const tmpB = new Vector3()
const tmpC = new Vector3()

/** Follows the orbit for the current scroll position, eased so it glides rather than snaps. */
function CameraRig({ input, reducedMotion }: { input: React.MutableRefObject<SceneInput>; reducedMotion: boolean }) {
  const { camera, size } = useThree()
  const look = useRef(new Vector3(0.3, 0.6, 0))
  const first = useRef(true)
  useFrame((_, dt) => {
    const band = size.width < 760 ? 'narrow' : size.width < 1100 ? 'mid' : 'wide'
    orbitAt(input.current.camera, band, tmpA, tmpB)
    const k = reducedMotion || first.current ? 1 : 1 - Math.exp(-Math.min(dt, 0.05) * 4)
    first.current = false
    camera.position.lerp(tmpA, k)
    look.current.lerp(tmpB, k)
    camera.lookAt(look.current)
  })
  return null
}

function Figure({ input, onMeasure, reducedMotion, clock, lights }: {
  input: React.MutableRefObject<SceneInput>
  onMeasure: (deg: number, flagged: boolean) => void
  reducedMotion: boolean
  clock: React.MutableRefObject<number>
  lights: { hemi: React.RefObject<HemisphereLight | null>; key: React.RefObject<DirectionalLight | null> }
}) {
  const shown = useRef({
    deg: 0, vel: 0, reach: 0, overMs: 0, warm: 0,
    lastTarget: 'RED' as Target,
    pull: { GREEN: 0, BLUE: 0, RED: 1 } as Record<Target, number>,
  })
  const body = useRef<BodyInput>({ lean: 0, alarm: 0, wrist: [HOME_X - 0.15, TABLE.height + 0.11, SHOULDER_HALF_WIDTH] })
  const ring = useRef<Mesh>(null)
  const ringMat = useRef<MeshStandardMaterial>(null)
  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05)
    clock.current += dt
    const s = shown.current
    const want = input.current

    // A damped spring, so the trunk moves like a body, not a slider.
    if (reducedMotion) {
      s.deg = want.trunkDeg
      s.reach = want.reach
    } else {
      const k = 90, damp = 18
      s.vel += (k * (want.trunkDeg - s.deg) - damp * s.vel) * dt
      s.deg += s.vel * dt
      s.reach += (want.reach - s.reach) * Math.min(1, dt * 9)
    }
    const deg = Math.max(0, s.deg)

    // The firmware's rule: past the limit, held for 200 ms.
    s.overMs = deg > LIMIT_DEG ? s.overMs + dt * 1000 : 0
    const flagged = s.overMs >= SUSTAIN_MS
    onMeasure(deg, flagged)

    // The room's light warms while flagged.
    s.warm += ((flagged ? 0.45 : 0) - s.warm) * (reducedMotion ? 1 : Math.min(1, dt * 3.5))
    if (lights.hemi.current) {
      lights.hemi.current.color.copy(SKY).lerp(SKY_WARM, s.warm)
      lights.hemi.current.groundColor.copy(GROUND).lerp(GROUND_WARM, s.warm)
    }
    lights.key.current?.color.copy(KEY).lerp(KEY_WARM, s.warm)

    // Which target the hand heads for. The page swaps the lit target the instant its own reach
    // hits HOME, but the shown reach eases and is still a little way out then, so taking the new
    // target straight away teleported the hand sideways between the clean reach and the lean.
    // Instead each target's pull eases in and out, and the hand is blended between them.
    const goal = want.target ?? s.lastTarget
    s.lastTarget = goal
    const kt = reducedMotion ? 1 : Math.min(1, dt * 7)
    let sum = 0
    for (const g of TARGETS) {
      s.pull[g] += ((g === goal ? 1 : 0) - s.pull[g]) * kt
      sum += s.pull[g]
    }
    const p = pose(deg, s.reach, 1, goal)
    p.hand = [0, 0, 0]
    for (const g of TARGETS) {
      if (s.pull[g] < 1e-3) continue
      const h = pose(deg, s.reach, 1, g).hand
      for (let j = 0; j < 3; j++) p.hand[j] += (h[j] * s.pull[g]) / sum
    }
    body.current.lean = (deg * Math.PI) / 180
    // the torso warms while the lean is flagged
    body.current.alarm += ((flagged ? 1 : 0) - body.current.alarm) * (reducedMotion ? 1 : Math.min(1, dt * 5))
    // with the hand level and fingers curled, the fingertip sits 15 cm ahead of and 9 cm below the wrist
    body.current.wrist = [p.hand[0] - 0.15, p.hand[1] + 0.09, p.hand[2]]

    // The buzzer pulse leaves the table unit while flagged.
    if (ring.current && ringMat.current) {
      if (flagged) {
        const phase = reducedMotion ? 0.4 : (clock.current * 2.1) % 1
        const sc = 1 + phase * 3.2
        ring.current.scale.set(sc, sc, sc)
        ringMat.current.opacity = reducedMotion ? 0.85 : 0.95 * (1 - phase)
        ring.current.visible = true
      } else {
        ring.current.visible = false
      }
    }
  })

  return (
    <group>
      <Suspense fallback={null}>
        <SkinnedHumanoid body={body} />
      </Suspense>
      {/* buzzer pulse from the table unit */}
      <mesh ref={ring} visible={false} position={[BUZZER[0], BUZZER[1] + 0.008, BUZZER[2]]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.03, 0.038, 56]} />
        <meshStandardMaterial ref={ringMat} color={C.terra} emissive={C.terra} emissiveIntensity={0.9} transparent opacity={0.9} depthWrite={false} side={2} />
      </mesh>
    </group>
  )
}

// The part of the room you can drag on the first screen: the seated figure and the mat in
// front of him, from the seat up (scene metres, room for his head at full lean).
const HIT_MIN = new Vector3(-0.3, 0.5, -0.26)
const HIT_MAX = new Vector3(0.62, 1.3, 0.34)
const HIT_PAD = 16 // px around the projected box
const corner = new Vector3()

/** Keeps the page's drag area sized to the figure as it appears on screen, whatever the camera does. */
function HitArea({ el }: { el: React.RefObject<HTMLDivElement | null> }) {
  const { camera, size } = useThree()
  const last = useRef('')
  useFrame(() => {
    const div = el.current
    if (!div) return
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
    for (let i = 0; i < 8; i++) {
      corner.set(i & 1 ? HIT_MAX.x : HIT_MIN.x, i & 2 ? HIT_MAX.y : HIT_MIN.y, i & 4 ? HIT_MAX.z : HIT_MIN.z).project(camera)
      const x = (corner.x * 0.5 + 0.5) * size.width, y = (-corner.y * 0.5 + 0.5) * size.height
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y)
    }
    x0 = Math.max(0, x0 - HIT_PAD); y0 = Math.max(0, y0 - HIT_PAD)
    x1 = Math.min(size.width, x1 + HIT_PAD); y1 = Math.min(size.height, y1 + HIT_PAD)
    const box = `${x0.toFixed(0)},${y0.toFixed(0)},${(x1 - x0).toFixed(0)},${(y1 - y0).toFixed(0)}`
    if (box === last.current) return // only touch the DOM when it moves
    last.current = box
    div.style.left = `${x0}px`; div.style.top = `${y0}px`
    div.style.width = `${x1 - x0}px`; div.style.height = `${y1 - y0}px`
  })
  return null
}

export function LeanScene({ input, onMeasure, reducedMotion, hitArea }: {
  input: React.MutableRefObject<SceneInput>
  onMeasure: (deg: number, flagged: boolean) => void
  reducedMotion: boolean
  /** an element the page lets you drag on; the scene keeps it over the figure */
  hitArea?: React.RefObject<HTMLDivElement | null>
}) {
  const clock = useRef(0)
  const hemi = useRef<HemisphereLight>(null)
  const key = useRef<DirectionalLight>(null)
  const dpr = useMemo<[number, number]>(() => [1, 1.75], [])
  return (
    <Canvas flat shadows="soft" dpr={dpr} camera={{ fov: 30, near: 0.05, far: 40 }} gl={{ antialias: true, alpha: true }}>
      <CameraRig input={input} reducedMotion={reducedMotion} />
      {hitArea && <HitArea el={hitArea} />}
      <hemisphereLight ref={hemi} args={['#f5f6f2', '#9fb0a6', 1.55]} />
      <directionalLight ref={key} position={[2.4, 3.6, 2.2]} intensity={2.1} />
      {/* a near-overhead light behind the scene casts the floor shadows forward, onto the floor */}
      <directionalLight
        position={[0.5, 4.6, -1.3]}
        intensity={0.15}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-radius={8}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
        shadow-camera-left={-2.4}
        shadow-camera-right={2.6}
        shadow-camera-top={2.4}
        shadow-camera-bottom={-2.4}
        shadow-camera-near={0.5}
        shadow-camera-far={9}
      />
      <directionalLight position={[-2.2, 1.4, 1.8]} intensity={0.35} />
      {/* rim light from behind, so the figure's outline separates from the wall */}
      <directionalLight position={[-2.5, 2.4, -2.8]} intensity={1.1} color="#e8f0ff" />
      <fog attach="fog" args={[PAPER, 5.5, 13]} />
      <Room />
      <Furniture input={input} clock={clock} />
      <Figure input={input} onMeasure={onMeasure} reducedMotion={reducedMotion} clock={clock} lights={{ hemi, key }} />
    </Canvas>
  )
}
