import type { ReactNode } from 'react'
import type { FieldDef, Issue, MemberLite, Roadmap } from '@/engine/roadmaps/types'
import type { IssueProps, RoadmapOp } from '@/engine/roadmaps/ops'
import { progress } from '@/engine/roadmaps/rollup'
import { canParent, issueTree } from '@/engine/roadmaps/tree'
import { toast } from 'sonner'
import { cn } from '@/app/lib/utils'
import { StatusCell } from './cells/StatusCell'
import { PersonCell } from './cells/PersonCell'
import { DateCell } from './cells/DateCell'
import { FieldCell } from './cells/FieldCell'
import { ProgressBar } from './ProgressBar'
import { ParentPicker } from './ParentPicker'
import { STATUS_LABEL } from '@/engine/roadmaps/types'
import { todayIso } from './dates'

interface Props {
  issue: Issue
  roadmap: Roadmap
  fields: FieldDef[]
  issues: Issue[]
  members: MemberLite[]
  canEdit: boolean
  act: (op: RoadmapOp) => 'ok' | string
  layout: 'stack' | 'rail'
  onOpenIssue?: (id: string) => void
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="py-[5px] text-ink-3">{label}</dt>
      <dd className="m-0 flex min-w-0 items-center gap-1.5 text-ink">{children}</dd>
    </>
  )
}

/** A borderless label/value list (v7): edits apply at once; the panel and the full page's rail share it. */
export function IssueProperties({ issue, roadmap, fields, issues, members, canEdit, act, layout, onOpenIssue }: Props) {
  const live = issues.filter((i) => i.deletedAt === null)
  const tree = issueTree(live)
  const prog = tree.children(issue.id).length ? progress(issues, issue.id) : null
  const parent = issue.parentId ? tree.get(issue.parentId) ?? null : null
  const parentChoices = live.filter((i) => i.id !== issue.id && canParent(live, issue.id, i.id) === 'ok')
  const late = !!issue.due && issue.due < todayIso() && issue.status !== 'done' && issue.status !== 'cancelled'

  const patch = (props: IssueProps) => {
    const out = act({ op: 'set', ids: [issue.id], props })
    if (out !== 'ok') toast(out)
  }

  return (
    <dl
      aria-label="Properties"
      className={cn('grid grid-cols-[84px_minmax(0,1fr)] items-center gap-x-2.5 text-[12.5px]', layout === 'stack' && 'border-b border-line pb-4')}
    >
      <Row label="Status">
        <StatusCell status={issue.status} disabled={!canEdit} onPick={(status) => patch({ status })} />
        <span>{STATUS_LABEL[issue.status]}</span>
      </Row>
      <Row label="Assignee">
        <PersonCell withName assignee={issue.assignee} members={members} disabled={!canEdit} onPick={(id) => patch({ assignee: id })} />
      </Row>
      <Row label="Dates">
        <DateCell value={issue.start} label="Start date" placeholder="Start" disabled={!canEdit} onPick={(v) => patch({ start: v })} />
        <span aria-hidden className="text-ink-3">→</span>
        <DateCell value={issue.due} label="Due date" placeholder="Due" late={late} disabled={!canEdit} onPick={(v) => patch({ due: v })} />
      </Row>
      <Row label="Parent">
        {canEdit ? (
          <ParentPicker
            roadmap={roadmap}
            parent={parent}
            choices={parentChoices}
            onPick={(parentId) => { const out = act({ op: 'move', id: issue.id, parentId }); if (out !== 'ok') toast(out) }}
          />
        ) : parent ? (
          <button type="button" className="truncate text-left text-ink hover:text-ink-2" onClick={() => onOpenIssue?.(parent.id)}>{parent.title}</button>
        ) : (
          <span className="text-ink-3">None</span>
        )}
      </Row>
      {prog !== null && (
        <Row label="Progress">
          <ProgressBar value={prog} />
        </Row>
      )}
      {fields.length > 0 && (
        <p className="col-span-2 mt-2 text-[10.5px] uppercase tracking-[.05em] text-ink-3">Fields</p>
      )}
      {fields.map((f) => (
        <Row key={f.id} label={f.name}>
          <FieldCell field={f} value={issue.fields[f.id]} members={members} disabled={!canEdit} onPick={(v) => patch({ fields: { [f.id]: v } })} />
        </Row>
      ))}
    </dl>
  )
}
