import type { Status } from '@/engine/roadmaps/types'
import { STATUS_LABEL, STATUSES } from '@/engine/roadmaps/types'
import { StatusGlyph } from '../StatusGlyph'
import { CellButton } from './CellButton'
import { CellMenu, type CellOption } from './CellMenu'

const OPTIONS: CellOption[] = STATUSES.map((s) => ({ id: s, name: STATUS_LABEL[s], icon: <StatusGlyph status={s} /> }))

interface Props {
  status: Status
  disabled?: boolean
  onPick: (status: Status) => void
}

export function StatusCell({ status, disabled, onPick }: Props) {
  return (
    <CellMenu
      label="Choose status"
      listLabel="Statuses"
      options={OPTIONS}
      value={status}
      disabled={disabled}
      onPick={(id) => { if (id) onPick(id as Status) }}
    >
      <CellButton className="size-6 min-w-0 shrink-0 justify-center px-0" aria-label={`Status: ${STATUS_LABEL[status]}`}>
        <StatusGlyph status={status} />
      </CellButton>
    </CellMenu>
  )
}
