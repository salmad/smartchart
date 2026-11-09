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
  said: string | null
}

export function IssuePage(props: Props) {
  const { issue, roadmapId, repo } = props
  const { detail, loading, error, setDetail } = useIssueDetail(repo, roadmapId, issue.id)
  const { said, ...rest } = props

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-11 shrink-0 items-center border-b border-line px-4">
        <Button variant="ghost" size="sm" onClick={props.onBack}>Back to table</Button>
      </div>
      {said && <p role="status" className="border-b border-line bg-panel px-8 py-2 text-[12.5px] text-ink-2">{said}</p>}
      <IssueDetailView
        key={issue.id}
        {...rest}
        detail={detail}
        detailLoading={loading}
        detailError={error}
        layout="page"
        onDetail={(patch) => setDetail(mergeIssueDetail(detail, patch))}
      />
    </div>
  )
}
