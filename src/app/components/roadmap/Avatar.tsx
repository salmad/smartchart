import { cn } from '@/app/lib/utils'

const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('') || '?'

/** An 18 px initials disc. Neutral on purpose: colour means status or a problem. */
export function Avatar({ name, className }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn('inline-grid size-[18px] shrink-0 place-items-center rounded-full bg-ink-2 text-[9px] font-semibold text-app-bg', className)}
    >
      {initials(name)}
    </span>
  )
}
