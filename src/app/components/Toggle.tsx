import type { ReactNode } from 'react'
import { MessageSquare } from 'lucide-react'
import { cn } from '@/app/lib/utils'

interface Props {
  open: boolean
  onClick: () => void
  /** The name a screen reader hears; also the tooltip unless `title` says more. */
  label: string
  title?: string
  /** The shortcut, shown in the tooltip. */
  keys?: string
  /** A number beside the icon (open comments, checks to look at); nothing at zero. */
  count?: number
  /** A gold dot at the corner: something here needs attention. */
  dot?: boolean
  /** The tour's anchor. */
  tour?: string
  children: ReactNode
}

/** A panel's toggle in a bar: pressed while its panel is open. */
export function Toggle({ open, onClick, label, title, keys, count = 0, dot = false, tour, children }: Props) {
  return (
    <button type="button" data-tour={tour} onClick={onClick} aria-label={label} aria-pressed={open} title={title ?? (keys ? `${label} (${keys})` : label)}
      className={cn('relative flex h-8 flex-none cursor-pointer items-center justify-center gap-1.5 rounded-lg text-ink-3 outline-none transition-[color,background-color,transform] duration-150 ease-out-strong hover:bg-panel hover:text-ink focus-visible:ring-1 focus-visible:ring-ring active:scale-[.94] aria-pressed:bg-panel aria-pressed:text-ink motion-reduce:transition-none', count > 0 ? 'px-2' : 'w-8')}>
      {children}
      {dot && <i aria-hidden className="absolute right-1 top-1 size-1.5 rounded-full bg-gold" />}
      {count > 0 && <span className="font-mono text-[11px] tabular-nums text-ink-2">{count}</span>}
    </button>
  )
}

/** The comments toggle, with the open count beside the icon once there is one. */
export function CommentsToggle({ open, count, onClick, tour, keys }: { open: boolean; count: number; onClick: () => void; tour?: string; keys?: string }) {
  return (
    <Toggle tour={tour} open={open} onClick={onClick} label={count ? `Comments, ${count} open` : 'Comments'} title={keys ? `Comments (${keys})` : 'Comments'} count={count}>
      <MessageSquare aria-hidden className="size-[17px]" strokeWidth={1.75} />
    </Toggle>
  )
}
