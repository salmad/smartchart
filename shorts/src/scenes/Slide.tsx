import { interpolate } from 'remotion'
import { Rich } from '../Rich'
import { useEnter, useSeconds, rise } from '../motion'
import { C, F } from '../theme'
import type { Bar } from '../types'

// A slide as the viewer knows it: white, a title, a chart. Paper colours from components.css (.theme-paper).
export const P = { bg: '#FFFFFF', fg: '#16140F', fg2: '#453F36', muted: '#776E61', line: '#E0D9CC', neutral: '#CFC6B6', faint: '#ECE7DD', neg: '#D2402C' }

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const
const ramp = (s: number, a: number, b: number) => interpolate(s, [a, b], [0, 1], clamp)

const Tick = ({ size = 52 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 72 72" style={{ flex: 'none' }}>
    <circle cx="36" cy="36" r="34" fill={C.gold} />
    <path d="M22 37 l9 9 l19 -20" fill="none" stroke={C.bg} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

// The default-chart look the turn fixes: every bar its own colour.
const RAINBOW = ['#4E79A7', '#F28E2B', '#E15759', '#76B7B2', '#59A14F', '#EDC948', '#B07AA1']

type Props = { title: string; retitle?: string; bars: Bar[]; focus?: string; unit?: string; label?: string | [string, string]; before?: 'rainbow';
  checks?: { text: string; on: 'title' | 'chart' }[]; cues: number[] }

/** The slide itself; at the turn the retitle strikes the topic title and writes the claim, the bars drop to grey and
 *  the one that proves it lights. */
export const Slide = ({ title, retitle, bars, focus, unit = '', label, before, checks = [], cues }: Props) => {
  const s = useSeconds(), p = useEnter(0)
  // Without a turn the slide is already in its final state: everything is "after".
  const turn = !!retitle || before === 'rainbow'
  const T = turn ? cues[0] : -1
  const strike = ramp(s, T - 0.45, T - 0.15), swap = retitle ? ramp(s, T - 0.1, T + 0.25) : 1, lit = ramp(s, T, T + 0.4)
  const checkAt = checks.map((_, i) => cues[(turn ? 1 : 0) + i] ?? 1e9)
  const ring = (on: 'title' | 'chart') => Math.max(0, ...checks.map((c, i) => (c.on === on ? ramp(s, checkAt[i], checkAt[i] + 0.25) : 0)))
  const max = Math.max(...bars.map((b) => b.value))
  const after = s >= T
  const tag = Array.isArray(label) ? label[after ? 1 : 0] : label ?? (after ? 'Action title' : 'Topic title')
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28, ...rise(p, 50) }}>
      <div style={{ fontFamily: F.mono, fontSize: 28, letterSpacing: '0.14em', textTransform: 'uppercase', color: after ? C.gold : C.muted }}>{tag}</div>
      <div style={{ background: P.bg, borderRadius: 18, padding: '40px 46px 44px', boxShadow: '0 40px 120px rgba(0,0,0,.55)', transform: `scale(${1 + 0.025 * lit})` }}>
        <div style={{ position: 'relative', minHeight: 104, marginBottom: 26 }}>
          <div style={{ position: 'absolute', inset: '-10px -14px', borderRadius: 12, boxShadow: `0 0 0 4px ${C.gold}`, opacity: ring('title') }} />
          {retitle && (
            <div style={{ position: 'absolute', inset: 0, opacity: 1 - swap, transform: `translateY(${-24 * swap}px)` }}>
              <div style={{ position: 'relative', display: 'inline-block', fontFamily: F.text, fontWeight: 650, fontSize: 40, lineHeight: 1.22, color: P.fg2 }}>
                {title}
                <div style={{ position: 'absolute', left: -4, right: -4, top: '54%', height: 5, borderRadius: 3, background: P.neg, transformOrigin: '0 50%', transform: `scaleX(${strike})` }} />
              </div>
            </div>
          )}
          <div style={{ fontFamily: F.text, fontWeight: 650, fontSize: 40, lineHeight: 1.22, color: P.fg, opacity: swap, transform: `translateY(${24 * (1 - swap)}px)`, textWrap: 'balance' }}>
            <Rich text={retitle ?? title} emScale={1.15} onPaper />
          </div>
        </div>
        <div style={{ height: 2, background: P.line, marginBottom: 30 }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          {bars.map((b, i) => {
            const grow = ramp(s, 0.15 + i * 0.08, 0.75 + i * 0.08), isFocus = b.label === focus
            const start = before === 'rainbow' ? RAINBOW[i % RAINBOW.length] : P.neutral
            const fill = `color-mix(in srgb, ${isFocus ? C.gold : P.faint} ${lit * 100}%, ${start})`
            return (
              <div key={b.label} style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 22 }}>
                {isFocus && <div style={{ position: 'absolute', inset: '-8px -12px', borderRadius: 10, boxShadow: `0 0 0 4px ${C.gold}`, opacity: ring('chart') }} />}
                <div style={{ width: 170, flex: 'none', fontFamily: F.text, fontSize: 28, fontWeight: isFocus && lit > 0.5 ? 650 : 500, color: P.fg2 }}>{b.label}</div>
                <div style={{ flex: 1, height: 40, display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ height: '100%', width: `${(b.value / max) * 82 * grow}%`, borderRadius: 4, background: fill }} />
                  <div style={{ fontFamily: F.mono, fontSize: 26, color: P.fg, opacity: ramp(s, 0.6 + i * 0.08, 0.9 + i * 0.08) }}>{b.value}{unit}</div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
      {checks.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22, marginTop: 14 }}>
          {checks.map((c, i) => {
            const q = ramp(s, checkAt[i], checkAt[i] + 0.25)
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 24, opacity: q, transform: `translateX(${(1 - q) * 50}px)` }}>
                <Tick />
                <div style={{ fontFamily: F.text, fontWeight: 600, fontSize: 48, color: C.fg }}><Rich text={c.text} /></div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
