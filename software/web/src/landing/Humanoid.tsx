/*
  The seated man on the landing page: a low-poly, faceted figure with adult male
  proportions (about 1.75 m), built in code from lofted parts.

  Each part is a loft: a stack of 8-10 sided rings, each with its own width (side
  to side), depth (front to back) and forward offset, so a ring stack can carry
  a jaw, a chest, a calf. Flat shading turns the rings into facets.

  The head and hair are separate (statueHead.ts): faceted, faceless, built from landmarks.

  Parts hang on a simple skeleton, posed every frame:
    - trunk in three pieces (pelvis, abdomen, ribcage) so the lean curves the spine;
      the ribcage, where the chest sensor sits, carries the full measured angle
    - seated legs, feet flat on the floor
    - reaching arm by two-bone IK to the hand target; free arm resting on the lap

  Local frame of every part: +y along the bone, +x its front, +z its side.
*/
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { BufferGeometry, Color, Float32BufferAttribute, type Group, IcosahedronGeometry, Matrix4, type Mesh, type MeshStandardMaterial, Vector3 } from 'three'
import type { V3 } from '../lib/figure'
import { chamferBox, PROP_COLORS } from './Props'
import { statueHead } from './statueHead'

/** What the scene asks of the body each frame. */
export interface BodyInput {
  /** trunk lean, radians, forward */
  lean: number
  /** where the reaching wrist should be, scene metres */
  wrist: V3
  /** 0..1: how strongly the torso shows the alarm (the lean is flagged) */
  alarm: number
}

const COLORS = { body: '#cdc3b6', alarmGlow: '#b4532f', hair: '#cdc3b6', strap: '#2f3e37', device: PROP_COLORS.device, led: '#7fb59a' }

// ---------- proportions (metres) ----------
const HIP: V3 = [0.03, 0.5, 0]         // centre between the hip joints
const HIP_HALF = 0.09                  // hip joint to centre, sideways
const SHOULDER_HALF = 0.185
const UPPER_ARM = 0.3, FOREARM = 0.265
const THIGH = 0.43
const LAP_WRIST: V3 = [0.3, 0.6, -0.11]

/** One ring of a loft: t along the part (0..1 of its length), half-width (side), half-depth (front-back), forward offset. */
type Ring = [t: number, w: number, d: number, f?: number]

function loft(length: number, rings: Ring[], sides = 8): BufferGeometry {
  const pos: number[] = []
  const ring = ([t, w, d, f = 0]: Ring) =>
    Array.from({ length: sides }, (_, k) => {
      const a = (k / sides) * Math.PI * 2 + Math.PI / sides
      return [f + d * Math.cos(a), t * length, w * Math.sin(a)]
    })
  const rs = rings.map(ring)
  const tri = (a: number[], b: number[], c: number[]) => pos.push(...a, ...b, ...c)
  for (let i = 0; i < rs.length - 1; i++) {
    for (let k = 0; k < sides; k++) {
      const a = rs[i][k], b = rs[i][(k + 1) % sides], c = rs[i + 1][(k + 1) % sides], e = rs[i + 1][k]
      tri(a, e, c); tri(a, c, b)
    }
  }
  // caps
  const first = rings[0], last = rings[rings.length - 1]
  const c0 = [first[3] ?? 0, first[0] * length, 0], c1 = [last[3] ?? 0, last[0] * length, 0]
  for (let k = 0; k < sides; k++) {
    tri(c0, rs[0][(k + 1) % sides], rs[0][k])
    tri(c1, rs[rs.length - 1][k], rs[rs.length - 1][(k + 1) % sides])
  }
  const g = new BufferGeometry()
  g.setAttribute('position', new Float32BufferAttribute(pos, 3))
  g.computeVertexNormals()
  return g
}

/** Finger proportions, index to little finger: length, half-width. */
const FINGERS: [len: number, w: number][] = [[0.075, 0.0095], [0.082, 0.0098], [0.077, 0.0093], [0.062, 0.0082]]
const KNUCKLE_SPREAD = [-0.029, -0.0095, 0.0095, 0.027] // across the palm, index first, toward the thumb negative
const PALM = 0.1

