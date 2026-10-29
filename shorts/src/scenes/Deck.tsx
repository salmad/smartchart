import { interpolate } from 'remotion'
import { Rich } from '../Rich'
import { useSeconds } from '../motion'
import { C, F } from '../theme'
import { P } from './Slide'

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const
const ease = (x: number) => 1 - Math.pow(1 - x, 3)
const CARD = 196, GAP = 24

const Card = ({ n, title, bright, current, enter }: { n: number; title: string; bright: number; current: boolean; enter: number }) => (
  <div style={{ position: 'relative', height: CARD, background: P.bg, borderRadius: 16, padding: '26px 36px 0 44px', overflow: 'hidden',
    opacity: enter * (0.5 + 0.5 * bright), transform: `translateY(${(1 - enter) * 40}px) scale(${current ? 1.02 : 1})`,
    boxShadow: current ? `0 0 0 4px ${C.gold}, 0 30px 80px rgba(0,0,0,.5)` : '0 20px 60px rgba(0,0,0,.45)' }}>
    <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 10, background: C.gold, opacity: current ? 1 : 0 }} />
    <div style={{ fontFamily: F.mono, fontSize: 20, color: P.muted, marginBottom: 10 }}>{String(n).padStart(2, '0')}</div>
    <div style={{ fontFamily: F.text, fontWeight: 650, fontSize: 36, lineHeight: 1.2, color: bright > 0.5 ? P.fg : P.neutral, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
      <Rich text={title} onPaper />
    </div>
    <div style={{ position: 'absolute', left: 44, right: 36, bottom: 22, display: 'flex', gap: 14, alignItems: 'flex-end', height: 30, opacity: 0.5 }}>
      {[60, 38, 74, 30, 52].map((h, k) => <div key={k} style={{ width: 56, height: `${h}%`, borderRadius: 3, background: P.faint }} />)}
      <div style={{ flex: 1, height: 8, borderRadius: 4, background: P.faint, alignSelf: 'center' }} />
    </div>
  </div>
)

/** A deck read titles-only. Reading mode: each title lights as the eye moves down, and together they tell the story.
 *  Reorder mode: at the turn the slides move into the new order and the new first slide lights. */
export const Deck = ({ titles, reorder, cues }: { titles: string[]; reorder?: number[]; cues: number[] }) => {
  const s = useSeconds()
  const enter = (i: number) => interpolate(s, [i * 0.07, i * 0.07 + 0.3], [0, 1], clamp)
  if (!reorder) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: GAP }}>
        {titles.map((t, i) => (
          <Card key={i} n={i + 1} title={t} enter={enter(i)} bright={interpolate(s, [cues[i], cues[i] + 0.25], [0, 1], clamp)}
            current={s >= cues[i] && (cues[i + 1] === undefined || s < cues[i + 1])} />
        ))}
      </div>
    )
  }
  const T = cues[0], move = ease(interpolate(s, [T, T + 0.8], [0, 1], clamp)), lead = reorder[0]
  return (
    <div style={{ position: 'relative', height: titles.length * (CARD + GAP) - GAP }}>
      {titles.map((t, i) => {
        const to = reorder.indexOf(i), y = (i + (to - i) * move) * (CARD + GAP)
        return (
          <div key={i} style={{ position: 'absolute', left: 0, right: 0, top: y, zIndex: i === lead ? 2 : 1 }}>
            <Card n={s >= T ? to + 1 : i + 1} title={t} enter={enter(i)} bright={s >= T && i !== lead ? 0.7 : 1} current={s >= T && i === lead} />
          </div>
        )
      })}
    </div>
  )
}
