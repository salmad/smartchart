import { Plus } from 'lucide-react'
import { cn } from '@/app/lib/utils'
import { Button } from '../ui/button'

/* What a roadmap becomes, drawn small: a goal with work nested under it, each bar drawing itself from its start, the one
   on the critical path in gold, and today's line. Written out whole (Tailwind reads classes from the source). */
const ROWS = [
  { label: 'w-16', bar: 'left-[4%] w-[46%] bg-ink/25', delay: '[animation-delay:150ms]' },
  { label: 'w-12 ml-3', bar: 'left-[10%] w-[24%] bg-ink/15', delay: '[animation-delay:300ms]' },
  { label: 'w-14 ml-3', bar: 'left-[30%] w-[38%] bg-gold', delay: '[animation-delay:450ms]' },
  { label: 'w-10', bar: 'left-[58%] w-[34%] bg-ink/15', delay: '[animation-delay:600ms]' },
] as const

function Timeline() {
  return (
    <div aria-hidden className="relative w-[340px] max-w-full overflow-hidden rounded-[14px] border border-line bg-panel p-4 shadow-menu">
      <div className="mb-3 grid grid-cols-[72px_1fr] text-[10.5px] uppercase tracking-[.08em] text-ink-3">
        <span />
        <span className="grid grid-cols-3"><span>Nov</span><span>Dec</span><span>Jan</span></span>
      </div>
      <div className="grid gap-2.5">
        {ROWS.map((r, i) => (
          <div key={i} className="grid grid-cols-[72px_1fr] items-center">
            <span className={cn('h-1.5 rounded-full bg-line-2', r.label)} />
            <span className="relative h-3.5">
              <span className={cn('absolute inset-y-0 origin-left rounded-[4px] motion-safe:animate-stretch', r.bar, r.delay)} />
            </span>
          </div>
        ))}
      </div>
      {/* Today: a gold hairline across the rows. */}
      <span className="absolute bottom-3 left-[calc(72px+16px+(100%-72px-32px)*.44)] top-9 w-px bg-gold/70 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:delay-700 motion-safe:fill-mode-both" />
    </div>
  )
}

/** A roadmap with nothing in it: what it will be (the picture), why it is worth starting (one line), and the one next
    step. A viewer gets the picture and a sentence, no action. */
export function EmptyRoadmap({ onNewIssue }: { onNewIssue?: () => void }) {
  return (
    <div className="grid min-h-0 flex-1 place-items-center overflow-y-auto px-8 py-11">
      <div className="grid max-w-[420px] justify-items-center gap-8 text-center animate-in fade-in-0 slide-in-from-bottom-2 duration-500 ease-out-strong">
        <Timeline />
        <div className="grid justify-items-center gap-2.5">
          <h2 className="app-title text-[28px]">{onNewIssue ? 'Plan the work. See when it lands.' : 'Nothing planned yet'}</h2>
          <p className="text-[14px] leading-[1.55] text-ink-2 [text-wrap:pretty]">
            {onNewIssue
              ? 'Add issues, nest them under goals, give them dates and owners. Occam checks the plan for gaps and shows it as a table, a timeline or a priority matrix.'
              : 'When someone adds an issue, it appears here.'}
          </p>
        </div>
        {onNewIssue && (
          <Button onClick={onNewIssue}><Plus aria-hidden strokeWidth={2} />Add the first issue <kbd>C</kbd></Button>
        )}
      </div>
    </div>
  )
}
