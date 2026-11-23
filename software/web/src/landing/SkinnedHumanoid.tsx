/*
  The seated man on the landing page: a low-poly rigged male base mesh
  (public/models/man-base.glb, CC0, github.com/BoQsc/Godot-Male-Base-Mesh), flat shaded.

    - the model is turned to face +x (forward), stood up +y, his right side +z, and
      scaled to 1.76 m; his hips are placed on the chair
    - each frame every bone starts from its rest pose and is re-aimed, top down:
      trunk curving with the lean (pelvis a little, ribcage the full angle), head a
      little more level, thighs forward on the seat, shins down to the floor,
      the reaching arm by two-bone IK to the wrist target, the other hand on the lap
    - flat shading turns the decimated mesh into facets; the trunk warms while flagged

  Aiming a bone: its direction to its child (or its own +y for an end bone) is turned
  onto the wanted direction, and a second "front" vector fixes the twist about it.
*/
import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import {
  type Bone, Box3, BufferAttribute, Color, type Group, Matrix4, MeshBasicMaterial, MeshStandardMaterial, type Object3D,
  Quaternion, type SkinnedMesh, Vector3,
} from 'three'
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { chamferBox, PROP_COLORS } from './Props'
import type { V3 } from '../lib/figure'

/** What the scene asks of the body each frame. */
export interface BodyInput {
  /** trunk lean, radians, forward */
  lean: number
  /** where the reaching wrist should be, scene metres */
  wrist: V3
  /**
    0..1: how far the hand has travelled from `wrist` to the figure's own mouth (the
    hand-to-mouth exercise). The mouth is found on the posed head every frame, so the
    hand still meets it when the trunk leans. Leave unset for a reach.
  */
  mouth?: number
  /**
    The sideways reach: 0..1, how far the hand is towards the side target. Set, the trunk
    leans towards the reaching side (+z) instead of forward, and the arm reaches out sideways.
  */
  sideways?: number
  /**
    Forearm rotation: 0..1, palm down (0) to palm up (1). Set, the wrist stays at `wrist`, the
    elbow at the side, and the hand turns about the forearm.
  */
  turn?: number
  /** 0..1: how strongly the torso shows the alarm (the lean is flagged) */
  alarm: number
  /** 0..1, hologram looks only: how visible the figure is (default 1). The replay fades its ghost out with it. */
  fade?: number
}

/** Bone names for the rig. Sides are the character's own. */
interface Rig {
  url: string
  pelvis: string
  spine: string[]       // lowest first; the last carries the full lean (the chest sensor)
  neck: string
  head: string
  side: (s: 'R' | 'L') => { thigh: string; shin: string; upper: string; fore: string; hand: string }
  /** where the chest sensor sits, from the top spine bone (0) to the neck (1) */
  sensorAt: number
}

const RIG: Rig = {
  url: '/models/man-base.glb',
  // (three.js drops the dots from Blender's bone names: spine.001 -> spine001)
  pelvis: 'spine', spine: ['spine001', 'spine002', 'spine003'], neck: 'spine004', head: 'spine005',
  side: (s) => ({ thigh: `thigh${s}`, shin: `shin${s}`, upper: `upper_arm${s}`, fore: `forearm${s}`, hand: `hand${s}` }),
  sensorAt: 0.1,
}
useGLTF.preload(RIG.url)

const HEIGHT = 1.76
const HIP = new Vector3(0.03, 0.5, 0)
const LAP_WRIST = new Vector3(0.3, 0.6, -0.11)
const ANKLE_Y = 0.085
const NECK_SCALE = 0.6 // neck length, as a share of the model's own
const NECK_DROP = 0.03 // m: the neck's base, lowered into the shoulders
const BODY = new Color('#cdc3b6'), ALARM = new Color('#c7724f')

/*
  Looks. 'clay' is the landing page's figure. 'holo' is the dashboard's rep replay: a
  see-through glowing body with its wireframe facets showing. 'ghost' is a faint holo
  (the replay's peak-lean marker), without the sensors.
*/
export type Look = 'clay' | 'holo' | 'ghost'
const LOOKS: Record<Look, { body: Color; alarm: Color }> = {
  clay: { body: BODY, alarm: ALARM },
  holo: { body: new Color('#9cc9e6'), alarm: new Color('#ee8a5f') },
  ghost: { body: new Color('#9cc9e6'), alarm: new Color('#ee8a5f') },
}

