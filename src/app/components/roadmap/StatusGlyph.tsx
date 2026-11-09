import { Check, Minus } from 'lucide-react'
import type { Status } from '@/engine/roadmaps/types'
import { cn } from '@/app/lib/utils'

interface Props {
  status: Status
  className?: string
}

/** Linear-style status circle: outline, half, tick, or red blocked. */
export function StatusGlyph({ status, className }: Props) {
  const base = cn('inline-block size-3 shrink-0 rounded-full align-[-1px]', className)

  if (status === 'done') {
    return (
      <span className={cn(base, 'relative bg-ok')} aria-hidden>
        <Check className="absolute left-0.5 top-0.5 size-2 text-app-bg" strokeWidth={3} />
      </span>
    )
  }

  if (status === 'blocked') {
    return (
      <span className={cn(base, 'relative bg-bad')} aria-hidden>
        <Minus className="absolute left-0.5 top-1.5 size-2 text-app-bg" strokeWidth={3} />
      </span>
    )
  }

  if (status === 'in_progress') {
    return (
      <span
        className={cn(
          base,
          'box-border bg-[conic-gradient(theme(colors.gold)_0_50%,transparent_50%_100%)] p-[3px] shadow-[inset_0_0_0_1.5px_theme(colors.gold)]',
        )}
        aria-hidden
      />
    )
  }

  if (status === 'cancelled') {
    return <span className={cn(base, 'shadow-[inset_0_0_0_1.5px_theme(colors.ink-3)] opacity-50')} aria-hidden />
  }

  return <span className={cn(base, 'shadow-[inset_0_0_0_1.5px_theme(colors.ink-3)]')} aria-hidden />
}
