/* The grip in the left margin of the block under the pointer (or with the cursor): a press opens Move up, Move down and
   Delete; a drag moves the block, with a line where it will land. Pointer events on the grip itself (captured), never
   HTML5 drag, which would drag text out of the page. A section's heading is a block like the others: it moves alone. */
import { useEffect, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, GripVertical, Trash2 } from 'lucide-react'
import { dropIndex, type Box } from '@/app/edit/drag'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/app/components/ui/dropdown-menu'
import type { Theme } from '@/engine/types'
import { cn } from '@/app/lib/utils'
import { moveBlockBy, moveBlockTo, removeBlockAt } from './editor/behaviour'
import { entries } from './editor/structure'
import { surface, tint, tintOnFocus, tintOnHover } from './chrome'
import type { DocEdit } from './useDocEdit'

interface Props {
  edit: DocEdit
  /** The editor's page (ProseMirror's root), where the blocks are; positions are relative to `frame`, the box both sit in. */
  page: HTMLElement
  frame: HTMLElement
  /** The page's theme: the menu opens in a portal, outside the page. */
  theme: Theme
}
interface At { index: number; x: number; y: number }

const rect = (el: Element): Box => { const r = el.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom } }

export function BlockHandle({ edit, page, frame, theme }: Props) {
  const { editor } = edit
  const [at, setAt] = useState<At | null>(null), [open, setOpenState] = useState(false), [line, setLine] = useState<{ x: number; y: number; w: number } | null>(null)
  const menuOpen = useRef(false), held = useRef<number | null>(null)
  const setOpen = (o: boolean) => { setOpenState(o); menuOpen.current = o }

  /** The blocks' elements, in the doc's order. */
  const els = () => (editor ? entries(editor.state.doc).map((e) => editor.view.nodeDOM(e.pos) as HTMLElement | null) : [])
  const place = (index: number | null) => {
    const el = index === null ? null : els()[index], box = frame.getBoundingClientRect()
    held.current = el ? index : null
    if (index === null || !el) { setAt(null); return }
    const r = el.getBoundingClientRect(), first = el.matches('h1,h2,h3,p') ? el : el.querySelector<HTMLElement>('p, li'), lh = first ? parseFloat(getComputedStyle(first).lineHeight) : NaN
    const next = { index, x: Math.round(r.left - box.left - 34), y: Math.round(r.top - box.top + (Number.isFinite(lh) ? Math.max(0, (lh - 24) / 2) : 0)) }
    setAt((h) => (h && h.index === next.index && h.x === next.x && h.y === next.y ? h : next))
  }

  useEffect(() => {
    if (!editor) return
    let frameId = 0
    const move = (e: MouseEvent) => {
      if (menuOpen.current) return
      cancelAnimationFrame(frameId)
      frameId = requestAnimationFrame(() => {
        if (e.target instanceof Element && e.target.closest('[data-block-handle]')) return
        const list = els(), r = page.getBoundingClientRect()
        // The margin counts as the row beside it: the pointer's height decides.
        if (e.clientX < r.left - 48 || e.clientX > r.right) return
        const i = list.findIndex((el) => { const b = el?.getBoundingClientRect(); return !!b && e.clientY >= b.top - 6 && e.clientY <= b.bottom + 6 })
        if (i >= 0) place(i)
      })
    }
    const follow = () => { const i = editor.state.selection.$from; const list = entries(editor.state.doc); const n = list.findIndex((x) => i.pos >= x.pos && i.pos <= x.pos + x.node.nodeSize); if (!menuOpen.current && n >= 0 && held.current === null) place(n) }
    frame.addEventListener('mousemove', move)
    editor.on('selectionUpdate', follow)
    const refresh = () => { if (held.current !== null) place(held.current) }
    editor.on('transaction', refresh)
    return () => { cancelAnimationFrame(frameId); frame.removeEventListener('mousemove', move); editor.off('selectionUpdate', follow); editor.off('transaction', refresh) }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- place and els read the editor and frame
  }, [editor, frame, page])

  if (!editor || !at) return null
  const total = entries(editor.state.doc).length, here = at
  /** A menu action, then the cursor back in the page. */
  const run = (fn: () => boolean) => { fn(); editor.view.focus() }
  const pos = (m: HTMLElement | null, p: { x: number; y: number; w?: number }) => { m?.style.setProperty('--x', `${p.x}px`); m?.style.setProperty('--y', `${p.y}px`); if (p.w) m?.style.setProperty('--w', `${p.w}px`) }

  const press = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return
    // Ours, not the menu's: a press that doesn't move opens it, one that moves drags.
    e.preventDefault()
    const grip = e.currentTarget, id = e.pointerId, sx = e.clientX, sy = e.clientY, list = els(), from = here.index
    grip.setPointerCapture(id)
    let active = false, to = from
    const mv = (ev: PointerEvent) => {
      if (!active && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 4) return
      if (!active) { active = true; list[from]?.setAttribute('data-dragging', '') }
      const boxes = list.map((el) => (el ? rect(el) : { left: 0, right: 0, top: 0, bottom: 0 })), f = frame.getBoundingClientRect(), rest = boxes.filter((_, n) => n !== from)
      to = dropIndex(boxes, from, { x: ev.clientX, y: ev.clientY }, 'y')
      const y = to >= rest.length ? rest[rest.length - 1].bottom + 8 : to === 0 ? rest[0].top - 8 : (rest[to - 1].bottom + rest[to].top) / 2
      const left = Math.min(...rest.map((b) => b.left)), right = Math.max(...rest.map((b) => b.right))
      setLine({ x: left - f.left, y: y - f.top, w: right - left })
    }
    const stop = () => { grip.removeEventListener('pointermove', mv); grip.removeEventListener('pointerup', up); grip.removeEventListener('pointercancel', stop); list[from]?.removeAttribute('data-dragging'); setLine(null) }
    const up = () => {
      stop()
      if (!active) { setOpen(true); return }
      if (to !== from) { moveBlockTo(editor, edit.originals, from, to); editor.view.focus() }
    }
    grip.addEventListener('pointermove', mv); grip.addEventListener('pointerup', up); grip.addEventListener('pointercancel', stop)
  }

  return (
    <>
      <DropdownMenu open={open} onOpenChange={setOpen} modal={false}>
        <DropdownMenuTrigger asChild>
          <button ref={(m) => pos(m, here)} type="button" aria-label="Block menu" title="Drag to move, click for more" data-edit-chrome data-block-handle onPointerDown={press}
            className={cn("absolute left-[var(--x)] top-[var(--y)] z-20 grid size-6 cursor-grab touch-none place-items-center rounded-md text-[var(--muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--focus)] active:cursor-grabbing", open ? tint : tintOnHover)}>
            <GripVertical className="size-4" strokeWidth={1.75} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="bottom" sideOffset={4} onCloseAutoFocus={(e) => e.preventDefault()} data-edit-chrome className={cn(`theme-${theme} min-w-[188px] rounded-[10px] border-0 p-1`, surface)}>
          <DropdownMenuItem className={tintOnFocus} disabled={here.index <= 0} onSelect={() => run(() => moveBlockBy(editor, edit.originals, here.index, -1))}><ArrowUp className="size-4" /> Move up<span className="ml-auto pl-4 font-mono text-[11px] text-[var(--muted)]">⌥⇧↑</span></DropdownMenuItem>
          <DropdownMenuItem className={tintOnFocus} disabled={here.index >= total - 1} onSelect={() => run(() => moveBlockBy(editor, edit.originals, here.index, 1))}><ArrowDown className="size-4" /> Move down<span className="ml-auto pl-4 font-mono text-[11px] text-[var(--muted)]">⌥⇧↓</span></DropdownMenuItem>
          <DropdownMenuSeparator className="bg-[var(--line)]" />
          <DropdownMenuItem className={tintOnFocus} onSelect={() => run(() => removeBlockAt(editor, edit.originals, here.index))}><Trash2 className="size-4" /> Delete</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {line && <div ref={(m) => pos(m, line)} aria-hidden className="pointer-events-none absolute left-[var(--x)] top-[var(--y)] z-20 h-0.5 w-[var(--w)] -translate-y-1/2 rounded-full bg-[var(--focus)]" />}
    </>
  )
}
