import type { FieldDef } from '@/engine/roadmaps/types'
import type { MatrixSettings, ViewSettings } from '@/engine/roadmaps/view'
import { liveMatrix } from '@/engine/roadmaps/matrix'
import { isLetterMark } from '@/engine/roadmaps/emoji'
import { MenuMulti, MenuSection, MenuSelect } from './MenuParts'
import type { ViewChange } from './DisplayMenu'

interface Props {
  fields: FieldDef[]
  view: ViewSettings
  onChange: (v: ViewChange) => void
}

const SHOWS: { key: keyof MatrixSettings['show']; label: string }[] = [
  { key: 'progress', label: 'Progress' },
  { key: 'dates', label: 'Due quarter' },
  { key: 'assignee', label: 'Assignee' },
]

/** The matrix's own rows in Display: the field that makes the columns, the one that splits them, the columns kept
    in view when empty, and what a cell says beyond its status. */
export function MatrixDisplay({ fields, view, onChange }: Props) {
  const live = liveMatrix(fields, view)
  const [first, second] = live.cols

  /** Every edit starts from what is on screen, so a default the matrix chose is kept once the person changes anything. */
  const edit = (change: (m: MatrixSettings) => Partial<MatrixSettings>) =>
    onChange((v) => {
      const { rows: _rows, ...m } = liveMatrix(fields, v)
      return { ...v, matrix: { ...m, ...change(m) } }
    })
  const togglePin = (key: string) => {
    const [fieldId, optionId] = key.split('\u0000')
    edit((m) => {
      const rest = m.pins.filter((p) => !(p.fieldId === fieldId && p.optionId === optionId))
      return { pins: rest.length < m.pins.length ? rest : [...m.pins, { fieldId, optionId }] }
    })
  }

  if (!fields.length) return <p className="px-2 py-1 text-[13px] text-ink-2">Add a field to set up the matrix.</p>

  const forCols = fields.filter((f) => !live.rows.includes(f.id))
  const pins = fields
    .filter((f) => f.type === 'choice' && live.cols.includes(f.id))
    .flatMap((f) => (f.options ?? []).map((o) => ({
      value: `${f.id}\u0000${o.id}`,
      // A letter mark would only repeat the name here; an emoji helps find it.
      label: o.emoji && !isLetterMark(o.emoji) ? `${o.emoji} ${o.name}` : o.name,
      on: live.pins.some((p) => p.fieldId === f.id && p.optionId === o.id),
    })))

  return (
    <MenuSection title="Matrix">
      {forCols.length > 0 && (
        <MenuSelect
          label="Columns"
          value={first ?? ''}
          options={forCols.map((f) => ({ value: f.id, label: f.name }))}
          onChange={(id) => edit(() => ({ cols: second && second !== id ? [id, second] : [id] }))}
        />
      )}
      {first && forCols.length > 1 && (
        <MenuSelect
          label="Split by"
          value={second ?? 'none'}
          options={[{ value: 'none', label: 'Nothing' }, ...forCols.filter((f) => f.id !== first).map((f) => ({ value: f.id, label: f.name }))]}
          onChange={(id) => edit(() => ({ cols: id === 'none' ? [first] : [first, id] }))}
        />
      )}
      {pins.length > 0 && <MenuMulti label="Keep in view" empty="Only in use" options={pins} onToggle={togglePin} />}
      <MenuMulti
        label="In each cell"
        empty="Status only"
        options={SHOWS.map((s) => ({ value: s.key, label: s.label, on: live.show[s.key] }))}
        onToggle={(key) => edit((m) => {
          const k = key as keyof MatrixSettings['show']
          return { show: { ...m.show, [k]: !m.show[k] } }
        })}
      />
    </MenuSection>
  )
}
