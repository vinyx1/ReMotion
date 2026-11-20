/*
  Everything in the room except the person, in the same faceted low-poly style:

    - a wooden table (chamfered top, apron, tapered legs) and a matching chair
    - the button mat: a dark rubber mat with chunky 30 mm arcade buttons (HOME + 3 targets)
    - the room: a corner of graph paper (floor and two walls), 10 cm squares, bolder every 50 cm
    - the table unit: a 3D-printed enclosure holding the Arduino, with the buzzer grille,
      the yellow START button and the red/green result LEDs on top

  The chest and wrist sensors ride the body, so they live in SkinnedHumanoid.tsx. Cables are left
  out on purpose: they cluttered the scene.
  Shapes are convex hulls of a few points (see `chamferBox`, `taperedLeg`), flat shaded.
*/
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef, useState } from 'react'
import {
  type BufferGeometry, CanvasTexture, CylinderGeometry, type MeshStandardMaterial,
  RepeatWrapping, SphereGeometry, SRGBColorSpace, Vector3,
} from 'three'
import { ConvexGeometry } from 'three/examples/jsm/geometries/ConvexGeometry.js'
import { HOME_X, SEAT_HEIGHT, SHOULDER_HALF_WIDTH, TABLE, TARGET_X, type V3 } from '../lib/figure'
import type { Target } from '../types'
import type { SceneInput } from './lean'

/** The page's paper colour: the grid's ground, and what the fog fades into. */
export const PAPER = '#eef0ec'

export const PROP_COLORS = {
  wood: '#c6a888',
  woodDark: '#ab8e6e',
  mat: '#34423b',
  device: '#24322c',
  deviceTop: '#2f3e37',
  bezel: '#1b2420',
  grille: '#121a16',
  home: '#f4f3ee',
  start: '#d9a93a',
  ledRed: '#b8473f',
  ledGreen: '#5c9a6c',
  GREEN: '#4c8a5f',
  BLUE: '#47709f',
  RED: '#a8343a',
}

/** Where the table unit sits on the table (the centre of its base). */
export const UNIT: V3 = [TABLE.far - 0.12, TABLE.height, -0.26]
/** Top of the buzzer grille, where the alarm pulse starts. */
export const BUZZER: V3 = [UNIT[0] + 0.035, UNIT[1] + 0.058, UNIT[2] - 0.012]

const MAT_Z = SHOULDER_HALF_WIDTH

// ---------- shapes ----------
const v = (x: number, y: number, z: number) => new Vector3(x, y, z)

/** A box with every edge cut at 45 degrees by `c`, centred on the origin. */
export function chamferBox(w: number, h: number, d: number, c: number): BufferGeometry {
  const pts: Vector3[] = []
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    pts.push(v(sx * (w / 2 - c), sy * h / 2, sz * (d / 2 - c)))
    pts.push(v(sx * w / 2, sy * (h / 2 - c), sz * (d / 2 - c)))
    pts.push(v(sx * (w / 2 - c), sy * (h / 2 - c), sz * d / 2))
  }
  return new ConvexGeometry(pts)
}

/** A square leg from `bottom` to `top`, `wb` wide at the floor and `wt` at the top. */
function taperedLeg(bottom: V3, top: V3, wb: number, wt: number): BufferGeometry {
  const pts: Vector3[] = []
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    pts.push(v(bottom[0] + sx * wb / 2, bottom[1], bottom[2] + sz * wb / 2))
    pts.push(v(top[0] + sx * wt / 2, top[1], top[2] + sz * wt / 2))
  }
  return new ConvexGeometry(pts)
}

// ---------- furniture ----------
function Wood({ dark = false }: { dark?: boolean }) {
  return <meshStandardMaterial color={dark ? PROP_COLORS.woodDark : PROP_COLORS.wood} roughness={0.78} flatShading />
}

