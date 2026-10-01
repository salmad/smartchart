import { useEffect, useState, type ReactNode } from 'react'
import type { Pill } from '@/engine/agent/suggest'
import type { Deck, Slide, Style, Theme } from '@/engine/types'
import { locked, type AppState } from '@/app/state'
import type { Measurer } from '@/app/measure'
import { EditMode } from '@/app/edit/EditMode'
import type { Attached } from '@/app/files'
import { deckName } from '@/app/store'
import { cn } from '@/app/lib/utils'
import { phaseLinesOf } from '@/app/phase'
import { Bar, type BarProps, type DeckView } from './Bar'
import { Chat } from './Chat'
import { Checks } from './Checks'
import { Composer } from './Composer'
import { LookPanel } from './LookPanel'
import { SLIDE_W, Stage } from './Stage'
import { Storyline } from './Storyline'
import { Strip } from './Strip'

export interface EditorProps {
  state: AppState; booted: boolean; deck: Deck; chips: Pill[] | null
  bar: Omit<BarProps, 'title' | 'hasSlides' | 'busy' | 'live' | 'view' | 'onView' | 'onLook'> & {
    onStyle: (s: Style) => void; onTheme: (t: Theme) => void; onAccent: (hex: string | null) => void; onAdd: () => void
  }
  onSend: (text: string, files?: Attached[]) => void; onClear: () => void; onSelect: (index: number) => void
  onMove: (id: string, to: number) => void; onRemove: (id: string) => void; onRestore: () => void
  /** Replaces the slide, checks and strip: the starter picker (a new deck, or Add slide). */
  stage?: ReactNode
  /** Your decks, down the left; null while hidden. */
  decks: ReactNode
  edit: { measurer: () => Measurer; save: (id: string, draft: Slide) => Promise<string | null> }
  onEdit: (id: string | null) => void
}

/** The editor screen: the bar, the chat, and the deck in one of three views (one slide, every slide, the storyline),
    with the deck's look as an inspector on the right while it is open. */
export function Editor({ state: s, booted, deck, chips, bar, onSend, onClear, onSelect, onMove, onRemove, onRestore, stage, decks, edit, onEdit }: EditorProps) {
  const { items, current } = s
  const lock = locked(s), editing = s.editing !== null && items[current]?.id === s.editing
  const [view, setView] = useState<DeckView>('slide')
  const [look, setLook] = useState(false)
  // The view switch only applies when the stage shows the deck.
  const shown = items.length && !stage && !editing ? view : null
  const open = (i: number) => { onSelect(i); setView('slide') }

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

  const strip = (layout: 'row' | 'grid') => (
    <Strip items={items} current={current} deck={deck} busy={lock} onSelect={onSelect} onAdd={bar.onAdd} layout={layout}
      onOpen={layout === 'grid' ? open : undefined} onMove={onMove} onRemove={onRemove} removed={s.removed?.item ?? null} onRestore={onRestore} />
  )

  return (
    <>
      <Bar {...bar} title={deckName({ name: s.name, items })} hasSlides={items.length > 0} busy={lock} live={s.live}
        view={shown || null} onView={setView} onLook={() => setLook(true)} />
      <div className="flex h-[calc(100%-56px)] max-[900px]:h-auto max-[900px]:flex-col">
        {decks}
        {/* Hidden, not unmounted: a half-written message survives. On a phone the chat always shows, under the deck. */}
        <aside aria-label="Chat" className={cn('flex w-[400px] min-h-0 flex-none flex-col border-r border-line bg-panel max-[900px]:order-3 max-[900px]:w-auto max-[900px]:border-r-0 max-[900px]:border-t max-[900px]:bg-transparent', !bar.chatOpen && 'min-[901px]:hidden')}>
          <Chat messages={s.messages} offline={booted && !s.live} />
          <Composer chips={chips} canSend={s.live && !lock} busy={s.busy} hint={s.editing ? 'Save or discard to keep chatting' : undefined} onSend={onSend} onClear={onClear}
            start={items.length ? undefined : { style: s.style, onStyle: bar.onStyle }} />
        </aside>
        {stage
          ? <main className="grid min-h-0 min-w-0 flex-1 max-[900px]:contents">{stage}</main>
          : editing
          ? <main className="flex min-h-0 min-w-0 flex-1 flex-col justify-center max-[900px]:contents">
              <EditMode key={items[current].id} item={items[current]} index={current} deck={deck} deckStyle={s.style} measurer={edit.measurer} save={edit.save} onDone={() => onEdit(null)} />
            </main>
          : shown === 'grid'
          ? <main className="min-h-0 min-w-0 flex-1 overflow-y-auto px-8 py-8 max-[900px]:contents">{strip('grid')}</main>
          : shown === 'story'
          ? <main className="grid min-h-0 min-w-0 flex-1 max-[900px]:contents">
              <Storyline items={items} deckStyle={s.style} live={s.live} busy={lock} onOpen={open}
                onMove={(id, to) => { onMove(id, to); onSelect(to) }} onAsk={(prompt) => onSend(prompt)} />
            </main>
          : <main className="flex min-h-0 min-w-0 flex-1 flex-col justify-center max-[900px]:contents">
              <Stage deck={deck} current={current} onEdit={() => items[current] && onEdit(items[current].id)} slideId={items[current]?.id} phase={s.busy ? phaseLinesOf(s.messages.at(-1)?.trace) : null} onPresent={bar.onPresent} />
              {/* Under the slide and as wide as it: how its checks stand, then the deck as a filmstrip. */}
              <section className={`mx-auto flex min-w-0 max-w-[calc(100%-4rem)] flex-col gap-2 pb-5 max-[900px]:contents ${SLIDE_W}`}>
                <div className="flex h-7 items-center max-[900px]:order-4 max-[900px]:px-4"><Checks item={items[current]} /></div>
                {strip('row')}
              </section>
            </main>}
        {look && <LookPanel deckStyle={s.style} theme={s.theme} accent={s.accent} styleLocked={items.length > 0}
          onStyle={bar.onStyle} onTheme={bar.onTheme} onAccent={bar.onAccent} onClose={() => setLook(false)} />}
      </div>
    </>
  )
}
