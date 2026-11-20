import { useLayoutEffect, useRef, useState } from 'react'

/** Width of an element in CSS pixels, kept up to date as it resizes. */
export function useWidth<T extends HTMLElement>(initial = 600) {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(initial)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    // A width of 0 means the element is hidden or mid-relayout (a print or full-page
    // capture collapses the layout for a frame); keep the last real width instead.
    const set = (v: number) => { if (v > 0) setWidth(Math.round(v)) }
    const ro = new ResizeObserver(([e]) => set(e.contentRect.width))
    ro.observe(el)
    set(el.getBoundingClientRect().width)
    return () => ro.disconnect()
  }, [])
  return [ref, width] as const
}
