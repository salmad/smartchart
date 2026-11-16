import type { SprintRhythm } from '@/engine/roadmaps/types'
import { sprintChoices, sprintName, sprintOf } from '@/engine/roadmaps/sprints'
import { CellButton } from './CellButton'
import { CellMenu } from './CellMenu'

interface Props {
  rhythm: SprintRhythm
  today: string
  /** The first day of the sprint the issue is in. */
  sprint: string | null
  disabled?: boolean
  onPick: (sprint: string | null) => void
}

/** The sprint an issue is in, as quiet text; a click lists the current and coming sprints. A sprint that has passed
    shows its name but isn't offered. */
export function SprintCell({ rhythm, today, sprint, disabled, onPick }: Props) {
  const name = sprint ? sprintName(rhythm, sprint) : ''
  return (
    <CellMenu
      label="Choose sprint"
      listLabel="Sprints"
      options={sprintChoices(rhythm, today).map((c) => ({ id: c.id, name: c.name }))}
      value={sprint ? sprintOf(rhythm, sprint)?.start ?? null : null}
      none="No sprint"
      disabled={disabled}
      onPick={onPick}
    >
      <CellButton empty={!name} aria-label={name ? `Sprint: ${name}` : 'Sprint: none'} className="whitespace-nowrap text-ink-2">
        {name}
      </CellButton>
    </CellMenu>
  )
}
