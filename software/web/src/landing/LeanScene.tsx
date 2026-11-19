/*
  The landing page's room: a clay figure seated at the four-target mat, wearing
  the chest and wrist sensors, with the table unit and its buzzer beside the mat.

  The wall and floor are painted by the page (CSS), so they are exactly the
  design tokens; this canvas is transparent and draws only the objects, with
  soft shadows cast onto an invisible floor.

  The parent says where the trunk should be and which shot to frame. This scene
  springs the displayed angle toward it, applies the firmware's lean rule (past
  the limit for at least 200 ms) and reports the measured angle and the flag.
*/
import { RoundedBox } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useMemo, useRef, useState } from 'react'
import {
  CanvasTexture, Color, type DirectionalLight, type Group, type HemisphereLight, type Mesh,
  type MeshStandardMaterial, Quaternion, Vector3,
} from 'three'
import { HOME_X, pose, SEAT_HEIGHT, SHOULDER_HALF_WIDTH, TABLE, TARGET_X, type V3 } from '../lib/figure'
import type { Target } from '../types'
import { LIMIT_DEG, type SceneInput, type Shot, SUSTAIN_MS } from './lean'

const C = {
  clay: '#cfc6ba',
  clayDark: '#bcb1a4',
  strap: '#2f3e37',
  device: '#1f2d27',
  deviceLed: '#7fb59a',
  ceramic: '#d9d5cd',
  furniture: '#f3f3ef',
  frame: '#dcded8',
  terra: '#b4532f',
  home: '#fbfbf8',
  GREEN: '#4c8a5f',
  BLUE: '#47709f',
  RED: '#a8343a',
  shadow: '#1f2d27',
}
const SKY = new Color('#f5f6f2'), SKY_WARM = new Color('#f7ddcf')
const GROUND = new Color('#9fb0a6'), GROUND_WARM = new Color('#c9a796')
const KEY = new Color('#ffffff'), KEY_WARM = new Color('#ffd8c3')

const MAT_Z = SHOULDER_HALF_WIDTH
const UNIT: V3 = [TABLE.far - 0.12, TABLE.height, -0.26]

// Camera framings: [position, look-at]. Wide screens put the figure right of centre.
type Frame = [V3, V3]
const FRAMES: Record<'wide' | 'mid' | 'narrow', Record<Shot, Frame>> = {
  wide: {
    hero: [[1.95, 1.5, 3.05], [-0.3, 0.6, 0.05]],
    chest: [[1.0, 1.12, 1.45], [-0.18, 0.92, 0.05]],
    mat: [[1.7, 1.55, 1.75], [0.05, 0.74, 0.12]],
    wide: [[2.1, 1.6, 3.35], [-0.25, 0.62, 0.05]],
  },
  mid: {
    hero: [[2.1, 1.55, 3.4], [-0.08, 0.6, 0.05]],
    chest: [[1.35, 1.2, 1.95], [0.05, 0.9, 0.05]],
    mat: [[1.75, 1.6, 1.9], [0.22, 0.74, 0.12]],
    wide: [[2.25, 1.65, 3.7], [-0.05, 0.6, 0.05]],
  },
  narrow: {
    hero: [[2.6, 1.9, 5.4], [0.32, 0.42, 0]],
    chest: [[1.7, 1.5, 3.2], [0.18, 0.72, 0]],
    mat: [[2.1, 2.0, 3.3], [0.45, 0.6, 0.1]],
    wide: [[2.8, 2.0, 5.8], [0.32, 0.42, 0]],
  },
}

const UP = new Vector3(0, 1, 0)
const tmpA = new Vector3()
const tmpB = new Vector3()
const tmpQ = new Quaternion()

/** Point a unit capsule mesh from a to b. */
function placeLimb(mesh: Mesh | null, a: V3, b: V3) {
  if (!mesh) return
  tmpA.set(...a)
  tmpB.set(...b)
  const dir = tmpB.clone().sub(tmpA)
  const length = Math.max(dir.length(), 1e-4)
  mesh.position.copy(tmpA).add(tmpB).multiplyScalar(0.5)
  tmpQ.setFromUnitVectors(UP, dir.normalize())
  mesh.quaternion.copy(tmpQ)
  mesh.scale.set(1, length, 1)
}