const V = (x = 0, y = 0, z = 0) => new Vector3(x, y, z)
const fromAngle = (a: number) => V(Math.sin(a), Math.cos(a), 0)
const frontOf = (a: number) => V(Math.cos(a), -Math.sin(a), 0)

// scratch
const qa = new Quaternion(), qb = new Quaternion(), m1 = new Matrix4(), m2 = new Matrix4()
const va = new Vector3(), vb = new Vector3(), vc = new Vector3(), vd = new Vector3()

interface BoneInfo { bone: Bone; aimLocal: Vector3; frontLocal: Vector3; rest: Quaternion }

/** Turn bone b so its aim points along `dir` and its front lies toward `front`. */
function aim(b: BoneInfo, dir: Vector3, front: Vector3) {
  const { bone } = b
  bone.updateWorldMatrix(true, false)
  bone.getWorldQuaternion(qa)
  // where aim and front point now
  const a = va.copy(b.aimLocal).applyQuaternion(qa).normalize()
  const f = vb.copy(b.frontLocal).applyQuaternion(qa)
  f.addScaledVector(a, -f.dot(a)).normalize()
  const d = vc.copy(dir).normalize()
  const t = vd.copy(front).addScaledVector(d, -front.dot(d))
  if (t.lengthSq() < 1e-8) t.copy(f).addScaledVector(d, -f.dot(d))
  t.normalize()
  m1.makeBasis(a, f, a.clone().cross(f))
  m2.makeBasis(d, t, d.clone().cross(t))
  m2.multiply(m1.transpose())
  qb.setFromRotationMatrix(m2).multiply(qa) // new world rotation
  // to local
  bone.parent!.getWorldQuaternion(qa)
  bone.quaternion.copy(qa.invert().multiply(qb))
  bone.updateWorldMatrix(false, true)
}

const wp = (o: Object3D) => o.getWorldPosition(new Vector3())

