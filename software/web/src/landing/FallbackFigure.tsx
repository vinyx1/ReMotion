/*
  The same figure in 2D, for browsers without WebGL. It follows the same input
  and applies the same lean rule as the 3D scene.
*/
import { useEffect, useRef, useState } from 'react'
import { LIMIT_DEG, type SceneInput, SUSTAIN_MS } from './lean'

export function FallbackFigure({ input, onMeasure }: {
  input: React.MutableRefObject<SceneInput>
  onMeasure: (deg: number, flagged: boolean) => void
}) {
  const [deg, setDeg] = useState(0)
  const [reach, setReach] = useState(0)
  const over = useRef(0)
  useEffect(() => {
    let raf = 0
    let last = performance.now()
    const loop = (now: number) => {
      const dt = now - last
      last = now
      const d = Math.max(0, input.current.trunkDeg)
      over.current = d > LIMIT_DEG ? over.current + dt : 0
      onMeasure(d, over.current >= SUSTAIN_MS)
      setDeg(d)
      setReach(input.current.reach)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [input, onMeasure])

  const hipX = 300, hipY = 330
  const a = (deg * Math.PI) / 180
  const chestX = hipX + Math.sin(a) * 170, chestY = hipY - Math.cos(a) * 170
  const handX = 470 + reach * 170
  return (
    <svg viewBox="0 0 900 520" className="lp-fallback" preserveAspectRatio="xMidYMax meet">
      <rect x="0" y="0" width="900" height="420" fill="#c9d3cb" />
      <rect x="0" y="420" width="900" height="100" fill="#e1e4de" />
      <rect x="430" y="300" width="420" height="14" rx="4" fill="#f1f2ee" />
      {[470, 550, 620, 680].map((x, i) => (
        <circle key={x} cx={x} cy="296" r="10" fill={['#f6f6f2', '#4c8a5f', '#47709f', '#a8343a'][i]} />
      ))}
      <path d="M200 420 V340 H330" stroke="#e3e5e0" strokeWidth="16" fill="none" />
      <g stroke="#cdc3b6" strokeLinecap="round" fill="none">
        <line x1={hipX} y1={hipY} x2={chestX} y2={chestY} strokeWidth="46" />
        <line x1={hipX} y1={hipY} x2={hipX + 120} y2={hipY + 4} strokeWidth="38" stroke="#b7ac9e" />
        <line x1={chestX} y1={chestY + 20} x2={handX} y2="290" strokeWidth="20" stroke="#b7ac9e" />
      </g>
      <circle cx={chestX + Math.sin(a) * 50} cy={chestY - Math.cos(a) * 50} r="34" fill="#cdc3b6" />
      <rect x={chestX - 8} y={chestY + 20} width="18" height="34" rx="4" fill="#1f2d27" transform={`rotate(${deg} ${chestX} ${chestY + 37})`} />
    </svg>
  )
}
