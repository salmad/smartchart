// The roadmaps API: open a roadmap, stream changes, write ops, issue bodies and comments, and page-tree moves (PUT ?move, as for decks and docs).
import type { UserFrom } from './auth.js'
import { markOf } from '../../src/engine/roadmaps/emoji.js'
import { MAX_COMMENT, newCommentId } from '../../src/engine/comments.js'
import { parseDoc } from '../../src/engine/docs/parse.js'
import { serializeDoc } from '../../src/engine/docs/serialize.js'
import { NO_EDIT } from '../../src/engine/pages/tree.js'
import type { RoadmapOp, IssueProps } from '../../src/engine/roadmaps/ops.js'
import { STATUSES, PREFIX, type FieldDef, type FieldOption, type FieldType, type Status } from '../../src/engine/roadmaps/types.js'
import type { Db } from './db.js'
import { viewerIn } from './decks.js'
import { movePage, parentOf, subpages } from './pages.js'

const ID = /^[\w-]{1,64}$/
const MAX_BYTES = 1_000_000
const NO_STORE = { 'Cache-Control': 'no-store' }
const err = (status: number, error: string) => Response.json({ error }, { status })
const NO_RM = () => err(404, 'No such roadmap.')
const BODY_STALE = 'This doc was changed in another tab or window. Reload to see the latest.'

const refusedRoadmap = async (db: Db, userId: string, id: string) =>
  (await db.getRoadmap(userId, id) ? err(403, 'You can view this roadmap, not edit it.') : NO_RM())

const str = (x: unknown) => (typeof x === 'string' ? x : undefined)
const isStatus = (v: unknown): v is Status => typeof v === 'string' && (STATUSES as readonly string[]).includes(v)
const FIELD_TYPES = new Set<FieldType>(['choice', 'text', 'number', 'date', 'person'])

function fieldOption(v: unknown): FieldOption | null {
  const o = v && typeof v === 'object' ? v as { id?: unknown; name?: unknown; emoji?: unknown } : null
  if (!o || typeof o.id !== 'string' || !ID.test(o.id) || typeof o.name !== 'string' || !o.name.trim()) return null
  // A mark is one emoji or up to two letters; the app only sends those, so anything else is left off.
  const emoji = typeof o.emoji === 'string' ? markOf(o.emoji) : null
  return { id: o.id, name: o.name.trim().slice(0, 200), ...(emoji ? { emoji } : {}) }
}

function fieldDef(v: unknown): FieldDef | null {
  const o = v && typeof v === 'object' ? v as { id?: unknown; name?: unknown; type?: unknown; options?: unknown } : null
  if (!o || typeof o.id !== 'string' || !ID.test(o.id) || typeof o.name !== 'string' || !o.name.trim()) return null
  if (typeof o.type !== 'string' || !FIELD_TYPES.has(o.type as FieldType)) return null
  const def: FieldDef = { id: o.id, name: o.name.trim().slice(0, 200), type: o.type as FieldType }
  if (o.options !== undefined) {
    if (!Array.isArray(o.options)) return null
    const options = o.options.map(fieldOption).filter((x): x is FieldOption => x !== null)
    if (options.length !== o.options.length) return null
    def.options = options
  }
  return def
}

