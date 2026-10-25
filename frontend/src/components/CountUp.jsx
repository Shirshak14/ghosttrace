import { useEffect, useRef } from 'react'
import { animate, useReducedMotion } from 'motion/react'

const nf = new Intl.NumberFormat()

// Counts from 0 to `to` once, writing straight to the DOM so it doesn't re-render every frame.
export default function CountUp({ to = 0, duration = 1.1, className }) {
  const ref = useRef(null)
  const reduce = useReducedMotion()
  useEffect(() => {
    const el = ref.current
    if (!el) return undefined
    if (reduce) { el.textContent = nf.format(to); return undefined }
    const controls = animate(0, to, {
      duration,
      ease: [0.32, 0.72, 0, 1],
      onUpdate: (v) => { el.textContent = nf.format(Math.round(v)) },
    })
    return () => controls.stop()
  }, [to, duration, reduce])
  return <span ref={ref} className={className}>{nf.format(to)}</span>
}
