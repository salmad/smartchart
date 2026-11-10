import { CalendarDays } from 'lucide-react'
import { SCALES, SCALE_LABEL, type Scale } from '@/engine/roadmaps/gantt'
import { Button } from '../ui/button'
import { Seg } from '../LookPanel'
import { chromeGhost, segTrack } from './roadmapChrome'

interface Props {
  scale: Scale
  onScale: (s: Scale) => void
  onToday: () => void
}

/** Week / month / quarter scale and jump to today on the Gantt tab. */
export function GanttControls({ scale, onScale, onToday }: Props) {
  return (
    <div className="flex items-center gap-1.5">
      <Seg label="Scale" value={scale} onChange={onScale} options={SCALES.map((s) => [s, SCALE_LABEL[s]])} className={segTrack} />
      <Button variant="ghost" size="sm" className={`h-8 gap-1.5 ${chromeGhost}`} onClick={onToday}>
        <CalendarDays className="size-[15px]" strokeWidth={1.75} aria-hidden />
        Today
      </Button>
    </div>
  )
}
