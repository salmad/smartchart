/* The doc in edit mode: the page drawn from the draft (editorHTML), every text field typed into in place. Typing redraws
   only its field; a structural change redraws the page and puts the cursor where the op said. Figures are drawn and
   scaled as when read. */
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { fitFigures } from '@/engine/docs/mount'
import { parse, setLink } from '@/engine/slides/markup'
import type { Block } from '@/engine/docs/types'
import type { Theme } from '@/engine/types'
import { caretRange, redraw, selectRange, setCaret } from '@/app/edit/fields'
import { editorHTML } from './editorHTML'
import { blockKey, fieldKey, fieldOf, markupOf, pasteInto, selectBlock, typeInto, type Field } from './editorKeys'
import { LinkBox, type LinkAt } from './LinkBox'
import type { DocEdit } from './useDocEdit'
import './docs-edit.css'

interface Props { edit: DocEdit; theme: Theme; accent: string | undefined }
type Drawn = Map<string, { block: Block; el: HTMLElement }>

export function DocEditor({ edit, theme, accent }: Props) {
  const root = useRef<HTMLDivElement>(null), editRef = useRef(edit)
  editRef.current = edit
  const [link, setLinkAt] = useState<(LinkAt & { f: Field; from: number; to: number }) | null>(null)

  // Figures already drawn, by key: a redraw keeps a figure whose block is unchanged (blocks are immutable, so the same
  // object), with its charts and fitted sizes, instead of drawing it again.
  const drawn = useRef<Drawn>(new Map()), look = useRef('')

  useLayoutEffect(() => {
    const el = root.current
    if (!el) return
    // The page is redrawn in place: the scroll stays where it was.
    const scroller = el.closest('main'), top = scroller?.scrollTop ?? 0
    const blocks = new Map(edit.shown.blocks.map((k) => [k.key, k.block])), keep: Drawn = look.current === `${theme} ${accent}` ? drawn.current : new Map()
    look.current = `${theme} ${accent}`
    el.innerHTML = editorHTML(edit.shown, theme)
    el.querySelectorAll<HTMLElement>('[data-key][data-block-select]').forEach((fresh) => {
      const key = fresh.dataset.key ?? '', old = keep.get(key)
      if (old && old.block === blocks.get(key)) fresh.replaceWith(old.el)
    })
    drawn.current = new Map()
    el.querySelectorAll<HTMLElement>('[data-key][data-block-select]').forEach((f) => { const key = f.dataset.key ?? '', block = blocks.get(key); if (block) drawn.current.set(key, { block, el: f }) })
    const sizes = fitFigures(el, (frame) => { const b = blocks.get(frame.closest<HTMLElement>('[data-key]')?.dataset.key ?? ''); return b?.type === 'figure' ? b : null }, theme, accent)
    if (scroller) scroller.scrollTop = top
    const want = editRef.current.takeFocus()
    if (want && 'select' in want) selectBlock(el, want.key)
    else if (want) {
      const f = el.querySelector<HTMLElement>(`[data-field="${want.key}"]${want.item === undefined ? '' : `[data-item="${want.item}"]`}`)
      if (f) { f.focus(); setCaret(f, want.at) }
    }
    return () => sizes.disconnect()
  }, [edit.shown, theme, accent])

  // While a save runs, the fields stop taking text: what is typed now would be lost when edit mode closes.
  useEffect(() => { root.current?.querySelectorAll<HTMLElement>('[data-field], [data-head]').forEach((f) => { f.contentEditable = edit.saving ? 'false' : 'true' }) }, [edit.saving, edit.shown])

  useEffect(() => {
    const el = root.current
    if (!el) return
    const onInput = (e: Event) => { const f = fieldOf(e.target); if (f && !(e as InputEvent).isComposing) typeInto(editRef.current, f) }
    const onComposed = (e: Event) => { const f = fieldOf(e.target); if (f) typeInto(editRef.current, f) }
    const onPaste = (e: ClipboardEvent) => { const f = fieldOf(e.target); if (f) pasteInto(e, f, editRef.current) }
    const onKey = (e: KeyboardEvent) => {
      // Enter and Escape while composing confirm or cancel the candidate; they are not ours.
      if (e.isComposing || e.keyCode === 229) return
      const f = fieldOf(e.target)
      if (f && (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        const [from, to] = caretRange(f.el) ?? [0, 0], box = window.getSelection()?.getRangeAt(0).getBoundingClientRect()
        if (from === to || !box) return
        const mark = parse(markupOf(editRef.current, f))[from]?.marks.find((m) => m.startsWith('link:'))
        setLinkAt({ f, from, to, x: box.left + box.width / 2, y: box.bottom, url: mark?.slice(5) ?? '' })
        return
      }
      if (f) { fieldKey(e, f, editRef.current, el); return }
      const b = e.target instanceof Element ? e.target.closest<HTMLElement>('[data-block-select]') : null
      if (b?.dataset.key) blockKey(e, b.dataset.key, editRef.current, el)
    }
    el.addEventListener('input', onInput); el.addEventListener('compositionend', onComposed)
    el.addEventListener('paste', onPaste); el.addEventListener('keydown', onKey)
    return () => { el.removeEventListener('input', onInput); el.removeEventListener('compositionend', onComposed); el.removeEventListener('paste', onPaste); el.removeEventListener('keydown', onKey) }
  }, [])

  const putLink = (url: string | null) => {
    if (!link) return
    const { f, from, to } = link, next = setLink(markupOf(edit, f), from, to, url)
    edit.mark(f.head ?? f.key ?? '', next, f.item)
    redraw(f.el, next); f.el.focus(); selectRange(f.el, from, to)
    setLinkAt(null)
  }

  return (
    <>
      <div ref={root} data-editing />
      {link && <LinkBox at={link} onSet={putLink} onClose={() => { setLinkAt(null); link.f.el.focus(); selectRange(link.f.el, link.from, link.to) }} />}
    </>
  )
}
