import { useState } from 'react'
import { ArrowDown, ArrowUp, GripVertical, Plus, Trash2 } from 'lucide-react'
import { checkFieldDefs } from '@/engine/roadmaps/fields'
import type { FieldDef, FieldType, Issue } from '@/engine/roadmaps/types'
import type { RoadmapOp } from '@/engine/roadmaps/ops'
import { Button } from '../ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu'
import { countFieldUse, countOptionUse, newFieldId, newOptionId } from './fieldCounts'
import { FieldOptions } from './FieldOptions'

const TYPES: { type: FieldType; label: string }[] = [
  { type: 'choice', label: 'Choice' },
  { type: 'text', label: 'Text' },
  { type: 'number', label: 'Number' },
  { type: 'date', label: 'Date' },
  { type: 'person', label: 'Person' },
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

/** Configure the roadmap’s custom fields; each change is one write, no Save. */
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
        <DialogContent className="max-h-[min(640px,90vh)] max-w-[520px] gap-0 overflow-hidden rounded-[14px] border-line-2 bg-raise p-0 text-ink" aria-describedby="fields-editor-desc">
          <div className="border-b border-line px-6 py-5">
            <DialogTitle className="text-[16px] font-semibold tracking-[-.01em]">Fields</DialogTitle>
            <DialogDescription id="fields-editor-desc" className="mt-1.5 text-[13px] leading-[1.5] text-ink-2">
              Custom columns for this roadmap. Renaming a field or option does not change stored values.
            </DialogDescription>
          </div>
          <div className="max-h-[420px] overflow-y-auto px-6 py-4">
            {fields.length === 0 && <p className="text-[13px] text-ink-3">No fields yet.</p>}
            <ul className="divide-y divide-hair">
              {fields.map((f, i) => (
                <li
                  key={f.id}
                  className="py-3 first:pt-0"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.target !== e.currentTarget) return
                    if (e.key === 'ArrowUp' && i > 0) { e.preventDefault(); moveField(i, i - 1) }
                    if (e.key === 'ArrowDown' && i < fields.length - 1) { e.preventDefault(); moveField(i, i + 1) }
                  }}
                >
                  <div className="flex items-start gap-1.5">
                    <button
                      type="button"
                      aria-label={`Move field ${f.name}`}
                      className="mt-0.5 grid size-7 shrink-0 cursor-grab place-items-center rounded-md text-ink-3 transition-colors hover:bg-panel hover:text-ink active:cursor-grabbing"
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
                        <span className="shrink-0 text-[11px] font-medium uppercase tracking-wide text-ink-3">{TYPES.find((t) => t.type === f.type)?.label ?? f.type}</span>
                        <input
                          className="min-w-0 flex-1 border-0 bg-transparent p-0 text-[13.5px] font-medium text-ink outline-none ring-0 placeholder:text-ink-3 focus:ring-0"
                          defaultValue={f.name}
                          key={`${f.id}-${f.name}`}
                          aria-label="Field name"
                          onBlur={(e) => {
                            const name = e.target.value.trim()
                            if (!name || name === f.name) return
                            patchField(f.id, { name })
                          }}
                        />
                        <div className="flex shrink-0 items-center gap-0.5">
                          <Button type="button" variant="ghost" size="sm" className="size-8 px-0 hover:bg-panel" disabled={i === 0} aria-label="Move field up" onClick={() => moveField(i, i - 1)}><ArrowUp className="size-3.5" /></Button>
                          <Button type="button" variant="ghost" size="sm" className="size-8 px-0 hover:bg-panel" disabled={i === fields.length - 1} aria-label="Move field down" onClick={() => moveField(i, i + 1)}><ArrowDown className="size-3.5" /></Button>
                          <Button type="button" variant="ghost" size="sm" className="size-8 px-0 text-ink-3 hover:bg-panel hover:text-bad" aria-label={`Delete ${f.name}`} onClick={() => setPending({ kind: 'field', fieldId: f.id, name: f.name, count: countFieldUse(issues, f.id) })}><Trash2 className="size-3.5" strokeWidth={1.75} /></Button>
                        </div>
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
          <div className="flex items-center justify-between gap-3 border-t border-line px-6 py-4">
            {refused ? <p role="alert" className="text-[12.5px] text-bad">{refused}</p> : <span />}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="ghost" className="gap-1.5 text-ink-2 hover:text-ink"><Plus className="size-3.5" strokeWidth={1.75} />Add field</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[160px]">
                {TYPES.map((t) => (
                  <DropdownMenuItem key={t.type} onSelect={() => addField(t.type)}>{t.label}</DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={pending !== null} onOpenChange={(o) => { if (!o) setPending(null) }}>
        <DialogContent className="max-w-[400px] gap-0 rounded-[14px] border-line-2 bg-raise p-6 text-ink">
          <DialogTitle className="text-[16px] font-semibold tracking-[-.01em]">Delete “{pending?.name}”?</DialogTitle>
          <DialogDescription className="mt-2 text-[13.5px] leading-[1.5] text-ink-2">
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
