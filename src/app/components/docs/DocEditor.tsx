/* The doc in edit mode: the page drawn from the draft (editorHTML), every text field typed into in place. Typing redraws
   only its field; a structural change redraws the page and puts the cursor where the op said. Figures are drawn and
   scaled as when read. */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { fitFigures } from '@/engine/docs/mount'
import { parse, setLink } from '@/engine/slides/markup'
import type { Block } from '@/engine/docs/types'
import type { Theme } from '@/engine/types'
import { caretRange, redraw, selectRange, setCaret } from '@/app/edit/fields'
import { editorHTML } from './editorHTML'
import { blockKey, fieldKey, fieldOf, markupOf, pasteInto, selectBlock, typeInto, type Field } from './editorKeys'
import { LinkBox, type LinkAt } from './LinkBox'
import { BlockHandle } from './BlockHandle'
import { SlashMenu } from './SlashMenu'
import { useSlash } from './useSlash'
import { FigureEdit } from './FigureEdit'
import type { DocEdit } from './useDocEdit'
import './docs-edit.css'

interface Props { edit: DocEdit; theme: Theme; accent: string | undefined }
type Drawn = Map<string, { block: Block; el: HTMLElement }>

export function DocEditor({ edit, theme, accent }: Props) {
  const root = useRef<HTMLDivElement>(null), editRef = useRef(edit)
  editRef.current = edit
  const [link, setLinkAt] = useState<(LinkAt & { f: Field; from: number; to: number }) | null>(null)
  const frame = useRef<HTMLDivElement>(null), slash = useSlash(edit, useCallback(() => frame.current, [])), slashRef = useRef(slash)
  slashRef.current = slash
  // The block with the handle: the one under the pointer, else the one with the cursor; held while its menu is open.
  const [handle, setHandle] = useState<{ key: string; x: number; y: number } | null>(null), menuOpen = useRef(false), focused = useRef<string | null>(null), held = useRef<string | null>(null)
  const place = useCallback((key: string | null) => {
    const el = key ? root.current?.querySelector<HTMLElement>(`[data-key="${key}"]`) : null, box = frame.current?.getBoundingClientRect()
    held.current = el ? key : null
    if (!key || !el || !box) { setHandle(null); return }
    const r = el.getBoundingClientRect(), first = el.matches('[data-field]') ? el : el.querySelector<HTMLElement>('[data-field]'), lh = first ? parseFloat(getComputedStyle(first).lineHeight) : NaN
    const next = { key, x: Math.round(r.left - box.left - 34), y: Math.round(r.top - box.top + (Number.isFinite(lh) ? Math.max(0, (lh - 24) / 2) : 0)) }
    setHandle((h) => (h && h.key === next.key && h.x === next.x && h.y === next.y ? h : next))
  }, [])
  const hoverAt = (t: EventTarget | null) => {
    if (menuOpen.current) return
    const b = t instanceof Element && root.current?.contains(t) ? t.closest<HTMLElement>('[data-key]') : null
    if (b) place(b.dataset.key ?? null)
  }

  // Figures already drawn, by key: a redraw keeps a figure whose block is unchanged (blocks are immutable, so the same
  // object), with its charts and fitted sizes, instead of drawing it again.
  const drawn = useRef<Drawn>(new Map()), look = useRef('')
  // The open figure's slot: the same element across redraws, so the figure's edit state lives through a split or a join
  // elsewhere on the page. It goes in after the figures are fitted: the page's fitter must not reach the figure inside.
  const slot = useRef<{ key: string; el: HTMLElement } | null>(null), [slotEl, setSlotEl] = useState<HTMLElement | null>(null)

  useLayoutEffect(() => {
    const el = root.current
    if (!el) return
    // The page is redrawn in place: the scroll stays where it was.
    const scroller = el.closest('main'), top = scroller?.scrollTop ?? 0
    const blocks = new Map(edit.shown.blocks.map((k) => [k.key, k.block])), keep: Drawn = look.current === `${theme} ${accent}` ? drawn.current : new Map()
    look.current = `${theme} ${accent}`
    el.innerHTML = editorHTML(edit.shown, theme, edit.figure)
    el.querySelectorAll<HTMLElement>('[data-key][data-block-select]').forEach((fresh) => {
      const key = fresh.dataset.key ?? '', old = keep.get(key)
      if (old && old.block === blocks.get(key)) fresh.replaceWith(old.el)
    })
    drawn.current = new Map()
    el.querySelectorAll<HTMLElement>('[data-key][data-block-select]').forEach((f) => { const key = f.dataset.key ?? '', block = blocks.get(key); if (block) drawn.current.set(key, { block, el: f }) })
    const sizes = fitFigures(el, (frame) => { const b = blocks.get(frame.closest<HTMLElement>('[data-key]')?.dataset.key ?? ''); return b?.type === 'figure' ? b : null }, theme, accent)
    const fresh = el.querySelector<HTMLElement>('[data-figure-open]')
    if (fresh && slot.current?.key === edit.figure) fresh.replaceWith(slot.current.el)
    else slot.current = fresh && edit.figure ? { key: edit.figure, el: fresh } : null
    setSlotEl(slot.current?.el ?? null)
    if (scroller) scroller.scrollTop = top
    const want = editRef.current.takeFocus()
    if (want && 'select' in want) selectBlock(el, want.key)
    else if (want) {
      const f = el.querySelector<HTMLElement>(`[data-field="${want.key}"]${want.item === undefined ? '' : `[data-item="${want.item}"]`}`)
      if (f) { f.focus(); setCaret(f, want.at) }
    }
    return () => sizes.disconnect()
  }, [edit.shown, edit.figure, theme, accent])
  // After a redraw the handle follows its block, or goes with it.
  useLayoutEffect(() => { if (held.current) place(held.current) }, [edit.shown, place])

  // While a save runs, the fields stop taking text: what is typed now would be lost when edit mode closes.
  useEffect(() => { root.current?.querySelectorAll<HTMLElement>('[data-field], [data-head]').forEach((f) => { f.contentEditable = edit.saving ? 'false' : 'true' }) }, [edit.saving, edit.shown])

  useEffect(() => {
    const el = root.current
    if (!el) return
    const onInput = (e: Event) => { const f = fieldOf(e.target); if (f && !(e as InputEvent).isComposing) { typeInto(editRef.current, f); slashRef.current.input(f) } }
    const onComposed = (e: Event) => { const f = fieldOf(e.target); if (f) typeInto(editRef.current, f) }
    const onPaste = (e: ClipboardEvent) => { const f = fieldOf(e.target); if (f) pasteInto(e, f, editRef.current) }
    const onKey = (e: KeyboardEvent) => {
      // Enter and Escape while composing confirm or cancel the candidate; they are not ours.
      if (e.isComposing || e.keyCode === 229) return
      // A figure's checks badge is a native <details>: its own keys (Enter, Space, Esc) are not the figure's.
      const badge = e.target instanceof Element ? e.target.closest<HTMLDetailsElement>('details.fig-checks') : null
      if (badge) { if (e.key === 'Escape' && badge.open) { badge.open = false; badge.querySelector('summary')?.focus() } return }
      const f = fieldOf(e.target)
      if (f && slashRef.current.key(e)) return
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
    // The menu closes when its paragraph loses the cursor (a click in the menu keeps it); the handle shows on the focused block.
    const onBlur = () => slashRef.current.close()
    const onFocus = (e: FocusEvent) => { const b = e.target instanceof Element ? e.target.closest<HTMLElement>('[data-key]') : null; focused.current = b?.dataset.key ?? null }
    // A click on a figure opens it in place (a callout too); dividers and code stay selected whole.
    const onClick = (e: MouseEvent) => {
      if (e.target instanceof Element && e.target.closest('.fig-checks')) return
      const b = e.target instanceof Element ? e.target.closest<HTMLElement>('[data-key][data-block-select]') : null, key = b?.dataset.key
      if (key && editRef.current.draft.blocks.find((k) => k.key === key)?.block.type === 'figure') editRef.current.openFigure(key)
    }
    el.addEventListener('click', onClick)
    el.addEventListener('input', onInput); el.addEventListener('compositionend', onComposed)
    el.addEventListener('paste', onPaste); el.addEventListener('keydown', onKey); el.addEventListener('focusout', onBlur); el.addEventListener('focusin', onFocus)
    return () => {
      el.removeEventListener('click', onClick); el.removeEventListener('input', onInput); el.removeEventListener('compositionend', onComposed); el.removeEventListener('paste', onPaste)
      el.removeEventListener('keydown', onKey); el.removeEventListener('focusout', onBlur); el.removeEventListener('focusin', onFocus)
    }
  }, [])

  const putLink = (url: string | null) => {
    if (!link) return
    const { f, from, to } = link, next = setLink(markupOf(edit, f), from, to, url)
    edit.mark(f.head ?? f.key ?? '', next, f.item)
    redraw(f.el, next); f.el.focus(); selectRange(f.el, from, to)
    setLinkAt(null)
  }

  const open = edit.figure ? edit.shown.blocks.find((k) => k.key === edit.figure) : undefined
  return (
    <div ref={frame} className={`relative theme-${theme}`} onMouseMove={(e) => hoverAt(e.target)} onMouseLeave={() => { if (!menuOpen.current) place(focused.current) }}>
      <div ref={root} data-editing />
      {handle && root.current && frame.current && <BlockHandle edit={edit} page={root.current} frame={frame.current} theme={theme} block={handle}
        onOpen={(o) => { menuOpen.current = o }} />}
      {slash.slash && <SlashMenu x={slash.slash.x} y={slash.slash.y} choices={slash.slash.choices} active={slash.slash.active} onPick={slash.choose} onHover={slash.hover} />}
      {slotEl && open?.block.type === 'figure' && createPortal(<FigureEdit key={open.key} doc={edit} at={open.key} block={open.block} theme={theme} accent={accent} />, slotEl)}
      {link && <LinkBox at={link} onSet={putLink} onClose={() => { setLinkAt(null); link.f.el.focus(); selectRange(link.f.el, link.from, link.to) }} />}
    </div>
  )
}
