import { canParent } from '@/engine/roadmaps/tree'
import type { Issue } from '@/engine/roadmaps/types'

export interface IssueDrop {
  parentId: string | null
  before?: string
  after?: string
}

/** Where a dragged issue lands on a visible row: top third before, middle re-parent under, bottom after. */
export function issueDropTarget(
  issues: Issue[],
  draggedId: string,
  overId: string,
  y: number,
): IssueDrop | null {
  const idx = issues.findIndex((i) => i.id === overId)
  const row = issues[idx]
  const dragged = issues.find((i) => i.id === draggedId)
  if (!row || !dragged || row.id === draggedId) return null

  if (y < 1 / 3) {
    const parentId = row.parentId
    if (canParent(issues, draggedId, parentId) !== 'ok') return null
    if (row.parentId === dragged.parentId) {
      const sibs = issues.filter((i) => i.parentId === parentId && i.deletedAt === null)
      const at = sibs.findIndex((i) => i.id === draggedId)
      const beforeAt = sibs.findIndex((i) => i.id === row.id)
      if (at >= 0 && beforeAt >= 0 && at + 1 === beforeAt) return null
    }
    return { parentId, before: row.id }
  }
  if (y <= 2 / 3) {
    if (canParent(issues, draggedId, row.id) !== 'ok') return null
    const kids = issues.filter((i) => i.parentId === row.id && i.deletedAt === null)
    if (kids.at(-1)?.id === draggedId) return null
    return { parentId: row.id }
  }
  const parentId = row.parentId
  if (canParent(issues, draggedId, parentId) !== 'ok') return null
  if (row.parentId === dragged.parentId) {
    const sibs = issues.filter((i) => i.parentId === parentId && i.deletedAt === null)
    const at = sibs.findIndex((i) => i.id === draggedId)
    const afterAt = sibs.findIndex((i) => i.id === row.id)
    if (at >= 0 && afterAt >= 0 && at === afterAt + 1) return null
  }
  return { parentId, after: row.id }
}

/** When a drop is rejected by tree rules, return the refusal sentence (silent no-ops return null). */
export function issueDropRefusal(
  issues: Issue[],
  draggedId: string,
  overId: string,
  y: number,
): string | null {
  if (issueDropTarget(issues, draggedId, overId, y)) return null
  const row = issues.find((i) => i.id === overId)
  const dragged = issues.find((i) => i.id === draggedId)
  if (!row || !dragged || row.id === draggedId) return null
  const parentId = y < 1 / 3 || y > 2 / 3 ? row.parentId : row.id
  const check = canParent(issues, draggedId, parentId)
  return check === 'ok' ? null : check
}
