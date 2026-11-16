import { ChevronLeft } from 'lucide-react'
import { Button } from '../ui/button'
import { IssueDetailView, type IssueViewProps } from './IssueDetailView'
import { mergeIssueDetail } from './issueDetailCache'
import { IssueCrumb } from './issueParts'
import { useIssueDetail } from './useIssueDetail'

interface Props extends IssueViewProps {
  /** Back to the roadmap, in the view it was left in (table, Gantt or Matrix). */
  onBack: () => void
  said: string | null
}

/** One issue as a page of its own: a way back and where it sits, then a reading column with the properties beside it. */
export function IssuePage({ onBack, said, ...view }: Props) {
  const { issue, issues, roadmap, roadmapId, repo } = view
  const { detail, loading, setDetail } = useIssueDetail(repo, roadmapId, issue.id, issue.seq, issue.bodyRev)

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <header className="flex h-11 flex-none items-center gap-2 border-b border-line px-3 text-[13px]">
        <Button variant="ghost" size="sm" className="max-w-[40%] flex-none gap-1 px-2 text-[13px] font-normal hover:bg-panel" onClick={onBack}>
          <ChevronLeft strokeWidth={1.75} />
          <span className="truncate">{roadmap.name}</span>
        </Button>
        <span aria-hidden className="flex-none text-ink-3">/</span>
        <IssueCrumb roadmap={roadmap} issue={issue} parent={issues.find((i) => i.id === issue.parentId) ?? null} onOpenIssue={view.onOpenIssue} />
      </header>
      {said && <p role="status" className="border-b border-line bg-panel px-8 py-2 text-[12.5px] text-ink-2">{said}</p>}
      <IssueDetailView
        key={issue.id}
        {...view}
        detail={detail}
        detailLoading={loading}
        layout="page"
        onDetail={(patch) => setDetail(mergeIssueDetail(detail, patch))}
      />
    </div>
  )
}
