import { SCALES, SCALE_LABEL, type Scale } from '@/engine/roadmaps/gantt'
import { Button } from '../ui/button'
import { ToggleGroup, ToggleGroupItem } from '../ui/toggle-group'
import { cn } from '@/app/lib/utils'

interface Props {
  scale: Scale
  onScale: (s: Scale) => void
  onToday: () => void
}

/** Week / month / quarter scale and jump to today on the Gantt tab. */
export function GanttControls({ scale, onScale, onToday }: Props) {
  return (
    <div className="flex items-center gap-1.5">
      <ToggleGroup
        type="single"
        value={scale}
        onValueChange={(v) => { if (v) onScale(v as Scale) }}
        aria-label="Scale"
        className="rounded-lg border border-line bg-panel p-0.5"
      >
        {SCALES.map((s) => (
          <ToggleGroupItem
            key={s}
            value={s}
            aria-label={SCALE_LABEL[s]}
            className={cn(
              'h-7 rounded-md border-0 px-2.5 text-[12.5px] font-medium text-ink-3 shadow-none',
              'data-[state=on]:bg-raise data-[state=on]:text-ink data-[state=on]:shadow-[0_0_0_1px_theme(colors.line)]',
            )}
          >
            {SCALE_LABEL[s]}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <Button variant="ghost" size="sm" className="h-8 text-ink-3 hover:text-ink" onClick={onToday}>
        Today
      </Button>
    </div>
  )
}
