/* Edit mode: the editable slide where the stage was, the edit bar where the strip and checks were (spec 4). */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { contexts } from '@/engine/slides/render'
import type { Deck, Slide, Style } from '@/engine/types'
import { SLIDE_W, SlideFrame } from '@/app/components/Stage'
import type { Measurer } from '../measure'
import type { Item } from '../store'
import { EditBar } from './EditBar'
import { EditOverlay } from './EditOverlay'
import { EditSurface } from './EditSurface'
import { IconPicker } from './IconPicker'
import { SelectionBar } from './SelectionBar'
import { ChartGrid } from './ChartGrid'
import { useSlideEdit } from './useSlideEdit'

interface Props { item: Item; index: number; deck: Deck; deckStyle: Style; measurer: () => Measurer; save: (id: string, draft: Slide) => Promise<string | null>; onDone: () => void }

export function EditMode({ item, index, deck, deckStyle: style, measurer, save, onDone }: Props) {
  const saveDraft = useCallback((d: Slide) => save(item.id, d), [save, item.id])
  const edit = useSlideEdit({ item, index, deck, style, measurer, save: saveDraft, onDone })
  const [slideEl, setSlideEl] = useState<HTMLElement | null>(null), [grid, setGrid] = useState(false)
  const discard = useCallback(() => { if (!edit.dirty || window.confirm('Discard your changes to this slide?')) edit.discard() }, [edit])

  // ⌘S / ⌘↵ save, Esc discards; leaving the page with changes asks first.
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.isComposing || e.keyCode === 229 || edit.saving) return
      if ((e.metaKey || e.ctrlKey) && (e.key === 's' || e.key === 'Enter')) { e.preventDefault(); void edit.save() }
      else if (e.key === 'Escape' && !grid) { e.preventDefault(); discard() }
    }
    const leave = (e: BeforeUnloadEvent) => { if (edit.dirty) e.preventDefault() }
    document.addEventListener('keydown', key); window.addEventListener('beforeunload', leave)
    return () => { document.removeEventListener('keydown', key); window.removeEventListener('beforeunload', leave) }
  }, [edit, discard, grid])

  const ctx = useMemo(() => contexts({ ...deck, slides: deck.slides.map((s, i) => (i === index ? edit.shown : s)) })[index], [deck, index, edit.shown])
  return (
    <>
      <div className="grid min-h-0 place-items-center px-8 pb-4 pt-7 max-[900px]:order-1 max-[900px]:px-4">
        <SlideFrame>
          <EditSurface edit={edit} deck={deck} ctx={ctx} onSlide={setSlideEl}>
            <EditOverlay edit={edit} slide={slideEl} deckStyle={style} onChart={() => setGrid(true)} />
            <SelectionBar edit={edit} slide={slideEl} />
            <IconPicker edit={edit} slide={slideEl} deckStyle={style} />
            {grid && edit.draft.chart && <ChartGrid edit={edit} slide={slideEl} deckStyle={style} onClose={() => setGrid(false)} />}
          </EditSurface>
        </SlideFrame>
      </div>
      <section className={`mx-auto min-w-0 max-w-[calc(100%-4rem)] pb-5 max-[900px]:order-2 max-[900px]:max-w-full max-[900px]:px-4 ${SLIDE_W}`}>
        <EditBar edit={edit} deckStyle={style} onDiscard={discard} />
      </section>
    </>
  )
}