// ---------- the parts ----------
const PARTS = {
  // trunk: lengths match the joint chain below
  pelvis: () => loft(0.22, [[0, 0.15, 0.1, -0.01], [0.3, 0.172, 0.118, 0], [0.65, 0.162, 0.108, 0.005], [1, 0.145, 0.097, 0.005]]),
  abdomen: () => loft(0.13, [[-0.05, 0.145, 0.097, 0.005], [0.5, 0.142, 0.1, 0.012], [1.05, 0.152, 0.106, 0.012]]),
  ribcage: () => loft(0.3, [
    [0, 0.152, 0.106, 0.012], [0.3, 0.166, 0.118, 0.026], [0.55, 0.176, 0.122, 0.028],
    [0.78, 0.192, 0.11, 0.012], [0.92, 0.17, 0.09, 0], [1, 0.1, 0.07, -0.01],
  ]),
  neck: () => loft(0.1, [[0, 0.062, 0.062, 0], [0.5, 0.054, 0.056, 0.008], [1, 0.052, 0.054, 0.01]]),
  head: () => statueHead().skin,
  hair: () => statueHead().hair,
  // a ball at the elbows and knees, so a bent limb reads as a joint, not a break
  joint: () => new IcosahedronGeometry(1, 1),
  upperArm: () => loft(UPPER_ARM, [[-0.12, 0.04, 0.045], [0.06, 0.06, 0.058], [0.45, 0.049, 0.054, 0.004], [1, 0.04, 0.042]]),
  forearm: () => loft(FOREARM, [[-0.04, 0.041, 0.041], [0.25, 0.047, 0.044], [0.7, 0.036, 0.032], [1, 0.032, 0.022]]),
  palm: () => loft(PALM, [[0, 0.03, 0.018], [0.5, 0.043, 0.017], [1, 0.045, 0.012]], 6),
  thumbA: () => loft(0.045, [[0, 0.015, 0.014], [1, 0.012, 0.011]], 5),
  thumbB: () => loft(0.035, [[0, 0.011, 0.01], [1, 0.008, 0.007]], 5),
  ...Object.fromEntries(FINGERS.flatMap(([len, w], i) => [
    [`finger${i}a`, () => loft(len * 0.55, [[0, w, w * 0.88], [1, w * 0.92, w * 0.82]], 5)],
    [`finger${i}b`, () => loft(len * 0.45, [[0, w * 0.9, w * 0.8], [0.7, w * 0.8, w * 0.72], [1, w * 0.5, w * 0.45]], 5)],
  ])),
  thigh: () => loft(THIGH, [[-0.06, 0.08, 0.08], [0.25, 0.082, 0.086, 0.004], [0.75, 0.064, 0.066], [1, 0.054, 0.056]]),
  shin: () => loft(0.42, [[-0.04, 0.052, 0.056], [0.25, 0.056, 0.062, -0.012], [0.65, 0.042, 0.044, -0.004], [1, 0.033, 0.035]]),
  foot: () => loft(0.25, [[0, 0.03, 0.04, 0.002], [0.12, 0.036, 0.046], [0.4, 0.04, 0.04, -0.002], [0.75, 0.046, 0.024, -0.018], [1, 0.034, 0.012, -0.03]], 6),
} as Record<string, () => BufferGeometry>

// The meshes in the scene: which part shape each one uses.
const HAND_PARTS = (side: 'R' | 'L'): [string, string][] => [
  [`palm${side}`, 'palm'], [`thumb${side}a`, 'thumbA'], [`thumb${side}b`, 'thumbB'],
  ...FINGERS.flatMap((_, i) => [[`finger${side}${i}a`, `finger${i}a`], [`finger${side}${i}b`, `finger${i}b`]] as [string, string][]),
]
/** The trunk: what the chest sensor measures, highlighted while the lean is flagged. */
const TORSO = ['pelvis', 'abdomen', 'ribcage']
const BODY_COLOR = new Color('#cdc3b6'), ALARM_COLOR = new Color('#c7724f')

