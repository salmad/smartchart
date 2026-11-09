import type { Issue, Roadmap } from '../../src/engine/roadmaps/types'

const now = 1_700_000_000_000

export function issue(over: Partial<Issue> = {}): Issue {
  return {
    id: 'iss_test',
    number: 1,
    parentId: null,
    sortKey: 'a',
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
