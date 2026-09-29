import { signOut, type Account } from '@/app/auth'
import { go } from '@/app/route'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from './ui/dropdown-menu'

/** The foot of the decks sidebar: who is signed in, with Sign out. */
export function AccountMenu({ account }: { account: Account }) {
  return (
    <div className="border-t border-line p-2">
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-left outline-none transition-colors hover:bg-panel focus-visible:ring-1 focus-visible:ring-line-2 data-[state=open]:bg-panel">
          <span className="grid size-7 flex-none place-items-center overflow-hidden rounded-full bg-raise text-[12px] font-medium text-ink shadow-[0_0_0_1px_theme(colors.line-2)]">
            {account.image ? <img src={account.image} alt="" className="size-full object-cover" /> : (account.name || account.email).slice(0, 1).toUpperCase()}
          </span>
          <span className="truncate text-[13px] text-ink-2">{account.name || account.email}</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="start" className="min-w-[220px] rounded-[10px] border-line-2 bg-raise p-1 text-ink">
          <DropdownMenuLabel className="grid gap-0.5 px-2 py-1.5 font-normal">
            {account.name && <span className="text-[13px] font-medium">{account.name}</span>}
            <span className="truncate text-[12.5px] text-ink-3">{account.email}</span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator className="bg-line" />
          <DropdownMenuItem onSelect={() => void signOut().then(() => go('/'))} className="rounded-md px-2 py-1.5 text-[13px] text-ink-2 focus:bg-panel focus:text-ink">Sign out</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
