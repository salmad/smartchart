/* The slash menu under the paragraph where / was typed. The cursor stays in the paragraph: the editor sends the arrows,
   Enter and Esc here, and what is typed after the / filters it. A click picks too. */
import { useEffect, useRef } from 'react'
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from '@/app/components/ui/command'
import { cn } from '@/app/lib/utils'
import { surface, tintOnFocus } from './chrome'
import type { SlashChoice } from './slash'

interface Props { x: number; y: number; choices: SlashChoice[]; active: string | null; onPick: (c: SlashChoice) => void; onHover: (id: string) => void }

export function SlashMenu({ x, y, choices, active, onPick, onHover }: Props) {
  const box = useRef<HTMLDivElement | null>(null)
  const place = (m: HTMLDivElement | null) => { box.current = m; m?.style.setProperty('--x', `${x}px`); m?.style.setProperty('--y', `${y}px`) }
  // The choice moved to by the keys stays in view.
  useEffect(() => { box.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' }) }, [active])
  const groups = (['Text', 'Figures'] as const).map((g) => [g, choices.filter((c) => c.group === g)] as const).filter(([, cs]) => cs.length)
  return (
    <div ref={place} data-edit-chrome onMouseDown={(e) => e.preventDefault()}
      className={cn("absolute left-[var(--x)] top-[var(--y)] z-30 w-[300px] overflow-hidden rounded-[10px]", surface)}>
      <Command shouldFilter={false} value={active ?? ''} onValueChange={onHover} className="bg-transparent text-[var(--fg)]">
        <CommandList label="Insert a block" className="max-h-[320px] p-1">
          <CommandEmpty className="px-3 py-3 text-[13px] text-[var(--muted)]">No block by that name.</CommandEmpty>
          {groups.map(([g, cs]) => (
            <CommandGroup key={g} heading={g} className="p-0 [&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-[var(--muted)]">
              {cs.map((c) => (
                <CommandItem key={c.id} value={c.id} onSelect={() => onPick(c)} className={cn("gap-3 rounded-md px-2.5 py-1.5", tintOnFocus)}>
                  <span className="grid size-7 flex-none place-items-center rounded-md shadow-[0_0_0_1px_var(--line)]"><c.icon className="size-4 text-[var(--fg-2)]" strokeWidth={1.75} /></span>
                  <span className="grid min-w-0 leading-tight">
                    <span className="text-[13px] text-[var(--fg)]">{c.label}</span>
                    <span className="truncate text-[11.5px] text-[var(--muted)]">{c.blurb}</span>
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
        </CommandList>
      </Command>
    </div>
  )
}
