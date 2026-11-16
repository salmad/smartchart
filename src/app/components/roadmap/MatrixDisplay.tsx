import { Columns3, LayoutList, Pin, Rows3 } from 'lucide-react'
import type { FieldDef } from '@/engine/roadmaps/types'
import type { MatrixSettings, ViewSettings } from '@/engine/roadmaps/view'
import { liveMatrix } from '@/engine/roadmaps/matrix'
import { MenuPick, MenuSection, MenuSwitch } from './MenuParts'

interface Props {
  fields: FieldDef[]
  view: ViewSettings
  onChange: (v: ViewSettings | ((prev: ViewSettings) => ViewSettings)) => void
}

const SHOWS: { key: keyof MatrixSettings['show']; label: string }[] = [
  { key: 'progress', label: 'Progress' },
  { key: 'dates', label: 'Due date' },
  { key: 'assignee', label: 'Assignee' },
]

/** What the matrix is made of: the field that groups its rows, the one or two that make its columns, the columns kept
    in view when empty, and what a cell says beyond its status. */
export function MatrixDisplay({ fields, view, onChange }: Props) {
  const live = liveMatrix(fields, view.matrix)
  const [first, second] = live.cols

  /** Every edit starts from what is on screen, so a default the matrix chose is kept once the person changes anything. */
  const edit = (change: (m: MatrixSettings) => Partial<MatrixSettings>) =>
    onChange((v) => {
      const m = liveMatrix(fields, v.matrix)
      return { ...v, matrix: { ...m, ...change(m) } }
    })

  // Rows taking the columns' field hands the columns the field the rows had.
  const setRows = (id: string | null) =>
    edit((m) => {
      const cols = m.cols.filter((c) => c !== id)
      return { rowField: id, cols: cols.length || m.rowField === null ? cols : [m.rowField] }
    })
  const setCols = (cols: string[]) => edit(() => ({ cols }))
  const togglePin = (fieldId: string, optionId: string) =>
    edit((m) => {
      const rest = m.pins.filter((p) => !(p.fieldId === fieldId && p.optionId === optionId))
      return { pins: rest.length < m.pins.length ? rest : [...m.pins, { fieldId, optionId }] }
    })

  if (!fields.length) return <p className="px-2 py-1 text-[13px] text-ink-2">Add a field to set up the matrix.</p>

  const pinnable = fields.filter((f) => f.type === 'choice' && live.cols.includes(f.id))
  const forCols = fields.filter((f) => f.id !== live.rowField)
  const forSplit = forCols.filter((f) => f.id !== first)

  return (
    <div className="flex flex-col gap-3">
      <MenuSection icon={Rows3} title="Group rows by">
        {fields.length > 1 ? (
          <div className="flex flex-col">
            <MenuPick label="Nothing" on={live.rowField === null} onClick={() => setRows(null)} />
            {fields.map((f) => (
              <MenuPick key={f.id} label={f.name} on={live.rowField === f.id} onClick={() => setRows(f.id)} />
            ))}
          </div>
        ) : (
          <p className="px-2 text-[12px] leading-[1.4] text-ink-3">{fields[0].name} makes the columns. Add a second field in settings to group the rows.</p>
        )}
      </MenuSection>
      <MenuSection icon={Columns3} title="Columns">
        <div className="flex flex-col">
          {forCols.map((f) => (
            <MenuPick key={f.id} label={f.name} on={first === f.id} onClick={() => setCols(second && second !== f.id ? [f.id, second] : [f.id])} />
          ))}
        </div>
        {forSplit.length > 0 && (
          <>
            <p className="mb-0.5 mt-2 px-2 text-[11px] text-ink-3">Then split by</p>
            <div className="flex flex-col">
              <MenuPick label="Nothing" on={!second} onClick={() => setCols([first])} />
              {forSplit.map((f) => (
                <MenuPick key={f.id} label={f.name} on={second === f.id} onClick={() => setCols([first, f.id])} />
              ))}
            </div>
          </>
        )}
      </MenuSection>
      {pinnable.map((f) => (
        <MenuSection key={f.id} icon={Pin} title={pinnable.length > 1 ? `Keep in view: ${f.name}` : 'Keep in view when empty'}>
          {(f.options ?? []).map((o) => (
            <MenuSwitch
              key={o.id}
              label={o.emoji ? `${o.emoji} ${o.name}` : o.name}
              on={live.pins.some((p) => p.fieldId === f.id && p.optionId === o.id)}
              onChange={() => togglePin(f.id, o.id)}
            />
          ))}
        </MenuSection>
      ))}
      <MenuSection icon={LayoutList} title="In each cell">
        {SHOWS.map((s) => (
          <MenuSwitch
            key={s.key}
            label={s.label}
            on={live.show[s.key]}
            onChange={() => edit((m) => ({ show: { ...m.show, [s.key]: !m.show[s.key] } }))}
          />
        ))}
      </MenuSection>
    </div>
  )
}
