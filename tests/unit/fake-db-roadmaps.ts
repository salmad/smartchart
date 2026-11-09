import { applyOp } from '../../src/engine/roadmaps/ops'
import type { Issue, IssueComment, IssueEvent, FieldDef } from '../../src/engine/roadmaps/types'
import { NO_EDIT, type PageRef } from '../../src/engine/pages/tree'
import { can, type Action, type Role } from '../../api/_lib/access'
import type { Db } from '../../api/_lib/db'

export type FakeRoadmapRow = {
  id: string; ws: string; user: string; name: string; prefix: string; updated: number
  parent?: PageRef | null; sortKey?: string | null
  fields: FieldDef[]; nextNumber: number; seq: number
}

export type FakeIssueRow = Issue & { roadmapId: string; body: string; comments: IssueComment[] }

type StoredEvent = IssueEvent & { roadmapId: string; seq: number }

type Calls = 'createRoadmap' | 'getRoadmap' | 'roadmapChanges' | 'writeRoadmap' | 'getIssueDetail' | 'putIssueBody' | 'addIssueComment' | 'deleteRoadmap'

export function fakeRoadmapCalls(deps: {
  roadmaps: Map<string, FakeRoadmapRow>
  issues: Map<string, FakeIssueRow>
  issueEvents: StoredEvent[]
  roadmapIf: (u: string, id: string, action: Action) => FakeRoadmapRow | undefined
  role: (u: string, r: { ws: string | null; user: string } | undefined) => Role | null
  memberIds: (ws: string) => string[]
  membersLite: (ws: string) => { id: string; name: string; email: string }[]
  place: (u: string, wanted: string | undefined, parent: PageRef | undefined) => { ws: string | null | false; parent: PageRef | null; key: string | null } | { refused: string }
  removeTree: (u: string, page: PageRef) => Promise<boolean>
  tick: () => number
}): Pick<Db, Calls> {
  const { roadmaps, issues, issueEvents, roadmapIf, role, memberIds, membersLite, place, removeTree, tick } = deps

  const purgeRoadmap = (id: string) => {
    for (const [iid, row] of [...issues.entries()]) if (row.roadmapId === id) issues.delete(iid)
    for (let i = issueEvents.length - 1; i >= 0; i--) if (issueEvents[i].roadmapId === id) issueEvents.splice(i, 1)
    roadmaps.delete(id)
  }

  const loadState = (m: FakeRoadmapRow) => ({
    roadmap: { id: m.id, workspaceId: m.ws, name: m.name, prefix: m.prefix, fields: structuredClone(m.fields), nextNumber: m.nextNumber, seq: m.seq },
    issues: [...issues.values()].filter((i) => i.roadmapId === m.id).map(({ roadmapId: _r, body: _b, comments: _c, ...issue }) => structuredClone(issue)),
  })

  const saveOp = (m: FakeRoadmapRow, result: { state: { roadmap: { name: string; fields: FieldDef[]; nextNumber: number; seq: number }; issues: Issue[] }; changed: Issue[]; events: IssueEvent[] }) => {
    m.name = result.state.roadmap.name
    m.fields = structuredClone(result.state.roadmap.fields)
    m.nextNumber = result.state.roadmap.nextNumber
    m.seq = result.state.roadmap.seq
    m.updated = tick()
    for (const row of result.changed) {
      const prev = issues.get(row.id)
      issues.set(row.id, { ...structuredClone(row), roadmapId: m.id, body: prev?.body ?? '', comments: prev?.comments ?? [] })
    }
    for (const e of result.events) issueEvents.push({ ...e, roadmapId: m.id, seq: result.state.roadmap.seq })
    return { seq: m.seq, changed: structuredClone(result.changed) }
  }

  return {
    createRoadmap: async (u, r) => {
      if (roadmaps.has(r.id)) return 'foreign'
      const at = place(u, r.workspaceId, r.parent)
      if ('refused' in at) return at.refused
      const name = r.name.trim(), prefix = r.prefix.trim()
      if (!name) return 'Every roadmap needs a name.'
      if (!prefix) return 'Every roadmap needs a prefix.'
      if (at.ws === false || at.ws === null) return 'foreign'
      roadmaps.set(r.id, {
        id: r.id, ws: at.ws, user: u, name, prefix, updated: tick(), parent: at.parent, sortKey: at.key,
        fields: [], nextNumber: 1, seq: 0,
      })
      return 'ok'
    },
    deleteRoadmap: async (u, id) => {
      const ok = await removeTree(u, { kind: 'roadmap', id })
      if (ok) purgeRoadmap(id)
      return ok
    },
    getRoadmap: async (u, id) => {
      const m = roadmapIf(u, id, 'read')
      if (!m) return null
      return { ...loadState(m), role: role(u, m) as Role, members: membersLite(m.ws) }
    },
    roadmapChanges: async (u, id, since) => {
      const m = roadmapIf(u, id, 'read')
      if (!m) return null
      const changedIssues = [...issues.values()].filter((i) => i.roadmapId === id && i.seq > since).map(({ roadmapId: _r, body: _b, comments: _c, ...issue }) => structuredClone(issue))
      const events = issueEvents.filter((e) => e.roadmapId === id && e.seq > since).map(({ roadmapId: _r, seq: _s, ...e }) => structuredClone(e))
      return { seq: m.seq, roadmap: m.seq > since ? loadState(m).roadmap : null, issues: changedIssues, events }
    },
    writeRoadmap: async (u, id, op, byClient) => {
      const m = roadmaps.get(id)
      if (!m || !can(role(u, m), 'read')) return 'foreign'
      if (!can(role(u, m), 'write')) return NO_EDIT
      const now = Date.now()
      const r = applyOp(loadState(m), op, { by: u, byClient, now, members: memberIds(m.ws) })
      if ('refused' in r) return r.refused
      return saveOp(m, r)
    },
    getIssueDetail: async (u, id, issueId) => {
      const m = roadmapIf(u, id, 'read')
      if (!m) return null
      const row = issues.get(issueId)
      if (!row || row.roadmapId !== id) return null
      const events = issueEvents.filter((e) => e.roadmapId === id && e.issueId === issueId).map(({ roadmapId: _r, seq: _s, ...e }) => structuredClone(e))
      return { body: row.body, bodyRev: row.bodyRev, comments: structuredClone(row.comments), events }
    },
    putIssueBody: async (u, id, issueId, body, baseRev) => {
      const m = roadmaps.get(id)
      const row = issues.get(issueId)
      if (!m || !row || row.roadmapId !== id || !can(role(u, m), 'read')) return 'foreign'
      if (!can(role(u, m), 'write')) return NO_EDIT
      if (row.bodyRev !== baseRev) return 'conflict'
      const now = Date.now()
      m.seq += 1
      m.updated = tick()
      row.body = body
      row.bodyRev = baseRev + 1
      row.seq = m.seq
      row.updatedAt = now
      issueEvents.push({ roadmapId: id, seq: m.seq, issueId, by: u, byClient: 'app', at: now, what: 'set', changes: [{ path: 'body', from: null, to: body }] })
      return { bodyRev: row.bodyRev, seq: m.seq }
    },
    addIssueComment: async (u, id, issueId, c) => {
      const m = roadmaps.get(id)
      const row = issues.get(issueId)
      if (!m || !row || row.roadmapId !== id || !can(role(u, m), 'read')) return 'foreign'
      if (!can(role(u, m), 'write')) return NO_EDIT
      const now = Date.now()
      m.seq += 1
      m.updated = tick()
      row.comments.push(structuredClone(c))
      row.seq = m.seq
      row.updatedAt = now
      issueEvents.push({ roadmapId: id, seq: m.seq, issueId, by: u, byClient: 'app', at: now, what: 'commented', changes: [{ path: 'comment', from: null, to: c.text }] })
      return structuredClone(row.comments)
    },
  }
}
