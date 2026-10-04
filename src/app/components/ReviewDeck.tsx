/* Review a deck made anywhere: drop a PDF or PPTX, get the red-pen review a partner would give (the storyline, then
   notes per slide), and rebuild it in Occam with every flaw fixed. Only the deck's text goes to the models. */
import { useRef, useState, type DragEvent } from 'react'
import { FileUp, PenLine } from 'lucide-react'
import { deckText, rebuildAsk, reviewDeck, type Page, type Review } from '@/engine/agent/review'
import type { Style } from '@/engine/types'
import type { Attached } from '@/app/files'
import { DECK_ACCEPT, readDeck } from '@/app/deck-file'
import { cn } from '@/app/lib/utils'
import { Seg } from './LookPanel'
import { Button } from './ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from './ui/dialog'

interface Props {
  open: boolean; onOpenChange: (open: boolean) => void
  /** The models are reachable: the review and the rebuild need them. */
  live: boolean
  onRebuild: (brief: string, file: Attached, style: Style) => void
}

type State = { at: 'idle' } | { at: 'reading'; name: string } | { at: 'reviewing'; name: string; pages: Page[] }
  | { at: 'done'; name: string; pages: Page[]; review: Review } | { at: 'failed'; why: string }

export function ReviewDeck({ open, onOpenChange, live, onRebuild }: Props) {
  const [state, setState] = useState<State>({ at: 'idle' }), [style, setStyle] = useState<Style>('consulting'), [over, setOver] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  const take = async (file: File | undefined) => {
    if (!file) return
    setState({ at: 'reading', name: file.name })
    try {
      const pages = await readDeck(file)
      setState({ at: 'reviewing', name: file.name, pages })
      setState({ at: 'done', name: file.name, pages, review: await reviewDeck(pages, style) })
    } catch (e) { setState({ at: 'failed', why: e instanceof Error ? e.message : 'The review failed. Try again.' }) }
  }
  const drop = (e: DragEvent) => { e.preventDefault(); setOver(false); void take(e.dataTransfer.files[0]) }
  const rebuild = () => {
    if (state.at !== 'done') return
    onRebuild(rebuildAsk(style), { name: state.name, text: deckText(state.pages, state.review), about: `${state.pages.length} slides, reviewed`, cut: false }, style)
    onOpenChange(false); setState({ at: 'idle' })
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setState({ at: 'idle' }) }}>
      <DialogContent className="flex max-h-[min(760px,90vh)] max-w-[640px] flex-col gap-0 overflow-hidden rounded-[14px] border-line-2 bg-raise p-0 text-ink">
        <div className="grid gap-2 p-6 pb-4">
          <DialogTitle className="flex items-center gap-2 text-[16px] font-semibold tracking-[-.01em]"><PenLine className="size-4 text-ink-2" strokeWidth={1.75} />Red-pen review</DialogTitle>
          <DialogDescription className="text-[13.5px] leading-[1.5] text-ink-2">Drop in a deck made anywhere and get the review a partner would give: does the story hold, does each title make a point. Then rebuild it in Occam with every flaw fixed.</DialogDescription>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">
          {(state.at === 'idle' || state.at === 'failed') && (
            <div className="grid gap-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[13px] text-ink-2">Review it as</span>
                <Seg label="Deck style" value={style} onChange={setStyle} options={[['consulting', 'Consulting'], ['pitch', 'Pitch']]} className="flex rounded-[9px] border border-line bg-panel p-[3px]" />
              </div>
              <button type="button" onClick={() => input.current?.click()} onDragOver={(e) => { e.preventDefault(); setOver(true) }} onDragLeave={() => setOver(false)} onDrop={drop} disabled={!live}
                className={cn('grid cursor-pointer place-items-center gap-2 rounded-xl border border-dashed border-line-2 px-6 py-10 text-center transition-colors hover:border-ink-3 disabled:cursor-not-allowed disabled:opacity-45', over && 'border-ink bg-panel')}>
                <FileUp className="size-6 text-ink-3" strokeWidth={1.5} />
                <span className="text-[14px] font-medium">Drop a PowerPoint or PDF</span>
                <span className="text-[12.5px] text-ink-3">{live ? 'From Google Slides or Keynote, export a PDF first.' : 'The models are not reachable right now.'}</span>
              </button>
              <input ref={input} type="file" accept={DECK_ACCEPT} aria-label="Deck file" className="hidden" onChange={(e) => { void take(e.target.files?.[0]); e.target.value = '' }} />
              {state.at === 'failed' && <p role="alert" className="text-[13px] text-ink-2">{state.why}</p>}
            </div>
          )}
          {(state.at === 'reading' || state.at === 'reviewing') && (
            <p role="status" className="flex items-center gap-2.5 py-8 text-[13.5px] text-ink-2"><i className="spinner" />
              {state.at === 'reading' ? `Reading ${state.name}…` : `Reviewing ${state.pages.length} slides like a partner would…`}</p>
          )}
          {state.at === 'done' && <Report review={state.review} />}
        </div>
        {state.at === 'done' && (
          <div className="flex items-center justify-between gap-3 border-t border-line px-6 py-4">
            <Button variant="outline" onClick={() => setState({ at: 'idle' })}>Review another</Button>
            <Button onClick={rebuild} disabled={!live}>Rebuild in Occam</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function Report({ review }: { review: Review }) {
  const failed = review.deck.filter((c) => !c.ok), passed = review.deck.filter((c) => c.ok)
  return (
    <div className="grid gap-5" aria-label="Review">
      <p className="text-[15px] font-medium tracking-[-.01em]">{review.verdict}</p>
      {review.deck.length > 0 && (
        <section className="grid gap-1.5">
          <h3 className="font-mono text-[11px] font-medium uppercase leading-none tracking-[.08em] text-ink-3">The storyline</h3>
          <ul className="grid gap-1">
            {failed.map((c) => <li key={c.id} className="grid grid-cols-[14px_1fr] gap-2 text-[13px] text-ink"><span aria-hidden className="font-semibold text-bad">✕</span>{c.msg}</li>)}
            {passed.map((c) => <li key={c.id} className="grid grid-cols-[14px_1fr] gap-2 text-[13px] text-ink-2"><span aria-hidden className="font-semibold text-ok">✓</span>{c.msg}</li>)}
          </ul>
        </section>
      )}
      <section className="grid gap-1.5">
        <h3 className="font-mono text-[11px] font-medium uppercase leading-none tracking-[.08em] text-ink-3">Slide by slide</h3>
        <ol className="grid gap-2">
          {review.pages.map((p) => (
            <li key={p.page} className="grid grid-cols-[24px_1fr] gap-x-3 gap-y-1 rounded-lg border border-line bg-panel px-3 py-2.5">
              <span className="pt-px font-mono text-[11px] font-medium text-ink-3">{String(p.page).padStart(2, '0')}</span>
              <span className={cn('text-[13px]', p.title ? 'text-ink' : 'italic text-ink-3')}>{p.title || 'No title'}</span>
              {p.notes.length ? p.notes.map((n, k) => <span key={k} className="col-start-2 text-[12.5px] text-bad">{n}</span>)
                : <span className="col-start-2 text-[12.5px] text-ink-3">No notes.</span>}
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}
