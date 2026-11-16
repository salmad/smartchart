import { useId } from 'react'
import type { Status } from '@/engine/roadmaps/types'
import { cn } from '@/app/lib/utils'
import { LANE_H } from './ganttBarDrag'

const BAR_H = 19
const BAR_Y = (LANE_H - BAR_H) / 2
const MID = LANE_H / 2
const EASE = 'transition-[fill,stroke,opacity,filter] duration-150 ease-out motion-reduce:transition-none'

/** One tone per status: neutral for work not started (backlog fainter and dashed), gold in progress, ok done,
    bad blocked. Late work keeps its status tone; lateness is the red cap on the bar's end and its label. */
const BAR_TONE: Record<Status, string> = {
  backlog: 'fill-ink/[.06] stroke-ink/25 [stroke-dasharray:3_3]',
  todo: 'fill-ink/[.16] stroke-ink/30',
  in_progress: 'fill-gold/25 stroke-gold/60',
  blocked: 'fill-bad/20 stroke-bad/70',
  done: 'fill-ok/20 stroke-ok/45',
  cancelled: 'fill-ink/[.04] stroke-ink/[.12]',
}

const DIAMOND_TONE: Record<Status, string> = {
  backlog: 'fill-app-bg stroke-ink-2',
  todo: 'fill-ink stroke-ink',
  in_progress: 'fill-gold stroke-gold',
  blocked: 'fill-bad stroke-bad',
  done: 'fill-ok stroke-ok',
  cancelled: 'fill-app-bg stroke-ink-3',
}

let ruler: CanvasRenderingContext2D | null = null
/** The drawn width of an 11 px label, so a label is placed by its real size and never by a guess per letter. */
export function labelWidth(text: string): number {
  ruler ??= document.createElement('canvas').getContext('2d')
  if (!ruler) return text.length * 6
  ruler.font = '11px Geist, system-ui, sans-serif'
  return Math.ceil(ruler.measureText(text).width) + 2
}

interface Box {
  x: number
  w: number
}

export function BarMark({ x, w, status, overdue, lit, grips }: Box & { status: Status; overdue: boolean; lit: boolean; grips: boolean }) {
  const clip = useId()
  return (
    <>
      <clipPath id={clip}>
        <rect x={x} y={BAR_Y} width={w} height={BAR_H} rx={5.5} />
      </clipPath>
      <rect
        data-bar
        x={x + 0.5}
        y={BAR_Y + 0.5}
        width={w - 1}
        height={BAR_H - 1}
        rx={5}
        className={cn(EASE, BAR_TONE[status], lit && 'brightness-125')}
      />
      {overdue && <rect x={x + w - 3} y={BAR_Y} width={3} height={BAR_H} clipPath={`url(#${clip})`} className="fill-bad" />}
      {w >= 28 && (
        <g className={cn(EASE, 'fill-ink/60', grips ? 'opacity-100' : 'opacity-0')}>
          <rect x={x + 4} y={MID - 4} width={2} height={8} rx={1} />
          <rect x={x + w - (overdue ? 9 : 6)} y={MID - 4} width={2} height={8} rx={1} />
        </g>
      )}
    </>
  )
}

/** A parent's span: a slim bar with two feet, lighter than any leaf bar. Solid when the parent holds its own dates. */
export function SpanMark({ x, w, own, blocked, lit }: Box & { own: boolean; blocked: boolean; lit: boolean }) {
  const top = MID - 3
  return (
    <g className={cn(EASE, blocked ? 'fill-bad/70' : own ? 'fill-ink-2' : 'fill-ink-3', lit && 'brightness-125')}>
      <rect data-bar x={x} y={top} width={w} height={4} rx={2} />
      <rect x={x} y={top + 2} width={2} height={7} rx={1} />
      <rect x={x + w - 2} y={top + 2} width={2} height={7} rx={1} />
    </g>
  )
}

export function MilestoneMark({ cx, status, lit }: { cx: number; status: Status; lit: boolean }) {
  return (
    <rect
      data-bar
      x={-5}
      y={-5}
      width={10}
      height={10}
      rx={1.5}
      strokeWidth={1.5}
      transform={`translate(${cx} ${MID}) rotate(45)`}
      className={cn(EASE, DIAMOND_TONE[status], lit && 'brightness-125')}
    />
  )
}

/** Where a click or a drop would put the bar. */
export function GhostBar({ x, w, firm }: Box & { firm: boolean }) {
  return (
    <rect
      data-ghost
      x={x + 0.5}
      y={BAR_Y + 0.5}
      width={w - 1}
      height={BAR_H - 1}
      rx={5}
      className={firm ? 'fill-ink/[.14] stroke-ink/40' : 'fill-ink/[.05] stroke-ink/25 [stroke-dasharray:3_3]'}
    />
  )
}

export function MarkLabel({ x, side, alert, children }: { x: number; side: 'left' | 'right'; alert: boolean; children: string }) {
  return (
    <text
      x={x}
      y={MID}
      dominantBaseline="central"
      textAnchor={side === 'left' ? 'end' : 'start'}
      className={cn('text-[11px] tabular-nums', alert ? 'fill-bad' : 'fill-ink-3')}
    >
      {children}
    </text>
  )
}

/** The dates a drag would set, riding with the pointer: above the bar, or below it on the first row, where the
    header would cover it. */
export function DragTip({ x, max, below, children }: { x: number; max: number; below: boolean; children: string }) {
  const w = labelWidth(children) + 16
  const left = Math.round(Math.min(Math.max(x - w / 2, 2), max - w - 2))
  const top = below ? BAR_Y + BAR_H + 6 : BAR_Y - 28
  return (
    <g data-drag-tip>
      <rect x={left + 0.5} y={top + 0.5} width={w - 1} height={21} rx={6} className="fill-raise stroke-line-2" />
      <text x={left + w / 2} y={top + 11} dominantBaseline="central" textAnchor="middle" className="fill-ink text-[11px] tabular-nums">
        {children}
      </text>
    </g>
  )
}
