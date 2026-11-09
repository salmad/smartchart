import { Tooltip, TooltipContent, TooltipTrigger } from '@/app/components/ui/tooltip'

interface Props {
  value: number
}

/** Rolled-up progress bar; the exact share sits in a tooltip. */
export function ProgressBar({ value }: Props) {
  const pct = Math.round(value * 100)
  const fill = Math.max(0, Math.min(56, 56 * value))
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <svg viewBox="0 0 56 4" className="h-1 w-14 cursor-default" aria-hidden>
          <rect width="56" height="4" rx="2" className="fill-line" />
          <rect width={fill} height="4" rx="2" className="fill-ink-2" />
        </svg>
      </TooltipTrigger>
      <TooltipContent side="top" className="font-mono text-[11px] tabular-nums">{pct}%</TooltipContent>
    </Tooltip>
  )
}
