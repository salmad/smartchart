import { interpolate } from 'remotion'
import { Rich } from '../Rich'
import { useEnter, useSeconds, rise } from '../motion'
import { C, F } from '../theme'

type Side = { label: string; text: string }

const Card = ({ side, good, p }: { side: Side; good: boolean; p: number }) => (
  <div style={{ background: C.surface, border: `3px solid ${good ? C.gold : C.line}`, borderRadius: 28, padding: '36px 44px 44px', ...rise(p) }}>
    <div style={{ fontFamily: F.mono, fontSize: 28, letterSpacing: '0.14em', textTransform: 'uppercase', color: good ? C.gold : C.muted, marginBottom: 20 }}>{side.label}</div>
    <div style={{ fontFamily: F.text, fontWeight: good ? 600 : 500, fontSize: 58, lineHeight: 1.22, textWrap: 'balance', color: good ? C.fg : C.fg2 }}><Rich text={side.text} /></div>
  </div>
)

/** The old way, struck through as the better way lands under it. */
export const Compare = ({ before, after, cues }: { before: Side; after: Side; cues: number[] }) => {
  const s = useSeconds(), a = useEnter(cues[0] ?? 0), b = useEnter(cues[1] ?? 1.2)
  const strike = interpolate(s, [(cues[1] ?? 1.2) - 0.1, (cues[1] ?? 1.2) + 0.3], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>
      <div style={{ position: 'relative', opacity: 1 - strike * 0.45 }}>
        <Card side={before} good={false} p={a} />
        <div style={{ position: 'absolute', left: 36, right: 36, top: '58%', height: 6, borderRadius: 3, background: C.neg, transformOrigin: '0 50%', transform: `scaleX(${strike})` }} />
      </div>
      <Card side={after} good p={b} />
    </div>
  )
}
