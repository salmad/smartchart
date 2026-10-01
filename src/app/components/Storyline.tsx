/* The storyline view: the deck as the room skims it (titles only, in order), and the deck checks a partner makes of it.
   A failed check offers its fix: code moves a slide; anything to rewrite goes to the agent as a prompt. */
import { useEffect, useState } from 'react'
import { storyChecks, storyKey, storyline, type StoryCheck, type StoryFix } from '@/engine/agent/story'
import type { Style } from '@/engine/types'
import type { Item } from '@/app/store'
import { cn } from '@/app/lib/utils'
import { Button } from './ui/button'

interface Props {
  items: Item[]; deckStyle: Style
  /** The models are reachable: the checks need Jev. A turn running: fixes wait for it. */
  live: boolean; busy: boolean
  /** A title's click: that slide, in the Slide view. */
  onOpen: (index: number) => void; onMove: (id: string, to: number) => void; onAsk: (prompt: string) => void
}

type Result = { state: 'checking' } | { state: 'done'; checks: StoryCheck[] } | { state: 'failed' }

/** Checks per storyline, kept for the session: reopening an unchanged deck shows them at once. A read still running
    is shared, so mounting the view twice (React's dev double mount) asks once. */
const seen = new Map<string, StoryCheck[]>()
const reading = new Map<string, Promise<StoryCheck[]>>()

export function Storyline({ items, deckStyle: style, live, busy, onOpen, onMove, onAsk }: Props) {
  const slides = items.map(({ id, slide }) => ({ id, slide })), key = storyKey(slides, style)
  const lines = storyline(slides, style)
  const [result, setResult] = useState<Result>({ state: 'checking' })

  useEffect(() => {
    if (!live) return
    const had = seen.get(key)
    if (had) { setResult({ state: 'done', checks: had }); return }
    let current = true
    setResult({ state: 'checking' })
    let read = reading.get(key)
    if (!read) {
      read = storyChecks(slides, style).then(({ checks }) => { seen.set(key, checks); return checks }).finally(() => reading.delete(key))
      reading.set(key, read)
    }
    read.then(
      (checks) => { if (current) setResult({ state: 'done', checks }) },
      () => { if (current) setResult({ state: 'failed' }) })
    return () => { current = false }
    // The key stands for the slides and style.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, key])

  const checks = result.state === 'done' ? result.checks : []
  const flagged = new Map(checks.filter((c) => !c.ok && c.slideId).map((c) => [c.slideId, c.msg]))
  const todo = checks.filter((c) => !c.ok), passed = checks.filter((c) => c.ok)
  const fix = (f: StoryFix) => { if (f.kind === 'move') onMove(f.id, f.to); else onAsk(f.prompt) }

  return (
    <section aria-labelledby="storyline-title" className="min-h-0 overflow-y-auto px-8 py-8 max-[900px]:px-4">
      <div className="mx-auto max-w-[680px]">
        <header className="grid gap-1 pb-5">
          <h2 id="storyline-title" className="text-[16px] font-semibold tracking-[-.01em] text-ink">The storyline</h2>
          <p className="text-[13px] text-ink-3">The deck as the room skims it: {style === 'pitch' ? 'each slide’s claim' : 'the titles alone'}, in order.</p>
        </header>
        <div>
          <ol aria-label="Storyline" className="grid gap-0.5">
            {lines.map((l, i) => l.kind === 'content' ? (
              <li key={l.id}>
                <button type="button" onClick={() => onOpen(i)}
                  className="-mx-2 grid w-[calc(100%+1rem)] cursor-pointer grid-cols-[28px_1fr] items-baseline gap-2 rounded-lg px-2 py-2 text-left transition-colors hover:bg-panel">
                  <span className="font-mono text-[11px] font-medium text-ink-3">{String(l.page).padStart(2, '0')}</span>
                  <span className="grid gap-0.5">
                    <span className="text-[14px] leading-[1.4] text-ink">{l.claim ?? l.title}</span>
                    {l.claim && <span className="font-mono text-[11px] uppercase tracking-[.08em] text-ink-3">{l.title}</span>}
                    {flagged.has(l.id) && <span className="text-[12.5px] text-warn">{flagged.get(l.id)}</span>}
                  </span>
                </button>
              </li>
            ) : (
              <li key={l.id} className={cn('grid grid-cols-[28px_1fr] gap-2 px-0 pb-1 font-mono text-[11px] font-medium uppercase tracking-[.1em] text-ink-3', i > 0 && 'pt-3')}>
                <span>{String(l.page).padStart(2, '0')}</span><span className="truncate">{l.kind === 'cover' ? l.title : `Section · ${l.title}`}</span>
              </li>
            ))}
          </ol>

          <section aria-label="Deck checks" className="mt-5 grid gap-2 border-t border-line pt-4">
            {!live ? <p className="text-[13px] text-ink-3">The deck checks run when the models are reachable.</p>
              : result.state === 'checking' ? <p role="status" className="flex items-center gap-2 text-[13px] text-ink-2"><i className="spinner" />Reading the story like a partner…</p>
              : result.state === 'failed' ? <p className="text-[13px] text-ink-2">The deck checks couldn’t run. Open the storyline again to retry.</p>
              : !checks.length ? <p className="text-[13px] text-ink-3">Deck checks start at two content slides.</p>
              : <>
                  <h3 className="text-[13px] font-medium text-ink">{todo.length ? `${todo.length} to look at` : 'The story holds'}</h3>
                  <ul className="grid gap-2">
                    {[...todo, ...passed].map((c) => (
                      <li key={c.id} className={cn('grid grid-cols-[14px_1fr_auto] items-baseline gap-2 text-[13px]', c.ok ? 'text-ink-2' : 'text-ink')}>
                        <span aria-hidden className={cn('font-semibold', c.ok ? 'text-ok' : 'text-warn')}>{c.ok ? '✓' : '!'}</span>
                        <span>{c.msg}</span>
                        {!c.ok && c.fix && <Button variant="outline" size="sm" disabled={busy} onClick={() => c.fix && fix(c.fix)}>{c.fix.label}</Button>}
                      </li>
                    ))}
                  </ul>
                </>}
          </section>
        </div>
      </div>
    </section>
  )
}
