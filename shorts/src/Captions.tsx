import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion'
import { C, F, SAFE } from './theme'
import type { Word } from './types'

type Page = { words: Word[]; start: number; end: number }

/** Up to three words a page; a sentence end always closes the page. */
function pages(words: Word[]): Page[] {
  const out: Page[] = []
  let cur: Word[] = []
  const flush = () => { if (cur.length) out.push({ words: cur, start: cur[0].start, end: cur[cur.length - 1].end }); cur = [] }
  for (const w of words) {
    cur.push(w)
    if (cur.length >= 3 || /[.!?,:;]$/.test(w.text)) flush()
  }
  flush()
  return out.map((p, i) => ({ ...p, end: out[i + 1] ? Math.min(out[i + 1].start, p.end + 0.6) : p.end + 0.4 }))
}

/** Word-by-word captions: the spoken word in gold. Most of the feed watches muted. */
export const Captions = ({ words }: { words: Word[] }) => {
  const frame = useCurrentFrame(), { fps } = useVideoConfig(), t = frame / fps
  const page = pages(words).find((p) => t >= p.start && t < p.end)
  if (!page) return null
  const pop = interpolate(t - page.start, [0, 0.12], [0.92, 1], { extrapolateRight: 'clamp' })
  return (
    <div style={{ position: 'absolute', left: SAFE.x, right: SAFE.x, top: SAFE.captions, display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '0 22px',
      fontFamily: F.display, fontStretch: '85%', fontWeight: 650, fontSize: 70, lineHeight: 1.1, textShadow: '0 4px 24px rgba(0,0,0,.6)', transform: `scale(${pop})` }}>
      {page.words.map((w, i) => <span key={i} style={{ color: t >= w.start ? (t < w.end + 0.05 ? C.gold : C.fg) : 'rgba(243,238,228,.45)' }}>{w.text}</span>)}
    </div>
  )
}
