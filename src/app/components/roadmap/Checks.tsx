import { ArrowUpFromLine, Ban, CalendarOff, Check, ChevronRight, Clock, Hourglass, ListTree, UserRound, type LucideIcon } from 'lucide-react'
import { ALARM_CHECKS, CHECK_COPY, CHECK_IDS, type CheckCard, type CheckId, type CheckReport } from '@/engine/roadmaps/checks'
import { cn } from '@/app/lib/utils'

interface Props {
  report: CheckReport
  hasIssues: boolean
  onOpen: (id: CheckId) => void
}

const ICON: Record<CheckId, LucideIcon> = {
  no_dates: CalendarOff,
  overdue: Clock,
  blocked: Ban,
  no_assignee: UserRound,
  long: Hourglass,
  outside_parent: ArrowUpFromLine,
  done_open: ListTree,
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/** The roadmap's health as a list: what is wrong first, what is merely incomplete next, and what passes on one quiet
    line. A row opens the table filtered to its issues. */
export function Checks({ report, hasIssues, onOpen }: Props) {
  const cards = CHECK_IDS.map((id) => report.cards.find((c) => c.id === id) ?? { id, count: 0, issueIds: [] })
  const failing = cards.filter((c) => c.count > 0)
  const alarms = failing.filter((c) => ALARM_CHECKS.includes(c.id))
  const advisory = failing.filter((c) => !ALARM_CHECKS.includes(c.id))
  const passing = cards.filter((c) => c.count === 0)

  const summary = !hasIssues
    ? 'No issues on this roadmap yet.'
    : report.alarms > 0
      ? `${plural(report.alarms, 'issue needs', 'issues need')} attention.`
      : advisory.length > 0
        ? 'Nothing is wrong. A few issues are incomplete.'
        : 'Everything is in order.'

  return (
    <section role="region" aria-label="Checks" className="min-h-0 min-w-0 flex-1 overflow-auto">
      <div className="mx-auto w-full max-w-[720px] px-8 py-10 max-[900px]:px-4 max-[900px]:py-6">
        <h2 className="text-[15px] font-medium tracking-[-.01em] text-ink">Checks</h2>
        <p className="mt-1 text-[13px] text-ink-2">{summary}</p>
        {alarms.length > 0 && <Group title="Needs attention" cards={alarms} alarm onOpen={onOpen} />}
        {advisory.length > 0 && <Group title="Incomplete" cards={advisory} onOpen={onOpen} />}
        {hasIssues && passing.length > 0 && (
          <p className="mt-8 flex items-start gap-2.5 px-2 text-[12px] leading-[18px] text-ink-3">
            <Check className="mt-px size-4 flex-none" strokeWidth={1.75} aria-hidden />
            <span>
              {failing.length === 0 ? 'All checks pass' : plural(passing.length, 'check passes', 'checks pass')}: {passing.map((c) => CHECK_COPY[c.id].label.toLowerCase()).join(', ')}.
            </span>
          </p>
        )}
      </div>
    </section>
  )
}

function Group({ title, cards, alarm = false, onOpen }: { title: string; cards: CheckCard[]; alarm?: boolean; onOpen: (id: CheckId) => void }) {
  return (
    <div className="mt-8">
      <h3 className="px-2 pb-1.5 text-[11px] text-ink-3">{title}</h3>
      <ul className="border-t border-hair">
        {cards.map(({ id, count }) => {
          const { label, detail } = CHECK_COPY[id]
          const Icon = ICON[id]
          return (
            <li key={id} className="border-b border-hair">
              <button
                type="button"
                aria-label={`${label}, ${count} issues`}
                className="group flex h-[52px] w-full items-center gap-3 rounded-md px-2 text-left outline-none transition-colors duration-150 hover:bg-panel focus-visible:bg-panel focus-visible:ring-1 focus-visible:ring-line-2"
                onClick={() => onOpen(id)}
              >
                <Icon className={cn('size-4 flex-none', alarm ? 'text-bad' : 'text-ink-3')} strokeWidth={1.75} aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-ink">{label}</span>
                  <span className="block truncate text-[12px] text-ink-3">{detail}</span>
                </span>
                <span className="text-[13px] tabular-nums text-ink-2">{count}</span>
                <ChevronRight className="size-4 flex-none text-ink-3 transition-colors group-hover:text-ink-2" strokeWidth={1.75} aria-hidden />
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
