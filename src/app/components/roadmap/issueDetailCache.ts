import type { IssueDetail, IssueEvent } from '@/engine/roadmaps/types'
import { ROADMAPS_KEY } from '@/app/roadmaps'

const mem = new Map<string, IssueDetail>()

const key = (roadmapId: string, issueId: string) => `${roadmapId}:${issueId}`

export function peekIssueDetail(roadmapId: string, issueId: string): IssueDetail | null {
  const hit = mem.get(key(roadmapId, issueId))
  if (hit) return hit
  try {
    const all = JSON.parse(localStorage.getItem(ROADMAPS_KEY) ?? '{}') as Record<string, {
      issues: { id: string; body: string; bodyRev: number; comments: IssueDetail['comments'] }[]
      events: (IssueEvent & { seq?: number })[]
    }>
    const rm = all[roadmapId]
    const row = rm?.issues.find((i) => i.id === issueId)
    if (!row) return null
    const events = (rm?.events ?? [])
      .filter((e) => e.issueId === issueId)
      .map(({ seq: _s, ...e }) => structuredClone(e))
    return { body: row.body, bodyRev: row.bodyRev, comments: structuredClone(row.comments ?? []), events }
  } catch {
    return null
  }
}

export function rememberIssueDetail(roadmapId: string, issueId: string, detail: IssueDetail) {
  mem.set(key(roadmapId, issueId), detail)
}

export function patchIssueDetail(roadmapId: string, issueId: string, patch: Partial<IssueDetail>) {
  const prev = mem.get(key(roadmapId, issueId))
  if (prev) mem.set(key(roadmapId, issueId), { ...prev, ...patch })
}

export function mergeIssueDetail(detail: IssueDetail | null, patch: Partial<IssueDetail> | IssueDetail): IssueDetail {
  if ('body' in patch && 'bodyRev' in patch && 'comments' in patch && 'events' in patch) return patch as IssueDetail
  return { body: '', bodyRev: 0, comments: [], events: [], ...detail, ...patch }
}
