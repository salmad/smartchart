/* A doc figure open in place: the deck's own edit surface, menu, overlay, bar, icon picker and data grid over the figure
   as the slide it would be (asSlide), with Done and Discard under it. Done writes the body into the doc's draft; what
   is wrong stays underlined and listed, it never stops the write. A callout has no template, so it edits its
   words only: no menu or list tools. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { asSlide } from '@/engine/docs/figure'
import type { FigureBlock } from '@/engine/docs/types'
import type { Slide, Style, Theme } from '@/engine/types'
import { ActionBar } from '@/app/edit/ActionBar'
import { ChartGrid } from '@/app/edit/ChartGrid'
import { EditMenu, type MenuLook } from '@/app/edit/EditMenu'
import { EditOverlay } from '@/app/edit/EditOverlay'
import { PictureButtons, usePictures } from '@/app/edit/EditPictures'
import { EditSurface } from '@/app/edit/EditSurface'
import { IconPicker } from '@/app/edit/IconPicker'
import { useEditKeys } from '@/app/edit/useEditKeys'
import { useSlideEdit } from '@/app/edit/useSlideEdit'
import type { Surface } from '@/app/edit/surface'
import { bodyOf, figureCheck, figureRender } from './figureCheck'
import type { DocEdit } from './useDocEdit'
import { surface as card, tintOnFocus, tintOnHover } from './chrome'

const STYLE: Style = 'consulting', DONE_KEYS = ['Enter']
const NONE = () => {}

interface Props { doc: DocEdit; at: string; block: FigureBlock; theme: Theme; accent: string | undefined }

export function FigureEdit({ doc, at, block, theme, accent }: Props) {
  const slide = useMemo(() => asSlide(block) ?? ({ ...block.body, template: 'callout', title: '' } as unknown as Slide), [block])
  const check = useMemo(() => figureCheck(block.kind), [block.kind])
  // Done: a changed figure is written into the doc, whatever its checks say (they stay underlined, and the doc's bar
  // lists them). Read through refs: the doc calls it from its own Save.
  const finish = useRef<(d: Slide, dirty: boolean) => void>(() => {})
  finish.current = (d, dirty) => { if (dirty) doc.setFigure(at, bodyOf(d)) }
  const save = useCallback(async (d: Slide) => { finish.current(d, true); return null }, [])
  const edit = useSlideEdit({ slide, check, save, onDone: NONE }), pictures = usePictures(edit, STYLE), editRef = useRef(edit)
  editRef.current = edit
  useEffect(() => { doc.holdFigure(() => finish.current(editRef.current.draft, editRef.current.dirty)); return () => doc.holdFigure(null) }, [doc])

  const box = useRef<HTMLDivElement>(null)
  const render = useMemo(() => figureRender(block, theme, accent, () => box.current), [block, theme, accent])
  const [surface, setSurface] = useState<Surface | null>(null), [grid, setGrid] = useState<number | null>(null)
  const done = useCallback(() => doc.openFigure(null), [doc])
  const discard = useCallback(() => {
    if (editRef.current.dirty && !window.confirm('Discard your changes to this figure?')) return
    doc.holdFigure(null); doc.openFigure(null)
  }, [doc])
  useEditKeys(edit, STYLE, { grid: grid !== null, discard, save: done, saveKeys: DONE_KEYS })

  const look = useMemo<MenuLook>(() => ({ content: `theme-${theme} rounded-[10px] border-0 ${card}`, item: tintOnFocus, separator: 'bg-[var(--line)]', label: 'text-[var(--muted)]' }), [theme])
  const callout = block.kind === 'callout', data = edit.draft.chart || edit.draft.table || edit.draft.halves
  const surfaceEl = (
    <EditSurface edit={edit} deckStyle={STYLE} render={render} onSurface={setSurface}>
      {!callout && <EditOverlay edit={edit} surface={surface} deckStyle={STYLE} onChart={setGrid} onAddPicture={pictures.add} />}
      {block.kind === 'image' && <PictureButtons surface={surface} pictures={pictures} />}
      <ActionBar edit={edit} surface={surface} deckStyle={STYLE} />
      {!callout && <IconPicker edit={edit} surface={surface} deckStyle={STYLE} />}
      {grid !== null && data && <ChartGrid edit={edit} deckStyle={STYLE} which={grid} onClose={() => setGrid(null)} />}
    </EditSurface>
  )
  return (
    <div data-figure-edit>
      <div ref={box} className="fig-edit-box">
        {callout ? surfaceEl : <EditMenu edit={edit} surface={surface} deckStyle={STYLE} onChart={setGrid} look={look}>{surfaceEl}</EditMenu>}
      </div>
      <div className="fig-edit-row" data-edit-chrome>
        <button type="button" onClick={discard} className={`h-8 rounded-md px-3 text-[13px] font-medium text-[var(--fg-2)] ${tintOnHover}`}>Discard</button>
        <button type="button" onClick={done} className="h-8 rounded-md bg-[var(--fg)] px-3 text-[13px] font-medium text-[var(--bg)] hover:opacity-90">Done</button>
      </div>
    </div>
  )
}
