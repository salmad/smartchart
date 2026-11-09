import type { FieldDef, Issue, MemberLite, Roadmap } from '@/engine/roadmaps/types'
import type { RoadmapOp } from '@/engine/roadmaps/ops'
import type { RoadmapRepo } from '@/app/roadmaps'
import type { Theme } from '@/engine/types'
import { IssueDetailView } from './IssueDetailView'
import { mergeIssueDetail } from './issueDetailCache'
import { useIssueDetail } from './useIssueDetail'
import { Button } from '../ui/button'

interface Props {
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
  onBack: () => void
  onOpenIssue: (id: string) => void
}

export function IssuePage(props: Props) {
  const { issue, roadmapId, repo } = props
  const { detail, loading, setDetail } = useIssueDetail(repo, roadmapId, issue.id)

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-11 shrink-0 items-center border-b border-line px-4">
        <Button variant="ghost" size="sm" onClick={props.onBack}>Back to table</Button>
      </div>
      <IssueDetailView
        {...props}
        detail={detail}
        detailLoading={loading}
        layout="page"
        onDetail={(patch) => setDetail(mergeIssueDetail(detail, patch))}
      />
    </div>
  )
}
