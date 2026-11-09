import { useEffect, useState } from 'react'
import type { RoadmapRepo } from '@/app/roadmaps'
import type { IssueDetail } from '@/engine/roadmaps/types'
import { peekIssueDetail, rememberIssueDetail } from './issueDetailCache'

export function useIssueDetail(repo: RoadmapRepo, roadmapId: string, issueId: string | null) {
  const [detail, setDetail] = useState<IssueDetail | null>(() => (issueId ? peekIssueDetail(roadmapId, issueId) : null))
  const [loading, setLoading] = useState(() => issueId !== null && detail === null)

  useEffect(() => {
    if (!issueId) { setDetail(null); setLoading(false); return }
    const peek = peekIssueDetail(roadmapId, issueId)
    if (peek) setDetail(peek)
    setLoading(!peek)
    let go = true
    void repo.detail(roadmapId, issueId).then((d) => {
      if (!go) return
      if (d) {
        rememberIssueDetail(roadmapId, issueId, d)
        setDetail(d)
      }
      setLoading(false)
    })
    return () => { go = false }
  }, [repo, roadmapId, issueId])

  const replace = (next: IssueDetail) => {
    if (issueId) rememberIssueDetail(roadmapId, issueId, next)
    setDetail(next)
  }

  return { detail, loading, setDetail: replace }
}
