import { applyOp } from '../../src/engine/roadmaps/ops.js'
import type { FieldDef, Issue, IssueComment, IssueEvent } from '../../src/engine/roadmaps/types.js'
import { NO_EDIT } from '../../src/engine/pages/tree.js'
import { rolesFor, type Role } from './access.js'
import { may, roleOf } from './db-decks.js'
import type { Db, Q, Tx } from './db.js'

const R = (a: 'read' | 'write') => rolesFor(a)
const ms = (t: string | Date) => new Date(t).getTime()
const isoDate = (d: string | Date | null | undefined): string | null => {
  if (d == null) return null
  return typeof d === 'string' ? d.slice(0, 10) : d.toISOString().slice(0, 10)
}

type RoadmapRow = {
  id: string; workspace_id: string; name: string; prefix: string; fields: FieldDef[]; next_number: number; seq: string | number; role: Role
}

type IssueRow = {
  id: string; number: number; parent_id: string | null; sort_key: string; title: string; status: string; assignee: string | null
  start_date: string | Date | null; due_date: string | Date | null; fields: Record<string, unknown>; body_rev: number; seq: string | number
  created_by: string; created_at: string | Date; updated_at: string | Date; deleted_at: string | Date | null
}

const toIssue = (r: IssueRow): Issue => ({
  id: r.id,
  number: r.number,
  parentId: r.parent_id,
  sortKey: r.sort_key,
  title: r.title,
  status: r.status as Issue['status'],
  assignee: r.assignee,
  start: isoDate(r.start_date),
  due: isoDate(r.due_date),
  fields: r.fields as Issue['fields'],
  bodyRev: r.body_rev,
  seq: Number(r.seq),
  createdBy: r.created_by,
  createdAt: ms(r.created_at),
  updatedAt: ms(r.updated_at),
  deletedAt: r.deleted_at ? ms(r.deleted_at) : null,
})

const toEvent = (r: { issue_id: string | null; user_id: string; by_client: string; at: string | Date; what: string; changes: IssueEvent['changes'] }): IssueEvent => ({
  issueId: r.issue_id,
  by: r.user_id,
  byClient: r.by_client,
  at: ms(r.at),
  what: r.what as IssueEvent['what'],
  changes: r.changes,
})

type Calls = 'getRoadmap' | 'roadmapChanges' | 'writeRoadmap' | 'getIssueDetail' | 'putIssueBody' | 'addIssueComment'

const BUSY = 'Busy, try again.'

