/*
  The figure's head, in the style of stylised low-poly game characters (think low-poly
  "Olympian" heroes): an angular, faceless head (no eyes or mouth) with a long straight
  nose, hard cheekbones, a defined jaw and chin, and hair as one sculpted low-poly mesh
  (jagged tufted hairline, ridges, a short quiff, sideburns), in the same stone as the face.

  Each piece is the convex hull of a handful of landmarks, so every plane is a flat facet
  with a hard edge. Head-local metres: +x is the front (face), +y up, +z the side.
  y = 0 is the bottom of the chin; the skull's crown is at about 0.24. Landmarks off the
  midline are mirrored.
*/
import { BufferGeometry, Float32BufferAttribute, Vector3 } from 'three'
import { ConvexGeometry } from 'three/examples/jsm/geometries/ConvexGeometry.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

type P = [x: number, y: number, z: number]

// ---------- skin: skull and face ----------
const SKULL_MID: P[] = [
  [0.084, 0.0, 0],     // underside of the chin
  [0.095, 0.02, 0],    // point of the chin
  [0.09, 0.05, 0],     // where the mouth would be: a flat plane
  [0.093, 0.08, 0],    // under the nose
  [0.093, 0.14, 0],    // bridge of the nose, between where the eyes would be
  [0.1, 0.158, 0],     // brow
  [0.096, 0.19, 0],    // forehead
  [0.083, 0.214, 0],
  [0.0, 0.242, 0],     // crown
  [-0.106, 0.152, 0],  // back of the skull
  [-0.09, 0.088, 0],
  [-0.055, 0.04, 0],   // nape
  [0.025, 0.0, 0],     // where the throat meets the jaw
]
const SKULL_SIDE: P[] = [
  [0.085, 0.012, 0.022],  // chin corners
  [0.06, 0.014, 0.046],   // jawline
  [0.03, 0.03, 0.062],    // angle of the jaw: sharp, high, wide
  [0.005, 0.045, 0.066],
  [0.084, 0.055, 0.03],
  [0.075, 0.085, 0.05],   // lower cheek, a hollow plane under the cheekbone
  [0.075, 0.118, 0.066],  // cheekbone: the widest point of the face
  [0.03, 0.115, 0.073],   // cheekbone running back to the ear
  [0.086, 0.135, 0.045],  // the flat plane where the eyes would be
  [0.092, 0.16, 0.032],   // brow
  [0.082, 0.16, 0.058],   // outer brow
  [0.06, 0.166, 0.071],   // temple
  [0.075, 0.2, 0.05],     // side of the forehead
  [-0.02, 0.17, 0.079],   // widest part of the skull
  [-0.01, 0.216, 0.056],
  [0.05, 0.229, 0.035],
  [-0.08, 0.152, 0.056],
  [-0.07, 0.08, 0.055],
  [-0.03, 0.058, 0.062],
  [-0.01, 0.082, 0.068],
]

// A long, straight nose, carrying on from the line of the brow.
const NOSE_MID: P[] = [[0.123, 0.084, 0], [0.098, 0.076, 0], [0.104, 0.152, 0]]
const NOSE_SIDE: P[] = [[0.1, 0.142, 0.01], [0.114, 0.11, 0.011], [0.115, 0.083, 0.015], [0.1, 0.078, 0.021]]

// A small, flat ear (+z side; mirrored).
const EAR: P[] = [
  [0.0, 0.15, 0.072], [-0.02, 0.146, 0.086], [-0.026, 0.118, 0.086], [-0.014, 0.092, 0.078],
  [0.004, 0.104, 0.072], [-0.012, 0.128, 0.072],
]

// ---------- hair: one sculpted mass ----------
// One custom mesh (not a hull), so it can have what makes low-poly hair read as hair even in
// the same stone as the face:
//   - a jagged hairline: every other column dips into a pointed tuft over the forehead,
//     temples and nape, with a lip turning in to the skull so the edge has thickness
//   - ridges: alternate columns stand proud on the lower half, like clumps of strands
//   - more lift at the front, a short quiff
const CAP = { c: new Vector3(-0.012, 0.162, 0), r: new Vector3(0.12, 0.11, 0.093) }
/** Hairline height around the head (cos a = 1 at the front): on the forehead, over the ears, low at the nape. */
const hairline = (cosA: number) => 0.153 + (cosA >= 0 ? 0.042 : 0.065) * cosA

