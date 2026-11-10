import { useEffect, useState } from 'react'
import type { RoadmapRepo } from '@/app/roadmaps'
import type { IssueDetail } from '@/engine/roadmaps/types'
import { peekIssueDetail, rememberIssueDetail } from './issueDetailCache'

function emptyDetail(bodyRev = 0): IssueDetail {
  return { body: '', bodyRev, comments: [], events: [] }
}

function resolveDetail(
  roadmapId: string,
  issueId: string,
  remote: IssueDetail | null,
  bodyRev: number,
): IssueDetail {
  if (remote) return remote
  return peekIssueDetail(roadmapId, issueId) ?? emptyDetail(bodyRev)
}

export function useIssueDetail(
  repo: RoadmapRepo,
  roadmapId: string,
  issueId: string | null,
  issueSeq?: number,
  bodyRev = 0,
) {
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
    const finish = (d: IssueDetail) => {
      if (!go) return
      rememberIssueDetail(roadmapId, issueId, d)
      setDetail(d)
      setError(null)
      setLoading(false)
    }

    const load = (attempt: number) =>
      repo
        .detail(roadmapId, issueId)
        .then((d) => finish(resolveDetail(roadmapId, issueId, d, bodyRev)))
        .catch(() => {
          if (!go) return
          if (attempt === 0) {
            window.setTimeout(() => load(1), 400)
            return
          }
          finish(resolveDetail(roadmapId, issueId, null, bodyRev))
        })

    void load(0)
    return () => { go = false }
  }, [repo, roadmapId, issueId, issueSeq, bodyRev])

  const replace = (next: IssueDetail) => {
    if (issueId) rememberIssueDetail(roadmapId, issueId, next)
    setDetail(next)
  }

  return { detail, loading, error, setDetail: replace }
}
