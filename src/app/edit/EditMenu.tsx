// src/app/edit/EditMenu.tsx
/* The slide's own right-click menu (replacing the browser's): everything that can be done to what is under the pointer,
   from the same actions as the floating bar and the keys. Shift + right-click still opens the browser's (spellcheck). */
import { useState, type ReactNode } from 'react'
import { actionsFor, type Action, type Target } from '@/engine/slides/actions'
import { ContextMenu, ContextMenuCheckboxItem, ContextMenuContent, ContextMenuItem, ContextMenuLabel, ContextMenuSeparator, ContextMenuShortcut, ContextMenuTrigger } from '@/app/components/ui/context-menu'
import type { Style } from '@/engine/types'
import { cn } from '@/app/lib/utils'
import { selectRange } from './fields'
import { targetAt } from './selection'
import type { SlideEdit } from './useSlideEdit'
import type { Surface } from './surface'

const GROUPS: { id: Action['group']; label: string }[] = [
  { id: 'text', label: 'Text' }, { id: 'item', label: 'Item' }, { id: 'row', label: 'Row' }, { id: 'column', label: 'Column' }, { id: 'format', label: 'Format' }, { id: 'mark', label: 'Score' },
]
const SYMBOLS: Record<string, string> = { Mod: '⌘', Shift: '⇧', Alt: '⌥', Up: '↑', Down: '↓', Left: '←', Right: '→', Backspace: '⌫' }
const keys = (s?: string) => s?.split('+').map((k) => SYMBOLS[k] ?? k).join('')

/** Cut, copy and paste inside the field the menu was opened on: the field takes focus back first. */
function clip(slide: HTMLElement | null | undefined, t: Target, what: 'cut' | 'copy' | 'paste') {
  if (t.kind !== 'text' || !slide) return
  const f = slide.querySelector<HTMLElement>(`[data-path="${t.path}"]`)
  if (!f) return
  f.focus(); selectRange(f, t.from, t.to)
  if (what !== 'paste') { document.execCommand(what); return }
  void navigator.clipboard.readText().then((text) => { f.focus(); selectRange(f, t.from, t.to); document.execCommand('insertText', false, text.replace(/\s+/g, ' ')) }).catch(() => { /* clipboard blocked */ })
}

/** The menu's colours where they differ from the app's: a doc figure's menu takes its page's (docs/chrome.ts). */
export interface MenuLook { content: string; item: string; separator: string; label: string }

export function EditMenu({ edit, surface, deckStyle, onChart, look, children }: { edit: SlideEdit; surface: Surface | null; deckStyle: Style; onChart: (which: number) => void; look?: MenuLook; children: ReactNode }) {
  const [target, setTarget] = useState<Target>({ kind: 'slide' }), [chartAt, setChartAt] = useState(0)
  const half = edit.draft.halves?.[chartAt]
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
          // The half under the pointer: a pair's left or right.
          const host = e.target instanceof Element ? e.target.closest<HTMLElement>('[data-chart], [data-grid]') : null
          setChartAt(Number(host?.dataset.chart || host?.dataset.grid || 0))
        }}>
        <div className="absolute inset-0">{children}</div>
      </ContextMenuTrigger>
      <ContextMenuContent data-edit-chrome className={cn('min-w-52', look?.content)} onCloseAutoFocus={(e) => e.preventDefault()}>
        {field && (<>
          <ContextMenuItem className={look?.item} onSelect={() => clip(surface?.slide, target, 'cut')} disabled={target.kind === 'text' && target.from === target.to}>Cut<ContextMenuShortcut>⌘X</ContextMenuShortcut></ContextMenuItem>
          <ContextMenuItem className={look?.item} onSelect={() => clip(surface?.slide, target, 'copy')} disabled={target.kind === 'text' && target.from === target.to}>Copy<ContextMenuShortcut>⌘C</ContextMenuShortcut></ContextMenuItem>
          <ContextMenuItem className={look?.item} onSelect={() => clip(surface?.slide, target, 'paste')}>Paste<ContextMenuShortcut>⌘V</ContextMenuShortcut></ContextMenuItem>
          {actions.length > 0 && <ContextMenuSeparator className={look?.separator} />}
        </>)}
        {GROUPS.map((g, gi) => {
          const items = actions.filter((a) => a.group === g.id)
          if (!items.length) return null
          const before = GROUPS.slice(0, gi).some((p) => actions.some((a) => a.group === p.id))
          return (
            <div key={g.id}>
              {before && <ContextMenuSeparator className={look?.separator} />}
              {(g.id === 'format' || g.id === 'mark') && <ContextMenuLabel className={cn('text-[11px] font-normal text-ink-3', look?.label)}>{g.label}</ContextMenuLabel>}
              {items.map((a) => a.checked !== undefined
                ? <ContextMenuCheckboxItem className={look?.item} key={a.id} checked={a.checked} onSelect={() => edit.apply(a.run())}>{a.label}<ContextMenuShortcut>{keys(a.shortcut)}</ContextMenuShortcut></ContextMenuCheckboxItem>
                : <ContextMenuItem className={look?.item} key={a.id} onSelect={() => edit.apply(a.run())}>{a.label}<ContextMenuShortcut>{keys(a.shortcut)}</ContextMenuShortcut></ContextMenuItem>)}
            </div>
          )
        })}
        {(edit.draft.chart || edit.draft.table || (half && (half.chart || half.table))) && <>{actions.length > 0 && <ContextMenuSeparator className={look?.separator} />}<ContextMenuItem className={look?.item} onSelect={() => { setTimeout(() => onChart(chartAt), 0) }}>{edit.draft.table || half?.table ? 'Edit as sheet…' : 'Edit chart data…'}</ContextMenuItem></>}
        {target.kind === 'slide' && !edit.draft.chart && !edit.draft.table && !edit.draft.halves && <ContextMenuLabel className={cn('text-[11px] font-normal text-ink-3', look?.label)}>Right-click a card, row, column or text</ContextMenuLabel>}
      </ContextMenuContent>
    </ContextMenu>
  )
}
