import { Tooltip, TooltipContent, TooltipTrigger } from '@/app/components/ui/tooltip'
import { cn } from '@/app/lib/utils'

interface Props {
  value: number
}

/** Rolled-up progress: a 3 px track with a quiet fill that turns ok when everything is done. The exact share sits in a tooltip. */
export function ProgressBar({ value }: Props) {
  const share = Math.max(0, Math.min(1, value))
  const pct = Math.round(share * 100)
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <svg viewBox="0 0 56 3" className="h-[3px] w-14 cursor-default" aria-hidden>
          <rect width="56" height="3" rx="1.5" className="fill-line" />
          {share > 0 && <rect width={Math.max(3, 56 * share)} height="3" rx="1.5" className={cn(share >= 1 ? 'fill-ok' : 'fill-ink-3')} />}
        </svg>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-[11px] tabular-nums">{pct}%</TooltipContent>
    </Tooltip>
  )
}
