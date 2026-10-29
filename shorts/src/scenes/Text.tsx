import { interpolate } from 'remotion'
import { Rich } from '../Rich'
import { useEnter, useSeconds, rise } from '../motion'
import { C, F } from '../theme'

const sizeFor = (text: string, big: number) => {
  const n = text.replace(/\*/g, '').length
  return n <= 22 ? big : n <= 42 ? big * 0.82 : n <= 70 ? big * 0.68 : big * 0.56
}

const display = { fontFamily: F.display, fontStretch: '78%', fontWeight: 560, lineHeight: 1.02, letterSpacing: '-0.01em', color: C.fg, textAlign: 'center' as const, textWrap: 'balance' as const, whiteSpace: 'pre-line' as const }

/** The scroll-stopper. Fully visible on frame 0: the first frame is what the feed shows. */
export const Hook = ({ text, kicker, dur }: { text: string; kicker?: string; dur: number }) => {
  const s = useSeconds()
  const bar = interpolate(s, [0.1, 0.7], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 44 }}>
      {kicker && <div style={{ fontFamily: F.mono, fontSize: 30, letterSpacing: '0.14em', textTransform: 'uppercase', color: C.gold }}>{kicker}</div>}
      <div style={{ ...display, fontSize: sizeFor(text, 150), transform: `scale(${interpolate(s, [0, dur], [1, 1.04])})` }}>
        <Rich text={text} />
      </div>
      <div style={{ width: 220, height: 6, borderRadius: 3, background: C.gold, transform: `scaleX(${bar})` }} />
    </div>
  )
}

export const Statement = ({ text }: { text: string }) => {
  const p = useEnter(0)
  return <div style={{ ...display, fontSize: sizeFor(text, 116), ...rise(p) }}><Rich text={text} /></div>
}
