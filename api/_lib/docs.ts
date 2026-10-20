// The docs API: list a workspace's docs, open, save (with the revision read, 409 when it moved on) and delete.
// Built from its dependencies so tests run it against a fake database and user. Writing in a doc's editor comes in M4.
import type { UserFrom } from './auth.js'
import { MAX_COMMENT, newCommentId, type CommentOp } from '../../src/engine/comments.js'
import { NO_COMMENT, type Db, type DocPresence } from './db.js'
import { recordDocVersion } from './versions.js'
import { viewerIn } from './decks.js'
import { movePage, parentOf, subpages } from './pages.js'

const ID = /^[\w-]{1,64}$/
const MAX_BYTES = 1_000_000
const NO_STORE = { 'Cache-Control': 'no-store' }
const err = (status: number, error: string) => Response.json({ error }, { status })
const NO_DOC = () => err(404, 'No such doc.')

/** A refused write on a doc: a viewer (who can still open it) is told so; anyone else hears it doesn't exist. */
const refusedDoc = async (db: Db, userId: string, id: string) => (await db.getDoc(userId, id) ? err(403, 'You can view this doc, not edit it.') : NO_DOC())

/** The label a save carries (a restore says what it restored), or null. */
const versionLabel = (v: unknown): string | null => {
  const l = (v && typeof v === 'object' ? (v as { label?: unknown }).label : null)
  return typeof l === 'string' && l.trim() ? l.trim().slice(0, 300) : null
}

/** A comment operation from a request body, or null when it is not one. */
function commentOp(v: unknown): CommentOp | null {
  const o = (v && typeof v === 'object' ? v : {}) as { add?: Record<string, unknown>; resolve?: Record<string, unknown>; remove?: Record<string, unknown> }
  const str = (x: unknown) => (typeof x === 'string' ? x : undefined)
  if (o.add) {
    const text = str(o.add.text)?.trim(), anchor = str(o.add.anchor), quote = str(o.add.quote)?.trim().slice(0, 200)
    return text && text.length <= MAX_COMMENT && anchor && ID.test(anchor) ? { add: { text, anchor, ...(quote ? { quote } : {}) } } : null
  }
  if (o.resolve) {
    const cid = str(o.resolve.id), reply = str(o.resolve.reply)
    return cid && ID.test(cid) ? { resolve: { id: cid, ...(reply ? { reply: reply.slice(0, MAX_COMMENT) } : {}) } } : null
  }
  if (o.remove) { const cid = str(o.remove.id); return cid && ID.test(cid) ? { remove: { id: cid } } : null }
  return null
}

