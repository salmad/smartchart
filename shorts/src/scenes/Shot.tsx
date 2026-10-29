import { Img, interpolate, staticFile } from 'remotion'
import { Rich } from '../Rich'
import { useEnter, useSeconds, rise } from '../motion'
import { C, F } from '../theme'

type Focus = { x: number; y: number; w: number; h: number }

const MAX_H = 900

/** A screenshot in a window frame; at the cue the camera pushes into `focus` (fractions of the image) and rings it. */
export const Shot = ({ src, base, focus, zoom = 1.8, caption, cues }: { src: string; base: string; focus?: Focus; zoom?: number; caption?: string; cues: number[] }) => {
  const s = useSeconds(), p = useEnter(0)
  const at = cues[0] ?? 0.8
  const z = focus ? interpolate(s, [at, at + 0.7], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: (x) => 1 - Math.pow(1 - x, 3) }) : 0
  const ring = focus ? interpolate(s, [at + 0.5, at + 0.8], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) : 0
  const cx = focus ? focus.x + focus.w / 2 : 0.5, cy = focus ? focus.y + focus.h / 2 : 0.5
  const scale = 1 + (zoom - 1) * z
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 40, ...rise(p) }}>
      <div style={{ borderRadius: 28, overflow: 'hidden', border: `2px solid ${C.line}`, boxShadow: '0 40px 120px rgba(0,0,0,.55)', background: C.surface, maxWidth: '100%' }}>
        <div style={{ position: 'relative', transform: `scale(${scale}) translate(${(0.5 - cx) * 100 * z}%, ${(0.5 - cy) * 100 * z}%)` }}>
          <Img src={staticFile(`${base}/${src}`)} style={{ display: 'block', maxWidth: '100%', maxHeight: caption ? MAX_H - 120 : MAX_H }} />
          {focus && (
            <div style={{ position: 'absolute', left: `${focus.x * 100}%`, top: `${focus.y * 100}%`, width: `${focus.w * 100}%`, height: `${focus.h * 100}%`,
              border: `${4 / scale}px solid ${C.gold}`, borderRadius: 12 / scale, boxShadow: `0 0 ${30 / scale}px rgba(232,185,74,.55)`, opacity: ring }} />
          )}
        </div>
      </div>
      {caption && <div style={{ fontFamily: F.text, fontWeight: 500, fontSize: 46, lineHeight: 1.25, color: C.fg, textAlign: 'center' }}><Rich text={caption} /></div>}
    </div>
  )
}
