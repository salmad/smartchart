/* Under the slide, beside its checks: the two ways to change it, by hand (Edit, E) or by leaving a note for an agent
   (Comment, C). The same place for both, and the same keys. */
import { MessageSquare, Pencil } from 'lucide-react'
import { cn } from '@/app/lib/utils'

interface Props { disabled: boolean; commenting: boolean; open: number; onEdit: () => void; onComment: () => void }

export function SlideActions({ disabled, commenting, open, onEdit, onComment }: Props) {
  return (
    <div className="flex items-center gap-0.5">
      <Action label="Edit" keys="E" disabled={disabled} onClick={onEdit}><Pencil aria-hidden className="size-4" strokeWidth={1.75} /></Action>
      <Action label="Comment" keys="C" tour="comments" pressed={commenting} onClick={onComment} count={open}><MessageSquare aria-hidden className="size-4" strokeWidth={1.75} /></Action>
    </div>
  )
}

function Action({ label, keys, tour, pressed, disabled, count, onClick, children }: { label: string; keys: string; tour?: string; pressed?: boolean; disabled?: boolean; count?: number; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" data-tour={tour} aria-pressed={pressed} disabled={disabled} onClick={onClick} title={`${label} (${keys})`}
      aria-label={count ? `${label}, ${count} open` : label}
      className={cn('flex h-7 cursor-pointer items-center gap-1.5 rounded-md px-2 text-[12.5px] text-ink-2 outline-none transition-colors hover:bg-panel hover:text-ink focus-visible:ring-1 focus-visible:ring-line-2',
        'disabled:cursor-not-allowed disabled:opacity-45 aria-pressed:bg-panel aria-pressed:text-ink')}>
      {children}
      <span className="max-[1100px]:sr-only">{label}</span>
      {count ? <span className="tabular-nums text-ink-3">· {count}</span> : <kbd className="font-mono text-[11px] text-ink-3 max-[1100px]:hidden">{keys}</kbd>}
    </button>
  )
}
