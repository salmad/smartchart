/* The grip in the left margin of the block under the pointer (or with the cursor): a press opens Move up, Move down and
   Delete; a drag moves the block, with a line where it will land. Pointer events on the grip itself (captured), never
   HTML5 drag, which would drag text out of the fields. */
import { useState } from 'react'
import { ArrowDown, ArrowUp, GripVertical, Trash2 } from 'lucide-react'
import { moveBlock } from '@/engine/docs/blocks'
import { dropIndex, type Box } from '@/app/edit/drag'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/app/components/ui/dropdown-menu'
import { moveBy, removeAt } from './editorKeys'
import type { DocEdit } from './useDocEdit'
import type { Theme } from '@/engine/types'
import { cn } from '@/app/lib/utils'
import { surface, tint, tintOnFocus, tintOnHover } from './chrome'

interface Props {
  edit: DocEdit
  /** The editor's page, where the blocks are; positions are relative to `frame`, the box both sit in. */
  page: HTMLElement
  frame: HTMLElement
  /** The page's theme: the menu opens in a portal, outside the page. */
  theme: Theme
  block: { key: string; x: number; y: number }
  /** While the menu is open the handle stays on its block. */
  onOpen: (open: boolean) => void
}

const rect = (el: Element): Box => { const r = el.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom } }
const blocksIn = (page: HTMLElement) => [...page.querySelectorAll<HTMLElement>('[data-key]')]

export function BlockHandle({ edit, page, frame, theme, block, onOpen }: Props) {
  const [open, setOpenState] = useState(false), [line, setLine] = useState<{ x: number; y: number; w: number } | null>(null)
  const setOpen = (o: boolean) => { setOpenState(o); onOpen(o) }
  const list = edit.draft.blocks, i = list.findIndex((k) => k.key === block.key)
  const at = (m: HTMLElement | null, p: { x: number; y: number; w?: number }) => { m?.style.setProperty('--x', `${p.x}px`); m?.style.setProperty('--y', `${p.y}px`); if (p.w) m?.style.setProperty('--w', `${p.w}px`) }

  const press = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return
    // Ours, not the menu's: a press that doesn't move opens it, one that moves drags.
    e.preventDefault()
    const grip = e.currentTarget, id = e.pointerId, sx = e.clientX, sy = e.clientY, els = blocksIn(page), from = els.findIndex((el) => el.dataset.key === block.key)
    grip.setPointerCapture(id)
    let active = false, to = from
    const move = (ev: PointerEvent) => {
      if (!active && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 4) return
      if (!active) { active = true; els[from]?.setAttribute('data-dragging', '') }
      const boxes = els.map(rect), f = frame.getBoundingClientRect(), rest = boxes.filter((_, n) => n !== from)
      to = dropIndex(boxes, from, { x: ev.clientX, y: ev.clientY }, 'y')
      // The line sits in the gap the block will land in.
      const y = to >= rest.length ? rest[rest.length - 1].bottom + 8 : to === 0 ? rest[0].top - 8 : (rest[to - 1].bottom + rest[to].top) / 2
      const left = Math.min(...rest.map((b) => b.left)), right = Math.max(...rest.map((b) => b.right))
      setLine({ x: left - f.left, y: y - f.top, w: right - left })
    }
    const stop = () => { grip.removeEventListener('pointermove', move); grip.removeEventListener('pointerup', up); grip.removeEventListener('pointercancel', stop); els[from]?.removeAttribute('data-dragging'); setLine(null) }
    const up = () => {
      stop()
      if (!active) { setOpen(true); return }
      if (to !== from) edit.apply(moveBlock(edit.draft.blocks, block.key, to), { key: block.key, select: true })
    }
    grip.addEventListener('pointermove', move); grip.addEventListener('pointerup', up); grip.addEventListener('pointercancel', stop)
  }

  return (
    <>
      <DropdownMenu open={open} onOpenChange={setOpen} modal={false}>
        <DropdownMenuTrigger asChild>
          <button ref={(m) => at(m, block)} type="button" aria-label="Block menu" title="Drag to move, click for more" data-edit-chrome onPointerDown={press}
            className={cn("absolute left-[var(--x)] top-[var(--y)] z-20 grid size-6 cursor-grab touch-none place-items-center rounded-md text-[var(--muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--focus)] active:cursor-grabbing", open ? tint : tintOnHover)}>
            <GripVertical className="size-4" strokeWidth={1.75} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="bottom" sideOffset={4} onCloseAutoFocus={(e) => e.preventDefault()} data-edit-chrome className={cn(`theme-${theme} min-w-[188px] rounded-[10px] border-0 p-1`, surface)}>
          <DropdownMenuItem className={tintOnFocus} disabled={i <= 0} onSelect={() => moveBy(edit, block.key, -1)}><ArrowUp className="size-4" /> Move up<span className="ml-auto pl-4 font-mono text-[11px] text-[var(--muted)]">⌥⇧↑</span></DropdownMenuItem>
          <DropdownMenuItem className={tintOnFocus} disabled={i < 0 || i >= list.length - 1} onSelect={() => moveBy(edit, block.key, 1)}><ArrowDown className="size-4" /> Move down<span className="ml-auto pl-4 font-mono text-[11px] text-[var(--muted)]">⌥⇧↓</span></DropdownMenuItem>
          <DropdownMenuSeparator className="bg-[var(--line)]" />
          <DropdownMenuItem className={tintOnFocus} onSelect={() => removeAt(edit, block.key)}><Trash2 className="size-4" /> Delete</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {line && <div ref={(m) => at(m, line)} aria-hidden className="pointer-events-none absolute left-[var(--x)] top-[var(--y)] z-20 h-0.5 w-[var(--w)] -translate-y-1/2 rounded-full bg-[var(--focus)]" />}
    </>
  )
}
