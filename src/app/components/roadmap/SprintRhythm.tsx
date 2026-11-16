import { useState, type ReactNode } from 'react'
import type { SprintRhythm as Rhythm } from '@/engine/roadmaps/types'
import { MAX_SPRINT_WEEKS } from '@/engine/roadmaps/sprints'
import { Button } from '../ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover'
import { DateCell } from './cells/DateCell'
import { MenuSelect } from './MenuParts'

const WEEKS = Array.from({ length: MAX_SPRINT_WEEKS }, (_, i) => ({ value: String(i + 1), label: i === 0 ? '1 week' : `${i + 1} weeks` }))

interface Props {
  /** The rhythm as it stands; null while the roadmap has none. */
  rhythm: Rhythm | null
  today: string
  onSave: (rhythm: { start: string; weeks: number }) => 'ok' | string
  /** What opens the form: a button the caller draws. */
  children: ReactNode
}

/** The sprint rhythm as a small form: the first day and how many weeks a sprint lasts. */
export function SprintRhythm({ rhythm, today, onSave, children }: Props) {
  const [open, setOpen] = useState(false)
  const [start, setStart] = useState<string | null>(rhythm?.start ?? today)
  const [weeks, setWeeks] = useState(String(rhythm?.weeks ?? 2))
  const [said, setSaid] = useState<string | null>(null)
  const changed = rhythm !== null && (start !== rhythm.start || Number(weeks) !== rhythm.weeks)

  const save = () => {
    if (!start) return
    const out = onSave({ start, weeks: Number(weeks) })
    if (out === 'ok') setOpen(false)
    else setSaid(out)
  }

  return (
    <Popover open={open} onOpenChange={(next) => {
      if (next) { setStart(rhythm?.start ?? today); setWeeks(String(rhythm?.weeks ?? 2)); setSaid(null) }
      setOpen(next)
    }}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="w-[18.5rem] p-2 text-[13px]" aria-label="Sprint rhythm">
        <div className="grid gap-1">
          <div className="flex items-center justify-between gap-3 px-2 py-1 text-ink-2">
            <span>First day</span>
            <DateCell value={start} label="First day" onPick={(iso) => { if (iso) setStart(iso) }} />
          </div>
          <MenuSelect label="Length" value={weeks} options={WEEKS} onChange={setWeeks} />
          {changed && <p className="px-2 py-1 text-[12px] leading-[1.5] text-ink-3">Sprint numbers will change. Issues keep their dates.</p>}
          {said && <p role="alert" className="px-2 py-1 text-[12px] leading-[1.5] text-ink-2">{said}</p>}
          <div className="flex justify-end px-2 pt-1">
            <Button size="sm" disabled={!start || (rhythm !== null && !changed)} onClick={save}>{rhythm ? 'Save' : 'Start sprints'}</Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
