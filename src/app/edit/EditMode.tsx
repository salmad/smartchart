/* Edit mode: the editable slide where the stage was, the edit bar where the strip and checks were (spec 4). */
import { useCallback, useMemo, useState } from 'react'
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
import { useSlideEdit } from './useSlideEdit'
import { deckCheck } from './check'
import { useEditKeys } from './useEditKeys'
import type { Surface } from './surface'

const SAVE_KEYS = ['s', 'Enter']

interface Props { item: Item; index: number; deck: Deck; deckStyle: Style; measurer: () => Measurer; save: (id: string, draft: Slide) => Promise<string | null>; onDone: () => void }

export function EditMode({ item, index, deck, deckStyle: style, measurer, save, onDone }: Props) {
  const saveDraft = useCallback((d: Slide) => save(item.id, d), [save, item.id])
  const check = useMemo(() => deckCheck(deck, index, style, measurer), [deck, index, style, measurer])
  const edit = useSlideEdit({ slide: item.slide, check, save: saveDraft, onDone })
  const [surface, setSurface] = useState<Surface | null>(null), [grid, setGrid] = useState<number | null>(null)
  const discard = useCallback(() => { if (!edit.dirty || window.confirm('Discard your changes to this slide?')) edit.discard() }, [edit])

  // ⌘S / ⌘↵ save; the rest are the edit keys a figure in a doc uses too.
  const saveNow = useCallback(() => { void edit.save() }, [edit])
  useEditKeys(edit, style, { grid: grid !== null, discard, save: saveNow, saveKeys: SAVE_KEYS })

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