function issueProps(v: unknown): IssueProps | null {
  const o = v && typeof v === 'object' ? v as Record<string, unknown> : null
  if (!o) return null
  const props: IssueProps = {}
  if ('title' in o) { if (typeof o.title !== 'string') return null; props.title = o.title }
  if ('status' in o) { if (!isStatus(o.status)) return null; props.status = o.status }
  if ('assignee' in o) {
    if (o.assignee !== null && (typeof o.assignee !== 'string' || !ID.test(o.assignee))) return null
    props.assignee = o.assignee as string | null
  }
  if ('start' in o) {
    if (o.start !== null && typeof o.start !== 'string') return null
    props.start = o.start as string | null
  }
  if ('due' in o) {
    if (o.due !== null && typeof o.due !== 'string') return null
    props.due = o.due as string | null
  }
  if ('sprint' in o) {
    if (o.sprint !== null && typeof o.sprint !== 'string') return null
    props.sprint = o.sprint as string | null
  }
  if ('fields' in o) {
    if (!o.fields || typeof o.fields !== 'object' || Array.isArray(o.fields)) return null
    const fields: Record<string, string | number | null> = {}
    for (const [k, val] of Object.entries(o.fields as Record<string, unknown>)) {
      if (!ID.test(k)) return null
      if (val === null) fields[k] = null
      else if (typeof val === 'string' || typeof val === 'number') fields[k] = val
      else return null
    }
    props.fields = fields
  }
  return props
}

type CreateIssue = { id: string; parentId: string | null; title: string; after?: string; props?: IssueProps }

function createRow(v: unknown): CreateIssue | null {
  const o = v && typeof v === 'object' ? v as Record<string, unknown> : null
  if (!o || typeof o.id !== 'string' || !ID.test(o.id)) return null
  const title = str(o.title)
  if (!title) return null
  const parentId = o.parentId === null ? null : (typeof o.parentId === 'string' && ID.test(o.parentId) ? o.parentId : null)
  if (o.parentId !== undefined && o.parentId !== null && parentId === null && o.parentId !== null) return null
  const after = o.after === undefined ? undefined : (typeof o.after === 'string' && ID.test(o.after) ? o.after : null)
  if (o.after !== undefined && after === null) return null
  const props = o.props === undefined ? undefined : issueProps(o.props)
  if (o.props !== undefined && props === null) return null
  return { id: o.id, parentId: parentId ?? null, title, ...(after ? { after } : {}), ...(props ? { props } : {}) }
}

/** A roadmap operation from a request body, or null when it is not one. */
export function roadmapOp(v: unknown): RoadmapOp | null {
  const o = v && typeof v === 'object' ? v as { op?: unknown } : null
  if (!o || typeof o.op !== 'string') return null
  switch (o.op) {
    case 'create': {
      const issues = (o as { issues?: unknown }).issues
      if (!Array.isArray(issues) || !issues.length) return null
      const rows = issues.map(createRow)
      if (rows.some((r) => r === null)) return null
      return { op: 'create', issues: rows as NonNullable<typeof rows[number]>[] }
    }
    case 'set': {
      const ids = (o as { ids?: unknown }).ids
      if (!Array.isArray(ids) || !ids.every((id) => typeof id === 'string' && ID.test(id))) return null
      const props = issueProps((o as { props?: unknown }).props)
      if (!props) return null
      return { op: 'set', ids, props }
    }
    case 'move': {
      const id = str((o as { id?: unknown }).id)
      if (!id || !ID.test(id)) return null
      const parentId = (o as { parentId?: unknown }).parentId === null
        ? null
        : (typeof (o as { parentId?: unknown }).parentId === 'string' && ID.test((o as { parentId: string }).parentId)
          ? (o as { parentId: string }).parentId
          : null)
      if ((o as { parentId?: unknown }).parentId !== undefined && (o as { parentId?: unknown }).parentId !== null && parentId === null) return null
      const before = (o as { before?: unknown }).before === undefined ? undefined : str((o as { before?: unknown }).before)
      const after = (o as { after?: unknown }).after === undefined ? undefined : str((o as { after?: unknown }).after)
      if ((o as { before?: unknown }).before !== undefined && (!before || !ID.test(before))) return null
      if ((o as { after?: unknown }).after !== undefined && (!after || !ID.test(after))) return null
      if (before && after) return null
      return { op: 'move', id, parentId: parentId ?? null, ...(before ? { before } : {}), ...(after ? { after } : {}) }
    }
    case 'delete':
    case 'restore': {
      const ids = (o as { ids?: unknown }).ids
      if (!Array.isArray(ids) || !ids.length || !ids.every((id) => typeof id === 'string' && ID.test(id))) return null
      return { op: o.op, ids }
    }
    case 'roadmap': {
      const row: { op: 'roadmap'; name?: string; fields?: FieldDef[]; sprints?: { start: string; weeks: number } | null } = { op: 'roadmap' }
      if ('name' in o) {
        if (typeof (o as { name?: unknown }).name !== 'string') return null
        row.name = (o as { name: string }).name
      }
      if ('fields' in o) {
        const fields = (o as { fields?: unknown }).fields
        if (!Array.isArray(fields)) return null
        const defs = fields.map(fieldDef)
        if (defs.some((f) => f === null)) return null
        row.fields = defs as FieldDef[]
      }
      if ('sprints' in o) {
        const sprints = (o as { sprints?: unknown }).sprints
        if (sprints === null) row.sprints = null
        else {
          const r = sprints && typeof sprints === 'object' ? sprints as { start?: unknown; weeks?: unknown } : null
          if (!r || typeof r.start !== 'string' || typeof r.weeks !== 'number') return null
          row.sprints = { start: r.start, weeks: r.weeks }
        }
      }
      if (row.name === undefined && row.fields === undefined && row.sprints === undefined) return null
      return row
    }
    default:
      return null
  }
}