function Limb({ radius, color, refFn }: { radius: number; color: string; refFn: (m: Mesh | null) => void }) {
  return (
    <mesh ref={refFn} castShadow>
      <capsuleGeometry args={[radius, 1, 10, 24]} />
      <meshStandardMaterial color={color} roughness={0.9} />
    </mesh>
  )
}

/** A 30 mm arcade button: a bezel and a domed cap, with a glow ring when lit. */
function ArcadeButton({ x, color, lit, blink, clock }: {
  x: number; color: string; lit: boolean; blink?: boolean; clock: React.MutableRefObject<number>
}) {
  const cap = useRef<MeshStandardMaterial>(null)
  const halo = useRef<MeshStandardMaterial>(null)
  useFrame(() => {
    const on = blink ? (Math.sin(clock.current * 7) > 0 ? 1 : 0.15) : lit ? 1 : 0
    if (cap.current) cap.current.emissiveIntensity = 0.06 + on * 0.9
    if (halo.current) halo.current.opacity = on * 0.7
  })
  const y = TABLE.height + 0.012
  return (
    <group position={[x, y, MAT_Z]}>
      <mesh>
        <cylinderGeometry args={[0.034, 0.036, 0.012, 40]} />
        <meshStandardMaterial color="#2a332f" roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.006, 0]} scale={[1, 0.42, 1]}>
        <sphereGeometry args={[0.027, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial ref={cap} color={color} emissive={color} emissiveIntensity={0.06} roughness={0.35} />
      </mesh>
      {/* the light spills onto the mat, so a lit button reads even under the hand */}
      <mesh position={[0, 0.0012, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.036, 0.066, 48]} />
        <meshStandardMaterial ref={halo} color={color} emissive={color} emissiveIntensity={1} transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  )
}

