// The decks API, built from its dependencies so tests can run it against a fake database and user.
import type { UserFrom } from './auth.js'
import type { Db, Presence } from './db.js'

const ID = /^[\w-]{1,64}$/
const MAX_BYTES = 2_000_000

export function decksHandler(deps: { userFrom: UserFrom; db: () => Db | null }) {
  return async (request: Request): Promise<Response> => {
    const db = deps.db()
    if (!db) return Response.json({ error: 'Saving is not set up on this server.' }, { status: 503 })
    const user = await deps.userFrom(request)
    if (!user) return Response.json({ error: 'Sign in to see your decks.' }, { status: 401 })
    const q = new URL(request.url).searchParams, id = q.get('id')

    // Live view: the app asks for the revision (and who is working) every few seconds, and for what changed since.
    if (request.method === 'GET' && id && q.get('rev')) {
      const m = ID.test(id) ? await db.getDeckMeta(user.id, id) : null
      return m ? Response.json({ rev: m.rev, presence: m.presence }, { headers: { 'Cache-Control': 'no-store' } }) : Response.json({ error: 'No such deck.' }, { status: 404 })
    }
    if (request.method === 'GET' && id && q.get('events') !== null)
      return Response.json(ID.test(id) ? await db.eventsSince(user.id, id, Number(q.get('events')) || 0) : [], { headers: { 'Cache-Control': 'no-store' } })
    if (request.method === 'PUT' && id && q.get('presence')) {
      const b = (await request.json().catch(() => ({}))) as { busy?: unknown; editing?: unknown }, now = Date.now(), p: Presence = {}
      if (b.busy === true) p.busy = { by: 'SmartChart', until: now + 90_000 }
      if (typeof b.editing === 'string') p.editing = { slideId: b.editing, until: now + 60_000 }
      return (ID.test(id) && await db.setPresence(user.id, id, p)) ? Response.json({ ok: true }) : Response.json({ error: 'No such deck.' }, { status: 404 })
    }

    if (request.method === 'GET' && !id) return Response.json(await db.listDecks(user.id))
    if (request.method === 'GET') {
      const d = ID.test(id ?? '') ? await db.getDeck(user.id, id ?? '') : null
      return d ? Response.json(d) : Response.json({ error: 'No such deck.' }, { status: 404 })
    }
    if (request.method === 'DELETE') {
      return id && ID.test(id) && await db.deleteDeck(user.id, id) ? new Response(null, { status: 204 }) : Response.json({ error: 'No such deck.' }, { status: 404 })
    }
    if (request.method === 'PUT') {
      const text = await request.text()
      if (text.length > MAX_BYTES) return Response.json({ error: 'This deck is too large to save.' }, { status: 413 })
      let body: { id?: unknown; name?: unknown; data?: unknown; chat?: unknown; baseRev?: unknown }
      try { body = JSON.parse(text) as typeof body } catch { return Response.json({ error: 'Bad deck.' }, { status: 400 }) }
      const { id: deckId, name, data, chat, baseRev } = body
      if (typeof deckId !== 'string' || !ID.test(deckId) || typeof name !== 'string' || !data || typeof data !== 'object'
        || !chat || typeof chat !== 'object' || typeof baseRev !== 'number' || !Number.isInteger(baseRev) || baseRev < 0)
        return Response.json({ error: 'Bad deck.' }, { status: 400 })
      const put = await db.putDeck(user.id, deckId, name.slice(0, 200), data, chat, baseRev)
      if (put === 'conflict') return Response.json({ error: 'This deck changed somewhere else.' }, { status: 409 })
      // 'foreign': the id is someone else's deck; answer as if it did not exist.
      return put === 'foreign' ? Response.json({ error: 'No such deck.' }, { status: 404 }) : Response.json({ ok: true, rev: put.rev })
    }
    return Response.json({ error: 'method not allowed' }, { status: 405 })
  }
}
