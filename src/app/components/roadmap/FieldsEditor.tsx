import { useState } from 'react'
import { CalendarDays, CircleDot, GripVertical, Hash, Plus, Trash2, Type, User, type LucideIcon } from 'lucide-react'
import { checkFieldDefs } from '@/engine/roadmaps/fields'
import type { FieldDef, FieldType, Issue } from '@/engine/roadmaps/types'
import type { RoadmapOp } from '@/engine/roadmaps/ops'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu'
import { countFieldUse, countOptionUse, newFieldId, newOptionId } from './fieldCounts'
import { MENU_ICON } from '../menu'
import { FieldOptions } from './FieldOptions'

/** What each type holds, said where the field is made. */
const TYPES: { type: FieldType; label: string; icon: LucideIcon; hint: string }[] = [
  { type: 'choice', label: 'Choice', icon: CircleDot, hint: 'A fixed list, like Country. Best for grouping and for the Matrix: its options keep their order.' },
  { type: 'text', label: 'Text', icon: Type, hint: 'Free text, like a note or a link.' },
  { type: 'number', label: 'Number', icon: Hash, hint: 'A figure, like a budget.' },
  { type: 'date', label: 'Date', icon: CalendarDays, hint: 'A day, like a review date.' },
  { type: 'person', label: 'Person', icon: User, hint: 'Someone in the workspace, like a sponsor.' },
]

type Pending =
  | { kind: 'field'; fieldId: string; name: string; count: number }
  | { kind: 'option'; fieldId: string; optionId: string; name: string; count: number }

interface Props {
  open: boolean
  onClose: () => void
  fields: FieldDef[]
  issues: Issue[]
  act: (op: RoadmapOp) => 'ok' | string
  refused: string | null
}

function FieldTypeIcon({ type }: { type: FieldType }) {
  const t = TYPES.find((x) => x.type === type)
  const Icon = t?.icon ?? CircleDot
  return (
    <span className="grid size-6 shrink-0 place-items-center text-ink-3" title={`${t?.label ?? type} field`}>
      <Icon className="size-4" strokeWidth={1.75} aria-hidden />
    </span>
  )
}