function commentBody(v: unknown): { issueId: string; text: string; replyTo?: string } | null {
  const o = v && typeof v === 'object' ? v as Record<string, unknown> : null
  if (!o) return null
  const issueId = str(o.issueId), text = str(o.text)?.trim()
  if (!issueId || !ID.test(issueId) || !text || text.length > MAX_COMMENT) return null
  const replyTo = o.replyTo === undefined ? undefined : str(o.replyTo)
  if (o.replyTo !== undefined && (!replyTo || !ID.test(replyTo))) return null
  return { issueId, text, ...(replyTo ? { replyTo } : {}) }
}

function bodySave(v: unknown): { issueId: string; text: string; baseRev: number } | null {
  const o = v && typeof v === 'object' ? v as Record<string, unknown> : null
  if (!o) return null
  const issueId = str(o.issueId), text = str(o.text)
  const baseRev = o.baseRev
  if (!issueId || !ID.test(issueId) || text === undefined || typeof baseRev !== 'number' || !Number.isInteger(baseRev) || baseRev < 0) return null
  return { issueId, text, baseRev }
}

export function roadmapsHandler(deps: { userFrom: UserFrom; db: () => Db | null }) {
  return async (request: Request): Promise<Response> => {
    const db = deps.db()
    if (!db) return err(503, 'Saving is not set up on this server.')
    const user = await deps.userFrom(request)
    if (!user) return err(401, 'Sign in to see your roadmaps.')
    await db.ensureWorkspace(user)
    const q = new URL(request.url).searchParams, id = q.get('id')

    if (request.method === 'GET' && id && q.get('since') !== null) {
      const since = Number(q.get('since'))
      if (!ID.test(id) || !Number.isFinite(since) || since < 0) return NO_RM()
      const c = await db.roadmapChanges(user.id, id, since)
      return c ? Response.json(c, { headers: NO_STORE }) : NO_RM()
    }
    if (request.method === 'GET' && id && q.get('issue') !== null) {
      const issueId = q.get('issue') ?? ''
      if (!ID.test(id) || !ID.test(issueId)) return NO_RM()
      const d = await db.getIssueDetail(user.id, id, issueId)
      return d ? Response.json(d, { headers: NO_STORE }) : NO_RM()
    }
    // A page-tree move, the same call as a deck's or a doc's.
    if (request.method === 'PUT' && id && q.get('move') !== null)
      return ID.test(id) ? movePage(db, user.id, { kind: 'roadmap', id }, request, NO_RM) : NO_RM()
    if (request.method === 'GET' && id && q.get('subpages') !== null)
      return ID.test(id) ? subpages(db, user.id, { kind: 'roadmap', id }, NO_RM) : NO_RM()

    if (request.method === 'GET') {
      if (!id || !ID.test(id)) return NO_RM()
      const r = await db.getRoadmap(user.id, id)
      return r ? Response.json(r, { headers: NO_STORE }) : NO_RM()
    }

    if (request.method === 'DELETE') {
      if (!id || !ID.test(id)) return NO_RM()
      return await db.deleteRoadmap(user.id, id) ? new Response(null, { status: 204 }) : refusedRoadmap(db, user.id, id)
    }

    if (request.method === 'POST' && !id) {
      const b = await request.json().catch(() => null)
      const o = b && typeof b === 'object' ? b as Record<string, unknown> : null
      const rid = str(o?.id), name = str(o?.name), prefix = str(o?.prefix), workspaceId = str(o?.workspaceId)
      const parent = parentOf(o?.parent)
      if (!o || !rid || !ID.test(rid) || !name || !prefix || !workspaceId || !ID.test(workspaceId) || parent === 'bad')
        return err(400, 'Bad roadmap.')
      if (!PREFIX.test(prefix.trim())) return err(400, 'Bad roadmap.')
      const created = await db.createRoadmap(user.id, { id: rid, name: name.slice(0, 200), prefix: prefix.trim(), workspaceId, parent: parent ?? undefined })
      if (created === 'ok') return Response.json({ ok: true })
      if (created === 'foreign') {
        if (!await db.getRoadmap(user.id, rid) && await viewerIn(db, user.id, workspaceId))
          return err(403, 'You can view this workspace, not add to it.')
        return refusedRoadmap(db, user.id, rid)
      }
      return err(409, created)
    }

    if (request.method === 'POST' && id && ID.test(id)) {
      const text = await request.text()
      if (text.length > MAX_BYTES) return err(413, 'This doc is too large to save.')
      let b: Record<string, unknown>
      try { b = JSON.parse(text) as Record<string, unknown> } catch { return err(400, 'Bad request.') }

      if ('comment' in b) {
        const c = commentBody(b.comment)
        if (!c) return err(400, 'Bad comment.')
        const comments = await db.getIssueDetail(user.id, id, c.issueId)
        if (!comments) return NO_RM()
        const row = await db.addIssueComment(user.id, id, c.issueId, {
          id: newCommentId(comments.comments.map((x) => x.id)) + Math.random().toString(36).slice(2, 6),
          by: user.id,
          text: c.text,
          at: Date.now(),
          ...(c.replyTo ? { replyTo: c.replyTo } : {}),
        })
        if (row === 'foreign') return NO_RM()
        if (typeof row === 'string') return err(row === NO_EDIT ? 403 : 409, row)
        return Response.json({ comments: row })
      }

      if ('body' in b) {
        const save = bodySave(b.body)
        if (!save) return err(400, 'Bad body.')
        const { doc } = parseDoc(save.text)
        const { theme: _t, accent: _a, ...body } = doc
        const stored = serializeDoc(body)
        const put = await db.putIssueBody(user.id, id, save.issueId, stored, save.baseRev)
        if (put === 'foreign') return NO_RM()
        if (put === 'conflict') return err(409, BODY_STALE)
        if (typeof put === 'string') return err(put === NO_EDIT ? 403 : 409, put)
        return Response.json(put)
      }

      if ('op' in b) {
        const op = roadmapOp(b.op)
        if (!op) return err(400, 'Bad roadmap change.')
        const r = await db.writeRoadmap(user.id, id, op, 'app')
        if (r === 'foreign') return NO_RM()
        if (typeof r === 'string') return err(r === NO_EDIT ? 403 : 409, r)
        return Response.json(r)
      }

      return err(400, 'Bad request.')
    }

  return err(405, 'method not allowed')
  }
}
