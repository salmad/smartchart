/* Edit mode: the editable slide where the stage was, the edit bar where the strip and checks were (spec 4). */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { contexts } from '@/engine/slides/render'
import type { Deck, Slide, Style } from '@/engine/types'
import { SLIDE_W, SlideFrame, UNDER_SLIDE } from '@/app/components/Stage'
import type { Measurer } from '../measure'
import type { Item } from '../store'
import { EditBar } from './EditBar'
import { EditTalk } from './EditTalk'
import { EditOverlay } from './EditOverlay'
import { PictureButtons, usePictures } from './EditPictures'
import { ActionBar } from './ActionBar'
import { EditMenu } from './EditMenu'
import { EditSurface, slideRender } from './EditSurface'
import { IconPicker } from './IconPicker'
import { ChartGrid } from './ChartGrid'
import { actionsFor } from '@/engine/slides/actions'
import { useSlideEdit } from './useSlideEdit'
import { deckCheck } from './check'
import type { Surface } from './surface'

interface Props { item: Item; index: number; deck: Deck; deckStyle: Style; measurer: () => Measurer; save: (id: string, draft: Slide) => Promise<string | null>; onDone: () => void }

export function EditMode({ item, index, deck, deckStyle: style, measurer, save, onDone }: Props) {
  const saveDraft = useCallback((d: Slide) => save(item.id, d), [save, item.id])
  const check = useMemo(() => deckCheck(deck, index, style, measurer), [deck, index, style, measurer])
  const edit = useSlideEdit({ slide: item.slide, check, save: saveDraft, onDone })
  const [surface, setSurface] = useState<Surface | null>(null), [grid, setGrid] = useState<number | null>(null)
  const discard = useCallback(() => { if (!edit.dirty || window.confirm('Discard your changes to this slide?')) edit.discard() }, [edit])

  // ⌘S / ⌘↵ save; ⌘Z undoes; Bold, Focus, move and delete come from the same actions as the menu. Esc peels back one layer
  // (a selection, then the item) before it asks about Discard. Leaving the page with changes asks first.
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.isComposing || e.keyCode === 229 || edit.saving) return
      const mod = e.metaKey || e.ctrlKey
      if (mod && (e.key === 's' || e.key === 'Enter')) { e.preventDefault(); void edit.save(); return }
      if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) edit.redo(); else edit.undo(); return }
      if (e.key === 'Escape') {
        if (e.defaultPrevented || grid !== null) return
        e.preventDefault()
        if (edit.target.kind === 'cells' || edit.target.kind === 'item' || (edit.target.kind === 'text' && edit.target.from !== edit.target.to)) { edit.setTarget({ kind: 'slide' }); window.getSelection()?.removeAllRanges(); return }
        discard(); return
      }
      // Shortcuts act on what is selected, or on the item the cursor is in.
      let t = edit.target
      const inField = document.activeElement instanceof HTMLElement ? document.activeElement : null
      if (t.kind !== 'cells' && t.kind !== 'item' && !(t.kind === 'text' && t.from !== t.to) && inField?.closest('[data-item]')) t = { kind: 'item', item: inField.closest<HTMLElement>('[data-item]')?.dataset.item ?? '' }
      const acts = actionsFor(t, edit.draft, style)
      const find = (id: string) => acts.find((a) => a.id === id || a.id === `row-${id}` || a.id === `col-${id}`)
      let a = null
      if (mod && e.key.toLowerCase() === 'b') a = find('bold')
      else if (mod && e.shiftKey && e.key.toLowerCase() === 'h') a = find('focus')
      else if (e.altKey && e.shiftKey && (e.key === 'ArrowUp' || e.key === 'ArrowLeft')) a = t.kind === 'cells' && e.key === 'ArrowLeft' ? acts.find((x) => x.id === 'col-move-earlier') : find('move-earlier')
      else if (e.altKey && e.shiftKey && (e.key === 'ArrowDown' || e.key === 'ArrowRight')) a = t.kind === 'cells' && e.key === 'ArrowRight' ? acts.find((x) => x.id === 'col-move-later') : find('move-later')
      else if (e.key === 'Backspace' && edit.target.kind === 'item' && !(inField?.isContentEditable)) a = find('delete')
      if (a) { e.preventDefault(); edit.apply(a.run()) }
    }
    const leave = (e: BeforeUnloadEvent) => { if (edit.dirty) e.preventDefault() }
    document.addEventListener('keydown', key); window.addEventListener('beforeunload', leave)
    return () => { document.removeEventListener('keydown', key); window.removeEventListener('beforeunload', leave) }
  }, [edit, discard, grid, style])

  const pictures = usePictures(edit, style)
  const ctx = useMemo(() => contexts({ ...deck, slides: deck.slides.map((s, i) => (i === index ? edit.shown : s)) })[index], [deck, index, edit.shown])
  // Primitives only: a new ctx or deck object with the same values (the agenda's chapters included) must not remount the
  // slide under the cursor.
  const chapters = JSON.stringify(ctx.sections ?? []), { theme, accent } = deck
  const render = useMemo(
    () => slideRender({ page: ctx.page, section: ctx.section, kicker: ctx.kicker, footer: ctx.footer, sections: JSON.parse(chapters) }, { style, theme, accent }),
    [ctx.page, ctx.section, ctx.kicker, ctx.footer, chapters, style, theme, accent],
  )
  return (
    <>
      <div className="grid min-h-0 place-items-center px-8 pb-4 pt-7 max-[900px]:order-1 max-[900px]:px-4">
        <SlideFrame>
          <EditMenu edit={edit} surface={surface} deckStyle={style} onChart={(which) => setGrid(which)}>
            <EditSurface edit={edit} deckStyle={style} render={render} onSurface={setSurface}>
              <EditOverlay edit={edit} surface={surface} deckStyle={style} onChart={(which) => setGrid(which)} onAddPicture={pictures.add} />
              <PictureButtons surface={surface} pictures={pictures} />
              <ActionBar edit={edit} surface={surface} deckStyle={style} />
              <IconPicker edit={edit} surface={surface} deckStyle={style} />
              {grid !== null && (edit.draft.chart || edit.draft.table || edit.draft.halves) && <ChartGrid edit={edit} deckStyle={style} which={grid} onClose={() => setGrid(null)} />}
            </EditSurface>
          </EditMenu>
        </SlideFrame>
      </div>
      <section className={`mx-auto min-w-0 max-w-[calc(100%-4rem)] pb-5 max-[900px]:order-2 max-[900px]:max-w-full max-[900px]:px-4 ${SLIDE_W} ${UNDER_SLIDE}`}>
        <EditTalk edit={edit} />
        <EditBar edit={edit} deckStyle={style} onDiscard={discard} />
      </section>
    </>
  )
}
