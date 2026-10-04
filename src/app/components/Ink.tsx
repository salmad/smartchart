import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'

export interface InkHandle { down(x: number, y: number): void; move(x: number, y: number): void; up(): void }

const LIFE = 1400
type Point = { x: number; y: number; t: number }

/** Disappearing ink for presenting: hold the button and draw; each stretch of the line fades a moment after it was
    drawn, so the pointer shows where to look and leaves nothing behind. Pointer-transparent; the parent feeds it. */
export const Ink = forwardRef<InkHandle>(function Ink(_, ref) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const strokes = useRef<Point[][]>([]), drawing = useRef(false), frame = useRef(0)

  const paint = () => {
    const el = canvas.current, g = el?.getContext('2d')
    if (!el || !g) return
    const now = performance.now(), dpr = window.devicePixelRatio || 1
    if (el.width !== Math.round(innerWidth * dpr) || el.height !== Math.round(innerHeight * dpr)) { el.width = Math.round(innerWidth * dpr); el.height = Math.round(innerHeight * dpr) }
    g.setTransform(dpr, 0, 0, dpr, 0, 0)
    g.clearRect(0, 0, innerWidth, innerHeight)
    g.lineCap = 'round'
    g.lineJoin = 'round'
    strokes.current = strokes.current.map((s) => s.filter((p) => now - p.t < LIFE)).filter((s) => s.length > 0)
    for (const s of strokes.current) {
      for (let i = 1; i < s.length; i++) {
        const a = 1 - (now - s[i].t) / LIFE
        g.strokeStyle = `rgba(255,210,74,${a * a})`
        g.shadowColor = `rgba(255,210,74,${a * 0.6})`
        g.shadowBlur = 12
        g.lineWidth = 5
        g.beginPath(); g.moveTo(s[i - 1].x, s[i - 1].y); g.lineTo(s[i].x, s[i].y); g.stroke()
      }
      if (s.length === 1) { // a press without movement is a dot
        const a = 1 - (now - s[0].t) / LIFE
        g.fillStyle = `rgba(255,210,74,${a * a})`
        g.beginPath(); g.arc(s[0].x, s[0].y, 4, 0, Math.PI * 2); g.fill()
      }
    }
    frame.current = strokes.current.length || drawing.current ? requestAnimationFrame(paint) : 0
  }
  const wake = () => { if (!frame.current) frame.current = requestAnimationFrame(paint) }
  useEffect(() => () => cancelAnimationFrame(frame.current), [])

  useImperativeHandle(ref, () => ({
    down(x, y) { drawing.current = true; strokes.current.push([{ x, y, t: performance.now() }]); wake() },
    move(x, y) { const s = strokes.current[strokes.current.length - 1]; if (drawing.current && s) { s.push({ x, y, t: performance.now() }); wake() } },
    up() { drawing.current = false },
  }))
  return <canvas ref={canvas} aria-hidden className="pointer-events-none fixed inset-0 size-full" />
})
