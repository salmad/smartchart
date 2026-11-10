import { ArrowUpFromLine, Ban, CalendarOff, Check, ChevronRight, Clock, Hourglass, UserX, CheckCheck, type LucideIcon } from 'lucide-react'
import { CHECK_COPY, CHECK_IDS, type CheckId, type CheckReport } from '@/engine/roadmaps/checks'
import { cn } from '@/app/lib/utils'

interface Props {
  report: CheckReport
  hasIssues: boolean
  onOpen: (id: CheckId) => void
}

/** Checks that mean something is wrong, not just unfinished: they turn red when they have issues. */
const BAD: CheckId[] = ['overdue', 'blocked', 'outside_parent', 'done_open']

const ICON: Record<CheckId, LucideIcon> = {
  no_dates: CalendarOff,
  overdue: Clock,
  blocked: Ban,
  no_assignee: UserX,
  long: Hourglass,
  outside_parent: ArrowUpFromLine,
  done_open: CheckCheck,
}

/** One card for each check. A card with issues opens the table filtered to them. */
export function Checks({ report, hasIssues, onOpen }: Props) {
  const cards = CHECK_IDS.map((id) => report.cards.find((c) => c.id === id) ?? { id, count: 0, issueIds: [] })
  const attention = cards.filter((c) => c.count > 0 && BAD.includes(c.id)).length
  const flagged = cards.filter((c) => c.count > 0).length

  return (
    <section role="region" aria-label="Checks" className="flex min-h-0 min-w-0 flex-1 flex-col overflow-auto">
      <div className="mx-auto w-full max-w-5xl px-8 py-8">
        <div className="mb-5 flex items-baseline gap-3">
          <h2 className="text-[15px] font-medium tracking-[-.01em] text-ink">Roadmap checks</h2>
          <p className="text-[12.5px] text-ink-3">
            {!hasIssues
              ? 'No issues on this roadmap yet.'
              : flagged === 0
                ? 'Everything is in order.'
                : attention > 0
                  ? `${attention} ${attention === 1 ? 'check needs' : 'checks need'} attention`
                  : `${flagged} ${flagged === 1 ? 'check has' : 'checks have'} issues to look at`}
          </p>
        </div>
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3">
          {cards.map(({ id, count }) => {
            const copy = CHECK_COPY[id]
            const Icon = ICON[id]
            const bad = count > 0 && BAD.includes(id)
            const face = (
              <>
                <span
                  className={cn(
                    'flex size-8 shrink-0 items-center justify-center rounded-lg',
                    bad ? 'bg-bad/15 text-bad' : 'bg-panel text-ink-3',
                  )}
                >
                  <Icon className="size-4" strokeWidth={1.75} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13.5px] font-medium text-ink">{copy.label}</span>
                  <span className="mt-0.5 block text-[12px] leading-snug text-ink-3">{copy.detail}</span>
                </span>
                {count === 0 ? (
                  <span className="flex items-center gap-1 text-[11.5px] text-ink-3">
                    <Check className="size-3.5" strokeWidth={2} aria-hidden />
                    <span className="tabular-nums">0</span>
                  </span>
                ) : (
                  <span className="flex items-center gap-1">
                    <span className={cn('text-[22px] font-semibold leading-none tabular-nums tracking-[-.02em]', bad ? 'text-bad' : 'text-ink')}>
                      {count}
                    </span>
                    <ChevronRight className="size-3.5 text-ink-3" strokeWidth={2} aria-hidden />
                  </span>
                )}
              </>
            )
            const surface = cn(
              'flex w-full items-center gap-3 rounded-xl bg-raise p-3.5 text-left ring-1 ring-inset',
              bad ? 'ring-bad/35' : 'ring-line',
            )
            if (count === 0) {
              return (
                <li key={id} className={cn(surface, 'opacity-60')}>
                  {face}
                </li>
              )
            }
            return (
              <li key={id}>
                <button
                  type="button"
                  className={cn(
                    surface,
                    'outline-none transition-[box-shadow,transform] duration-150 ease-out-strong active:scale-[.98] focus-visible:ring-ink-3 motion-reduce:transition-none motion-reduce:active:scale-100',
                    bad ? 'hover:ring-bad/60' : 'hover:ring-line-2',
                  )}
                  aria-label={`${copy.label}, ${count} issues`}
                  onClick={() => onOpen(id)}
                >
                  {face}
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
