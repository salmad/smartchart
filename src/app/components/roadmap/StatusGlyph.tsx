import type { Status } from '@/engine/roadmaps/types'
import { cn } from '@/app/lib/utils'

interface Props {
  status: Status
  className?: string
}

const TONE: Record<Status, string> = {
  backlog: 'text-ink-3',
  todo: 'text-ink-2',
  in_progress: 'text-gold',
  blocked: 'text-bad',
  done: 'text-ok',
  cancelled: 'text-ink-3',
}

/** A 14 px status mark on the text baseline: dashed ring (backlog), ring (to do), gold half (in progress), barred disc
    (blocked), ticked disc (done), crossed dim ring (cancelled). Shape carries the meaning, so it reads without colour. */
export function StatusGlyph({ status, className }: Props) {
  return (
    <svg
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden
      className={cn('inline-block size-3.5 shrink-0 align-[-2.5px]', TONE[status], className)}
    >
      {status === 'backlog' && (
        <circle cx="7" cy="7" r="5.25" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2.1 2.02" strokeLinecap="round" />
      )}
      {status === 'todo' && <circle cx="7" cy="7" r="5.25" stroke="currentColor" strokeWidth="1.5" />}
      {status === 'in_progress' && (
        <>
          <circle cx="7" cy="7" r="5.25" stroke="currentColor" strokeWidth="1.5" />
          <path d="M7 3.75a3.25 3.25 0 0 1 0 6.5z" fill="currentColor" />
        </>
      )}
      {status === 'blocked' && (
        <>
          <circle cx="7" cy="7" r="6" fill="currentColor" />
          <path d="M4.25 7h5.5" className="stroke-app-bg" strokeWidth="1.6" strokeLinecap="round" />
        </>
      )}
      {status === 'done' && (
        <>
          <circle cx="7" cy="7" r="6" fill="currentColor" />
          <path d="M4.4 7.2l1.8 1.8 3.4-3.7" className="stroke-app-bg" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
      {status === 'cancelled' && (
        <g opacity=".7">
          <circle cx="7" cy="7" r="5.25" stroke="currentColor" strokeWidth="1.5" />
          <path d="M5.1 5.1l3.8 3.8M8.9 5.1l-3.8 3.8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </g>
      )}
    </svg>
  )
}
