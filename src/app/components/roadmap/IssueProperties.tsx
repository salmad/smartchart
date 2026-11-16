import { useEffect, useState, type ReactNode } from 'react'
import type { FieldDef, FieldValue, Issue, MemberLite, Roadmap } from '@/engine/roadmaps/types'
import type { IssueProps, RoadmapOp } from '@/engine/roadmaps/ops'
import { canParent, dateSpan, issueTree, progress } from '@/engine/roadmaps/tree'
import { toast } from 'sonner'
import { cn } from '@/app/lib/utils'
import { Input } from '../ui/input'
import { DateCell } from './cells/DateCell'
import { ProgressBar } from './ProgressBar'
import { ParentPicker } from './ParentPicker'
import { PersonPick, PropertyPick, StatusPick } from './PropertyPick'
import { Placeholder } from './issueParts'
import { shortDate, todayIso } from './dates'

interface Props {
  issue: Issue
  roadmap: Roadmap
  fields: FieldDef[]
  issues: Issue[]
  members: MemberLite[]
  canEdit: boolean
  act: (op: RoadmapOp) => 'ok' | string
  onOpenIssue: (id: string) => void
  className?: string
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="truncate text-ink-3" title={label}>{label}</dt>
      <dd className="m-0 flex min-h-8 min-w-0 items-center gap-1 text-ink">{children}</dd>
    </>
  )
}

/** A value worked out from the sub-issues, and said to be. */
function Derived({ children }: { children: ReactNode }) {
  return <span className="ml-1 flex-none whitespace-nowrap text-[12px] text-ink-3">{children}</span>
}

/** A text or number field typed in place: saved on Enter or on leaving the field, dropped on Escape. */
function FieldInput({ field, value, onPick }: { field: FieldDef; value: FieldValue | undefined; onPick: (v: FieldValue | null) => void }) {
  const saved = value === undefined ? '' : String(value)
  const [draft, setDraft] = useState(saved)
  useEffect(() => setDraft(saved), [saved])
  const commit = () => {
    const t = draft.trim()
    if (t === saved) return
    onPick(t === '' ? null : field.type === 'number' ? Number(t) : t)
  }
  return (
    <Input
      type={field.type === 'number' ? 'number' : 'text'}
      aria-label={field.name}
      placeholder="Empty"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur()
        if (e.key === 'Escape') { e.stopPropagation(); setDraft(saved) }
      }}
      className="-ml-1.5 h-7 border-transparent px-1.5 text-[13px] tabular-nums shadow-none placeholder:text-ink-3 hover:bg-raise focus-visible:border-line-2 focus-visible:bg-transparent focus-visible:ring-0 md:text-[13px]"
    />
  )
}

function FieldValueRow({ field, value, members, canEdit, onPick }: { field: FieldDef; value: FieldValue | undefined; members: MemberLite[]; canEdit: boolean; onPick: (v: FieldValue | null) => void }) {
  if (field.type === 'person') {
    return <PersonPick label={field.name} empty="Empty" person={value === undefined ? null : String(value)} members={members} disabled={!canEdit} onPick={onPick} />
  }
  if (field.type === 'date') {
    return <div className="-ml-1"><DateCell value={value === undefined ? null : String(value)} label={field.name} placeholder={canEdit ? 'Empty' : ''} disabled={!canEdit} onPick={onPick} /></div>
  }
  if (field.type === 'choice') {
    const chosen = field.options?.find((o) => o.id === value)
    return (
      <PropertyPick
        label={chosen ? `${field.name}: ${chosen.name}` : field.name}
        options={(field.options ?? []).map((o) => ({ id: o.id, label: o.name, icon: o.emoji ? <span aria-hidden>{o.emoji}</span> : undefined }))}
        value={chosen?.id ?? null}
        clear="None"
        disabled={!canEdit}
        onPick={onPick}
      >
        {chosen
          ? <>{chosen.emoji && <span aria-hidden>{chosen.emoji}</span>}<span className="truncate">{chosen.name}</span></>
          : canEdit && <Placeholder>Empty</Placeholder>}
      </PropertyPick>
    )
  }
  if (!canEdit) return <span className="truncate tabular-nums">{value === undefined ? '' : String(value)}</span>
  return <FieldInput field={field} value={value} onPick={onPick} />
}

