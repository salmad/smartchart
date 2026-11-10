import { Copy, Trash2 } from 'lucide-react'
import type { FieldDef, MemberLite, Status } from '@/engine/roadmaps/types'
import { STATUS_LABEL, STATUSES } from '@/engine/roadmaps/types'
import { Button } from '../ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover'
import { Command, CommandItem, CommandList } from '../ui/command'
import { cn } from '@/app/lib/utils'
import { menuCommand, menuSurface } from './roadmapChrome'

/** The bar sits on panel, so its quiet buttons step up to raise. */
const bulkGhost = 'h-7 rounded-lg text-[12px] text-ink-2 transition-colors hover:bg-raise hover:text-ink'

interface Props {
  count: number
  fields: FieldDef[]
  members: MemberLite[]
  onStatus: (status: Status) => void
  onAssignee: (id: string | null) => void
  onField: (fieldId: string, value: string | null) => void
  onDuplicate: () => void
  onDelete: () => void
  onClear: () => void
}

export function BulkBar({ count, fields, members, onStatus, onAssignee, onField, onDuplicate, onDelete, onClear }: Props) {
  const choices = fields.filter((f) => f.type === 'choice')
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-line bg-panel px-4 py-2 text-[12px]">
      <span className="font-medium text-ink">
        {count} selected
      </span>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className={bulkGhost}>Set status</Button>
        </PopoverTrigger>
        <PopoverContent className={cn('w-44 overflow-hidden p-1', menuSurface)} align="start" sideOffset={6}>
          <Command className={menuCommand}>
            <CommandList label="Status">
              {STATUSES.map((s) => (
                <CommandItem key={s} value={s} onSelect={() => onStatus(s)} className="text-[13px]">
                  {STATUS_LABEL[s]}
                </CommandItem>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className={bulkGhost}>Set assignee</Button>
        </PopoverTrigger>
        <PopoverContent className={cn('w-48 overflow-hidden p-1', menuSurface)} align="start" sideOffset={6}>
          <Command className={menuCommand}>
            <CommandList label="Assignee">
              <CommandItem value="none" onSelect={() => onAssignee(null)} className="text-[13px]">Unassigned</CommandItem>
              {members.map((m) => (
                <CommandItem key={m.id} value={m.id} onSelect={() => onAssignee(m.id)} className="text-[13px]">{m.name}</CommandItem>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {choices.map((f) => (
        <Popover key={f.id}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className={bulkGhost}>Set {f.name}</Button>
          </PopoverTrigger>
          <PopoverContent className={cn('w-48 overflow-hidden p-1', menuSurface)} align="start" sideOffset={6}>
            <Command className={menuCommand}>
              <CommandList label={f.name}>
                {(f.options ?? []).map((o) => (
                  <CommandItem key={o.id} value={o.id} onSelect={() => onField(f.id, o.id)} className="text-[13px]">
                    {o.emoji && <span aria-hidden>{o.emoji} </span>}
                    {o.name}
                  </CommandItem>
                ))}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      ))}
      <span className="flex-1" />
      <Button variant="ghost" size="sm" className={cn(bulkGhost, 'gap-1')} onClick={onDuplicate}>
        <Copy className="size-3.5" strokeWidth={2} aria-hidden />
        Duplicate
      </Button>
      <Button variant="ghost" size="sm" className={cn(bulkGhost, 'gap-1 text-bad hover:text-bad')} onClick={onDelete}>
        <Trash2 className="size-3.5" strokeWidth={2} aria-hidden />
        Delete
      </Button>
      <Button variant="ghost" size="sm" className={bulkGhost} onClick={onClear}>Clear</Button>
    </div>
  )
}
