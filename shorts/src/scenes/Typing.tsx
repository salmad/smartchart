import { Rich } from '../Rich'
import { useEnter, useSeconds, rise } from '../motion'
import { C, F } from '../theme'

const CPS = 32
const typed = (text: string, since: number) => text.slice(0, Math.max(0, Math.floor(since * CPS)))
const Caret = ({ on }: { on: boolean }) => <span style={{ display: 'inline-block', width: 4, height: '1em', marginLeft: 4, verticalAlign: '-0.12em', background: C.gold, opacity: on ? 1 : 0 }} />

/** A terminal that types its commands; each step starts at its cue. */
export const Terminal = ({ title, steps, cues }: { title?: string; steps: { cmd?: string; out?: string }[]; cues: number[] }) => {
  const s = useSeconds(), p = useEnter(0)
  const live = cues.filter((c) => c <= s).length - 1
  return (
    <div style={{ background: C.surface, border: `2px solid ${C.line}`, borderRadius: 28, overflow: 'hidden', boxShadow: '0 40px 120px rgba(0,0,0,.55)', ...rise(p) }}>
      <div style={{ height: 72, display: 'flex', alignItems: 'center', gap: 14, padding: '0 28px', borderBottom: `2px solid ${C.line}` }}>
        {[0, 1, 2].map((i) => <div key={i} style={{ width: 18, height: 18, borderRadius: 9, background: C.line }} />)}
        <div style={{ marginLeft: 16, fontFamily: F.mono, fontSize: 24, color: C.muted }}>{title ?? 'terminal'}</div>
      </div>
      <div style={{ padding: '36px 40px 44px', fontFamily: F.mono, fontSize: 38, lineHeight: 1.45, minHeight: 360 }}>
        {steps.map((st, i) => {
          if (i > live) return null
          const since = s - cues[i]
          return (
            <div key={i} style={{ marginBottom: 14 }}>
              {st.cmd && <div style={{ color: C.fg, whiteSpace: 'pre-wrap' }}><span style={{ color: C.gold }}>$ </span>{typed(st.cmd, since)}{i === live && typed(st.cmd, since).length < st.cmd.length && <Caret on />}</div>}
              {st.out && (!st.cmd || since * CPS > st.cmd.length + 6) && <div style={{ color: C.fg2, whiteSpace: 'pre-wrap' }}>{st.out}</div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** A prompt bar that types the request, then the reply lands under it. */
export const Prompt = ({ text, reply, cues }: { text: string; reply?: string; cues: number[] }) => {
  const s = useSeconds(), p = useEnter(0)
  const shown = typed(text, s - 0.25), done = shown.length >= text.length
  const replyAt = cues[1] ?? 0.25 + text.length / CPS + 0.4
  const q = useEnter(Math.max(replyAt, 0.25 + text.length / CPS + 0.2))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 48 }}>
      <div style={{ position: 'relative', background: '#171514', border: '2px solid rgba(255,255,255,.12)', borderRadius: 56, padding: '34px 140px 34px 48px', boxShadow: '0 30px 80px rgba(0,0,0,.5)', fontFamily: F.text, fontSize: 42, lineHeight: 1.35, color: C.fg, minHeight: 112, ...rise(p) }}>
        {shown}<Caret on={!done || Math.floor(s * 2) % 2 === 0} />
        <div style={{ position: 'absolute', right: 22, bottom: 22, width: 72, height: 72, borderRadius: 36, background: done ? C.gold : C.fg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="32" height="32" viewBox="0 0 32 32"><path d="M16 26 V8 M8 15 l8 -8 l8 8" fill="none" stroke={C.bg} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </div>
      </div>
      {reply && (
        <div style={{ background: C.surface, border: `2px solid ${C.line}`, borderRadius: 28, padding: '36px 44px', fontFamily: F.text, fontSize: 44, lineHeight: 1.35, color: C.fg2, ...rise(q) }}>
          <Rich text={reply} />
        </div>
      )}
    </div>
  )
}
