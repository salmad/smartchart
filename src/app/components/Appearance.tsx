/* Appearance: app chrome (Dark / Light / System) and slides palette (Ink / Paper) plus accent. Opened from the avatar
   menu as a popover beside it, so the page behind shows each change at once. */
import type { ReactNode } from 'react'
import type { Chrome } from '@/engine/look'
import type { UserLookControls } from '@/app/user-look-context'
import { AccentPanel, accentLook } from './AccentPicker'
import { Seg } from './Seg'
import { Popover, PopoverAnchor, PopoverContent } from './ui/popover'

interface Props { look: UserLookControls; open: boolean; onOpenChange: (open: boolean) => void; children: ReactNode }

const CHROME: [Chrome, string][] = [['dark', 'Dark'], ['light', 'Light'], ['system', 'System']]

/** `children`: what the popover hangs from (the avatar). */
export function Appearance({ look, open, onOpenChange, children }: Props) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverAnchor asChild>{children}</PopoverAnchor>
      <PopoverContent align="end" sideOffset={8} aria-label="Appearance" className="grid w-80 gap-4 p-4">
        <div className="grid gap-1">
          <h2 className="text-[14px] font-medium text-ink">Appearance</h2>
          <p className="text-[12.5px] text-ink-3">App chrome, and the palette on every deck and doc.</p>
        </div>
        <div className="grid gap-1.5">
          <p className="text-[12px] text-ink-3">App</p>
          <Seg label="App" value={look.chrome} onChange={look.onChrome} options={CHROME} />
        </div>
        <div className="grid gap-1.5">
          <p className="text-[12px] text-ink-3">Slides</p>
          <Seg label="Slides" value={look.theme} onChange={look.onTheme} options={[['ink', 'Ink'], ['paper', 'Paper']]} />
        </div>
        <div className="grid gap-3"><AccentPanel look={accentLook(look.accent, look.theme)} accent={look.accent} onChange={look.onAccent} /></div>
      </PopoverContent>
    </Popover>
  )
}
