import { useEffect, useState } from 'react'
import type { RoadmapRepo } from '@/app/roadmaps'
import type { IssueDetail } from '@/engine/roadmaps/types'
import { peekIssueDetail, rememberIssueDetail } from './issueDetailCache'

const DETAIL_LOAD_FAILED = 'Couldn’t load the description and activity.'

export function useIssueDetail(repo: RoadmapRepo, roadmapId: string, issueId: string | null) {
  const [detail, setDetail] = useState<IssueDetail | null>(() => (issueId ? peekIssueDetail(roadmapId, issueId) : null))
  const [loading, setLoading] = useState(() => issueId !== null && detail === null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!issueId) {
      setDetail(null)
      setLoading(false)
      setError(null)
      return
    }
    const peek = peekIssueDetail(roadmapId, issueId)
    if (peek) setDetail(peek)
    else setDetail(null)
    setLoading(!peek)
    setError(null)
    let go = true
    void repo
      .detail(roadmapId, issueId)
      .then((d) => {
        if (!go) return
        if (d) {
          rememberIssueDetail(roadmapId, issueId, d)
          setDetail(d)
          setError(null)
        }
        setLoading(false)
      })
      .catch(() => {
        if (!go) return
        setLoading(false)
        setError(DETAIL_LOAD_FAILED)
      })
    return () => { go = false }
  }, [repo, roadmapId, issueId])

  const replace = (next: IssueDetail) => {
    if (issueId) rememberIssueDetail(roadmapId, issueId, next)
    setDetail(next)
  }

  return { detail, loading, error, setDetail: replace }
}
