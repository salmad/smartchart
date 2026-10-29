import type { ReactNode } from 'react'
import { Rich } from '../Rich'
import { useEnter, useSeconds, rise } from '../motion'
import { C, F } from '../theme'

const kicker = { fontFamily: F.mono, fontSize: 30, letterSpacing: '0.14em', textTransform: 'uppercase' as const, color: C.gold, marginBottom: 56 }
const itemText = { fontFamily: F.text, fontWeight: 600, fontSize: 60, lineHeight: 1.18, color: C.fg, letterSpacing: '-0.01em' }

const Badge = ({ n }: { n: number }) => (
  <div style={{ flex: 'none', width: 72, height: 72, borderRadius: 18, background: C.gold, color: C.bg, fontFamily: F.mono, fontWeight: 600, fontSize: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{n}</div>
)

const Check = () => (
  <svg width="72" height="72" viewBox="0 0 72 72" style={{ flex: 'none' }}>
    <circle cx="36" cy="36" r="34" fill="none" stroke={C.gold} strokeWidth="4" />
    <path d="M22 37 l9 9 l19 -20" fill="none" stroke={C.gold} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const Row = ({ text, at, mark, dimAfter }: { text: string; at: number; mark: ReactNode; dimAfter?: number }) => {
  const p = useEnter(at), s = useSeconds()
  const dim = dimAfter !== undefined && s >= dimAfter ? 0.42 : 1
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 36, opacity: p * dim, transform: `translateX(${(1 - p) * 60}px)` }}>
      {mark}
      <div style={itemText}><Rich text={text} /></div>
    </div>
  )
}

/** Numbered beats; the newest is bright, the earlier ones step back. */
export const List = ({ title, items, cues }: { title?: string; items: string[]; cues: number[] }) => (
  <div>
    {title && <div style={kicker}><Rich text={title} /></div>}
    <div style={{ display: 'flex', flexDirection: 'column', gap: 52 }}>
      {items.map((it, i) => <Row key={i} text={it} at={cues[i]} mark={<Badge n={i + 1} />} dimAfter={cues[i + 1]} />)}
    </div>
  </div>
)

/** The close: every point checked off, then the line that loops back to the hook. */
export const Recap = ({ title, items, loop, cues, dur }: { title?: string; items: string[]; loop?: string; cues: number[]; dur: number }) => {
  const loopAt = loop ? Math.max((cues[cues.length - 1] ?? 0) + 0.8, dur * 0.7) : dur
  const p = useEnter(Math.min(loopAt, dur - 0.6))
  return (
    <div>
      <div style={kicker}>{title ? <Rich text={title} /> : 'Recap'}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 44 }}>
        {items.map((it, i) => <Row key={i} text={it} at={cues[i]} mark={<Check />} />)}
      </div>
      {loop && (
        <div style={{ marginTop: 84, fontFamily: F.display, fontStretch: '78%', fontWeight: 560, fontSize: 84, lineHeight: 1.04, color: C.fg, textWrap: 'balance', ...rise(p) }}>
          <Rich text={loop} />
        </div>
      )}
    </div>
  )
}
