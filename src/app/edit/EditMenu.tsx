// src/app/edit/EditMenu.tsx
/* The slide's own right-click menu (replacing the browser's): everything that can be done to what is under the pointer,
   from the same actions as the floating bar and the keys. Shift + right-click still opens the browser's (spellcheck). */
import { useState, type ReactNode } from 'react'
import { actionsFor, type Action, type Target } from '@/engine/slides/actions'
import { ContextMenu, ContextMenuCheckboxItem, ContextMenuContent, ContextMenuItem, ContextMenuLabel, ContextMenuSeparator, ContextMenuShortcut, ContextMenuTrigger } from '@/app/components/ui/context-menu'
import type { Style } from '@/engine/types'
import { selectRange } from './fields'
import { targetAt } from './selection'
import type { SlideEdit } from './useSlideEdit'

const GROUPS: { id: Action['group']; label: string }[] = [
  { id: 'text', label: 'Text' }, { id: 'item', label: 'Item' }, { id: 'row', label: 'Row' }, { id: 'column', label: 'Column' }, { id: 'format', label: 'Format' }, { id: 'mark', label: 'Score' },
]
const SYMBOLS: Record<string, string> = { Mod: '⌘', Shift: '⇧', Alt: '⌥', Up: '↑', Down: '↓', Left: '←', Right: '→', Backspace: '⌫' }
const keys = (s?: string) => s?.split('+').map((k) => SYMBOLS[k] ?? k).join('')

/** Cut, copy and paste inside the field the menu was opened on: the field takes focus back first. */
function clip(slide: HTMLElement | null, t: Target, what: 'cut' | 'copy' | 'paste') {
  if (t.kind !== 'text' || !slide) return
  const f = slide.querySelector<HTMLElement>(`[data-path="${t.path}"]`)
  if (!f) return
  f.focus(); selectRange(f, t.from, t.to)
  if (what !== 'paste') { document.execCommand(what); return }
  void navigator.clipboard.readText().then((text) => { f.focus(); selectRange(f, t.from, t.to); document.execCommand('insertText', false, text.replace(/\s+/g, ' ')) }).catch(() => { /* clipboard blocked */ })
}

export function EditMenu({ edit, slide, deckStyle, onChart, children }: { edit: SlideEdit; slide: HTMLElement | null; deckStyle: Style; onChart: () => void; children: ReactNode }) {
  const [target, setTarget] = useState<Target>({ kind: 'slide' })
  const actions = actionsFor(target, edit.draft, deckStyle)
  const field = target.kind === 'text'
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild
        onContextMenuCapture={(e) => {
          // Shift + right-click: the browser's own menu.
          if (e.shiftKey) { e.stopPropagation(); return }
          const t = targetAt(e.target instanceof Element ? e.target : null, edit.target)
          setTarget(t); edit.setTarget(t)
        }}>
        <div className="absolute inset-0">{children}</div>
      </ContextMenuTrigger>
      <ContextMenuContent data-edit-chrome className="min-w-52" onCloseAutoFocus={(e) => e.preventDefault()}>
        {field && (<>
          <ContextMenuItem onSelect={() => clip(slide, target, 'cut')} disabled={target.kind === 'text' && target.from === target.to}>Cut<ContextMenuShortcut>⌘X</ContextMenuShortcut></ContextMenuItem>
          <ContextMenuItem onSelect={() => clip(slide, target, 'copy')} disabled={target.kind === 'text' && target.from === target.to}>Copy<ContextMenuShortcut>⌘C</ContextMenuShortcut></ContextMenuItem>
          <ContextMenuItem onSelect={() => clip(slide, target, 'paste')}>Paste<ContextMenuShortcut>⌘V</ContextMenuShortcut></ContextMenuItem>
          {actions.length > 0 && <ContextMenuSeparator />}
        </>)}
        {GROUPS.map((g, gi) => {
          const items = actions.filter((a) => a.group === g.id)
          if (!items.length) return null
          const before = GROUPS.slice(0, gi).some((p) => actions.some((a) => a.group === p.id))
          return (
            <div key={g.id}>
              {before && <ContextMenuSeparator />}
              {(g.id === 'format' || g.id === 'mark') && <ContextMenuLabel className="text-[11px] font-normal text-ink-3">{g.label}</ContextMenuLabel>}
              {items.map((a) => a.checked !== undefined
                ? <ContextMenuCheckboxItem key={a.id} checked={a.checked} onSelect={() => edit.apply(a.run())}>{a.label}<ContextMenuShortcut>{keys(a.shortcut)}</ContextMenuShortcut></ContextMenuCheckboxItem>
                : <ContextMenuItem key={a.id} onSelect={() => edit.apply(a.run())}>{a.label}<ContextMenuShortcut>{keys(a.shortcut)}</ContextMenuShortcut></ContextMenuItem>)}
            </div>
          )
        })}
        {(edit.draft.chart || edit.draft.table) && <>{actions.length > 0 && <ContextMenuSeparator />}<ContextMenuItem onSelect={() => { setTimeout(onChart, 0) }}>{edit.draft.table ? 'Edit as sheet…' : 'Edit chart data…'}</ContextMenuItem></>}
        {target.kind === 'slide' && !edit.draft.chart && !edit.draft.table && <ContextMenuLabel className="text-[11px] font-normal text-ink-3">Right-click a card, row, column or text</ContextMenuLabel>}
      </ContextMenuContent>
    </ContextMenu>
  )
}
