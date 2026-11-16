import { useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import type { RoadmapOp } from '@/engine/roadmaps/ops'
import { keyOf } from '@/engine/roadmaps/fields'
import type { Sprint } from '@/engine/roadmaps/sprints'
import { sprintCandidates } from '@/engine/roadmaps/sprintView'
import type { RoadmapState } from '@/engine/roadmaps/types'
import { Button } from '../ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover'
import { FilterValuePicker, type PickOption } from './FilterValuePicker'
import { IssueKey } from './issueParts'
import { StatusGlyph } from './StatusGlyph'
import { ToolButton } from './ToolButton'

interface Props {
  state: RoadmapState
  sprint: Sprint
  act: (op: RoadmapOp) => 'ok' | string
}

/** Select, then add: tick open tasks from anywhere in the roadmap and put them in this sprint. A Backlog task becomes
    To do as it joins, since the sprint lists only work someone has committed to. */
export function SprintAddTasks({ state, sprint, act }: Props) {
  const [open, setOpen] = useState(false)
  const [picked, setPicked] = useState<(string | null)[]>([])
  const candidates = useMemo(() => sprintCandidates(state, sprint), [state, sprint])
  const options = useMemo(
    () => candidates.map((i): PickOption => ({
      value: i.id,
      label: i.title,
      keywords: keyOf(state.roadmap, i),
      lead: <><StatusGlyph status={i.status} /><IssueKey roadmap={state.roadmap} issue={i} /></>,
    })),
    [candidates, state.roadmap],
  )
  const ids = picked.filter((v): v is string => v !== null)

  const add = () => {
    const backlog = ids.filter((id) => candidates.find((i) => i.id === id)?.status === 'backlog')
    if (backlog.length) act({ op: 'set', ids: backlog, props: { status: 'todo' } })
    act({ op: 'set', ids, props: { sprint: sprint.start } })
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (o) setPicked([]) }}>
      <PopoverTrigger asChild>
        <ToolButton><Plus strokeWidth={1.75} aria-hidden />Add tasks</ToolButton>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={6} className="w-80 overflow-hidden p-0" aria-label={`Add tasks to Sprint ${sprint.n}`}>
        {options.length === 0 ? (
          <p className="px-3 py-4 text-center text-[12px] text-ink-3">Every open task is in this sprint.</p>
        ) : (
          <>
            <FilterValuePicker options={options} selected={picked} onChange={setPicked} noun="tasks" />
            <div className="flex items-center justify-end border-t border-hair p-1.5">
              <Button size="sm" disabled={!ids.length} onClick={add}>
                {ids.length ? `Add ${ids.length} to Sprint ${sprint.n}` : `Add to Sprint ${sprint.n}`}
              </Button>
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  )
}
