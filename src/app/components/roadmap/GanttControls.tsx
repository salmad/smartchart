import { SCALES, SCALE_LABEL, type Scale } from '@/engine/roadmaps/gantt'
import { Seg, SEG_TRACK } from '../Seg'
import { ToolButton } from './ToolButton'

interface Props {
  scale: Scale
  onScale: (s: Scale) => void
  onToday: () => void
}

/** Week / month / quarter scale and jump to today on the Gantt tab. */
export function GanttControls({ scale, onScale, onToday }: Props) {
  return (
    <>
      <Seg label="Scale" value={scale} onChange={onScale} options={SCALES.map((s) => [s, SCALE_LABEL[s]])} className={SEG_TRACK} />
      <ToolButton onClick={onToday}>Today</ToolButton>
    </>
  )
}