export function docsHandler(deps: { userFrom: UserFrom; db: () => Db | null }) {
  return async (request: Request): Promise<Response> => {
    const db = deps.db()
    if (!db) return err(503, 'Saving is not set up on this server.')
    const user = await deps.userFrom(request)
    if (!user) return err(401, 'Sign in to see your docs.')
    await db.ensureWorkspace(user)
    const q = new URL(request.url).searchParams, id = q.get('id'), ws = q.get('workspace')

    // Live view: the revision, who is editing, and the caller's role.
    if (request.method === 'GET' && id && q.get('rev')) {
      const m = ID.test(id) ? await db.getDocMeta(user.id, id) : null
      return m ? Response.json(m, { headers: NO_STORE }) : NO_DOC()
    }
    // Versions (trees, newest first), and the blocks a tree needs by hash. Anyone who can read the doc can read these.
    if (request.method === 'GET' && id && q.get('versions') !== null) {
      if (!ID.test(id) || !await db.getDocMeta(user.id, id)) return NO_DOC()
      return Response.json(await db.listDocVersions(user.id, id), { headers: NO_STORE })
    }
    if (request.method === 'GET' && id && q.get('blobs') !== null) {
      const hashes = (q.get('blobs') ?? '').split(',').filter((h) => /^[a-z0-9]{1,24}$/.test(h)).slice(0, 500)
      if (!ID.test(id) || !await db.getDocMeta(user.id, id)) return NO_DOC()
      return Response.json(await db.docBlobs(user.id, id, hashes))
    }
    if (request.method === 'GET' && id && q.get('comments') !== null) {
      const c = ID.test(id) ? await db.docComments(user.id, id) : null
      return c ? Response.json(c, { headers: NO_STORE }) : NO_DOC()
    }
    // The page tree: how many pages sit below this doc, and moving it.
    if (request.method === 'GET' && id && q.get('subpages') !== null) return ID.test(id) ? subpages(db, user.id, { kind: 'doc', id }, NO_DOC) : NO_DOC()
    if ((request.method === 'PUT' || request.method === 'POST') && id && q.get('move') !== null)
      return ID.test(id) ? movePage(db, user.id, { kind: 'doc', id }, request, NO_DOC) : NO_DOC()
    if (request.method === 'PUT' && id && q.get('presence')) {
      if (!ID.test(id)) return NO_DOC()
      const b = (await request.json().catch(() => ({}))) as { editing?: unknown }, p: DocPresence = b.editing === true ? { editing: { by: user.name, until: Date.now() + 60_000 } } : {}
      return await db.setDocPresence(user.id, id, p) ? Response.json({ ok: true }) : refusedDoc(db, user.id, id)
    }
    // A comment is its own write, so a viewer can leave one without being able to save the doc.
    if (request.method === 'PUT' && id && q.get('comment')) {
      if (!ID.test(id)) return NO_DOC()
      const op = commentOp(await request.json().catch(() => null))
      if (!op) return err(400, 'Bad comment.')
      const r = await db.docComment(user.id, id, op, { id: newCommentId([]) + Math.random().toString(36).slice(2, 6), by: user.name, now: Date.now() })
      if (r === 'foreign') return NO_DOC()
      return typeof r === 'string' ? err(r === NO_COMMENT ? 404 : 403, r) : Response.json(r)
    }

    if (request.method === 'GET' && !id) return ws && ID.test(ws) ? Response.json(await db.listDocs(user.id, ws)) : err(400, 'Say which workspace.')
    if (request.method === 'GET') {
      const d = id && ID.test(id) ? await db.getDoc(user.id, id) : null
      return d ? Response.json(d) : NO_DOC()
    }
    if (request.method === 'DELETE') {
      if (!id || !ID.test(id)) return NO_DOC()
      return await db.deleteDoc(user.id, id) ? new Response(null, { status: 204 }) : refusedDoc(db, user.id, id)
    }
    if (request.method === 'PUT') {
      const text = await request.text()
      if (text.length > MAX_BYTES) return err(413, 'This doc is too large to save.')
      let b: { id?: unknown; name?: unknown; text?: unknown; baseRev?: unknown; workspaceId?: unknown; version?: unknown; parent?: unknown }
      try { b = JSON.parse(text) as typeof b } catch { return err(400, 'Bad doc.') }
      if (typeof b.id !== 'string' || !ID.test(b.id) || typeof b.name !== 'string' || typeof b.text !== 'string'
        || typeof b.baseRev !== 'number' || !Number.isInteger(b.baseRev) || b.baseRev < 0
        || (b.workspaceId !== undefined && (typeof b.workspaceId !== 'string' || !ID.test(b.workspaceId))) || parentOf(b.parent) === 'bad')
        return err(400, 'Bad doc.')
      const parent = parentOf(b.parent)
      const put = await db.putDoc(user.id, b.id, b.name.slice(0, 200), b.text, b.baseRev, b.workspaceId, parent === 'bad' ? undefined : parent)
      if (typeof put === 'object' && 'refused' in put) return err(409, put.refused)
      if (put === 'conflict') return err(409, 'This doc changed somewhere else.')
      if (put === 'foreign') {
        if (!await db.getDoc(user.id, b.id) && b.workspaceId && await viewerIn(db, user.id, b.workspaceId))
          return err(403, 'You can view this workspace, not add to it.')
        return refusedDoc(db, user.id, b.id)
      }
      await recordDocVersion(db, user.id, b.id, b.text, user.name, put.rev, versionLabel(b.version))
      return Response.json({ ok: true, rev: put.rev })
    }
    return err(405, 'method not allowed')
  }
}
