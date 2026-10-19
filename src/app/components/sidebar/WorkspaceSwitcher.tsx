import { Check, ChevronsUpDown, Plus, Users } from 'lucide-react'
import type { Role, Workspace } from '@/app/workspaces'
import { MENU_ICON, MENU_ITEM } from '../menu'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '../ui/dropdown-menu'

interface Props {
  list: Workspace[] | null
  current: Workspace | null
  busy: boolean
  onSwitch: (id: string) => void
  onNew: () => void
  /** Owners manage members (Task 8 fills this in); null hides it. */
  onMembers: (() => void) | null
}

const ROLE: Record<Role, string> = { owner: 'Owner', editor: 'Editor', viewer: 'Viewer' }

/** The workspace's name at the top of the sidebar, as in Linear and Notion: it opens the list of workspaces. The role
    shows, muted, only where it limits what the user can do (an editor or a viewer). */
export function WorkspaceSwitcher({ list, current, busy, onSwitch, onNew, onMembers }: Props) {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger disabled={busy || !current} aria-label={current ? `Workspace: ${current.name}` : 'Workspace'}
        className="flex h-10 w-full min-w-0 cursor-pointer items-center gap-2 rounded-lg px-2.5 text-left outline-none transition-colors hover:bg-panel focus-visible:ring-1 focus-visible:ring-line-2 disabled:cursor-default disabled:hover:bg-transparent data-[state=open]:bg-panel">
        <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold tracking-[-.01em] text-ink">{current?.name ?? ' '}</span>
        {current && current.role !== 'owner' && <span className="flex-none text-[11.5px] text-ink-3">{ROLE[current.role]}</span>}
        <ChevronsUpDown aria-hidden className="size-3.5 flex-none text-ink-3" strokeWidth={1.75} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[232px] rounded-[10px] border-line-2 bg-raise p-1 text-ink">
        <DropdownMenuLabel className="px-2 pb-1 pt-1.5 font-mono text-[10.5px] font-medium uppercase tracking-[.1em] text-ink-3">Workspaces</DropdownMenuLabel>
        {(list ?? []).map((w) => (
          <DropdownMenuItem key={w.id} onSelect={() => { if (w.id !== current?.id) onSwitch(w.id) }} className={MENU_ITEM}>
            <span className="min-w-0 flex-1 truncate">{w.name}</span>
            {w.role !== 'owner' && <span className="flex-none text-[11.5px] text-ink-3">{ROLE[w.role]}</span>}
            <Check {...MENU_ICON} aria-label={w.id === current?.id ? 'Open' : undefined} className={w.id === current?.id ? 'size-3.5' : 'invisible size-3.5'} />
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator className="my-1 bg-line" />
        {onMembers && <DropdownMenuItem onSelect={onMembers} className={MENU_ITEM}><Users {...MENU_ICON} />Members…</DropdownMenuItem>}
        <DropdownMenuItem onSelect={onNew} className={MENU_ITEM}><Plus {...MENU_ICON} />New workspace…</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
