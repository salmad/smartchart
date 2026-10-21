/* A strip of thumbnails drawn all at once costs a long frame, and the slide on the stage waits behind it. The first few
   thumbnails (and the open slide's) draw with the page; the rest follow in the frames after, a few at a time. Once every
   thumbnail has drawn, later ones (a slide added) draw at once. Keyed by deck in the editor, so each deck ramps up afresh. */
import { useEffect, useRef, useState } from 'react'

/** Whether thumbnail `i` draws now. */
export function useRamp(count: number, current: number, eager = 4, step = 4): (i: number) => boolean {
  const [drawn, setDrawn] = useState(eager)
  const complete = useRef(count <= eager)
  if (drawn >= count) complete.current = true
  useEffect(() => {
    if (complete.current) return
    let timer: ReturnType<typeof setTimeout> | undefined
    const frame = requestAnimationFrame(() => { timer = setTimeout(() => setDrawn((n) => n + step), 0) })
    return () => { cancelAnimationFrame(frame); clearTimeout(timer) }
  }, [drawn, count, step])
  return (i) => complete.current || i < drawn || i === current
}
