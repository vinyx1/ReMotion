/*
  The wall's surface: a faint low-poly field of triangles, echoing the low-poly
  figure on the landing page. Lit like the wall itself, brighter toward the upper
  left, with fine pale seams. Built once from a fixed seed, so it never shifts
  between loads. Decorative only.
*/
import { useMemo } from 'react'

const W = 1440, H = 480, COLS = 18, ROWS = 6

/** A small seeded random generator (mulberry32), so the pattern is the same every time. */
function rng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

interface Facet { d: string; fill: string }

function facets(): Facet[] {
  const rand = rng(198)
  const cw = W / COLS, rh = H / ROWS
  // a jittered grid of points; the edges stay on the border so the field has no gaps
  const pts: [number, number][][] = []
  for (let r = 0; r <= ROWS; r++) {
    const row: [number, number][] = []
    for (let c = 0; c <= COLS; c++) {
      const jx = c === 0 || c === COLS ? 0 : (rand() - 0.5) * cw * 0.8
      const jy = r === 0 || r === ROWS ? 0 : (rand() - 0.5) * rh * 0.8
      row.push([c * cw + jx, r * rh + jy])
    }
    pts.push(row)
  }
  const out: Facet[] = []
  const tri = (a: [number, number], b: [number, number], c: [number, number]) => {
    const cx = (a[0] + b[0] + c[0]) / 3, cy = (a[1] + b[1] + c[1]) / 3
    // light from the upper left, plus a little per-facet variation
    const light = 1 - (cx / W) * 0.7 - (cy / H) * 0.6 + (rand() - 0.5) * 0.5
    const fill = light > 0.35
      ? `rgb(255 255 255 / ${Math.min(0.2, 0.02 + (light - 0.35) * 0.22).toFixed(3)})`
      : `rgb(31 45 39 / ${Math.min(0.09, 0.015 + (0.35 - light) * 0.1).toFixed(3)})`
    out.push({ d: `M${a[0].toFixed(1)},${a[1].toFixed(1)}L${b[0].toFixed(1)},${b[1].toFixed(1)}L${c[0].toFixed(1)},${c[1].toFixed(1)}Z`, fill })
  }
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const p00 = pts[r][c], p10 = pts[r][c + 1], p01 = pts[r + 1][c], p11 = pts[r + 1][c + 1]
      if ((r + c) % 2 === 0) { tri(p00, p10, p11); tri(p00, p11, p01) }
      else { tri(p00, p10, p01); tri(p10, p11, p01) }
    }
  }
  return out
}

export function WallFacets() {
  const list = useMemo(facets, [])
  return (
    <svg className="dash-facets" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" aria-hidden focusable="false">
      {list.map((f, i) => <path key={i} d={f.d} fill={f.fill} />)}
    </svg>
  )
}
