import { FileText, X } from 'lucide-react'
import { cn } from '@/app/lib/utils'

interface Props { name: string; about?: string; error?: string; onRemove?: () => void }

/** A file on a message: its name and what was read from it (or why it couldn't be), removable while composing. */
export function FileChip({ name, about, error, onRemove }: Props) {
  return (
    <span title={error ?? `${name}${about ? ` · ${about}` : ''}`}
      className={cn('flex h-8 max-w-[280px] items-center gap-2 rounded-lg border bg-app-bg pl-2.5 text-[12.5px]', onRemove ? 'pr-1' : 'pr-2.5', error ? 'border-bad/40' : 'border-line-2')}>
      <FileText className={cn('size-3.5 flex-none', error ? 'text-bad' : 'text-ink-3')} strokeWidth={1.75} />
      <span className="min-w-0 truncate text-ink">{name}</span>
      {(error || about) && <span className={cn('flex-none', error ? 'text-bad' : 'text-ink-3')}>{error ? 'Couldn’t read' : about}</span>}
      {onRemove && (
        <button type="button" onClick={onRemove} aria-label={`Remove ${name}`}
          className="grid size-6 flex-none cursor-pointer place-items-center rounded-md text-ink-3 hover:bg-panel hover:text-ink">
          <X className="size-3.5" strokeWidth={1.75} />
        </button>
      )}
    </span>
  )
}
