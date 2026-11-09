import { keyBetween } from '../../src/engine/pages/tree'
import type { FieldDef, Issue, Roadmap, RoadmapState } from '../../src/engine/roadmaps/types'
import type { OpCtx } from '../../src/engine/roadmaps/ops'

const now = 1_700_000_000_000
let lastSortKey: string | null = null

export function issue(over: Partial<Issue> = {}): Issue {
  const sortKey = over.sortKey ?? keyBetween(lastSortKey, null)
  if (!over.sortKey) lastSortKey = sortKey
  return {
    id: 'iss_test',
    number: 1,
    parentId: null,
    sortKey,
    title: 'Untitled',
    status: 'todo',
    assignee: null,
    start: null,
    due: null,
    fields: {},
    bodyRev: 0,
    seq: 1,
    createdBy: 'u1',
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...over,
  }
}

export const country: FieldDef = { id: 'f1', name: 'Country', type: 'choice', options: [{ id: 'uk', name: 'UK' }] }

export const ctx: OpCtx = { by: 'ann', byClient: 'app', now: now, members: ['ann', 'bob'] }

export function state(road: Partial<Roadmap> = {}, issues: Issue[] = []): RoadmapState {
  return { roadmap: roadmap(road), issues }
}

export function roadmap(over: Partial<Roadmap> = {}): Roadmap {
  return {
    id: 'rm_test',
    workspaceId: 'ws_test',
    name: 'Roadmap',
    prefix: 'TST',
    fields: [],
    nextNumber: 1,
    seq: 0,
    ...over,
  }
}
