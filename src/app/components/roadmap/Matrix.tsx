import type { RoadmapState } from '@/engine/roadmaps/types'
import type { ViewSettings } from '@/engine/roadmaps/view'
import { liveMatrix } from '@/engine/roadmaps/matrix'

interface Props {
  state: RoadmapState
  view: ViewSettings
}

const NO_CHOICE =
  'Add a choice field to line the work up in columns.'
const NO_COLUMN = 'Choose a column field in Display.'

/** Matrix grid shell; full table UI ships in the next milestone step. */
export function Matrix({ state, view }: Props) {
  const fields = state.roadmap.fields
  const choiceCount = fields.filter((f) => f.type === 'choice').length
  const matrix = liveMatrix(fields, view.matrix)
  const hint =
    choiceCount === 0 ? NO_CHOICE : matrix.cols.length === 0 ? NO_COLUMN : null

  return (
    <section
      role="region"
      aria-label="Matrix"
      className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
    >
      {hint && <p className="px-8 py-10 text-[13.5px] text-ink-2">{hint}</p>}
    </section>
  )
}