/** A soft dark patch where two surfaces touch (baked contact occlusion). */
const contactTexture = (() => {
  if (typeof document === 'undefined') return null
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')!
  const grad = g.createRadialGradient(64, 64, 4, 64, 64, 64)
  grad.addColorStop(0, 'rgba(31,45,39,0.55)')
  grad.addColorStop(1, 'rgba(31,45,39,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 128, 128)
  return new CanvasTexture(c)
})()

function ContactPatch({ position, scale }: { position: V3; scale: [number, number] }) {
  return (
    <mesh position={position} rotation={[-Math.PI / 2, 0, 0]} scale={[scale[0], scale[1], 1]}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial map={contactTexture} transparent depthWrite={false} toneMapped={false} />
    </mesh>
  )
}

function Furniture({ input, clock }: { input: React.MutableRefObject<SceneInput>; clock: React.MutableRefObject<number> }) {
  const width = TABLE.far - TABLE.near
  const target = useRef<Target | null>(input.current.target)
  const home = useRef(input.current.homeLit)
  // Re-render only when the lit button changes, not every frame.
  const [, force] = useForce()
  useFrame(() => {
    if (input.current.target !== target.current || input.current.homeLit !== home.current) {
      target.current = input.current.target
      home.current = input.current.homeLit
      force()
    }
  })
  return (
    <group>
      {/* table */}
      <RoundedBox castShadow args={[width, 0.045, 1.0]} radius={0.018} smoothness={4} position={[TABLE.near + width / 2, TABLE.height - 0.022, 0]}>
        <meshStandardMaterial color={C.furniture} roughness={0.85} />
      </RoundedBox>
      {[TABLE.near + 0.05, TABLE.far - 0.05].map((x) =>
        [-0.44, 0.44].map((z) => (
          <RoundedBox castShadow key={`${x}${z}`} args={[0.04, TABLE.height - 0.045, 0.04]} radius={0.016} smoothness={3} position={[x, (TABLE.height - 0.045) / 2, z]}>
            <meshStandardMaterial color={C.frame} roughness={0.8} />
          </RoundedBox>
        )),
      )}
      {/* the mat: matte ceramic bar holding HOME and the three targets */}
      <RoundedBox castShadow args={[TARGET_X.RED - HOME_X + 0.13, 0.012, 0.15]} radius={0.006} smoothness={3} position={[(HOME_X + TARGET_X.RED) / 2, TABLE.height + 0.006, MAT_Z]}>
        <meshStandardMaterial color={C.ceramic} roughness={0.95} />
      </RoundedBox>
      <ArcadeButton x={HOME_X} color={C.home} lit={false} blink={home.current} clock={clock} />
      {(Object.keys(TARGET_X) as Target[]).map((name) => (
        <ArcadeButton key={name} x={TARGET_X[name]} color={C[name]} lit={name === target.current} clock={clock} />
      ))}
      {/* the table unit: Arduino, level shifter and the buzzer */}
      <RoundedBox castShadow args={[0.17, 0.06, 0.12]} radius={0.014} smoothness={4} position={[UNIT[0], UNIT[1] + 0.03, UNIT[2]]}>
        <meshStandardMaterial color={C.device} roughness={0.55} />
      </RoundedBox>
      <mesh position={[UNIT[0] + 0.035, UNIT[1] + 0.064, UNIT[2]]}>
        <cylinderGeometry args={[0.018, 0.018, 0.008, 32]} />
        <meshStandardMaterial color="#39463f" roughness={0.4} />
      </mesh>
      <mesh position={[UNIT[0] - 0.045, UNIT[1] + 0.062, UNIT[2] + 0.04]}>
        <sphereGeometry args={[0.007, 12, 12]} />
        <meshStandardMaterial color={C.deviceLed} emissive={C.deviceLed} emissiveIntensity={1} />
      </mesh>
      {/* where the thighs rest on the seat */}
      <ContactPatch position={[0.06, SEAT_HEIGHT - 0.036, 0]} scale={[0.42, 0.4]} />
      {/* chair */}
      <RoundedBox castShadow args={[0.46, 0.045, 0.48]} radius={0.02} smoothness={4} position={[-0.02, SEAT_HEIGHT - 0.06, 0]}>
        <meshStandardMaterial color={C.furniture} roughness={0.85} />
      </RoundedBox>
      <RoundedBox castShadow args={[0.045, 0.56, 0.46]} radius={0.02} smoothness={4} position={[-0.25, SEAT_HEIGHT + 0.24, 0]}>
        <meshStandardMaterial color={C.furniture} roughness={0.85} />
      </RoundedBox>
      {[-0.2, 0.17].map((x) =>
        [-0.2, 0.2].map((z) => (
          <RoundedBox castShadow key={`c${x}${z}`} args={[0.034, SEAT_HEIGHT - 0.08, 0.034]} radius={0.014} smoothness={3} position={[x, (SEAT_HEIGHT - 0.08) / 2, z]}>
            <meshStandardMaterial color={C.frame} roughness={0.8} />
          </RoundedBox>
        )),
      )}
    </group>
  )
}

function useForce(): [number, () => void] {
  const [n, setN] = useState(0)
  return [n, () => setN((x) => x + 1)]
}

/** Eases the camera toward the framing for the current shot and screen width. */
function CameraRig({ input, reducedMotion }: { input: React.MutableRefObject<SceneInput>; reducedMotion: boolean }) {
  const { camera, size } = useThree()
  const look = useRef(new Vector3(0.3, 0.6, 0))
  const first = useRef(true)
  useFrame((_, dt) => {
    const band = size.width < 760 ? 'narrow' : size.width < 1100 ? 'mid' : 'wide'
    const [p, t] = FRAMES[band][input.current.shot]
    const k = reducedMotion || first.current ? 1 : 1 - Math.exp(-Math.min(dt, 0.05) * 2.6)
    first.current = false
    camera.position.lerp(tmpA.set(...p), k)
    look.current.lerp(tmpB.set(...t), k)
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
  const shown = useRef({ deg: 0, vel: 0, reach: 0, overMs: 0, warm: 0 })
  const parts = useRef<Record<string, Mesh | null>>({})
  const head = useRef<Mesh>(null)
  const hand = useRef<Mesh>(null)
  const chestRig = useRef<Group>(null)
  const wrist = useRef<Group>(null)
  const ring = useRef<Mesh>(null)
  const ringMat = useRef<MeshStandardMaterial>(null)
  const set = (k: string) => (m: Mesh | null) => { parts.current[k] = m }

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

    const p = pose(deg, s.reach, 1, want.target ?? 'RED')
    const a = (deg * Math.PI) / 180
    const up: V3 = [Math.sin(a), Math.cos(a), 0]
    const pelvisTop: V3 = [p.hip[0] + up[0] * 0.2, p.hip[1] + up[1] * 0.2, 0]
    placeLimb(parts.current.pelvis, p.hip, pelvisTop)
    placeLimb(parts.current.chest, pelvisTop, p.chest)
    placeLimb(parts.current.shoulders, p.otherShoulder, p.shoulder)
    placeLimb(parts.current.neck, p.chest, [p.chest[0] + up[0] * 0.13, p.chest[1] + up[1] * 0.13, 0])
    placeLimb(parts.current.upper, p.shoulder, p.elbow)
    // the free arm rests in the lap, as in a real session
    const lapElbow: V3 = [p.otherShoulder[0] + 0.06, p.otherShoulder[1] - 0.27, p.otherShoulder[2] - 0.02]
    placeLimb(parts.current.restUpper, p.otherShoulder, lapElbow)
    placeLimb(parts.current.restFore, lapElbow, [0.3, SEAT_HEIGHT + 0.1, -0.05])
    placeLimb(parts.current.fore, p.elbow, p.hand)
    head.current?.position.set(...p.head)

    // A mitten hand, continuing the forearm.
    const fx = p.hand[0] - p.elbow[0], fy = p.hand[1] - p.elbow[1], fz = p.hand[2] - p.elbow[2]
    const fl = Math.hypot(fx, fy, fz) || 1
    tmpQ.setFromUnitVectors(UP, tmpA.set(fx / fl, fy / fl, fz / fl))
    if (hand.current) {
      hand.current.position.set(p.hand[0] + (fx / fl) * 0.03, p.hand[1] + (fy / fl) * 0.03 - 0.008, p.hand[2] + (fz / fl) * 0.03)
      hand.current.quaternion.copy(tmpQ)
    }
    // Wrist brace near the hand.
    if (wrist.current) {
      wrist.current.position.set(p.elbow[0] + fx * 0.8, p.elbow[1] + fy * 0.8, p.elbow[2] + fz * 0.8)
      wrist.current.quaternion.copy(tmpQ)
    }
    // Chest strap and sensor pod ride the trunk; the pod sits on the sternum.
    if (chestRig.current) {
      const h = 0.8
      chestRig.current.position.set(p.hip[0] + (p.chest[0] - p.hip[0]) * h, p.hip[1] + (p.chest[1] - p.hip[1]) * h, 0)
      chestRig.current.rotation.set(0, 0, -a)
    }

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
      <Limb radius={0.098} color={C.clay} refFn={set('pelvis')} />
      <Limb radius={0.082} color={C.clay} refFn={set('chest')} />
      <Limb radius={0.05} color={C.clay} refFn={set('shoulders')} />
      <Limb radius={0.046} color={C.clay} refFn={set('neck')} />
      <Limb radius={0.041} color={C.clayDark} refFn={set('upper')} />
      <Limb radius={0.035} color={C.clayDark} refFn={set('fore')} />
      <Limb radius={0.041} color={C.clayDark} refFn={set('restUpper')} />
      <Limb radius={0.035} color={C.clayDark} refFn={set('restFore')} />
      <mesh ref={head} castShadow>
        <sphereGeometry args={[0.096, 48, 48]} />
        <meshStandardMaterial color={C.clay} roughness={0.88} />
      </mesh>
      <mesh ref={hand} castShadow scale={[1.15, 1.5, 0.7]}>
        <sphereGeometry args={[0.032, 28, 28]} />
        <meshStandardMaterial color={C.clayDark} roughness={0.88} />
      </mesh>
      {/* thighs and shins, so the figure reads as seated */}
      {[0.085, -0.085].map((z) => (
        <group key={z}>
          <mesh castShadow position={[0.17, SEAT_HEIGHT + 0.03, z]} rotation={[0, 0, Math.PI / 2 - 0.05]}>
            <capsuleGeometry args={[0.066, 0.3, 10, 24]} />
            <meshStandardMaterial color={C.clayDark} roughness={0.9} />
          </mesh>
          <mesh castShadow position={[0.37, SEAT_HEIGHT / 2 + 0.01, z]}>
            <capsuleGeometry args={[0.052, SEAT_HEIGHT - 0.12, 10, 24]} />
            <meshStandardMaterial color={C.clayDark} roughness={0.9} />
          </mesh>
        </group>
      ))}
      {/* chest strap with the trunk sensor on the sternum */}
      <group ref={chestRig}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.086, 0.011, 12, 48]} />
          <meshStandardMaterial color={C.strap} roughness={0.7} />
        </mesh>
        <RoundedBox castShadow args={[0.03, 0.075, 0.085]} radius={0.01} smoothness={3} position={[0.09, 0, 0.03]} rotation={[0, -0.35, 0]}>
          <meshStandardMaterial color={C.device} roughness={0.5} />
        </RoundedBox>
        <mesh position={[0.106, 0.02, 0.05]}>
          <sphereGeometry args={[0.007, 12, 12]} />
          <meshStandardMaterial color={C.deviceLed} emissive={C.deviceLed} emissiveIntensity={1.2} />
        </mesh>
      </group>
      {/* wrist brace with the arm sensor */}
      <group ref={wrist}>
        <mesh>
          <cylinderGeometry args={[0.042, 0.042, 0.06, 32, 1, true]} />
          <meshStandardMaterial color={C.strap} roughness={0.75} side={2} />
        </mesh>
        <RoundedBox castShadow args={[0.045, 0.05, 0.03]} radius={0.008} smoothness={3} position={[0, 0, 0.045]}>
          <meshStandardMaterial color={C.device} roughness={0.5} />
        </RoundedBox>
      </group>
      {/* buzzer pulse from the table unit */}
      <mesh ref={ring} visible={false} position={[UNIT[0] + 0.035, UNIT[1] + 0.07, UNIT[2]]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.03, 0.038, 56]} />
        <meshStandardMaterial ref={ringMat} color={C.terra} emissive={C.terra} emissiveIntensity={0.9} transparent opacity={0.9} depthWrite={false} side={2} />
      </mesh>
    </group>
  )
}

export function LeanScene({ input, onMeasure, reducedMotion }: {
  input: React.MutableRefObject<SceneInput>
  onMeasure: (deg: number, flagged: boolean) => void
  reducedMotion: boolean
}) {
  const clock = useRef(0)
  const hemi = useRef<HemisphereLight>(null)
  const key = useRef<DirectionalLight>(null)
  const dpr = useMemo<[number, number]>(() => [1, 1.75], [])
  return (
    <Canvas flat shadows="soft" dpr={dpr} camera={{ fov: 30, near: 0.05, far: 40 }} gl={{ antialias: true, alpha: true }}>
      <CameraRig input={input} reducedMotion={reducedMotion} />
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
      <Furniture input={input} clock={clock} />
      <Figure input={input} onMeasure={onMeasure} reducedMotion={reducedMotion} clock={clock} lights={{ hemi, key }} />
      {/* an invisible floor that only receives shadows, over the page's painted floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0.3, 0, 0]} receiveShadow>
        <planeGeometry args={[6, 4]} />
        <shadowMaterial color={C.shadow} opacity={0.22} transparent />
      </mesh>
    </Canvas>
  )
}
