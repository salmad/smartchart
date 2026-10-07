/* Rehearse, under the storyline: the room's questions slide by slide, with the answer to give. An answer the maker
   likes goes into that slide's speaker notes (the presenter view shows them); a question the deck cannot answer can
   become a backup slide, asked of the agent. */
import { useEffect, useState } from 'react'
import { Check, MessageCircleQuestion } from 'lucide-react'
import { asTalk, rehearse, type SlideQuestions } from '@/engine/agent/rehearse'
import type { Slide, Style } from '@/engine/types'
import { cn } from '@/app/lib/utils'
import { Button } from './ui/button'

type Result = { state: 'idle' } | { state: 'running' } | { state: 'done'; slides: SlideQuestions[] } | { state: 'failed' }
/** Kept for the session per version of the deck, so the view can close and open again without asking twice. */
const kept = new Map<string, SlideQuestions[]>()

interface Props {
  slides: { id: string; slide: Slide }[]; deckStyle: Style; storyKey: string
  live: boolean; busy: boolean
  onOpen: (page: number) => void; onAsk: (prompt: string) => void; onTalk: (id: string, talk: string) => void
}

export function Rehearse({ slides, deckStyle: style, storyKey, live, busy, onOpen, onAsk, onTalk }: Props) {
  const [result, setResult] = useState<Result>(() => { const had = kept.get(storyKey); return had ? { state: 'done', slides: had } : { state: 'idle' } })
  // The deck's story changed (a title, a slide): its questions are asked again, not shown stale.
  useEffect(() => { const had = kept.get(storyKey); setResult(had ? { state: 'done', slides: had } : { state: 'idle' }) }, [storyKey])
  const run = () => {
    setResult({ state: 'running' })
    rehearse(slides, style).then((r) => { kept.set(storyKey, r); setResult({ state: 'done', slides: r }) }, () => setResult({ state: 'failed' }))
  }
  const talkOf = (id: string) => slides.find((s) => s.id === id)?.slide.talk ?? ''
  const room = style === 'pitch' ? 'investors' : 'the board'

  return (
    <section aria-label="Rehearse" className="mt-5 grid gap-3 border-t border-line pt-4">
      <header className="flex items-baseline gap-3">
        <h3 className="text-[13px] font-medium text-ink">Rehearse</h3>
        <p className="text-[12.5px] text-ink-3">The questions {room} will ask, slide by slide, with the answer to give.</p>
      </header>
      {!live ? <p className="text-[13px] text-ink-3">Rehearsing needs the models; they are not reachable right now.</p>
        : result.state === 'idle' || result.state === 'failed' ? (
          <div className="flex items-center gap-3">
            <Button variant="outline" disabled={busy || slides.length < 2} onClick={run}><MessageCircleQuestion className="size-3.5" />Ask me {room === 'investors' ? 'investors’' : 'the board’s'} questions</Button>
            {result.state === 'failed' && <span className="text-[12.5px] text-ink-2">That didn’t work. Try again.</span>}
          </div>
        )
        : result.state === 'running' ? <p role="status" className="flex items-center gap-2 text-[13px] text-ink-2"><i className="spinner" />Reading the deck as {room}; about half a minute…</p>
        : !result.slides.length ? <p className="text-[13px] text-ink-3">No hard questions came up. Ask again once the deck has more to argue.</p>
        : (
          <ol className="grid gap-4">
            {result.slides.map((s) => (
              <li key={s.id} className="grid gap-2">
                <button type="button" onClick={() => onOpen(s.page - 1)} className="grid grid-cols-[28px_1fr] items-baseline gap-2 text-left">
                  <span className="font-mono text-[11px] font-medium text-ink-3">{String(s.page).padStart(2, '0')}</span>
                  <span className="truncate text-[12.5px] text-ink-3 hover:text-ink-2">{s.title}</span>
                </button>
                <ul className="grid gap-2 pl-[36px]">
                  {s.questions.map((x, i) => {
                    const line = asTalk(x), noted = talkOf(s.id).includes(line)
                    return (
                      <li key={i} className="grid gap-1.5 rounded-lg border border-line bg-panel px-3 py-2.5">
                        <p className="text-[13.5px] font-medium leading-[1.4] text-ink">“{x.q}”</p>
                        <p className={cn('text-[13px] leading-[1.45]', x.gap ? 'text-warn' : 'text-ink-2')}>{x.gap ? 'Not in the deck: ' : ''}{x.answer}</p>
                        <div className="flex gap-2 pt-0.5">
                          {!x.gap && (noted
                            ? <span className="flex items-center gap-1 text-[12px] text-ink-3"><Check className="size-3.5" />In your speaker notes</span>
                            : <Button variant="ghost" size="sm" onClick={() => onTalk(s.id, [talkOf(s.id), line].filter(Boolean).join('\n'))}>Add the answer to my notes</Button>)}
                          {x.gap && <Button variant="ghost" size="sm" disabled={busy} onClick={() => onAsk(`Add a backup slide after slide ${s.page} that answers the question the room will ask: "${x.q}". Use only figures I give you; ask me for the ones you need.`)}>Ask for a backup slide</Button>}
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </li>
            ))}
            <li><Button variant="ghost" size="sm" disabled={busy} onClick={run}>Ask again</Button></li>
          </ol>
        )}
    </section>
  )
}
