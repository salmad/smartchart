// The docs API: list a workspace's docs, open, save (with the revision read, 409 when it moved on) and delete.
// Built from its dependencies so tests run it against a fake database and user. Writing in a doc's editor comes in M4.
import type { UserFrom } from './auth.js'
import type { Db } from './db.js'
import { viewerIn } from './decks.js'

const ID = /^[\w-]{1,64}$/
const MAX_BYTES = 1_000_000
const err = (status: number, error: string) => Response.json({ error }, { status })
const NO_DOC = () => err(404, 'No such doc.')

/** A refused write on a doc: a viewer (who can still open it) is told so; anyone else hears it doesn't exist. */
const refusedDoc = async (db: Db, userId: string, id: string) => (await db.getDoc(userId, id) ? err(403, 'You can view this doc, not edit it.') : NO_DOC())

export function docsHandler(deps: { userFrom: UserFrom; db: () => Db | null }) {
  return async (request: Request): Promise<Response> => {
    const db = deps.db()
    if (!db) return err(503, 'Saving is not set up on this server.')
    const user = await deps.userFrom(request)
    if (!user) return err(401, 'Sign in to see your docs.')
    await db.ensureWorkspace(user)
    const q = new URL(request.url).searchParams, id = q.get('id'), ws = q.get('workspace')

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
      let b: { id?: unknown; name?: unknown; text?: unknown; baseRev?: unknown; workspaceId?: unknown }
      try { b = JSON.parse(text) as typeof b } catch { return err(400, 'Bad doc.') }
      if (typeof b.id !== 'string' || !ID.test(b.id) || typeof b.name !== 'string' || typeof b.text !== 'string'
        || typeof b.baseRev !== 'number' || !Number.isInteger(b.baseRev) || b.baseRev < 0
        || (b.workspaceId !== undefined && (typeof b.workspaceId !== 'string' || !ID.test(b.workspaceId))))
        return err(400, 'Bad doc.')
      const put = await db.putDoc(user.id, b.id, b.name.slice(0, 200), b.text, b.baseRev, b.workspaceId)
      if (put === 'conflict') return err(409, 'This doc changed somewhere else.')
      if (put === 'foreign') {
        if (!await db.getDoc(user.id, b.id) && b.workspaceId && await viewerIn(db, user.id, b.workspaceId))
          return err(403, 'You can view this workspace, not add to it.')
        return refusedDoc(db, user.id, b.id)
      }
      return Response.json({ ok: true, rev: put.rev })
    }
    return err(405, 'method not allowed')
  }
}