function hairMesh(): BufferGeometry {
  const cols = 18
  const rows = [0, 0.2, 0.42, 0.64, 0.84]
  const point = (k: number, t: number, grow: number, drop = 0): Vector3 => {
    const az = (k / cols) * Math.PI * 2
    const cosA = Math.cos(az)
    const elLine = Math.asin(Math.max(-1, Math.min(1, (hairline(cosA) - CAP.c.y) / CAP.r.y))) - drop
    const el = elLine + (Math.PI / 2 - elLine) * t
    const front = Math.max(0, cosA) ** 2
    const lift = 1 + grow + front * 0.05 * Math.sin(Math.PI * Math.min(t * 1.3, 1)) // the quiff
    return new Vector3(
      CAP.c.x + CAP.r.x * lift * Math.cos(el) * cosA,
      CAP.c.y + CAP.r.y * Math.sin(el) * (1 + front * 0.04 * t),
      CAP.c.z + CAP.r.z * lift * Math.cos(el) * Math.sin(az),
    )
  }
  const grid: Vector3[][] = []
  // the lip: the hairline pulled back in to the skull
  grid.push(Array.from({ length: cols }, (_, k) => point(k, 0, -0.16, k % 2 === 0 ? 0.24 : 0)))
  rows.forEach((t, j) => grid.push(Array.from({ length: cols }, (_, k) => {
    const tuft = j === 0 && k % 2 === 0
    const ridge = k % 2 === 1 && t > 0 && t < 0.75 ? 0.11 * (1 - t) : 0
    return point(k, t, tuft ? 0.045 : ridge, tuft ? 0.24 : 0)
  })))
  const crown = new Vector3(CAP.c.x + 0.005, CAP.c.y + CAP.r.y + 0.008, 0)
  const pos: number[] = []
  const tri = (a: Vector3, b: Vector3, c: Vector3) => pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z)
  for (let j = 0; j < grid.length - 1; j++) {
    for (let k = 0; k < cols; k++) {
      const a = grid[j][k], b = grid[j][(k + 1) % cols], c = grid[j + 1][(k + 1) % cols], d = grid[j + 1][k]
      tri(a, c, d); tri(a, b, c)
    }
  }
  const top = grid[grid.length - 1]
  for (let k = 0; k < cols; k++) tri(top[k], top[(k + 1) % cols], crown)
  const g = new BufferGeometry()
  g.setAttribute('position', new Float32BufferAttribute(pos, 3))
  return g
}

// Sideburns down in front of the ear (+z side; mirrored).
const SIDEBURN: P[] = [[0.02, 0.18, 0.086], [0.062, 0.18, 0.074], [0.03, 0.115, 0.08], [0.046, 0.117, 0.077], [0.01, 0.15, 0.08], [0.055, 0.15, 0.072], [0.03, 0.17, 0.07]]

const mirror = (mid: P[], side: P[]) => [...mid, ...side, ...side.map(([x, y, z]) => [x, y, -z] as P)]
const flip = (pts: P[]) => pts.map(([x, y, z]) => [x, y, -z] as P)
const hull = (pts: P[]) => new ConvexGeometry(pts.map((p) => new Vector3(...p)))

function merge(parts: BufferGeometry[]): BufferGeometry {
  const clean = parts.map((g) => {
    const flat = g.index ? g.toNonIndexed() : g
    for (const name of Object.keys(flat.attributes)) if (name !== 'position') flat.deleteAttribute(name)
    return flat
  })
  const merged = mergeGeometries(clean)!
  merged.computeVertexNormals()
  return merged
}

/** The head as two meshes: skin (skull, nose, ears) and hair. */
export function statueHead(): { skin: BufferGeometry; hair: BufferGeometry } {
  return {
    skin: merge([hull(mirror(SKULL_MID, SKULL_SIDE)), hull(mirror(NOSE_MID, NOSE_SIDE)), hull(EAR), hull(flip(EAR))]),
    hair: merge([hairMesh(), hull(SIDEBURN), hull(flip(SIDEBURN))]),
  }
}