export function SkinnedHumanoid({ body, look = 'clay' }: { body: React.MutableRefObject<BodyInput>; look?: Look }) {
  const rig = RIG
  const gltf = useGLTF(rig.url)
  const { root, bones, skinned, torsoW, lens, chestFront, holoMats } = useMemo(() => {
    // the hologram's materials with their full opacity, so `fade` can scale them
    const holoMats: { mat: MeshBasicMaterial; full: number }[] = []
    const scene = cloneSkinned(gltf.scene)
    const root = scene
    const find = (n: string) => {
      const o = root.getObjectByName(n)
      if (!o) throw new Error(`bone ${n} not in ${rig.url}`)
      return o as Bone
    }
    let skinned: SkinnedMesh | null = null
    root.traverse((o) => { if ((o as SkinnedMesh).isSkinnedMesh) skinned = o as SkinnedMesh })
    if (!skinned) throw new Error('no skinned mesh')
    const sk = skinned as SkinnedMesh
    sk.castShadow = true
    sk.frustumCulled = false
    // geometry: drop normals so flat shading shows the facets crisply
    sk.geometry = sk.geometry.clone()
    if (look === 'clay') {
      sk.material = new MeshStandardMaterial({ color: '#ffffff', vertexColors: true, roughness: 0.8, flatShading: true })
    } else {
      // a hologram: a faint see-through fill, plus the same mesh again as glowing wireframe
      const faint = look === 'ghost'
      sk.castShadow = false
      const fill = new MeshBasicMaterial({ color: '#ffffff', vertexColors: true, transparent: true, opacity: faint ? 0.05 : 0.2, depthWrite: false })
      sk.material = fill
      const wire = sk.clone() as SkinnedMesh // shares the skeleton, so it follows every pose
      const lines = new MeshBasicMaterial({ color: '#ffffff', vertexColors: true, wireframe: true, transparent: true, opacity: faint ? 0.12 : 0.55, depthWrite: false })
      wire.material = lines
      holoMats.push({ mat: fill, full: fill.opacity }, { mat: lines, full: lines.opacity })
      sk.parent?.add(wire)
    }

    // orient: up = pelvis -> head, right = left thigh -> right thigh
    root.updateMatrixWorld(true)
    const R = rig.side('R'), L = rig.side('L')
    const up = wp(find(rig.head)).sub(wp(find(rig.pelvis))).normalize()
    const right = wp(find(R.thigh)).sub(wp(find(L.thigh)))
    right.addScaledVector(up, -right.dot(up)).normalize()
    const fwd = up.clone().cross(right)
    const basis = new Matrix4().makeBasis(fwd, up, right).transpose()
    root.quaternion.setFromRotationMatrix(basis)
    root.updateMatrixWorld(true)
    const box = new Box3().setFromObject(root, true)
    root.scale.setScalar(HEIGHT / (box.max.y - box.min.y))
    root.updateMatrixWorld(true)

    // per bone: direction to its chain child (local), a front vector (local), rest rotation
    const info = (name: string, child: string | null, frontWorld: Vector3): BoneInfo => {
      const bone = find(name)
      const qw = bone.getWorldQuaternion(new Quaternion())
      const inv = qw.clone().invert()
      const aimLocal = child ? wp(find(child)).sub(wp(bone)).applyQuaternion(inv).normalize() : V(0, 1, 0)
      return { bone, aimLocal, frontLocal: frontWorld.clone().applyQuaternion(inv), rest: bone.quaternion.clone() }
    }
    const X = V(1, 0, 0)
    const chain = [rig.pelvis, ...rig.spine, rig.neck, rig.head]
    const bones: Record<string, BoneInfo> = {}
    chain.forEach((n, i) => { bones[n] = info(n, chain[i + 1] ?? null, X) })
    for (const s of ['R', 'L'] as const) {
      const n = rig.side(s)
      bones[n.thigh] = info(n.thigh, n.shin, X)
      bones[n.shin] = info(n.shin, null, X)
      // arms: front = forward in the rest pose (palms down, thumbs forward)
      bones[n.upper] = info(n.upper, n.fore, X)
      bones[n.fore] = info(n.fore, n.hand, X)
      bones[n.hand] = info(n.hand, null, X)
    }
    // the shin aims at the foot bone: use the foot as its child
    for (const s of ['R', 'L'] as const) {
      const n = rig.side(s)
      const foot = find(n.shin).children.find((c) => (c as Bone).isBone)
      if (foot) bones[n.shin] = info(n.shin, foot.name, X)
    }
    // A shorter neck than the model's: the head bone sits closer to the neck bone, so the
    // head drops and the neck part of the mesh shortens with it.
    find(rig.head).position.multiplyScalar(NECK_SCALE)
    {
      // and the neck's base comes down a little too (its children are only the neck and head)
      const nb = find(rig.neck)
      const world = wp(nb).distanceTo(wp(nb.parent!))
      nb.position.multiplyScalar(Math.max(0.5, 1 - NECK_DROP / world))
    }
    root.updateMatrixWorld(true)

    const len = (a: string, b: string) => wp(find(a)).distanceTo(wp(find(b)))
    const lens = {
      upper: len(R.upper, R.fore), fore: len(R.fore, R.hand),
      thigh: len(R.thigh, R.shin),
      shin: len(R.shin, (find(R.shin).children.find((c) => (c as Bone).isBone) as Bone).name),
    }

    // how much each vertex belongs to the trunk (for the alarm colour)
    const torsoNames = new Set([rig.pelvis, ...rig.spine])
    const skel = sk.skeleton
    const idx = skel.bones.map((b) => torsoNames.has(b.name))
    const J = sk.geometry.getAttribute('skinIndex'), W = sk.geometry.getAttribute('skinWeight')
    const torsoW = new Float32Array(J.count)
    for (let v = 0; v < J.count; v++) {
      let w = 0
      for (let k = 0; k < 4; k++) if (idx[J.getComponent(v, k)]) w += W.getComponent(v, k)
      torsoW[v] = Math.min(1, w * 1.15)
    }
    sk.geometry.setAttribute('color', new BufferAttribute(new Float32Array(J.count * 3), 3))

    // where the front of the chest is at sensor height, in the rest pose, so the sensor sits on it
    const sAt = wp(find(rig.spine[rig.spine.length - 1])).lerp(wp(find(rig.neck)), rig.sensorAt)
    let x1 = -Infinity
    const p = new Vector3()
    for (let v = 0; v < J.count; v++) {
      if (torsoW[v] < 0.5) continue
      sk.getVertexPosition(v, p).applyMatrix4(sk.matrixWorld)
      if (Math.abs(p.y - sAt.y) > 0.03) continue
      x1 = Math.max(x1, p.x)
    }
    const chestFront = x1 - sAt.x
    return { root, bones, skinned: sk, torsoW, lens, chestFront, holoMats }
  }, [gltf, rig, look])

  const lastAlarm = useRef(-1)
  const chest = useRef<Group>(null)
  const wristRig = useRef<Group>(null)
  const devices = useMemo(() => ({
    chestBox: chamferBox(0.026, 0.064, 0.058, 0.006),
    wristBox: chamferBox(0.016, 0.044, 0.034, 0.005),
  }), [])

  useFrame(() => {
    // hologram fade: scale the materials' opacity; skip posing entirely once invisible
    if (holoMats.length) {
      const f = Math.max(0, Math.min(1, body.current.fade ?? 1))
      for (const m of holoMats) m.mat.opacity = m.full * f
      root.visible = f > 0.001
      if (!root.visible) return
    }
    const a = body.current.lean
    const sw = body.current.sideways
    // the lean's direction: forward, or towards the reaching side for the sideways reach
    const upAt = (x: number) => (sw === undefined ? fromAngle(x) : V(0, Math.cos(x), Math.sin(x)))
    const faceAt = (x: number) => (sw === undefined ? frontOf(x) : V(1, 0, 0))
    for (const b of Object.values(bones)) b.bone.quaternion.copy(b.rest)
    root.position.set(0, 0, 0)
    root.updateMatrixWorld(true)

    // trunk
    const spineAngles = rig.spine.map((_, i) => a * (0.55 + 0.45 * (i / Math.max(1, rig.spine.length - 1))))
    aim(bones[rig.pelvis], upAt(a * 0.3), faceAt(a * 0.3))
    // seat the hips: midpoint of the hip joints onto HIP
    const R = rig.side('R'), L = rig.side('L')
    const hipMid = wp(bones[R.thigh].bone).add(wp(bones[L.thigh].bone)).multiplyScalar(0.5)
    root.position.add(HIP.clone().sub(hipMid))
    root.updateMatrixWorld(true)
    rig.spine.forEach((n, i) => aim(bones[n], upAt(spineAngles[i]), faceAt(spineAngles[i])))
    aim(bones[rig.neck], upAt(a * 0.9), faceAt(a * 0.9))
    aim(bones[rig.head], upAt(a * 0.75), faceAt(a * 0.75))

    // legs: thigh tipped so the shin, hanging near vertical, puts the ankle at ANKLE_Y
    for (const s of ['R', 'L'] as const) {
      const n = rig.side(s)
      const h = wp(bones[n.thigh].bone)
      const sin = Math.max(-0.6, Math.min(0.3, (ANKLE_Y + lens.shin * 0.99 - h.y) / lens.thigh))
      const cos = Math.sqrt(1 - sin * sin)
      aim(bones[n.thigh], V(cos, sin, (s === 'R' ? 1 : -1) * 0.02), V(0, 1, 0))
      aim(bones[n.shin], V(0.07, -1, 0), V(1, 0, 0))
    }

    // arms
    const arm = (s: 'R' | 'L', target: Vector3, hint: Vector3, thumb: Vector3, handDir: Vector3) => {
      const n = rig.side(s)
      const sh = wp(bones[n.upper].bone)
      const to = target.clone().sub(sh)
      const d = Math.min(to.length(), lens.upper + lens.fore - 1e-3)
      const u = to.normalize()
      const along = (lens.upper ** 2 - lens.fore ** 2 + d * d) / (2 * d)
      const out = Math.sqrt(Math.max(lens.upper ** 2 - along * along, 0))
      const bend = hint.clone().addScaledVector(u, -hint.dot(u)).normalize()
      const elbow = sh.clone().addScaledVector(u, along).addScaledVector(bend, out)
      const wrist = sh.clone().addScaledVector(u, d)
      // inner elbow faces the wrist side
      aim(bones[n.upper], elbow.clone().sub(sh), wrist.clone().sub(elbow))
      aim(bones[n.fore], wrist.clone().sub(elbow), thumb)
      aim(bones[n.hand], handDir, thumb)
      return { elbow, wrist }
    }
    const start = V(...body.current.wrist).add(V(0, -0.018, 0))
    const m = Math.max(0, Math.min(1, body.current.mouth ?? 0))
    let right
    if (m > 0) {
      // hand to mouth: the fingers end just in front of the lips, pointing up; the wrist sits a hand's length below them
      const headPos = wp(bones[rig.head].bone)
      const face = frontOf(a * 0.75)
      const lips = headPos.clone().addScaledVector(face, 0.085).add(V(0, -0.045, 0.02))
      const handUp = V(-0.25, 1, -0.3).normalize()
      const atMouth = lips.clone().addScaledVector(handUp, -0.085)
      const wristAt = start.clone().lerp(atMouth, m)
      const handDir = V(1, -0.22, 0).lerp(handUp, m).normalize()
      // the elbow drops and comes forward as the hand rises
      const hint = V(-0.2, -1, 0.7).lerp(V(0.35, -1, 0.55), m)
      right = arm('R', wristAt, hint, V(0.25, 0.2, -1), handDir)
    } else if (body.current.turn !== undefined) {
      // forearm rotation: the thumb swings from pointing in (palm down) over the top to pointing out (palm up)
      const th = Math.PI * Math.max(0, Math.min(1, body.current.turn))
      right = arm('R', start, V(-0.35, -1, 0.2), V(0, Math.sin(th), -Math.cos(th)), V(1, -0.08, 0))
    } else if (sw !== undefined) {
      // sideways reach: the elbow swings back and down, the hand turns to point out to the side
      const s = Math.max(0, Math.min(1, sw))
      right = arm('R', start, V(-0.2, -1, 0.7).lerp(V(-0.5, -1, -0.1), s),
        V(0.25, 0.2, -1).lerp(V(1, 0.35, 0), s), V(1, -0.22, 0).lerp(V(0.3, -0.3, 1), s).normalize())
    } else {
      right = arm('R', start, V(-0.2, -1, 0.7), V(0.25, 0.2, -1), V(1, -0.22, 0))
    }
    arm('L', LAP_WRIST, V(-0.2, -1, -0.8), V(0.2, 0.2, 1), V(0.85, -0.3, 0.25))

    // alarm colour on the trunk
    const al = body.current.alarm
    if (Math.abs(al - lastAlarm.current) > 0.004) {
      lastAlarm.current = al
      const c = skinned.geometry.getAttribute('color') as BufferAttribute
      const tmp = new Color()
      const { body: base, alarm: hot } = LOOKS[look]
      for (let v = 0; v < torsoW.length; v++) {
        tmp.copy(base).lerp(hot, al * torsoW[v])
        c.setXYZ(v, tmp.r, tmp.g, tmp.b)
      }
      c.needsUpdate = true
    }

    // chest sensor on the sternum, wrist brace near the end of the forearm
    const top = bones[rig.spine[rig.spine.length - 1]].bone
    const topPos = wp(top), neckPos = wp(bones[rig.neck].bone)
    const sensorAt = topPos.lerp(neckPos, rig.sensorAt)
    placeGroup(chest.current, sensorAt, fromAngle(a), frontOf(a))
    const fd = right.wrist.clone().sub(right.elbow).normalize()
    placeGroup(wristRig.current, right.elbow.clone().addScaledVector(fd, lens.fore * 0.8), fd, V(0, 1, 0))
  })

  return (
    <group>
      <primitive object={root} />
      <group ref={chest} visible={look !== 'ghost'}>
        {/* the trunk sensor box on the sternum, no strap: a strap ring cut through the body */}
        <mesh castShadow geometry={devices.chestBox} position={[chestFront - 0.004, 0.004, 0]}>
          <meshStandardMaterial color={PROP_COLORS.device} roughness={0.55} flatShading />
        </mesh>
        <mesh position={[chestFront + 0.01, 0.022, -0.016]}>
          <sphereGeometry args={[0.0045, 8, 6]} />
          <meshStandardMaterial color="#7fb59a" emissive="#7fb59a" emissiveIntensity={1.2} />
        </mesh>
      </group>
      <group ref={wristRig} visible={look !== 'ghost'}>
        <mesh scale={[0.036, 1, 0.041]}>
          <cylinderGeometry args={[1, 1, 0.05, 12, 1, true]} />
          <meshStandardMaterial color="#2f3e37" roughness={0.8} side={2} flatShading />
        </mesh>
        <mesh castShadow geometry={devices.wristBox} position={[0.044, 0, 0]}>
          <meshStandardMaterial color={PROP_COLORS.device} roughness={0.55} flatShading />
        </mesh>
      </group>
    </group>
  )
}

const pm = new Matrix4(), px = new Vector3(), py = new Vector3(), pz = new Vector3()
function placeGroup(o: Group | null, at: Vector3, dir: Vector3, front: Vector3) {
  if (!o) return
  py.copy(dir).normalize()
  px.copy(front).addScaledVector(py, -front.dot(py)).normalize()
  pz.crossVectors(px, py)
  o.position.copy(at)
  o.quaternion.setFromRotationMatrix(pm.makeBasis(px, py, pz))
}
