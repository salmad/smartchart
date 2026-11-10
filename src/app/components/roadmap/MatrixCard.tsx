import type { ReactNode } from 'react'
import type { Status } from '@/engine/roadmaps/types'
import { STATUS_LABEL } from '@/engine/roadmaps/types'
import { cn } from '@/app/lib/utils'
import { StatusGlyph } from './StatusGlyph'

/** A matrix cell's surface: a quiet raised card, the issue's whole state in two lines. */
export const cardSurface =
  'flex w-full flex-col justify-center gap-1.5 rounded-[7px] bg-raise px-2 py-1.5 text-left outline-none ring-1 ring-inset transition-[box-shadow,transform] duration-150 ease-out-strong active:scale-[.98] motion-reduce:transition-none motion-reduce:active:scale-100'
export const cardRing = 'ring-line hover:ring-line-2 focus-visible:ring-ink-3'
export const cardLateRing = 'ring-bad/45 hover:ring-bad/70 focus-visible:ring-bad'

type Tone = 'neutral' | 'done' | 'blocked'

const FILL: Record<Tone, string> = { neutral: 'fill-ink-2', done: 'fill-ok', blocked: 'fill-bad' }

/** The bar fills the card's width. The exact share sits beside it, so no tooltip. */
export function CardBar({ value, tone = 'neutral' }: { value: number; tone?: Tone }) {
  const w = Math.max(0, Math.min(100, value * 100))
  return (
    <svg viewBox="0 0 100 4" preserveAspectRatio="none" className="h-1 min-w-0 flex-1" aria-hidden>
      <rect width="100" height="4" rx="2" className="fill-white/[.08]" />
      <rect width={w} height="4" rx="2" className={FILL[tone]} />
    </svg>
  )
}

export function toneOf(status: Status | null, late: boolean): Tone {
  if (status === 'done') return 'done'
  if (status === 'blocked' || late) return 'blocked'
  return 'neutral'
}

interface FaceProps {
  /** Shown first on the top line: a status glyph and name, or "3 issues". */
  glyph?: ReactNode
  label?: string
  /** Right end of the top line: a quarter, or "Overdue". */
  quarter?: string | null
  late?: boolean
  assignee?: ReactNode
  progress?: number | null
  tone?: Tone
}

/** Line one: state and when. Line two: progress. Either line is dropped when its Display switch is off. */
export function CardFace({ glyph, label, quarter, late, assignee, progress, tone = 'neutral' }: FaceProps) {
  const top = glyph || label || quarter || assignee
  return (
    <>
      {top && (
        <span className="flex h-4 items-center gap-1.5 text-[12px] text-ink-2">
          {glyph}
          {label && <span className="truncate">{label}</span>}
          <span className="ml-auto flex items-center gap-1.5">
            {quarter && (
              <span className={cn('text-[11px] tabular-nums', late ? 'text-bad' : 'text-ink-3')}>{quarter}</span>
            )}
            {assignee}
          </span>
        </span>
      )}
      {progress != null && (
        <span className="flex h-3 items-center gap-2">
          <CardBar value={progress} tone={tone} />
          <span className="w-8 text-right text-[11.5px] tabular-nums text-ink-2">{Math.round(progress * 100)}%</span>
        </span>
      )}
    </>
  )
}

export function statusFace(status: Status): { glyph: ReactNode; label: string } {
  return { glyph: <StatusGlyph status={status} />, label: STATUS_LABEL[status] }
}
