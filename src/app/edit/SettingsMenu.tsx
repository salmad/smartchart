/* The right-click menu's Settings submenu: one entry per setting of the object under the pointer, read from the schema by
   `settingsFor`. A choice opens a radio list of its allowed values, with the current one shown beside the entry; a flag is a
   single checkable item. Each pick is a patch to a schema path, applied like any other edit (undo, Save and checks as usual). */
import type { ReactNode } from 'react'
import { ContextMenuCheckboxItem, ContextMenuRadioGroup, ContextMenuRadioItem, ContextMenuSub, ContextMenuSubContent, ContextMenuSubTrigger } from '@/app/components/ui/context-menu'
import type { Result } from '@/engine/slides/actions'
import type { Setting } from '@/engine/slides/settings'
import { cn } from '@/app/lib/utils'
import type { MenuLook } from './EditMenu'

/** A submenu that opens beside its entry; its content takes the page's colours inside a doc figure, and counts as the edit's own
    chrome so a click in it does not leave the edit. */
export function Sub({ label, look, children }: { label: ReactNode; look?: MenuLook; children: ReactNode }) {
  return (
    <ContextMenuSub>
      <ContextMenuSubTrigger className={look?.item}>{label}</ContextMenuSubTrigger>
      <ContextMenuSubContent data-edit-chrome collisionPadding={8} className={cn('min-w-44', look?.content)}>{children}</ContextMenuSubContent>
    </ContextMenuSub>
  )
}

export function SettingsMenu({ settings, apply, look }: { settings: Setting[]; apply: (r: Result) => void; look?: MenuLook }) {
  if (!settings.length) return null
  return (
    <Sub label="Settings" look={look}>
      {settings.map((s) => s.kind === 'flag'
        ? <ContextMenuCheckboxItem key={s.id} className={look?.item} checked={s.on} onSelect={() => apply({ set: s.set(!s.on) })}>{s.label}</ContextMenuCheckboxItem>
        : (
          <Sub key={s.id} look={look} label={<span className="flex flex-1 items-center justify-between gap-5"><span>{s.label}</span><span className="text-ink-3">{s.options.find((o) => o.value === s.value)?.label ?? ''}</span></span>}>
            <ContextMenuRadioGroup value={s.value} onValueChange={(v) => apply({ set: s.set(v) })}>
              {s.options.map((o) => <ContextMenuRadioItem key={o.value} className={look?.item} value={o.value}>{o.label}</ContextMenuRadioItem>)}
            </ContextMenuRadioGroup>
          </Sub>
        ))}
    </Sub>
  )
}
