import { forwardRef, type ReactNode } from 'react'
import { Copy, Trash2, X } from 'lucide-react'
import type { FieldDef, MemberLite, Status } from '@/engine/roadmaps/types'
import { STATUS_LABEL, STATUSES } from '@/engine/roadmaps/types'
import { Button, type ButtonProps } from '../ui/button'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger,
} from '../ui/dropdown-menu'
import { cn } from '@/app/lib/utils'
import { Avatar } from './Avatar'
import { StatusGlyph } from './StatusGlyph'
import { menuSurface } from './roadmapChrome'

const surface = cn('min-w-44 p-1 text-ink', menuSurface)
const item = 'rounded-md text-[13px] focus:bg-panel data-[state=open]:bg-panel'

const BarButton = forwardRef<HTMLButtonElement, ButtonProps>(({ className, ...props }, ref) => (
  <Button ref={ref} variant="ghost" size="sm" className={cn('gap-1.5 px-2 text-[13px] font-normal hover:bg-panel data-[state=open]:bg-panel data-[state=open]:text-ink', className)} {...props} />
))
BarButton.displayName = 'BarButton'

function BarMenu({ label, children }: { label: string; children: ReactNode }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <BarButton>{label}</BarButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" sideOffset={8} className={surface}>
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

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

/** What to do with the selected rows: a bar that rises over the foot of the table, so nothing in it moves. */
export function BulkBar({ count, fields, members, onStatus, onAssignee, onField, onDuplicate, onDelete, onClear }: Props) {
  const choices = fields.filter((f) => f.type === 'choice')
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-5 z-40 flex justify-center px-4">
      <div
        role="toolbar"
        aria-label="Selection"
        className={cn(
          'pointer-events-auto flex items-center gap-0.5 border py-1 pl-3.5 pr-1 animate-in fade-in-0 slide-in-from-bottom-2 ease-out [animation-duration:140ms] motion-reduce:animate-none',
          menuSurface,
        )}
      >
        <span className="mr-2 whitespace-nowrap text-[13px] tabular-nums text-ink">{count} selected</span>
        <BarMenu label="Status">
          {STATUSES.map((s) => (
            <DropdownMenuItem key={s} className={item} onSelect={() => onStatus(s)}>
              <StatusGlyph status={s} />
              {STATUS_LABEL[s]}
            </DropdownMenuItem>
          ))}
        </BarMenu>
        <BarMenu label="Assignee">
          <DropdownMenuItem className={cn(item, 'text-ink-2')} onSelect={() => onAssignee(null)}>Unassigned</DropdownMenuItem>
          {members.map((m) => (
            <DropdownMenuItem key={m.id} className={item} onSelect={() => onAssignee(m.id)}>
              <Avatar name={m.name} />
              {m.name}
            </DropdownMenuItem>
          ))}
        </BarMenu>
        {choices.length > 0 && (
          <BarMenu label="Set field">
            {choices.map((f) => (
              <DropdownMenuSub key={f.id}>
                <DropdownMenuSubTrigger className={cn(item, '[&_svg]:text-ink-3')}>{f.name}</DropdownMenuSubTrigger>
                <DropdownMenuSubContent sideOffset={6} className={surface} aria-label={f.name}>
                  <DropdownMenuItem className={cn(item, 'text-ink-2')} onSelect={() => onField(f.id, null)}>Clear</DropdownMenuItem>
                  {(f.options ?? []).map((o) => (
                    <DropdownMenuItem key={o.id} className={item} onSelect={() => onField(f.id, o.id)}>
                      {o.emoji && <span aria-hidden>{o.emoji}</span>}
                      {o.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            ))}
          </BarMenu>
        )}
        <span aria-hidden className="mx-1.5 h-4 w-px bg-line" />
        <BarButton onClick={onDuplicate}>
          <Copy strokeWidth={1.75} aria-hidden />
          Duplicate
        </BarButton>
        <BarButton onClick={onDelete}>
          <Trash2 strokeWidth={1.75} aria-hidden />
          Delete
        </BarButton>
        <span aria-hidden className="mx-1.5 h-4 w-px bg-line" />
        <BarButton aria-label="Clear selection" className="w-7 px-0" onClick={onClear}>
          <X strokeWidth={1.75} aria-hidden />
        </BarButton>
      </div>
    </div>
  )
}