function Table() {
  const width = TABLE.far - TABLE.near
  const cx = TABLE.near + width / 2
  const g = useMemo(() => {
    const legTop = TABLE.height - 0.034
    const legs = [TABLE.near + 0.05, TABLE.far - 0.05].flatMap((x) => [-0.44, 0.44].map((z) => taperedLeg([x, 0, z], [x, legTop, z], 0.032, 0.046)))
    return { top: chamferBox(width, 0.034, 1.0, 0.01), legs, apronLong: chamferBox(width - 0.1, 0.07, 0.022, 0.005), apronShort: chamferBox(0.022, 0.07, 0.88 - 0.046, 0.005) }
  }, [width])
  return (
    <group>
      <mesh castShadow receiveShadow geometry={g.top} position={[cx, TABLE.height - 0.017, 0]}><Wood /></mesh>
      {g.legs.map((leg, i) => <mesh key={i} castShadow geometry={leg}><Wood dark /></mesh>)}
      {/* apron: the rails under the top that tie the legs together */}
      {[-0.44, 0.44].map((z) => <mesh key={z} castShadow geometry={g.apronLong} position={[cx, TABLE.height - 0.07, z]}><Wood dark /></mesh>)}
      <mesh castShadow geometry={g.apronShort} position={[TABLE.far - 0.05, TABLE.height - 0.07, 0]}><Wood dark /></mesh>
    </group>
  )
}

function Chair() {
  const g = useMemo(() => {
    const seatTop = SEAT_HEIGHT - 0.0375
    const front = [-0.19, 0.19].map((z) => taperedLeg([0.17, 0, z], [0.17, seatTop - 0.035, z], 0.03, 0.038))
    // the back legs run on up to carry the backrest, leaning back a little
    const back = [-0.19, 0.19].map((z) => taperedLeg([-0.2, 0, z], [-0.25, 0.9, z], 0.032, 0.03))
    return { seat: chamferBox(0.44, 0.035, 0.44, 0.01), legs: [...front, ...back], slat: chamferBox(0.022, 0.085, 0.4, 0.006) }
  }, [])
  return (
    <group>
      <mesh castShadow receiveShadow geometry={g.seat} position={[-0.02, SEAT_HEIGHT - 0.055, 0]}><Wood /></mesh>
      {g.legs.map((leg, i) => <mesh key={i} castShadow geometry={leg}><Wood dark /></mesh>)}
      {/* backrest slats, tilted with the back legs */}
      {[[0.66, -0.234], [0.82, -0.244]].map(([y, x]) => (
        <mesh key={y} castShadow geometry={g.slat} position={[x, y, 0]} rotation={[0, 0, 0.055]}><Wood /></mesh>
      ))}
    </group>
  )
}

// ---------- the button mat ----------
const BEZEL = new CylinderGeometry(0.034, 0.038, 0.014, 12)
const DOME = new SphereGeometry(0.027, 12, 5, 0, Math.PI * 2, 0, Math.PI / 2)

/** A 30 mm arcade button: a faceted bezel and domed cap, with a glow ring when lit. */
function ArcadeButton({ x, color, lit, blink, clock }: {
  x: number; color: string; lit: boolean; blink?: boolean; clock: React.MutableRefObject<number>
}) {
  const cap = useRef<MeshStandardMaterial>(null)
  const halo = useRef<MeshStandardMaterial>(null)
  useFrame(() => {
    const on = blink ? (Math.sin(clock.current * 7) > 0 ? 1 : 0.15) : lit ? 1 : 0
    if (cap.current) cap.current.emissiveIntensity = 0.05 + on * 0.9
    if (halo.current) halo.current.opacity = on * 0.7
  })
  return (
    <group position={[x, TABLE.height + 0.014, MAT_Z]}>
      <mesh castShadow geometry={BEZEL}>
        <meshStandardMaterial color={PROP_COLORS.bezel} roughness={0.55} flatShading />
      </mesh>
      <mesh geometry={DOME} position={[0, 0.006, 0]} scale={[1, 0.5, 1]}>
        <meshStandardMaterial ref={cap} color={color} emissive={color} emissiveIntensity={0.05} roughness={0.35} flatShading />
      </mesh>
      {/* the light spills onto the mat, so a lit button reads even under the hand */}
      <mesh position={[0, -0.0055, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.038, 0.068, 24]} />
        <meshStandardMaterial ref={halo} color={color} emissive={color} emissiveIntensity={1} transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  )
}

