/*
  Geometry of the seated figure in the 3D replay (metres).
  What is measured and what is drawn:

    REAL   trunk tilt = the logged trunk angle (drawn as a forward lean)
    REAL   timing of cue, leaving HOME and target press
    DRAWN  the arm: the hand travels HOME -> target over the logged reach time

  Three.js axes: x = forward (towards the table), y = up, z = sideways
  (+z = the reaching side, towards the camera).
*/
import type { Target } from '../types'

export type V3 = [number, number, number]

export const SEAT_HEIGHT = 0.45
const TRUNK_LENGTH = 0.52
const NECK_LENGTH = 0.2
export const SHOULDER_HALF_WIDTH = 0.18
const UPPER_ARM = 0.31
const FOREARM = 0.33
const HAND_LIFT = 0.08
const RETURN_S = 0.5

export const TABLE = { near: 0.2, far: 0.85, height: 0.72 }
export const HOME_X = 0.27
export const TARGET_X: Record<Target, number> = { GREEN: 0.37, BLUE: 0.47, RED: 0.57 }

const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const scale = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k]
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const len = (a: V3) => Math.sqrt(dot(a, a))
const norm = (a: V3): V3 => scale(a, 1 / len(a))

const smoothstep = (f: number) => {
  const x = Math.min(Math.max(f, 0), 1)
  return x * x * (3 - 2 * x)
}

export interface Pose {
  hip: V3
  chest: V3
  shoulder: V3       // reaching shoulder
  otherShoulder: V3
  head: V3
  elbow: V3
  hand: V3
}

/**
  How far along its movement the hand is at time t: 0 resting on HOME, rising to 1
  as it arrives (the target press, or the hand at the mouth), back to 0 over the
  return. Eased at both ends. The arrival time is the logged one; the path is drawn.
*/
export function progress(t: number, reachEndS: number): number {
  if (t <= 0) return 0
  if (t <= reachEndS) return smoothstep(t / reachEndS)
  return 1 - smoothstep((t - reachEndS) / RETURN_S)
}

/** Where HOME is: the hand's resting place on the mat. */
export const HOME: V3 = [HOME_X, TABLE.height + 0.02, SHOULDER_HALF_WIDTH]

function handPosition(t: number, reachEndS: number, target: Target): V3 {
  const home = HOME
  const goal: V3 = [TARGET_X[target], TABLE.height + 0.02, SHOULDER_HALF_WIDTH]
  const f = progress(t, reachEndS)
  const moving = t > 0 && t < reachEndS + RETURN_S
  const lift = moving ? HAND_LIFT * Math.sin(Math.PI * f) : 0
  return add(add(home, scale(sub(goal, home), f)), [0, lift, 0])
}

/** Where every joint is at time t (seconds since leaving HOME) for a given trunk angle. */
export function pose(trunkDeg: number, t: number, reachEndS: number, target: Target): Pose {
  const a = (trunkDeg * Math.PI) / 180
  const hip: V3 = [0, SEAT_HEIGHT, 0]
  const up: V3 = [Math.sin(a), Math.cos(a), 0]
  const chest = add(hip, scale(up, TRUNK_LENGTH))
  const shoulder = add(chest, [0, 0, SHOULDER_HALF_WIDTH])
  const otherShoulder = add(chest, [0, 0, -SHOULDER_HALF_WIDTH])
  const head = add(chest, scale(up, NECK_LENGTH))

  // Two-link arm: the elbow sits where an upper arm and a forearm of fixed length meet
  const wanted = handPosition(t, reachEndS, target)
  const toHand = sub(wanted, shoulder)
  const d = Math.min(len(toHand), UPPER_ARM + FOREARM - 1e-3)
  const u = norm(toHand)
  const hand = add(shoulder, scale(u, d))
  const along = (UPPER_ARM ** 2 - FOREARM ** 2 + d ** 2) / (2 * d)
  const out = Math.sqrt(Math.max(UPPER_ARM ** 2 - along ** 2, 0))
  const downAndOut: V3 = [0, -1, 0.7]               // elbow drops and points out to the side
  const bend = norm(sub(downAndOut, scale(u, dot(downAndOut, u))))
  const elbow = add(add(shoulder, scale(u, along)), scale(bend, out))

  return { hip, chest, shoulder, otherShoulder, head, elbow, hand }
}