export function roadmapCalls(q: Q, tx: Tx): Pick<Db, Calls> {
  const membersOf = async (ws: string) => (await q<{ user_id: string; name: string; email: string }>(
    `select user_id, name, email from members where workspace_id = $1 order by joined`,
    [ws])).map((m) => ({ id: m.user_id, name: m.name, email: m.email }))

  const memberIds = async (ws: string) => (await q<{ user_id: string }>(`select user_id from members where workspace_id = $1`, [ws])).map((m) => m.user_id)

  const readRoadmap = async (u: string, id: string, roles: ReturnType<typeof R>) => {
    const head = await q<RoadmapRow>(
      `select id, workspace_id, name, prefix, fields, next_number, seq, ${roleOf('roadmaps', '$1')} as role
       from roadmaps where id = $2 and ${may('roadmaps', '$1', '$3')}`,
      [u, id, roles])
  return head[0] ?? null
  }

  const loadState = async (u: string, id: string) => {
    const m = await readRoadmap(u, id, R('read'))
    if (!m) return null
    const rows = await q<IssueRow>(
      `select id, number, parent_id, sort_key, title, status, assignee, start_date, due_date, fields, body_rev, seq, created_by, created_at, updated_at, deleted_at
       from issues where roadmap_id = $1 order by seq`,
      [id])
    const roadmap = { id: m.id, workspaceId: m.workspace_id, name: m.name, prefix: m.prefix, fields: m.fields, nextNumber: m.next_number, seq: Number(m.seq) }
    return { m, roadmap, issues: rows.map(toIssue) }
  }

  const loadForOp = async (u: string, id: string) => {
    const m = await readRoadmap(u, id, R('write'))
    if (!m) return { kind: 'foreign' as const }
    if (m.role === 'viewer') return { kind: 'view' as const }
    const rows = await q<IssueRow>(
      `select id, number, parent_id, sort_key, title, status, assignee, start_date, due_date, fields, body_rev, seq, created_by, created_at, updated_at, deleted_at
       from issues where roadmap_id = $1`,
      [id])
    const roadmap = { id: m.id, workspaceId: m.workspace_id, name: m.name, prefix: m.prefix, fields: m.fields, nextNumber: m.next_number, seq: Number(m.seq) }
    return { kind: 'ok' as const, m, state: { roadmap, issues: rows.map(toIssue) }, readSeq: Number(m.seq) }
  }

  const upsertIssue = (row: Issue, roadmapId: string): [string, unknown[]] => {
    const params: unknown[] = [
      row.id, roadmapId, row.number, row.parentId, row.sortKey, row.title, row.status, row.assignee,
      row.start, row.due, row.bodyRev, JSON.stringify(row.fields), Number(row.seq), row.createdBy,
      new Date(row.createdAt), new Date(row.updatedAt), row.deletedAt ? new Date(row.deletedAt) : null,
    ]
    return [`insert into issues (id, roadmap_id, number, parent_id, sort_key, title, status, assignee, start_date, due_date, body_rev, fields, seq, created_by, created_at, updated_at, deleted_at)
      values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13,$14,$15,$16,$17)
      on conflict (id) do update set number = excluded.number, parent_id = excluded.parent_id, sort_key = excluded.sort_key, title = excluded.title, status = excluded.status,
        assignee = excluded.assignee, start_date = excluded.start_date, due_date = excluded.due_date, body_rev = excluded.body_rev, fields = excluded.fields,
        seq = excluded.seq, updated_at = excluded.updated_at, deleted_at = excluded.deleted_at
      where issues.roadmap_id = excluded.roadmap_id`, params]
  }

  const insertEvent = (roadmapId: string, seq: number, e: IssueEvent, u: string): [string, unknown[]] => [
    `insert into issue_events (roadmap_id, issue_id, user_id, by_client, seq, at, what, changes)
     values ($1,$2,$3,$4,$5,to_timestamp($6/1000.0),$7,$8::jsonb)`,
    [roadmapId, e.issueId, u, e.byClient, seq, e.at, e.what, JSON.stringify(e.changes)],
  ]

  return {
    getRoadmap: async (u, id) => {
      const loaded = await loadState(u, id)
      if (!loaded) return null
      return { roadmap: loaded.roadmap, issues: loaded.issues, role: loaded.m.role, members: await membersOf(loaded.m.workspace_id) }
    },
    roadmapChanges: async (u, id, since) => {
      const loaded = await loadState(u, id)
      if (!loaded) return null
      const seq = loaded.roadmap.seq
      const issues = loaded.issues.filter((i) => i.seq > since)
      const evs = await q<{ issue_id: string | null; user_id: string; by_client: string; at: string | Date; what: string; changes: IssueEvent['changes']; seq: string | number }>(
        `select issue_id, user_id, by_client, at, what, changes, seq from issue_events where roadmap_id = $2 and seq > $3 and ${may('roadmaps', '$1', '$4')}`,
        [u, id, since, R('read')])
      return { seq, roadmap: seq > since ? loaded.roadmap : null, issues, events: evs.map(toEvent) }
    },
    writeRoadmap: async (u, id, op, byClient) => {
      for (let attempt = 0; attempt < 3; attempt++) {
        const read = await loadForOp(u, id)
        if (read.kind === 'foreign') return 'foreign'
        if (read.kind === 'view') return NO_EDIT
        const now = Date.now()
        const applied = applyOp(read.state, op, { by: u, byClient, now, members: await memberIds(read.m.workspace_id) })
        if ('refused' in applied) return applied.refused
        const { state, changed, events } = applied
        const { roadmap } = state
        const stmts: [string, unknown[]][] = [[
          `update roadmaps set name = $3, fields = $4::jsonb, next_number = $5, seq = $6, updated_at = now()
           where id = $1 and seq = $2 and workspace_id = $7 and ${may('roadmaps', '$8', '$9')} returning seq`,
          [id, read.readSeq, roadmap.name, JSON.stringify(roadmap.fields), roadmap.nextNumber, roadmap.seq, read.m.workspace_id, u, R('write')],
        ]]
        for (const row of changed) stmts.push(upsertIssue(row, id))
        for (const e of events) stmts.push(insertEvent(id, roadmap.seq, e, u))
        const out = await tx(stmts)
        if ((out[0] as { seq: string | number }[])[0]) return { seq: roadmap.seq, changed }
      }
      return BUSY
    },
    getIssueDetail: async (u, id, issueId) => {
      const m = await readRoadmap(u, id, R('read'))
      if (!m) return null
      const row = await q<{ body: string; body_rev: number; comments: IssueComment[] }>(
        `select body, body_rev, comments from issues where id = $2 and roadmap_id = $3 and exists (
          select 1 from roadmaps r where r.id = $3 and ${may('roadmaps', '$1', '$4')})`,
        [u, issueId, id, R('read')])
      if (!row[0]) return null
      const evs = await q<{ issue_id: string | null; user_id: string; by_client: string; at: string | Date; what: string; changes: IssueEvent['changes'] }>(
        `select issue_id, user_id, by_client, at, what, changes from issue_events where roadmap_id = $2 and issue_id = $3 order by at`,
        [id, issueId])
      return { body: row[0].body, bodyRev: row[0].body_rev, comments: row[0].comments, events: evs.map(toEvent) }
    },
    putIssueBody: async (u, id, issueId, body, baseRev) => {
      const m = await readRoadmap(u, id, R('write'))
      if (!m) {
        const canRead = await readRoadmap(u, id, R('read'))
        return canRead ? NO_EDIT : 'foreign'
      }
      const readSeq = Number(m.seq)
      const now = Date.now()
      const nextSeq = readSeq + 1
      const out = await tx([
        [`update roadmaps set seq = $2, updated_at = now() where id = $1 and seq = $3 and ${may('roadmaps', '$4', '$5')} returning seq`,
          [id, nextSeq, readSeq, u, R('write')]],
        [`update issues set body = $4, body_rev = $5, updated_at = to_timestamp($6/1000.0), seq = $7
          where id = $2 and roadmap_id = $1 and body_rev = $8 returning id`,
          [id, issueId, nextSeq, body, baseRev + 1, now, nextSeq, baseRev]],
        insertEvent(id, nextSeq, { issueId, by: u, byClient: 'app', at: now, what: 'set', changes: [{ path: 'body', from: null, to: body }] }, u),
      ])
      if ((out[0] as { seq: string | number }[])[0] && (out[1] as { id: string }[])[0]) return { bodyRev: baseRev + 1, seq: nextSeq }
      const exists = await q(`select 1 from issues where id = $2 and roadmap_id = $3`, [issueId, id])
      if (!exists.length) return 'foreign'
      return 'conflict'
    },
    addIssueComment: async (u, id, issueId, c) => {
      const m = await readRoadmap(u, id, R('write'))
      if (!m) {
        const canRead = await readRoadmap(u, id, R('read'))
        return canRead ? NO_EDIT : 'foreign'
      }
      const now = Date.now()
      const upd = await q<{ comments: IssueComment[]; seq: string | number }>(
        `update issues set comments = comments || $4::jsonb, updated_at = now(), seq = (select seq + 1 from roadmaps r where r.id = $3)
         where id = $2 and roadmap_id = $3
         and exists (select 1 from roadmaps r where r.id = $3 and ${may('roadmaps', '$1', '$5')})
         returning comments, (select seq from roadmaps where id = $3) as seq`,
        [u, issueId, id, JSON.stringify([c]), R('write')])
      if (!upd[0]) return 'foreign'
      const seq = Number(upd[0].seq)
      await tx([
        [`update roadmaps set seq = $2, updated_at = now() where id = $1`, [id, seq]],
        insertEvent(id, seq, { issueId, by: u, byClient: 'app', at: now, what: 'commented', changes: [{ path: 'comment', from: null, to: c.text }] }, u),
      ])
      return upd[0].comments
    },
  }
}
