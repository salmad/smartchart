import { contexts } from '@/engine/slides/render'
import type { Deck } from '@/engine/types'
import type { Item } from '@/app/store'
import { SlideView } from './SlideView'

interface Props { items: Item[]; current: number; deck: Deck; onSelect: (index: number) => void; onAdd: () => void; busy: boolean }

/** The deck as a row of thumbnails; a click selects the slide. */
export function Strip({ items, current, deck, onSelect, onAdd, busy }: Props) {
  if (!items.length) return null
  const ctx = contexts(deck)
  return (
    <div className="min-w-0 flex-none max-[900px]:order-2 max-[900px]:px-4 max-[900px]:pb-5 max-[900px]:pt-1">
      <h3 className="mb-2.5 font-mono text-[11px] font-medium uppercase leading-none tracking-[.1em] text-ink-3">
        Deck · {items.length} slide{items.length > 1 ? 's' : ''}
      </h3>
      <div className="flex gap-3 overflow-x-auto px-0.5 pb-2 pt-0.5">
        {items.map((it, i) => (
          <button key={it.id} type="button" data-strip-thumb aria-current={i === current} onClick={() => onSelect(i)}
            className="group grid flex-[0_0_176px] cursor-pointer gap-1.5 text-left max-[900px]:basis-36">
            <SlideView slide={it.slide} deck={deck} ctx={ctx[i]}
              className="relative aspect-video w-44 overflow-hidden rounded-md shadow-[0_0_0_1px_theme(colors.line)] group-aria-[current=true]:shadow-[0_0_0_2px_theme(colors.ink)] max-[900px]:w-36" />
            <span className="flex gap-2 font-mono text-[11px] font-medium leading-none text-ink-3">
              <b className="font-medium text-ink-2">{String(i + 1).padStart(2, '0')}</b>
              {it.status === 'draft' && <i className="not-italic text-warn">draft</i>}
            </span>
          </button>
        ))}
        <button type="button" aria-label="Add a slide" onClick={onAdd} disabled={busy}
          className="grid aspect-video w-44 flex-none cursor-pointer place-items-center self-start rounded-md border border-dashed border-line-2 text-[22px] font-light text-ink-3 transition-colors hover:border-ink-3 hover:text-ink disabled:cursor-not-allowed disabled:opacity-45 max-[900px]:w-36">+</button>
      </div>
    </div>
  )
}
