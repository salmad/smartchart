import { useEffect, useState, type ReactNode } from 'react'
import type { Pill } from '@/engine/agent/suggest'
import type { Deck, Slide } from '@/engine/types'
import { locked, type AppState } from '@/app/state'
import type { Measurer } from '@/app/measure'
import { EditMode } from '@/app/edit/EditMode'
import type { Attached } from '@/app/files'
import { deckName } from '@/app/store'
import { cn } from '@/app/lib/utils'
import { phaseLinesOf } from '@/app/phase'
import { Bar, type BarProps } from './Bar'
import { Chat } from './Chat'
import { Checks } from './Checks'
import { Composer } from './Composer'
import { SLIDE_W, Stage } from './Stage'
import { Storyline } from './Storyline'
import { Strip } from './Strip'

export interface EditorProps {
  state: AppState; booted: boolean; deck: Deck; chips: Pill[] | null
  bar: Omit<BarProps, 'deckStyle' | 'theme' | 'accent' | 'hasSlides' | 'busy' | 'live' | 'title' | 'canAdd'>
  onSend: (text: string, files?: Attached[]) => void; onClear: () => void; onSelect: (index: number) => void
  onMove: (id: string, to: number) => void; onRemove: (id: string) => void; onRestore: () => void
  /** Replaces the slide, checks and strip: the starter picker (a new deck, or Add slide). */
  stage?: ReactNode
  /** Your decks, down the left; null while hidden. */
  decks: ReactNode
  edit: { measurer: () => Measurer; save: (id: string, draft: Slide) => Promise<string | null> }
  onEdit: (id: string | null) => void
}

/** The editor screen: bar, chat, the current slide, its checks and the deck strip. */
export function Editor({ state: s, booted, deck, chips, bar, onSend, onClear, onSelect, onMove, onRemove, onRestore, stage, decks, edit, onEdit }: EditorProps) {
  const { items, current } = s
  const lock = locked(s), editing = s.editing !== null && items[current]?.id === s.editing
  const [story, setStory] = useState(false)

  // F presents; the arrows move through the deck. Typing in a field is left alone.
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (stage || s.editing || e.metaKey || e.ctrlKey || e.altKey || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement || (e.target instanceof HTMLElement && e.target.isContentEditable)) return
      if (e.key === 'e' && items[current] && !lock) { e.preventDefault(); onEdit(items[current].id) }
      if (e.key === 'f') bar.onPresent()
      if (e.key === 'ArrowRight' && current < items.length - 1) onSelect(current + 1)
      if (e.key === 'ArrowLeft' && current > 0) onSelect(current - 1)
    }
    document.addEventListener('keydown', key)
    return () => document.removeEventListener('keydown', key)
  }, [bar, current, items, onSelect, onEdit, stage, s.editing, lock])

  return (
    <>
      <Bar {...bar} canAdd={items.length > 0 && s.view === 'editor'} deckStyle={s.style} theme={s.theme} accent={s.accent} hasSlides={items.length > 0} busy={lock} live={s.live} title={deckName({ items })} />
      <div className={cn('grid h-[calc(100%-56px)] max-[900px]:flex max-[900px]:h-auto max-[900px]:flex-col',
        decks ? 'grid-cols-[248px_400px_1fr]' : 'grid-cols-[400px_1fr]')}>
        {decks}
        <aside className="flex min-h-0 flex-col border-r border-line bg-panel max-[900px]:order-3 max-[900px]:border-r-0 max-[900px]:border-t max-[900px]:bg-transparent">
          <Chat messages={s.messages} offline={booted && !s.live} />
          <Composer chips={chips} canSend={s.live && !lock} busy={s.busy} hint={s.editing ? 'Save or discard to keep chatting' : undefined} onSend={onSend} onClear={onClear}
            start={items.length ? undefined : { style: s.style, onStyle: bar.onStyle }} />
        </aside>
        {stage
          ? <main className="grid min-h-0 min-w-0 max-[900px]:contents">{stage}</main>
          : editing
          ? <main className="flex min-h-0 min-w-0 flex-col justify-center max-[900px]:contents">
              <EditMode key={items[current].id} item={items[current]} index={current} deck={deck} deckStyle={s.style} measurer={edit.measurer} save={edit.save} onDone={() => onEdit(null)} />
            </main>
          : <main className="flex min-h-0 min-w-0 flex-col justify-center max-[900px]:contents">
              <Stage deck={deck} current={current} onEdit={() => items[current] && onEdit(items[current].id)} slideId={items[current]?.id} phase={s.busy ? phaseLinesOf(s.messages.at(-1)?.trace) : null} onPresent={bar.onPresent} />
              {/* Under the slide and as wide as it: the deck, then the current slide's checks. */}
              <section className={`mx-auto flex max-h-[250px] min-w-0 max-w-[calc(100%-4rem)] flex-col gap-4 pb-5 max-[900px]:contents ${SLIDE_W}`}>
                <Strip items={items} current={current} deck={deck} busy={lock} onSelect={onSelect} onAdd={bar.onAdd}
                  onMove={onMove} onRemove={onRemove} removed={s.removed?.item ?? null} onRestore={onRestore} onStory={() => setStory(true)} />
                <Checks item={items[current]} />
              </section>
            </main>}
      </div>
      <Storyline open={story} onOpenChange={setStory} items={items} deckStyle={s.style} live={s.live} busy={lock}
        onSelect={onSelect} onMove={(id, to) => { onMove(id, to); onSelect(to) }} onAsk={(prompt) => onSend(prompt)} />
    </>
  )
}
