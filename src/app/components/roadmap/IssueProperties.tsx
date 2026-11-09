import type { FieldDef, Issue, MemberLite, Roadmap } from '@/engine/roadmaps/types'
import type { RoadmapOp } from '@/engine/roadmaps/ops'
import { keyOf } from '@/engine/roadmaps/fields'
import { progress } from '@/engine/roadmaps/rollup'
import { canParent, issueTree } from '@/engine/roadmaps/tree'
import { toast } from 'sonner'
import { StatusCell } from './cells/StatusCell'
import { PersonCell } from './cells/PersonCell'
import { DateCell } from './cells/DateCell'
import { FieldCell } from './cells/FieldCell'
import { ProgressBar } from './ProgressBar'

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

function Row({ label, children, rail }: { label: string; children: React.ReactNode; rail: boolean }) {
  if (rail) {
    return (
      <div className="grid gap-1 border-b border-line/50 py-2.5 text-[12px]">
        <span className="text-ink-3">{label}</span>
        <div className="text-ink">{children}</div>
      </div>
    )
  }
  return (
    <div className="flex items-center gap-3 py-1.5 text-[12px]">
      <span className="w-24 shrink-0 text-ink-3">{label}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}

export function IssueProperties({ issue, roadmap, fields, issues, members, canEdit, act, layout, onOpenIssue }: Props) {
  const rail = layout === 'rail'
  const tree = issueTree(issues.filter((i) => i.deletedAt === null))
  const kids = tree.children(issue.id)
  const prog = kids.length ? progress(issues, issue.id) : null
  const parent = issue.parentId ? tree.get(issue.parentId) : null

  const patch = (props: Record<string, unknown>) => {
    act({ op: 'set', ids: [issue.id], props: props as import('@/engine/roadmaps/ops').IssueProps })
  }

  const live = issues.filter((i) => i.deletedAt === null)
  const parentChoices = live.filter((i) => i.id !== issue.id && canParent(live, issue.id, i.id) === 'ok')

  return (
    <div className={rail ? 'text-[12px]' : 'rounded-lg border border-line/60 bg-panel/40 px-3 py-2'} aria-label="Properties">
      <Row label="Status" rail={rail}>
        <StatusCell status={issue.status} disabled={!canEdit} onPick={(status) => patch({ status })} />
      </Row>
      <Row label="Assignee" rail={rail}>
        <PersonCell assignee={issue.assignee} members={members} disabled={!canEdit} onPick={(id) => patch({ assignee: id })} />
      </Row>
      <Row label="Start" rail={rail}>
        <DateCell value={issue.start} label="Start date" disabled={!canEdit} onPick={(v) => patch({ start: v })} />
      </Row>
      <Row label="Due" rail={rail}>
        <DateCell value={issue.due} label="Due date" disabled={!canEdit} onPick={(v) => patch({ due: v })} />
      </Row>
      <Row label="Parent" rail={rail}>
        {canEdit ? (
          <select
            className="w-full rounded border border-line bg-app-bg px-2 py-1 text-[12px] text-ink"
            value={issue.parentId ?? ''}
            aria-label="Parent issue"
            onChange={(e) => {
              const parentId = e.target.value || null
              const out = act({ op: 'move', id: issue.id, parentId })
              if (out !== 'ok') toast(out)
            }}
          >
            <option value="">No parent</option>
            {parentChoices.map((i) => (
              <option key={i.id} value={i.id}>{keyOf(roadmap, i)} · {i.title}</option>
            ))}
          </select>
        ) : parent ? (
          <button type="button" className="truncate text-left text-ink hover:text-gold" onClick={() => onOpenIssue?.(parent.id)}>
            {keyOf(roadmap, parent)} · {parent.title}
          </button>
        ) : (
          <span className="text-ink-3">None</span>
        )}
      </Row>
      {prog !== null && (
        <Row label="Progress" rail={rail}>
          <ProgressBar value={prog} />
        </Row>
      )}
      {fields.length > 0 && (
        <p className={rail ? 'mt-3 text-[11px] font-medium uppercase tracking-wide text-ink-3' : 'mt-2 border-t border-line/50 pt-2 text-[11px] font-medium uppercase tracking-wide text-ink-3'}>
          Fields
        </p>
      )}
      {fields.map((f) => (
        <Row key={f.id} label={f.name} rail={rail}>
          <FieldCell
            field={f}
            value={issue.fields[f.id]}
            members={members}
            disabled={!canEdit}
            onPick={(v) => patch({ fields: { [f.id]: v } })}
          />
        </Row>
      ))}
    </div>
  )
}