function ButtonMat({ input, clock }: { input: React.MutableRefObject<SceneInput>; clock: React.MutableRefObject<number> }) {
  const target = useRef<Target | null>(input.current.target)
  const home = useRef(input.current.homeLit)
  // Re-render only when the lit button changes, not every frame.
  const [, setTick] = useState(0)
  useFrame(() => {
    if (input.current.target !== target.current || input.current.homeLit !== home.current) {
      target.current = input.current.target
      home.current = input.current.homeLit
      setTick((n) => n + 1)
    }
  })
  const length = TARGET_X.RED - HOME_X + 0.14
  const mat = useMemo(() => chamferBox(length, 0.008, 0.16, 0.004), [length])
  return (
    <group>
      <mesh receiveShadow geometry={mat} position={[(HOME_X + TARGET_X.RED) / 2, TABLE.height + 0.004, MAT_Z]}>
        <meshStandardMaterial color={PROP_COLORS.mat} roughness={0.95} flatShading />
      </mesh>
      <ArcadeButton x={HOME_X} color={PROP_COLORS.home} lit={false} blink={home.current} clock={clock} />
      {(Object.keys(TARGET_X) as Target[]).map((name) => (
        <ArcadeButton key={name} x={TARGET_X[name]} color={PROP_COLORS[name]} lit={name === target.current} clock={clock} />
      ))}
    </group>
  )
}

