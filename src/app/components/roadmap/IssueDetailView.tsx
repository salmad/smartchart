import type { FieldDef, Issue, MemberLite, Roadmap } from '@/engine/roadmaps/types'
import type { RoadmapOp } from '@/engine/roadmaps/ops'
import type { RoadmapRepo } from '@/app/roadmaps'
import type { IssueDetail } from '@/engine/roadmaps/types'
import { keyOf } from '@/engine/roadmaps/fields'
import type { Theme } from '@/engine/types'
import { IssueTitle } from './IssueTitle'
import { IssueProperties } from './IssueProperties'
import { IssueBody } from './IssueBody'
import { SubIssues } from './SubIssues'
import { IssueActivity } from './IssueActivity'

interface Props {
  issue: Issue
  roadmap: Roadmap
  fields: FieldDef[]
  issues: Issue[]
  members: MemberLite[]
  detail: IssueDetail | null
  detailLoading: boolean
  canEdit: boolean
  act: (op: RoadmapOp) => 'ok' | string
  repo: RoadmapRepo
  look: { theme: Theme; accent?: string }
  layout: 'panel' | 'page'
  onOpenIssue: (id: string) => void
  onDetail: (patch: Partial<IssueDetail> | IssueDetail) => void
}

export function IssueDetailView({
  issue,
  roadmap,
  fields,
  issues,
  members,
  detail,
  detailLoading,
  canEdit,
  act,
  repo,
  look,
  layout,
  onOpenIssue,
  onDetail,
}: Props) {
  const body = detail?.body ?? ''
  const bodyRev = detail?.bodyRev ?? issue.bodyRev
  const events = detail?.events ?? []
  const comments = detail?.comments ?? []

  const main = (
  <>
      <p className="font-mono text-[12px] text-ink-3">{keyOf(roadmap, issue)}</p>
      <IssueTitle title={issue.title} canEdit={canEdit} act={act} issueId={issue.id} as={layout === 'page' ? 'h1' : 'h2'} />
      {layout === 'panel' && (
        <div className="mt-3">
          <IssueProperties
            issue={issue}
            roadmap={roadmap}
            fields={fields}
            issues={issues}
            members={members}
            canEdit={canEdit}
            act={act}
            layout="stack"
            onOpenIssue={onOpenIssue}
          />
        </div>
      )}
      {detailLoading && !detail && <p className="mt-4 text-[13px] text-ink-2">Loading description…</p>}
      <IssueBody
        roadmapId={roadmap.id}
        issueId={issue.id}
        body={body}
        bodyRev={bodyRev}
        canEdit={canEdit}
        look={look}
        repo={repo}
        onSaved={(rev, text) => onDetail({ bodyRev: rev, body: text })}
      />
      <SubIssues parent={issue} roadmap={roadmap} issues={issues} members={members} canEdit={canEdit} act={act} onOpen={onOpenIssue} />
      <IssueActivity
        issue={issue}
        events={events}
        comments={comments}
        fields={fields}
        members={members}
        canEdit={canEdit}
        onComment={async (text) => {
          const r = await repo.comment(roadmap.id, issue.id, text)
          if (typeof r === 'string') return
          const d = await repo.detail(roadmap.id, issue.id)
          if (d) onDetail(d)
          else onDetail({ comments: r })
        }}
      />
    </>
  )

  if (layout === 'page') {
    return (
      <div className="flex min-h-0 flex-1 gap-8 px-8 py-6 max-[900px]:flex-col max-[900px]:px-4">
        <div className="min-w-0 flex-1 overflow-y-auto">{main}</div>
        <aside className="w-64 shrink-0 overflow-y-auto border-l border-line/50 pl-6 max-[900px]:w-full max-[900px]:border-l-0 max-[900px]:border-t max-[900px]:pl-0 max-[900px]:pt-4">
          <IssueProperties
            issue={issue}
            roadmap={roadmap}
            fields={fields}
            issues={issues}
            members={members}
            canEdit={canEdit}
            act={act}
            layout="rail"
            onOpenIssue={onOpenIssue}
          />
        </aside>
      </div>
    )
  }

  return <div className="overflow-y-auto px-4 py-4">{main}</div>
}
