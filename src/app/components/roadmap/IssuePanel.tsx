import { useEffect } from 'react'
import { X, Maximize2 } from 'lucide-react'
import type { FieldDef, Issue, MemberLite, Roadmap } from '@/engine/roadmaps/types'
import type { RoadmapOp } from '@/engine/roadmaps/ops'
import type { RoadmapRepo } from '@/app/roadmaps'
import type { Theme } from '@/engine/types'
import { IssueDetailView } from './IssueDetailView'
import { mergeIssueDetail } from './issueDetailCache'
import { useIssueDetail } from './useIssueDetail'

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
  onClose: () => void
  onFullPage: () => void
  onOpenIssue: (id: string) => void
}

export function IssuePanel(props: Props) {
  const { issue, roadmapId, repo, onClose } = props
  const { detail, loading, error, setDetail } = useIssueDetail(repo, roadmapId, issue.id, issue.seq)

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      const t = e.target
      if (t instanceof HTMLElement && (t.closest('.ProseMirror') || t.closest('textarea, input'))) return
      onClose()
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [onClose])

  return (
    <aside
      className="flex w-[560px] shrink-0 flex-col border-l border-line bg-app-bg"
      aria-label="Issue panel"
    >
      <div className="flex h-11 shrink-0 items-center justify-end gap-1 border-b border-line px-2">
        <button type="button" className="rounded p-2 text-ink-2 hover:bg-raise hover:text-ink" aria-label="Open full page" onClick={props.onFullPage}>
          <Maximize2 className="size-4" strokeWidth={1.75} />
        </button>
        <button type="button" className="rounded p-2 text-ink-2 hover:bg-raise hover:text-ink" aria-label="Close issue panel" onClick={onClose}>
          <X className="size-4" strokeWidth={1.75} />
        </button>
      </div>
      <IssueDetailView
        key={issue.id}
        {...props}
        detail={detail}
        detailLoading={loading}
        detailError={error}
        layout="panel"
        onDetail={(patch) => setDetail(mergeIssueDetail(detail, patch))}
      />
    </aside>
  )
}
