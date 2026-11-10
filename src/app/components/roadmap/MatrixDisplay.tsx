import type { FieldDef } from '@/engine/roadmaps/types'
import type { ViewSettings } from '@/engine/roadmaps/view'
import { liveMatrix } from '@/engine/roadmaps/matrix'
import { cn } from '@/app/lib/utils'

type ViewChange = ViewSettings | ((prev: ViewSettings) => ViewSettings)

interface Props {
  fields: FieldDef[]
  view: ViewSettings
  onChange: (v: ViewChange) => void
}

const SHOWS: { key: keyof ViewSettings['matrix']['show']; label: string }[] = [
  { key: 'status', label: 'Status' },
  { key: 'progress', label: 'Progress' },
  { key: 'dates', label: 'Dates' },
  { key: 'assignee', label: 'Assignee' },
]

/** Rows, columns, pins and cell content for the matrix layout. */
export function MatrixDisplay({ fields, view, onChange }: Props) {
  const choiceFields = fields.filter((f) => f.type === 'choice')
  const live = liveMatrix(fields, view.matrix)

  const setMatrix = (patch: Partial<ViewSettings['matrix']>) =>
    onChange({ ...view, matrix: { ...view.matrix, ...patch } })

  const setRowField = (fieldId: string | null) => {
    const cols = view.matrix.cols.filter((c) => c !== fieldId)
    setMatrix({ rowField: fieldId, cols })
  }

  const setCol = (index: 0 | 1, fieldId: string | null) => {
    let cols = [...view.matrix.cols]
    if (fieldId === null) {
      cols.splice(index, 1)
    } else if (index === 0) {
      cols = [fieldId, ...cols.slice(1)].filter((c) => c !== view.matrix.rowField)
      if (cols[1] === cols[0]) cols = cols.slice(0, 1)
    } else {
      if (!cols[0]) return
      cols[1] = fieldId
      cols = cols.filter((c, i, a) => a.indexOf(c) === i && c !== view.matrix.rowField).slice(0, 2)
    }
    cols = cols.filter((c) => c !== view.matrix.rowField).slice(0, 2)
    setMatrix({ cols })
  }

  const togglePin = (fieldId: string, optionId: string) => {
    const on = view.matrix.pins.some((p) => p.fieldId === fieldId && p.optionId === optionId)
    const pins = on
      ? view.matrix.pins.filter((p) => !(p.fieldId === fieldId && p.optionId === optionId))
      : [...view.matrix.pins, { fieldId, optionId }]
    setMatrix({ pins })
  }

  const toggleShow = (key: keyof ViewSettings['matrix']['show']) => {
    setMatrix({ show: { ...view.matrix.show, [key]: !view.matrix.show[key] } })
  }

  const colFields = live.cols
    .map((id) => fields.find((f) => f.id === id))
    .filter((f): f is FieldDef => !!f && f.type === 'choice')

  const secondChoices = choiceFields.filter((f) => f.id !== live.rowField && f.id !== live.cols[0])

  return (
    <>
      <section className="mb-4">
        <h3 className="mb-2 text-[11px] font-medium uppercase tracking-wide text-ink-3">Rows</h3>
        <div className="flex max-h-32 flex-col gap-0.5 overflow-y-auto">
          <Pick label="None" on={live.rowField === null} onClick={() => setRowField(null)} />
          {choiceFields.map((f) => (
            <Pick
              key={f.id}
              label={f.name}
              on={live.rowField === f.id}
              onClick={() => setRowField(f.id)}
            />
          ))}
        </div>
      </section>
      <section className="mb-4">
        <h3 className="mb-2 text-[11px] font-medium uppercase tracking-wide text-ink-3">Columns</h3>
        <p className="mb-1.5 text-[11px] text-ink-3">First field</p>
        <div className="mb-2 flex max-h-32 flex-col gap-0.5 overflow-y-auto">
          <Pick label="None" on={!live.cols[0]} onClick={() => setCol(0, null)} />
          {choiceFields
            .filter((f) => f.id !== live.rowField)
            .map((f) => (
              <Pick
                key={f.id}
                label={f.name}
                on={live.cols[0] === f.id}
                onClick={() => setCol(0, f.id)}
              />
            ))}
        </div>
        {live.cols[0] && (
          <>
            <p className="mb-1.5 text-[11px] text-ink-3">Second field (optional)</p>
            <div className="flex max-h-32 flex-col gap-0.5 overflow-y-auto">
              <Pick label="None" on={!live.cols[1]} onClick={() => setCol(1, null)} />
              {secondChoices.map((f) => (
                <Pick
                  key={f.id}
                  label={f.name}
                  on={live.cols[1] === f.id}
                  onClick={() => setCol(1, f.id)}
                />
              ))}
            </div>
          </>
        )}
      </section>
      {colFields.map((f) => (
        <section key={f.id} className="mb-4">
          <h3 className="mb-2 text-[11px] font-medium uppercase tracking-wide text-ink-3">
            Show when empty · {f.name}
          </h3>
          <div className="flex flex-col gap-1">
            {(f.options ?? []).map((o) => (
              <label key={o.id} className="flex cursor-pointer items-center gap-2 text-[12px] text-ink-2">
                <input
                  type="checkbox"
                  className="size-3.5 accent-ink"
                  checked={view.matrix.pins.some((p) => p.fieldId === f.id && p.optionId === o.id)}
                  onChange={() => togglePin(f.id, o.id)}
                />
                {o.emoji ? `${o.emoji} ` : ''}
                {o.name}
              </label>
            ))}
          </div>
        </section>
      ))}
      <section>
        <h3 className="mb-2 text-[11px] font-medium uppercase tracking-wide text-ink-3">Cell shows</h3>
        <div className="flex flex-col gap-1">
          {SHOWS.map((s) => (
            <label key={s.key} className="flex cursor-pointer items-center gap-2 text-[12px] text-ink-2">
              <input
                type="checkbox"
                className="size-3.5 accent-ink"
                checked={view.matrix.show[s.key]}
                onChange={() => toggleShow(s.key)}
              />
              {s.label}
            </label>
          ))}
        </div>
      </section>
    </>
  )
}

function Pick({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      className={cn(
        'rounded-md px-2 py-1 text-left text-[12px]',
        on ? 'bg-raise font-medium text-ink' : 'text-ink-2 hover:text-ink',
      )}
      onClick={onClick}
    >
      {label}
    </button>
  )
}
