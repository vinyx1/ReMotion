// Shared by the 3D scene, its 2D fallback and the page. Same rule as the firmware.
import type { Target } from '../types'

export const LIMIT_DEG = 10      // default lean limit, degrees
export const SUSTAIN_MS = 200    // the lean must last this long to count

/** Where the camera looks for each part of the story. */
export type Shot = 'hero' | 'chest' | 'mat' | 'wide'

export interface SceneInput {
  trunkDeg: number            // where the trunk should go (degrees forward)
  reach: number               // 0 = hand on HOME, 1 = hand on the target
  target: Target | null       // lit target button
  homeLit: boolean            // HOME blinks during calibration
  calibrating: boolean
  shot: Shot
}
