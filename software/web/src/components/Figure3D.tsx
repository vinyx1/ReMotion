/*
  The seated figure, drawn with React Three Fiber.
  Fixed camera (side view) so nothing can be knocked out of place while presenting.
*/
import { Canvas } from '@react-three/fiber'
import { useMemo } from 'react'
import { Quaternion, Vector3 } from 'three'
import { HOME_X, pose, SEAT_HEIGHT, SHOULDER_HALF_WIDTH, TABLE, TARGET_X, type V3 } from '../lib/figure'
import type { Target } from '../types'

const COLORS = {
  clean: '#2a78d6',
  comp: '#eb6834',
  arm: '#5b6577',
  furniture: '#d5dbe3',
  table: '#e9edf2',
  home: '#f8fafc',
  GREEN: '#1baf7a',
  BLUE: '#2a78d6',
  RED: '#e34948',
}

const UP = new Vector3(0, 1, 0)

/** A rounded rod between two points (a capsule). */
function Limb({ from, to, radius, color }: { from: V3; to: V3; radius: number; color: string }) {
  const a = new Vector3(...from)
  const b = new Vector3(...to)
  const dir = b.clone().sub(a)
  const length = Math.max(dir.length(), 1e-4)
  const mid = a.clone().add(b).multiplyScalar(0.5)
  const quat = new Quaternion().setFromUnitVectors(UP, dir.normalize())
  return (
    <mesh position={mid} quaternion={quat}>
      <capsuleGeometry args={[radius, length, 6, 16]} />
      <meshStandardMaterial color={color} roughness={0.55} />
    </mesh>
  )
}

function Furniture({ target }: { target: Target }) {
  const width = TABLE.far - TABLE.near
  return (
    <group>
      {/* table top */}
      <mesh position={[TABLE.near + width / 2, TABLE.height - 0.015, 0]}>
        <boxGeometry args={[width, 0.03, 1.1]} />
        <meshStandardMaterial color={COLORS.table} roughness={0.9} />
      </mesh>
      {/* chair: seat, back, front legs */}
      <mesh position={[-0.02, SEAT_HEIGHT - 0.06, 0]}>
        <boxGeometry args={[0.42, 0.035, 0.44]} />
        <meshStandardMaterial color={COLORS.furniture} roughness={0.8} />
      </mesh>
      <mesh position={[-0.24, SEAT_HEIGHT + 0.22, 0]}>
        <boxGeometry args={[0.035, 0.52, 0.44]} />
        <meshStandardMaterial color={COLORS.furniture} roughness={0.8} />
      </mesh>
      {[-0.2, 0.17].map((x) =>
        [-0.19, 0.19].map((z) => (
          <mesh key={`${x}${z}`} position={[x, (SEAT_HEIGHT - 0.08) / 2, z]}>
            <boxGeometry args={[0.03, SEAT_HEIGHT - 0.08, 0.03]} />
            <meshStandardMaterial color={COLORS.furniture} roughness={0.8} />
          </mesh>
        )),
      )}
      {/* mat buttons: HOME + the three targets; the cued one is raised and larger */}
      <mesh position={[HOME_X, TABLE.height + 0.006, SHOULDER_HALF_WIDTH]}>
        <cylinderGeometry args={[0.026, 0.026, 0.012, 32]} />
        <meshStandardMaterial color={COLORS.home} roughness={0.4} />
      </mesh>
      {(Object.keys(TARGET_X) as Target[]).map((name) => {
        const lit = name === target
        return (
          <mesh key={name} position={[TARGET_X[name], TABLE.height + (lit ? 0.01 : 0.006), SHOULDER_HALF_WIDTH]}>
            <cylinderGeometry args={[lit ? 0.03 : 0.022, lit ? 0.03 : 0.022, lit ? 0.02 : 0.012, 32]} />
            <meshStandardMaterial
              color={COLORS[name]}
              emissive={COLORS[name]}
              emissiveIntensity={lit ? 0.45 : 0}
              roughness={0.4}
            />
          </mesh>
        )
      })}
    </group>
  )
}

export function Figure3D({ trunkDeg, t, reachEndS, target, over }: {
  trunkDeg: number
  t: number
  reachEndS: number
  target: Target
  over: boolean          // trunk past the threshold right now
}) {
  const p = useMemo(() => pose(trunkDeg, t, reachEndS, target), [trunkDeg, t, reachEndS, target])
  const body = over ? COLORS.comp : COLORS.clean

  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ position: [0.36, 1.05, 2.75], fov: 30 }}
      onCreated={({ camera }) => camera.lookAt(0.3, 0.74, 0)}
      aria-label="3D replay of the seated reach"
      role="img"
    >
      <ambientLight intensity={0.85} />
      <directionalLight position={[1.5, 3, 2.5]} intensity={1.6} />
      <directionalLight position={[-2, 1.5, -1]} intensity={0.4} />
      <Furniture target={target} />
      {/* trunk and shoulders */}
      <Limb from={p.hip} to={p.chest} radius={0.05} color={body} />
      <Limb from={p.otherShoulder} to={p.shoulder} radius={0.035} color={body} />
      <Limb from={p.chest} to={p.head} radius={0.03} color={body} />
      <mesh position={p.head}>
        <sphereGeometry args={[0.085, 32, 32]} />
        <meshStandardMaterial color={body} roughness={0.5} />
      </mesh>
      {/* reaching arm */}
      <Limb from={p.shoulder} to={p.elbow} radius={0.027} color={COLORS.arm} />
      <Limb from={p.elbow} to={p.hand} radius={0.024} color={COLORS.arm} />
      <mesh position={p.hand}>
        <sphereGeometry args={[0.032, 24, 24]} />
        <meshStandardMaterial color={COLORS.arm} roughness={0.5} />
      </mesh>
      {/* thigh, so the figure reads as seated */}
      <Limb from={[0, SEAT_HEIGHT, 0.08]} to={[0.36, SEAT_HEIGHT + 0.02, 0.08]} radius={0.055} color="#c3cad5" />
      <Limb from={[0.36, SEAT_HEIGHT + 0.02, 0.08]} to={[0.38, 0.05, 0.08]} radius={0.045} color="#c3cad5" />
    </Canvas>
  )
}
