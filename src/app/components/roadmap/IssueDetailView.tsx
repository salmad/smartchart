import type { FieldDef, Issue, IssueDetail, MemberLite, Roadmap } from '@/engine/roadmaps/types'
import type { RoadmapOp } from '@/engine/roadmaps/ops'
import type { RoadmapRepo } from '@/app/roadmaps'
import type { Theme } from '@/engine/types'
import { IssueTitle } from './IssueTitle'
import { IssueProperties } from './IssueProperties'
import { IssueBody } from './IssueBody'
import { SubIssues } from './SubIssues'
import { IssueActivity } from './IssueActivity'

/** What the panel and the full page both hand down. */
export interface IssueViewProps {
  roadmapId: string
  issue: Issue
  roadmap: Roadmap
  fields: FieldDef[]
  issues: Issue[]
  members: MemberLite[]
  canEdit: boolean
  act: (op: RoadmapOp) => 'ok' | string
  repo: RoadmapRepo
  look: { theme: Theme; accent?: string }
  onOpenIssue: (id: string) => void
}

interface Props extends Omit<IssueViewProps, 'roadmapId'> {
  detail: IssueDetail | null
  detailLoading: boolean
  layout: 'panel' | 'page'
  onDetail: (patch: Partial<IssueDetail> | IssueDetail) => void
}

/** One issue, top to bottom: title, properties, description, sub-issues, activity. The panel stacks them in one column;
    the page sets the properties in a rail beside a reading column, and stacks like the panel when the window is narrow. */
export function IssueDetailView({ issue, roadmap, fields, issues, members, detail, detailLoading, canEdit, act, repo, look, layout, onOpenIssue, onDetail }: Props) {
  const page = layout === 'page'
  const properties = (className: string) => (
    <IssueProperties issue={issue} roadmap={roadmap} fields={fields} issues={issues} members={members} canEdit={canEdit} act={act} onOpenIssue={onOpenIssue} className={className} />
  )

  const main = (
    <>
      <IssueTitle title={issue.title} canEdit={canEdit} act={act} issueId={issue.id} page={page} />
      {properties(page ? 'mt-4 border-b border-line pb-4 min-[901px]:hidden' : 'mt-3 border-b border-line pb-3')}
      {detailLoading && !detail && <p className="mt-5 text-[13px] text-ink-3">Loading the description…</p>}
      <IssueBody
        roadmapId={roadmap.id}
        issueId={issue.id}
        issueTitle={issue.title}
        body={detail?.body ?? ''}
        bodyRev={detail?.bodyRev ?? issue.bodyRev}
        canEdit={canEdit}
        look={look}
        repo={repo}
        onSaved={(bodyRev, body) => onDetail({ bodyRev, body })}
      />
      <SubIssues parent={issue} roadmap={roadmap} issues={issues} members={members} canEdit={canEdit} act={act} onOpen={onOpenIssue} />
      <IssueActivity
        issue={issue}
        events={detail?.events ?? []}
        comments={detail?.comments ?? []}
        fields={fields}
        members={members}
        canEdit={canEdit}
        onComment={async (text) => {
          const r = await repo.comment(roadmap.id, issue.id, text)
          if (typeof r === 'string') throw new Error(r)
          onDetail((await repo.detail(roadmap.id, issue.id)) ?? { comments: r })
        }}
      />
    </>
  )

  if (!page) return <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-10 pt-1">{main}</div>

  return (
    <div className="flex min-h-0 flex-1">
      <div className="min-w-0 flex-1 overflow-y-auto px-8 pb-16 pt-8 max-[900px]:px-5 max-[900px]:pt-5">
        <div className="mx-auto max-w-[680px]">{main}</div>
      </div>
      <aside aria-label="Issue properties" className="w-[304px] flex-none overflow-y-auto border-l border-line px-5 py-6 max-[900px]:hidden">
        {properties('')}
      </aside>
    </div>
  )
}
