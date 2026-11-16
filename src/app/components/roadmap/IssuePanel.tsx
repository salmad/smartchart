import { useEffect, useRef } from 'react'
import { Maximize2 } from 'lucide-react'
import { SidePanel } from '../SidePanel'
import { IssueDetailView, type IssueViewProps } from './IssueDetailView'
import { mergeIssueDetail } from './issueDetailCache'
import { IconAction, IssueCrumb } from './issueParts'
import { useIssueDetail } from './useIssueDetail'

interface Props extends IssueViewProps {
  onClose: () => void
  onFullPage: () => void
}

/** One issue beside the roadmap. The header (where it sits, open as a page, close) stays put and the rest scrolls.
    In a narrow window it lies over the roadmap instead of squeezing it. Escape closes; focus comes in on open and goes
    back to where it was (or the issue's row) on close. */
export function IssuePanel({ onClose, onFullPage, ...view }: Props) {
  const { issue, issues, roadmap, roadmapId, repo } = view
  const { detail, loading, setDetail } = useIssueDetail(repo, roadmapId, issue.id, issue.seq, issue.bodyRev)
  const panel = useRef<HTMLElement>(null)
  const shown = useRef(issue.id)
  shown.current = issue.id

  useEffect(() => {
    const before = document.activeElement
    panel.current?.focus({ preventScroll: true })
    return () => {
      const back = before instanceof HTMLElement && before.isConnected && before !== document.body
        ? before
        : document.querySelector<HTMLElement>(`[data-issue-id="${CSS.escape(shown.current)}"]`)
      back?.focus({ preventScroll: true })
    }
  }, [])

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      // A menu, a picker or a field that took the Escape for itself has already handled it.
      if (e.key !== 'Escape' || e.defaultPrevented) return
      const t = e.target
      if (t instanceof HTMLElement && t.closest('.ProseMirror, textarea, input, [role="menu"], [role="dialog"]')) return
      onClose()
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [onClose])

  return (
    <SidePanel ref={panel} label="Issue panel" wide narrow="over" closeLabel="Close issue panel" onClose={onClose}
      title={<IssueCrumb roadmap={roadmap} issue={issue} parent={issues.find((i) => i.id === issue.parentId) ?? null} onOpenIssue={view.onOpenIssue} />}
      actions={<IconAction label="Open full page" onClick={onFullPage}><Maximize2 strokeWidth={1.75} /></IconAction>}>
      <IssueDetailView
        key={issue.id}
        {...view}
        detail={detail}
        detailLoading={loading}
        layout="panel"
        onDetail={(patch) => setDetail(mergeIssueDetail(detail, patch))}
      />
    </SidePanel>
  )
}
