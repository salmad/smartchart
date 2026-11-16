import { buildIndex, type IssueIndex } from './index.js'
import type { Sprint } from './sprints.js'
import type { Issue, RoadmapState, Status } from './types.js'
import { matchesChips, type ViewFilter } from './view.js'

export type SprintRow =
  | { kind: 'group'; key: string; assignee: string | null; label: string; count: number; mine: boolean; open: boolean }
  | { kind: 'issue'; key: string; issue: Issue; parentTitle: string | null; carried: boolean }

/** Work still to do in a sprint: what a person can act on. */
const ACTIVE: readonly Status[] = ['blocked', 'in_progress', 'todo']

/** Every live issue's place in the tree's own order (parents before children, siblings by their keys). */
function treeOrder(idx: IssueIndex): Map<string, number> {
  const order = new Map<string, number>()
  const walk = (parentId: string | null) => {
    for (const i of idx.children(parentId)) {
      order.set(i.id, order.size)
      walk(i.id)
    }
  }
  walk(null)
  return order
}

const byDue = (a: string | null, b: string | null) => (a === b ? 0 : a === null ? 1 : b === null ? -1 : a < b ? -1 : 1)

/** The sprint's open leaf tasks grouped by assignee: the viewer's group first, then the others by name, then
    Unassigned. `names` maps a person's id to their name; someone it doesn't know is labelled by their id, as the table does. */
export function sprintRows(
  s: RoadmapState,
  sprint: Sprint,
  opts: { me: string; today: string; filters: readonly ViewFilter[]; folded: string[]; names: ReadonlyMap<string, string> },
): SprintRow[] {
  const idx = buildIndex(s.issues)
  const order = treeOrder(idx)
  const folded = new Set(opts.folded)
  const groups = new Map<string | null, Issue[]>()

  for (const issue of idx.byId.values()) {
    if (idx.children(issue.id).length) continue
    if (!ACTIVE.includes(issue.status)) continue
    if (!issue.sprint || issue.sprint < sprint.start || issue.sprint > sprint.end) continue
    if (!matchesChips(issue, opts.filters, opts.today, idx)) continue
    const list = groups.get(issue.assignee) ?? []
    list.push(issue)
    groups.set(issue.assignee, list)
  }

  const rank = (st: Status) => ACTIVE.indexOf(st)
  const label = (a: string | null) => (a === null ? 'Unassigned' : (opts.names.get(a) ?? a))
  const assignees = [...groups.keys()].sort((a, b) => {
    if (a === null || b === null) return a === b ? 0 : a === null ? 1 : -1
    if ((a === opts.me) !== (b === opts.me)) return a === opts.me ? -1 : 1
    return label(a).localeCompare(label(b))
  })

  const out: SprintRow[] = []
  for (const assignee of assignees) {
    const list = (groups.get(assignee) ?? []).sort((a, b) =>
      rank(a.status) - rank(b.status) || byDue(a.due, b.due) || (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
    const key = `sprint/${assignee ?? 'none'}`
    const open = !folded.has(key)
    out.push({ kind: 'group', key, assignee, label: label(assignee), count: list.length, mine: assignee !== null && assignee === opts.me, open })
    if (!open) continue
    for (const issue of list) {
      out.push({
        kind: 'issue',
        key: `${key}/${issue.id}`,
        issue,
        parentTitle: issue.parentId ? (idx.byId.get(issue.parentId)?.title ?? null) : null,
        carried: (issue.carried ?? 0) > 0,
      })
    }
  }
  return out
}

/** What can be added to a sprint: open live leaves (Backlog included) not already in it, in the tree's order. A task in
    another sprint is offered too; adding it moves it. */
export function sprintCandidates(s: RoadmapState, sprint: Sprint): Issue[] {
  const idx = buildIndex(s.issues)
  const order = treeOrder(idx)
  return [...idx.byId.values()]
    .filter((i) => !idx.children(i.id).length)
    .filter((i) => i.status === 'backlog' || ACTIVE.includes(i.status))
    .filter((i) => !i.sprint || i.sprint < sprint.start || i.sprint > sprint.end)
    .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
}
