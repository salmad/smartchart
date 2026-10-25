// The decks API, built from its dependencies so tests can run it against a fake database and user.
import type { UserFrom } from './auth.js'
import type { Db, Presence } from './db.js'
import { movePage, parentOf, subpages } from './pages.js'
import { appMeta, recordVersion } from './versions.js'

const ID = /^[\w-]{1,64}$/
const MAX_BYTES = 2_000_000
const NO_DECK = () => Response.json({ error: 'No such deck.' }, { status: 404 })

/** A refused write on a deck: a viewer is told they can only view it; anyone else hears it doesn't exist. */
export async function refusedDeck(db: Db, userId: string, id: string): Promise<Response> {
  return await db.deckRole(userId, id) === 'viewer' ? Response.json({ error: 'You can view this deck, not edit it.' }, { status: 403 }) : NO_DECK()
}

/** The user is a viewer (only) in the workspace. */
export const viewerIn = async (db: Db, userId: string, ws: string) => (await db.listWorkspaces(userId)).some((w) => w.id === ws && w.role === 'viewer')

export function decksHandler(deps: { userFrom: UserFrom; db: () => Db | null }) {
  return async (request: Request): Promise<Response> => {
    const db = deps.db()
    if (!db) return Response.json({ error: 'Saving is not set up on this server.' }, { status: 503 })
    const user = await deps.userFrom(request)
    if (!user) return Response.json({ error: 'Sign in to see your decks.' }, { status: 401 })
    // A user's first request makes their personal workspace and moves their decks from before into it.
    await db.ensureWorkspace(user)
    const q = new URL(request.url).searchParams, id = q.get('id')

    // Live view: the app asks for the revision (and who is working) every few seconds, and for what changed since.
    if (request.method === 'GET' && id && q.get('rev')) {
      const m = ID.test(id) ? await db.getDeckMeta(user.id, id) : null
      return m ? Response.json({ rev: m.rev, presence: m.presence }, { headers: { 'Cache-Control': 'no-store' } }) : Response.json({ error: 'No such deck.' }, { status: 404 })
    }
    if (request.method === 'GET' && id && q.get('events') !== null)
      return Response.json(ID.test(id) ? await db.eventsSince(user.id, id, Number(q.get('events')) || 0) : [], { headers: { 'Cache-Control': 'no-store' } })
    // Versions: the list (trees, newest first), and the slides a tree needs, by hash.
    if (request.method === 'GET' && id && q.get('versions') !== null)
      return Response.json(ID.test(id) ? await db.listVersions(user.id, id) : [], { headers: { 'Cache-Control': 'no-store' } })
    if (request.method === 'GET' && id && q.get('blobs') !== null) {
      const hashes = (q.get('blobs') ?? '').split(',').filter((h) => /^[a-z0-9]{1,24}$/.test(h)).slice(0, 500)
      return Response.json(ID.test(id) ? await db.blobs(user.id, id, hashes) : [])
    }
    // The page tree: how many pages sit below this deck, and moving it (a PUT, as the function exports only GET, PUT and DELETE).
    if (request.method === 'GET' && id && q.get('subpages') !== null)
      return ID.test(id) ? subpages(db, user.id, { kind: 'deck', id }, NO_DECK) : NO_DECK()
    if (request.method === 'PUT' && id && q.get('move') !== null)
      return ID.test(id) ? movePage(db, user.id, { kind: 'deck', id }, request, NO_DECK) : NO_DECK()
    if (request.method === 'PUT' && id && q.get('presence')) {
      const b = (await request.json().catch(() => ({}))) as { busy?: unknown; editing?: unknown }, now = Date.now(), p: Presence = {}
      if (b.busy === true) p.busy = { by: 'Occam', until: now + 90_000 }
      if (typeof b.editing === 'string') p.editing = { slideId: b.editing, until: now + 60_000 }
      if (!ID.test(id)) return NO_DECK()
      return await db.setPresence(user.id, id, p) ? Response.json({ ok: true }) : refusedDeck(db, user.id, id)
    }

    // ?workspace= lists that workspace's decks; without it, every deck the user can open.
    if (request.method === 'GET' && !id) {
      const ws = q.get('workspace')
      return Response.json(ws && !ID.test(ws) ? [] : await db.listDecks(user.id, ws ?? undefined))
    }
    if (request.method === 'GET') {
      const d = ID.test(id ?? '') ? await db.getDeck(user.id, id ?? '') : null
      return d ? Response.json(d) : Response.json({ error: 'No such deck.' }, { status: 404 })
    }
    if (request.method === 'DELETE') {
      if (!id || !ID.test(id)) return NO_DECK()
      return await db.deleteDeck(user.id, id) ? new Response(null, { status: 204 }) : refusedDeck(db, user.id, id)
    }
    if (request.method === 'PUT') {
      const text = await request.text()
      if (text.length > MAX_BYTES) return Response.json({ error: 'This deck is too large to save.' }, { status: 413 })
      let body: { id?: unknown; name?: unknown; named?: unknown; data?: unknown; chat?: unknown; baseRev?: unknown; version?: unknown; workspaceId?: unknown; parent?: unknown }
      try { body = JSON.parse(text) as typeof body } catch { return Response.json({ error: 'Bad deck.' }, { status: 400 }) }
      const { id: deckId, name, named, data, chat, baseRev, workspaceId } = body, parent = parentOf(body.parent)
      if (typeof deckId !== 'string' || !ID.test(deckId) || typeof name !== 'string' || !data || typeof data !== 'object'
        || !chat || typeof chat !== 'object' || typeof baseRev !== 'number' || !Number.isInteger(baseRev) || baseRev < 0
        || (workspaceId !== undefined && (typeof workspaceId !== 'string' || !ID.test(workspaceId))) || parent === 'bad')
        return Response.json({ error: 'Bad deck.' }, { status: 400 })
      // named: the maker renamed the deck; from then on its name stays put (as when an agent names it).
      // workspaceId places a new deck; a save never moves one.
      const stored = (() => { const { theme: _t, accent: _a, ...rest } = data as { theme?: unknown; accent?: unknown }; return rest })()
      const put = await db.putDeck(user.id, deckId, name.slice(0, 200), stored, chat, baseRev, { named: named === true, workspaceId, parent })
      if (typeof put === 'object' && 'refused' in put) return Response.json({ error: put.refused }, { status: 409 })
      if (put === 'conflict') return Response.json({ error: 'This deck changed somewhere else.' }, { status: 409 })
      // 'foreign': a viewer's save, a new deck where the writer may only view, or someone else's id (answered as if it did not exist).
      if (put === 'foreign') {
        if (await db.deckRole(user.id, deckId) === null && workspaceId && await viewerIn(db, user.id, workspaceId))
          return Response.json({ error: 'You can view this workspace, not add to it.' }, { status: 403 })
        return refusedDeck(db, user.id, deckId)
      }
      await recordVersion(db, user.id, deckId, stored, appMeta(body.version), put.rev)
      return Response.json({ ok: true, rev: put.rev })
    }
    return Response.json({ error: 'method not allowed' }, { status: 405 })
  }
}
