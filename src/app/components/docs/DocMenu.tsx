/* The doc's own menu, beside its name. Versions open from the read view only: a draft can't be overwritten under you. */
import { History, MoreHorizontal } from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/app/components/ui/dropdown-menu'
import { MENU_ICON, MENU_ITEM as ITEM } from '@/app/components/menu'

export function DocMenu({ onVersions }: { onVersions: () => void }) {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger aria-label="Doc menu" title="Doc menu"
        className="grid size-7 flex-none cursor-pointer place-items-center rounded-md text-ink-3 outline-none transition-colors hover:bg-panel hover:text-ink focus-visible:ring-1 focus-visible:ring-line-2 data-[state=open]:bg-panel data-[state=open]:text-ink">
        <MoreHorizontal className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={6} className="min-w-[180px] rounded-[10px] border-line-2 bg-raise p-1 text-ink">
        <DropdownMenuItem onSelect={onVersions} className={ITEM}><History {...MENU_ICON} />Versions</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