/** Roadmap settings: its fields. Each change is one write, so there is no Save. */
export function FieldsEditor({ open, onClose, fields, issues, act, refused }: Props) {
  const [pending, setPending] = useState<Pending | null>(null)

  const apply = (next: FieldDef[]) => {
    if (checkFieldDefs(next) !== 'ok') return
    act({ op: 'roadmap', fields: next })
  }

  const moveField = (from: number, to: number) => {
    if (to < 0 || to >= fields.length || from === to) return
    const next = [...fields]
    const [row] = next.splice(from, 1)
    next.splice(to, 0, row)
    apply(next)
  }

  const addField = (type: FieldType) => {
    const base = TYPES.find((t) => t.type === type)?.label ?? 'Field'
    const row: FieldDef = type === 'choice'
      ? { id: newFieldId(), name: base, type, options: [{ id: newOptionId(), name: 'Option' }] }
      : { id: newFieldId(), name: base, type }
    apply([...fields, row])
  }

  const patchField = (fieldId: string, patch: Partial<FieldDef>) => {
    apply(fields.map((f) => (f.id === fieldId ? { ...f, ...patch } : f)))
  }

  const confirmDelete = () => {
    if (!pending) return
    if (pending.kind === 'field') {
      apply(fields.filter((f) => f.id !== pending.fieldId))
    } else {
      const field = fields.find((f) => f.id === pending.fieldId)
      const options = field?.options
      if (!options) return
      apply(fields.map((f) => (f.id === pending.fieldId ? { ...f, options: options.filter((o) => o.id !== pending.optionId) } : f)))
    }
    setPending(null)
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
        <DialogContent className="max-h-[min(640px,90vh)] max-w-[520px] overflow-hidden p-0" aria-describedby="fields-editor-desc">
          <div className="px-6 pb-4 pt-6">
            <DialogTitle>Roadmap settings</DialogTitle>
            <DialogDescription id="fields-editor-desc">Fields are extra columns on every issue. Filter, sort and group by any of them, in the table and the Matrix.</DialogDescription>
          </div>
          <div className="flex items-center justify-between border-t border-line px-6 pt-4">
            <h3 className="text-[13px] font-medium text-ink">Fields</h3>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="outline" size="sm"><Plus className="!size-3.5" strokeWidth={2} aria-hidden />Add field</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" sideOffset={6} className="w-[300px]">
                {TYPES.map((t) => (
                  <DropdownMenuItem key={t.type} className="items-start" aria-label={t.label} aria-description={t.hint} onSelect={() => addField(t.type)}>
                    <t.icon {...MENU_ICON} className="mt-0.5" aria-hidden />
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="text-ink">{t.label}</span>
                      <span className="text-[12px] leading-[1.4] text-ink-3">{t.hint}</span>
                    </span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="max-h-[420px] overflow-y-auto px-6 pb-5 pt-2">
            {fields.length === 0 && <p className="py-6 text-center text-[13px] text-ink-3">No fields yet.</p>}
            <ul className="divide-y divide-hair">
              {fields.map((f, i) => (
                <li
                  key={f.id}
                  className="group rounded-md py-2 outline-none focus-visible:ring-1 focus-visible:ring-line-2"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.target !== e.currentTarget) return
                    if (e.key === 'ArrowUp' && i > 0) { e.preventDefault(); moveField(i, i - 1) }
                    if (e.key === 'ArrowDown' && i < fields.length - 1) { e.preventDefault(); moveField(i, i + 1) }
                  }}
                >
                  <div className="-ml-5 flex items-start gap-0.5">
                    <button
                      type="button"
                      aria-label={`Move field ${f.name}`}
                      className="mt-1 grid h-6 w-[18px] shrink-0 cursor-grab place-items-center rounded text-ink-3 opacity-0 outline-none transition-[opacity,color] duration-150 hover:text-ink focus-visible:opacity-100 focus-visible:ring-1 focus-visible:ring-line-2 group-hover:opacity-100 active:cursor-grabbing"
                      onPointerDown={(e) => {
                        e.preventDefault()
                        const grip = e.currentTarget
                        grip.setPointerCapture(e.pointerId)
                        let over = i
                        const rows = () => [...document.querySelectorAll('[data-field-row]')] as HTMLElement[]
                        const pick = (ev: PointerEvent) => {
                          const y = ev.clientY
                          const ix = rows().findIndex((el) => { const b = el.getBoundingClientRect(); return y >= b.top && y <= b.bottom })
                          if (ix >= 0) over = ix
                        }
                        const up = () => {
                          grip.removeEventListener('pointermove', pick)
                          grip.removeEventListener('pointerup', up)
                          if (over !== i) moveField(i, over)
                        }
                        grip.addEventListener('pointermove', pick)
                        grip.addEventListener('pointerup', up)
                      }}
                    >
                      <GripVertical className="size-3.5" strokeWidth={1.75} />
                    </button>
                    <div className="min-w-0 flex-1" data-field-row={f.id}>
                      <div className="flex items-center gap-2">
                        <FieldTypeIcon type={f.type} />
                        <Input
                          className="h-8 min-w-0 flex-1 border-transparent bg-transparent px-2 text-[13px] font-medium shadow-none transition-colors hover:bg-panel focus:bg-panel"
                          defaultValue={f.name}
                          key={`${f.id}-${f.name}`}
                          aria-label="Field name"
                          onBlur={(e) => {
                            const name = e.target.value.trim()
                            if (!name || name === f.name) return
                            patchField(f.id, { name })
                          }}
                        />
                        <Button type="button" variant="ghost" size="sm" className="size-8 shrink-0 px-0 text-ink-3 opacity-0 hover:bg-panel hover:text-ink focus-visible:opacity-100 group-hover:opacity-100" aria-label={`Delete ${f.name}`} onClick={() => setPending({ kind: 'field', fieldId: f.id, name: f.name, count: countFieldUse(issues, f.id) })}><Trash2 className="!size-3.5" strokeWidth={1.75} /></Button>
                      </div>
                      {f.type === 'choice' && f.options && (
                        <FieldOptions
                          fieldId={f.id}
                          options={f.options}
                          onPatch={(options) => patchField(f.id, { options })}
                          onDelete={(optionId, name) => setPending({ kind: 'option', fieldId: f.id, optionId, name, count: countOptionUse(issues, f.id, optionId) })}
                          onMove={(from, to) => {
                            if (!f.options) return
                            const opts = [...f.options]
                            const [row] = opts.splice(from, 1)
                            opts.splice(to, 0, row)
                            patchField(f.id, { options: opts })
                          }}
                        />
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          {refused && (
            <div className="border-t border-line px-6 py-3">
              <p role="alert" className="text-[12.5px] text-ink-2">{refused}</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={pending !== null} onOpenChange={(o) => { if (!o) setPending(null) }}>
        <DialogContent className="max-w-[400px]">
          <DialogTitle>Delete “{pending?.name}”?</DialogTitle>
          <DialogDescription>
            {pending?.count ?? 0} {pending?.count === 1 ? 'issue uses' : 'issues use'} this {pending?.kind === 'option' ? 'option' : 'field'}. {pending?.count ? 'Their values will be cleared.' : 'No issue values will change.'}
          </DialogDescription>
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setPending(null)}>Cancel</Button>
            <Button onClick={confirmDelete}>Delete</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