// ---------- the table unit ----------
function TableUnit() {
  const g = useMemo(() => ({
    body: chamferBox(0.17, 0.05, 0.12, 0.008),
    lid: chamferBox(0.15, 0.006, 0.1, 0.003),
  }), [])
  const [x, y, z] = UNIT
  const top = y + 0.05
  return (
    <group>
      <mesh castShadow geometry={g.body} position={[x, y + 0.025, z]}>
        <meshStandardMaterial color={PROP_COLORS.device} roughness={0.6} flatShading />
      </mesh>
      <mesh geometry={g.lid} position={[x, top + 0.001, z]}>
        <meshStandardMaterial color={PROP_COLORS.deviceTop} roughness={0.5} flatShading />
      </mesh>
      {/* buzzer grille */}
      <mesh position={[BUZZER[0], top + 0.004, BUZZER[2]]}>
        <cylinderGeometry args={[0.018, 0.019, 0.004, 12]} />
        <meshStandardMaterial color={PROP_COLORS.grille} roughness={0.7} flatShading />
      </mesh>
      {[-0.008, 0, 0.008].map((dz) => (
        <mesh key={dz} position={[BUZZER[0], top + 0.0065, BUZZER[2] + dz]}>
          <boxGeometry args={[0.024, 0.001, 0.0025]} />
          <meshStandardMaterial color="#3b4943" roughness={0.6} />
        </mesh>
      ))}
      {/* START (yellow arcade button) */}
      <mesh castShadow position={[x - 0.035, top + 0.007, z + 0.028]}>
        <cylinderGeometry args={[0.02, 0.022, 0.01, 10]} />
        <meshStandardMaterial color={PROP_COLORS.bezel} roughness={0.55} flatShading />
      </mesh>
      <mesh position={[x - 0.035, top + 0.011, z + 0.028]} scale={[1, 0.5, 1]}>
        <sphereGeometry args={[0.016, 10, 4, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={PROP_COLORS.start} roughness={0.4} flatShading />
      </mesh>
      {/* result LEDs: green = clean rep, red = compensated */}
      {[[PROP_COLORS.ledGreen, -0.012], [PROP_COLORS.ledRed, 0.006]].map(([color, dz]) => (
        <mesh key={color as string} position={[x - 0.07, top + 0.004, z + (dz as number) - 0.03]}>
          <sphereGeometry args={[0.0045, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color={color as string} emissive={color as string} emissiveIntensity={0.5} roughness={0.3} flatShading />
        </mesh>
      ))}
    </group>
  )
}

// ---------- the room: graph paper ----------
/** One 50 cm square of graph paper: a fine line every 10 cm, a bolder one at the edge. */
const gridTexture = (() => {
  if (typeof document === 'undefined') return null
  const px = 512, c = document.createElement('canvas')
  c.width = c.height = px
  const g = c.getContext('2d')!
  g.fillStyle = PAPER
  g.fillRect(0, 0, px, px)
  g.strokeStyle = '#d2dad4'
  g.lineWidth = 2
  for (let i = 1; i < 5; i++) {
    const p = (i * px) / 5
    g.beginPath(); g.moveTo(p, 0); g.lineTo(p, px); g.moveTo(0, p); g.lineTo(px, p); g.stroke()
  }
  g.strokeStyle = '#aebdb4'
  g.lineWidth = 4
  g.strokeRect(0, 0, px, px)
  const t = new CanvasTexture(c)
  t.wrapS = t.wrapT = RepeatWrapping
  t.anisotropy = 8
  t.colorSpace = SRGBColorSpace
  return t
})()

/** A gridded plane `w` by `h` metres; the grid stays 10 cm whatever its size. */
function GraphPaper({ w, h, position, rotation, lit = false }: { w: number; h: number; position: V3; rotation?: V3; lit?: boolean }) {
  const map = useMemo(() => {
    if (!gridTexture) return null
    const t = gridTexture.clone()
    t.needsUpdate = true
    t.repeat.set(w / 0.5, h / 0.5)
    return t
  }, [w, h])
  return (
    <mesh position={position} rotation={rotation}>
      <planeGeometry args={[w, h]} />
      {/* unlit: the paper stays paper-coloured, whatever the light */}
      {lit ? <meshLambertMaterial map={map} /> : <meshBasicMaterial map={map} />}
    </mesh>
  )
}

/** A graph-paper room round him: floor and walls. Fog fades it into the page. */
export function Room() {
  return (
    <group>
      <GraphPaper w={30} h={30} rotation={[-Math.PI / 2, 0, 0]} position={[13.9, 0, 0]} />
      {/* soft shadows on the floor, from the overhead light */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0.3, 0.001, 0]} receiveShadow>
        <planeGeometry args={[6, 4]} />
        <shadowMaterial color="#1f2d27" opacity={0.2} transparent />
      </mesh>
      {/* walls behind him and on both sides; each shows only from inside the room, so whichever
          one stands between the camera and him (as it orbits) disappears */}
      <GraphPaper w={30} h={8} rotation={[0, Math.PI / 2, 0]} position={[-1.1, 4, 0]} />
      <GraphPaper w={30} h={8} position={[13.9, 4, -1.3]} />
      <GraphPaper w={30} h={8} rotation={[0, Math.PI, 0]} position={[13.9, 4, 1.5]} />
    </group>
  )
}

// ---------- contact shadow ----------
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

export function Furniture({ input, clock }: { input: React.MutableRefObject<SceneInput>; clock: React.MutableRefObject<number> }) {
  return (
    <group>
      <Table />
      <ButtonMat input={input} clock={clock} />
      <TableUnit />
      <Chair />
      {/* where the thighs rest on the seat */}
      <mesh position={[0.06, SEAT_HEIGHT - 0.036, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[0.42, 0.4, 1]}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial map={contactTexture} transparent depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  )
}