const MESHES: [id: string, part: string][] = [
  ['pelvis', 'pelvis'], ['abdomen', 'abdomen'], ['ribcage', 'ribcage'], ['neck', 'neck'], ['head', 'head'],
  ['elbowR', 'joint'], ['elbowL', 'joint'], ['kneeR', 'joint'], ['kneeL', 'joint'],
  ['upperR', 'upperArm'], ['foreR', 'forearm'], ...HAND_PARTS('R'),
  ['upperL', 'upperArm'], ['foreL', 'forearm'], ...HAND_PARTS('L'),
  ['thighR', 'thigh'], ['shinR', 'shin'], ['footR', 'foot'],
  ['thighL', 'thigh'], ['shinL', 'shin'], ['footL', 'foot'],
]

// ---------- posing helpers ----------
const m4 = new Matrix4()
const vx = new Vector3(), vy = new Vector3(), vz = new Vector3()

/** Place an object at `at`, its +y along `dir`, its +x as close to `front` as possible. */
function orient(o: Mesh | Group | null, at: Vector3, dir: Vector3, front: Vector3) {
  if (!o) return
  vy.copy(dir).normalize()
  vx.copy(front).addScaledVector(vy, -front.dot(vy))
  if (vx.lengthSq() < 1e-6) vx.set(0, 1, 0).addScaledVector(vy, -vy.y)
  vx.normalize()
  vz.crossVectors(vx, vy)
  o.position.copy(at)
  o.quaternion.setFromRotationMatrix(m4.makeBasis(vx, vy, vz))
}

const V = (x = 0, y = 0, z = 0) => new Vector3(x, y, z)
const fromAngle = (a: number) => V(Math.sin(a), Math.cos(a), 0) // "up", tipped forward by a
const frontOf = (a: number) => V(Math.cos(a), -Math.sin(a), 0)

/** Two-bone IK: elbow position for shoulder s reaching wrist t, bending toward hint. Returns [elbow, wrist]. */
function solveArm(s: Vector3, t: Vector3, hint: Vector3): [Vector3, Vector3] {
  const to = t.clone().sub(s)
  const d = Math.min(to.length(), UPPER_ARM + FOREARM - 1e-3)
  const u = to.normalize()
  const along = (UPPER_ARM ** 2 - FOREARM ** 2 + d * d) / (2 * d)
  const out = Math.sqrt(Math.max(UPPER_ARM ** 2 - along * along, 0))
  const bend = hint.clone().addScaledVector(u, -hint.dot(u)).normalize()
  return [s.clone().addScaledVector(u, along).addScaledVector(bend, out), s.clone().addScaledVector(u, d)]
}

/** Palm along `dir` from the wrist, back of the hand up, fingers curling toward the surface. */
function placeHand(m: Record<string, Mesh | null>, side: 'R' | 'L', wrist: Vector3, dir: Vector3) {
  const across = V().crossVectors(dir, V(0, 1, 0)).normalize()   // +z for a hand pointing forward
  const back = V().crossVectors(across, dir).normalize()          // back of the hand
  const toThumb = across.clone().multiplyScalar(side === 'R' ? -1 : 1)
  const bent = (angle: number, spread = 0) =>
    dir.clone().multiplyScalar(Math.cos(angle)).addScaledVector(back, -Math.sin(angle)).addScaledVector(toThumb, -spread).normalize()
  orient(m[`palm${side}`], wrist, dir, back)
  const knuckles = wrist.clone().addScaledVector(dir, PALM - 0.004)
  FINGERS.forEach(([len], i) => {
    const base = knuckles.clone().addScaledVector(toThumb, -KNUCKLE_SPREAD[i]).addScaledVector(back, 0.002)
    const d1 = bent(0.3 + i * 0.04, KNUCKLE_SPREAD[i] * 1.2)
    orient(m[`finger${side}${i}a`], base, d1, back)
    orient(m[`finger${side}${i}b`], base.clone().addScaledVector(d1, len * 0.55), bent(0.8 + i * 0.05, KNUCKLE_SPREAD[i] * 1.2), back)
  })
  const tBase = wrist.clone().addScaledVector(dir, 0.022).addScaledVector(toThumb, 0.028).addScaledVector(back, -0.008)
  const t1 = dir.clone().multiplyScalar(0.62).addScaledVector(toThumb, 0.62).addScaledVector(back, -0.35).normalize()
  orient(m[`thumb${side}a`], tBase, t1, back)
  orient(m[`thumb${side}b`], tBase.clone().addScaledVector(t1, 0.045), dir.clone().multiplyScalar(0.9).addScaledVector(toThumb, 0.2).addScaledVector(back, -0.35).normalize(), back)
}

