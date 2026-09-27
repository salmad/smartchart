import { useEffect, type ReactNode } from 'react'
import type { Pill } from '@/engine/agent/suggest'
import type { Deck } from '@/engine/types'
import type { AppState } from '@/app/state'
import { Bar, type BarProps } from './Bar'
import { Chat } from './Chat'
import { Checks } from './Checks'
import { Composer } from './Composer'
import { Stage } from './Stage'
import { Strip } from './Strip'

export interface EditorProps {
  state: AppState; booted: boolean; deck: Deck; chips: Pill[] | 'pending' | null
  bar: Omit<BarProps, 'deckStyle' | 'theme' | 'accent' | 'hasSlides' | 'busy' | 'live' | 'deckId' | 'canAdd'>
  onSend: (text: string) => void; onClear: () => void; onSelect: (index: number) => void
  /** Replaces the slide, checks and strip: the landing gallery or Add slide. */
  stage?: ReactNode
}

/** The editor screen: bar, chat, the current slide, its checks and the deck strip. */
export function Editor({ state: s, booted, deck, chips, bar, onSend, onClear, onSelect, stage }: EditorProps) {
  const { items, current } = s

  // F presents; the arrows move through the deck. Typing in a field is left alone.
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (stage || e.metaKey || e.ctrlKey || e.altKey || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) return
      if (e.key === 'f') bar.onPresent()
      if (e.key === 'ArrowRight' && current < items.length - 1) onSelect(current + 1)
      if (e.key === 'ArrowLeft' && current > 0) onSelect(current - 1)
    }
    document.addEventListener('keydown', key)
    return () => document.removeEventListener('keydown', key)
  }, [bar, current, items.length, onSelect, stage])

  return (
    <>
      <Bar {...bar} canAdd={items.length > 0 && s.view === 'editor'} deckStyle={s.style} theme={s.theme} accent={s.accent} hasSlides={items.length > 0} busy={s.busy} live={s.live} deckId={s.deckId} />
      <div className="grid h-[calc(100%-56px)] grid-cols-[400px_1fr] max-[900px]:flex max-[900px]:h-auto max-[900px]:flex-col">
        <aside className="flex min-h-0 flex-col border-r border-line bg-panel max-[900px]:order-3 max-[900px]:border-r-0 max-[900px]:border-t max-[900px]:bg-transparent">
          <Chat messages={s.messages} legacyThread={s.legacyThread} offline={booted && !s.live} />
          <Composer chips={chips} canSend={s.live && !s.busy} busy={s.busy} onSend={onSend} onClear={onClear} />
        </aside>
        {stage
          ? <main className="grid min-h-0 min-w-0 max-[900px]:contents">{stage}</main>
          : <main className="grid min-h-0 min-w-0 grid-rows-[1fr_auto] max-[900px]:contents">
              <Stage deck={deck} current={current} busy={s.busy} onPresent={bar.onPresent} />
              <section className="grid h-[250px] grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] gap-6 px-8 pb-5 max-[900px]:contents">
                <Checks item={items[current]} />
                <Strip items={items} current={current} deck={deck} onSelect={onSelect} onAdd={bar.onAdd} busy={s.busy} />
              </section>
            </main>}
      </div>
    </>
  )
}
