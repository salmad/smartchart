import { isLetterMark } from '@/engine/roadmaps/emoji'
import { cn } from '@/app/lib/utils'

/** A choice option's mark, the same everywhere it shows: an emoji as it is, one or two letters as a small badge so
    "UK" never reads as part of the option's name. */
export function OptionMark({ mark, className }: { mark?: string; className?: string }) {
  if (!mark) return null
  if (!isLetterMark(mark)) return <span aria-hidden className={className}>{mark}</span>
  return (
    <span aria-hidden className={cn('inline-grid h-4 min-w-4 shrink-0 place-items-center rounded-[4px] bg-ink/[.08] px-1 text-[9.5px] font-semibold leading-none tracking-[.02em] text-ink-2', className)}>
      {mark}
    </span>
  )
}