export function Humanoid({ body }: { body: React.MutableRefObject<BodyInput> }) {
  const geos = useMemo(() => Object.fromEntries(Object.entries(PARTS).map(([k, f]) => [k, f()])) as Record<string, BufferGeometry>, [])
  const mesh = useRef<Record<string, Mesh | null>>({})
  const torsoMats = useRef<MeshStandardMaterial[]>([])
  const chest = useRef<Group>(null)
  const wristRig = useRef<Group>(null)
  const devices = useMemo(() => ({
    chestBox: chamferBox(0.026, 0.064, 0.058, 0.006),
    wristBox: chamferBox(0.016, 0.044, 0.034, 0.005),
  }), [])

  useFrame(() => {
    const m = mesh.current
    const a = body.current.lean

    // Highlight the trunk while the lean is flagged: it warms to terracotta and glows a little.
    const al = body.current.alarm
    for (const mat of torsoMats.current) {
      mat.color.copy(BODY_COLOR).lerp(ALARM_COLOR, al)
      mat.emissiveIntensity = 0.28 * al
    }

    // Trunk: pelvis tilts a little, the abdomen more, the ribcage the full measured angle.
    const hip = V(...HIP)
    const aP = a * 0.3, aA = a * 0.65
    const pelvisBase = hip.clone().addScaledVector(fromAngle(aP), -0.08)
    const waist = pelvisBase.clone().addScaledVector(fromAngle(aP), 0.22)
    const chestBase = waist.clone().addScaledVector(fromAngle(aA), 0.13)
    const neckBase = chestBase.clone().addScaledVector(fromAngle(a), 0.3)
    orient(m.pelvis, pelvisBase, fromAngle(aP), frontOf(aP))
    orient(m.abdomen, waist, fromAngle(aA), frontOf(aA))
    orient(m.ribcage, chestBase, fromAngle(a), frontOf(a))

    // Neck and head: the head stays a little more level than the trunk, as people's do.
    const aH = a * 0.75
    const neckAt = neckBase.clone().addScaledVector(fromAngle(a), -0.03)
    orient(m.neck, neckAt, fromAngle(a * 0.9), frontOf(a * 0.9))
    const headAt = neckAt.clone().addScaledVector(fromAngle(a * 0.9), 0.04)
    const up = fromAngle(aH), fwd = frontOf(aH)
    orient(m.head, headAt, up, fwd)
    orient(m.hair, headAt, up, fwd)

    // Arms.
    const shoulderLine = chestBase.clone().addScaledVector(fromAngle(a), 0.255)
    const sR = shoulderLine.clone().add(V(0, 0, SHOULDER_HALF))
    const sL = shoulderLine.clone().add(V(0, 0, -SHOULDER_HALF))
    const arm = (side: 'R' | 'L', s: Vector3, target: V3, hint: Vector3) => {
      const [elbow, wrist] = solveArm(s, V(...target), hint)
      const foreDir = wrist.clone().sub(elbow)
      orient(m[`upper${side}`], s, elbow.clone().sub(s), V(1, 0, 0))
      orient(m[`fore${side}`], elbow, foreDir, V(0, 1, 0))
      const ball = m[`elbow${side}`]
      if (ball) { ball.position.copy(elbow); ball.scale.setScalar(0.041) }
      // The wrist flexes: the hand lies level whatever angle the forearm comes in at,
      // tipped a little toward the surface.
      // The reaching hand points straight down the mat at its button; the resting one follows its forearm.
      const level = side === 'R' ? V(1, 0, 0) : V(foreDir.x, 0, foreDir.z).normalize()
      placeHand(m, side, wrist, level.add(V(0, -0.22, 0)).normalize())
      return { elbow, foreDir: foreDir.normalize() }
    }
    const right = arm('R', sR, body.current.wrist, V(-0.2, -1, 0.7))
    arm('L', sL, LAP_WRIST, V(-0.2, -1, -0.8))

    // Seated legs.
    for (const [side, z] of [['R', HIP_HALF], ['L', -HIP_HALF]] as const) {
      const h = hip.clone().add(V(0, 0, z))
      const knee = h.clone().add(V(THIGH, 0.015, z * 0.12))
      const ankle = V(knee.x + 0.03, 0.09, knee.z)
      orient(m[`thigh${side}`], h, knee.clone().sub(h), V(0, 1, 0))
      orient(m[`shin${side}`], knee, ankle.clone().sub(knee), V(1, 0, 0))
      const kneeBall = m[`knee${side}`]
      if (kneeBall) { kneeBall.position.copy(knee); kneeBall.scale.setScalar(0.056) }
      orient(m[`foot${side}`], V(ankle.x - 0.06, 0.045, ankle.z), V(1, 0, 0), V(0, 1, 0))
    }

    // Chest strap on the ribcage; wrist brace near the end of the reaching forearm.
    orient(chest.current, chestBase.clone().addScaledVector(fromAngle(a), 0.1), fromAngle(a), frontOf(a))
    orient(wristRig.current, right.elbow.clone().addScaledVector(right.foreDir, FOREARM * 0.8), right.foreDir, V(0, 1, 0))

  })

  return (
    <group>
      {MESHES.map(([id, part]) => (
        <mesh key={id} ref={(o) => { mesh.current[id] = o }} castShadow geometry={geos[part]}>
          <meshStandardMaterial
            ref={TORSO.includes(id) ? (mat) => { if (mat && !torsoMats.current.includes(mat)) torsoMats.current.push(mat) } : undefined}
            color={COLORS.body} emissive={COLORS.alarmGlow} emissiveIntensity={0} roughness={0.78} flatShading
          />
        </mesh>
      ))}
      <mesh ref={(o) => { mesh.current.hair = o }} castShadow geometry={geos.hair}>
        <meshStandardMaterial color={COLORS.hair} roughness={0.85} flatShading side={2} />
      </mesh>
      {/* chest strap: a band round the ribcage with the trunk sensor box on the sternum
          (local: +x front, +y up the trunk, +z the reaching side) */}
      <group ref={chest}>
        <mesh position={[0.027, 0, 0]} scale={[0.131, 1, 0.177]}>
          <cylinderGeometry args={[1, 1, 0.03, 20, 1, true]} />
          <meshStandardMaterial color={COLORS.strap} roughness={0.8} side={2} flatShading />
        </mesh>
        <mesh castShadow geometry={devices.chestBox} position={[0.171, 0.004, 0]}>
          <meshStandardMaterial color={COLORS.device} roughness={0.55} flatShading />
        </mesh>
        <mesh position={[0.185, 0.022, -0.016]}>
          <sphereGeometry args={[0.0045, 8, 6]} />
          <meshStandardMaterial color={COLORS.led} emissive={COLORS.led} emissiveIntensity={1.2} />
        </mesh>
      </group>
      {/* wrist brace with the arm sensor box on top (local: +x up, +y along the forearm) */}
      <group ref={wristRig}>
        <mesh scale={[0.036, 1, 0.041]}>
          <cylinderGeometry args={[1, 1, 0.05, 12, 1, true]} />
          <meshStandardMaterial color={COLORS.strap} roughness={0.8} side={2} flatShading />
        </mesh>
        <mesh castShadow geometry={devices.wristBox} position={[0.044, 0, 0]}>
          <meshStandardMaterial color={COLORS.device} roughness={0.55} flatShading />
        </mesh>
      </group>
    </group>
  )
}
