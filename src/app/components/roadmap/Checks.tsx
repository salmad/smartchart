import { CHECK_COPY, CHECK_IDS, type CheckId, type CheckReport } from '@/engine/roadmaps/checks'
import { cn } from '@/app/lib/utils'

interface Props {
  report: CheckReport
  hasIssues: boolean
  onOpen: (id: CheckId) => void
}

const BAD: CheckId[] = ['overdue', 'blocked', 'outside_parent', 'done_open']

/** Seven check rows; card click hands off to the table filter. */
export function Checks({ report, hasIssues, onOpen }: Props) {
  return (
    <section role="region" aria-label="Checks" className="flex min-h-0 min-w-0 flex-1 flex-col overflow-auto">
      {!hasIssues && (
        <p className="border-b border-line px-8 py-6 text-[13.5px] text-ink-2">Nothing to look at.</p>
      )}
      <ul className="divide-y divide-line">
        {CHECK_IDS.map((id) => {
          const card = report.cards.find((c) => c.id === id) ?? { id, count: 0, issueIds: [] }
          const copy = CHECK_COPY[id]
          const count = card.count
          const countClass = cn(
            'tabular-nums text-[13px] font-medium',
            count === 0 ? 'text-ink-3' : BAD.includes(id) ? 'text-bad' : 'text-ink',
          )
          const inner = (
            <>
              <div className="min-w-0 flex-1">
                <div className="text-[13.5px] font-medium text-ink">{copy.label}</div>
                <div className="mt-0.5 text-[12.5px] text-ink-3">{copy.detail}</div>
              </div>
              <span className={countClass}>{count}</span>
            </>
          )
          if (count === 0) {
            return (
              <li key={id} className="flex w-full items-center gap-4 px-8 py-4 text-left">
                {inner}
              </li>
            )
          }
          return (
            <li key={id}>
              <button
                type="button"
                className="flex w-full items-center gap-4 px-8 py-4 text-left hover:bg-raise/60"
                aria-label={`${copy.label}, ${count} issues`}
                onClick={() => onOpen(id)}
              >
                {inner}
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
