import { useState } from 'react'
import { LogOut, Plug } from 'lucide-react'
import { signOut, type Account } from '@/app/auth'
import { go } from '@/app/route'
import { AgentKey } from './AgentKey'
import { MENU_ICON, MENU_ITEM } from './menu'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from './ui/dropdown-menu'

/** Your avatar at the right of the bar: who is signed in, Connect an agent and Sign out. */
export function AccountMenu({ account }: { account: Account }) {
  const [connecting, setConnecting] = useState(false)
  const who = account.name || account.email
  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger aria-label={`Account: ${who}`} title={who}
          className="grid size-8 flex-none cursor-pointer place-items-center rounded-full outline-none transition-colors hover:bg-panel focus-visible:ring-1 focus-visible:ring-line-2 data-[state=open]:bg-panel">
          <span className="grid size-7 place-items-center overflow-hidden rounded-full bg-raise text-[12px] font-medium text-ink shadow-[0_0_0_1px_theme(colors.line-2)]">
            {account.image ? <img src={account.image} alt="" className="size-full object-cover" /> : who.slice(0, 1).toUpperCase()}
          </span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={8} className="min-w-[220px] rounded-[10px] border-line-2 bg-raise p-1 text-ink">
          <DropdownMenuLabel className="grid gap-0.5 px-2 py-1.5 font-normal">
            {account.name && <span className="text-[13px] font-medium">{account.name}</span>}
            <span className="truncate text-[12.5px] text-ink-3">{account.email}</span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator className="bg-line" />
          <DropdownMenuItem onSelect={() => setConnecting(true)} className={MENU_ITEM}><Plug {...MENU_ICON} />Connect an agent</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => void signOut().then(() => go('/'))} className={MENU_ITEM}><LogOut {...MENU_ICON} />Sign out</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <AgentKey open={connecting} onOpenChange={setConnecting} />
    </>
  )
}