/** One calm label/value list: every value is one click to edit, and edits apply at once. The roadmap's own fields
    follow the built-in ones after a hairline. The panel and the full page share it. */
export function IssueProperties({ issue, roadmap, fields, issues, members, canEdit, act, onOpenIssue, className }: Props) {
  const tree = issueTree(issues)
  const hasKids = tree.children(issue.id).length > 0
  const prog = hasKids ? progress(issues, issue.id) : null
  const span = hasKids ? dateSpan(issues, issue.id) : null
  const parent = issue.parentId ? tree.get(issue.parentId) ?? null : null
  const today = todayIso()
  const late = !!issue.due && issue.due < today && issue.status !== 'done' && issue.status !== 'cancelled'
  // A parent without its own dates shows the span of its sub-issues, dimmed, where its own dates would be.
  const derivedStart = !issue.start && span?.start ? shortDate(span.start, today) : null
  const derivedDue = !issue.due && span?.due ? shortDate(span.due, today) : null
  const hint = (word: string) => (canEdit ? word : '')

  const patch = (props: IssueProps) => {
    const out = act({ op: 'set', ids: [issue.id], props })
    if (out !== 'ok') toast(out)
  }

  return (
    <dl aria-label="Properties" className={cn('grid grid-cols-[96px_minmax(0,1fr)] items-center gap-x-3 text-[13px]', className)}>
      <Row label="Status">
        <StatusPick withLabel status={issue.status} disabled={!canEdit} onPick={(status) => patch({ status })} />
      </Row>
      <Row label="Assignee">
        <PersonPick label="Assignee" empty="Add assignee" person={issue.assignee} members={members} disabled={!canEdit} onPick={(id) => patch({ assignee: id })} />
      </Row>
      <Row label="Dates">
        <div className="-ml-1 flex min-w-0 items-center gap-1">
          <DateCell value={issue.start} label="Start date" placeholder={derivedStart ?? hint('Start')} disabled={!canEdit} onPick={(v) => patch({ start: v })} />
          {(canEdit || issue.start || issue.due || derivedStart || derivedDue) && <span aria-hidden className="text-ink-3">→</span>}
          <DateCell value={issue.due} label="Due date" placeholder={derivedDue ?? hint('Due')} late={late} disabled={!canEdit} onPick={(v) => patch({ due: v })} />
        </div>
        {(derivedStart || derivedDue) && <Derived>from sub-issues</Derived>}
      </Row>
      <Row label="Parent">
        {canEdit ? (
          <ParentPicker
            roadmap={roadmap}
            parent={parent}
            choices={issues.filter((i) => i.id !== issue.id && canParent(issues, issue.id, i.id) === 'ok')}
            onPick={(parentId) => { const out = act({ op: 'move', id: issue.id, parentId }); if (out !== 'ok') toast(out) }}
          />
        ) : parent && (
          <button type="button" title={parent.title} className="truncate text-left transition-colors hover:text-ink-2 focus-visible:underline focus-visible:outline-none" onClick={() => onOpenIssue(parent.id)}>
            {parent.title}
          </button>
        )}
      </Row>
      {prog !== null && (
        <Row label="Progress">
          <ProgressBar value={prog} />
          <span className="ml-1.5 tabular-nums text-ink-2">{Math.round(prog * 100)}%</span>
          <Derived>from sub-issues</Derived>
        </Row>
      )}
      {fields.length > 0 && <div role="presentation" className="col-span-2 my-2 border-t border-hair" />}
      {fields.map((f) => (
        <Row key={f.id} label={f.name}>
          <FieldValueRow field={f} value={issue.fields[f.id]} members={members} canEdit={canEdit} onPick={(v) => patch({ fields: { [f.id]: v } })} />
        </Row>
      ))}
    </dl>
  )
}
