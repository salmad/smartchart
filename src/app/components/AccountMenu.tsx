import { useEffect, useState } from 'react'
import { Compass, LogOut, PenLine, Plug } from 'lucide-react'
import { signOut, type Account } from '@/app/auth'
import { dropLinkParam, linkParam } from '@/app/email-links'
import { go } from '@/app/route'
import { Avatar } from './Avatar'
import { AgentKey } from './AgentKey'
import { MENU_ICON } from './menu'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from './ui/dropdown-menu'

/** Your avatar at the right of the bar: who is signed in, Connect an agent and Sign out. */
export function AccountMenu({ account, onTour = null, onReview = null }: { account: Account; onTour?: (() => void) | null; onReview?: (() => void) | null }) {
  const [connecting, setConnecting] = useState(() => linkParam('connect') !== null)
  useEffect(() => dropLinkParam('connect'), [])
  const who = account.name || account.email
  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger data-tour="account" aria-label={`Account: ${who}`} title={who}
          className="grid size-8 flex-none cursor-pointer place-items-center rounded-full outline-none transition-colors hover:bg-panel focus-visible:ring-1 focus-visible:ring-line-2 data-[state=open]:bg-panel">
          <span className="relative grid size-7 place-items-center overflow-hidden rounded-full bg-raise text-[12px] font-medium text-ink shadow-[0_0_0_1px_theme(colors.line-2)]">
            <Avatar name={who} image={account.image} />
          </span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={8} className="min-w-[220px]">
          <DropdownMenuLabel className="grid gap-0.5 px-2 py-1.5 font-normal">
            {account.name && <span className="text-[13px] font-medium">{account.name}</span>}
            <span className="truncate text-[12.5px] text-ink-3">{account.email}</span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setConnecting(true)}><Plug {...MENU_ICON} />Connect an agent</DropdownMenuItem>
          {onReview && <DropdownMenuItem onSelect={onReview}><PenLine {...MENU_ICON} />Review a deck</DropdownMenuItem>}
          {onTour && <DropdownMenuItem onSelect={onTour}><Compass {...MENU_ICON} />Take the tour</DropdownMenuItem>}
          <DropdownMenuItem onSelect={() => void signOut().then(() => go('/'))}><LogOut {...MENU_ICON} />Sign out</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <AgentKey open={connecting} onOpenChange={setConnecting} />
    </>
  )
}
