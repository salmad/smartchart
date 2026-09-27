// The decks API, built from its dependencies so tests can run it against a fake database and user.
import type { UserFrom } from './auth'
import type { Db } from './db'

const ID = /^[\w-]{1,64}$/
const MAX_BYTES = 2_000_000

export function decksHandler(deps: { userFrom: UserFrom; db: () => Db | null }) {
  return async (request: Request): Promise<Response> => {
    const db = deps.db()
    if (!db) return Response.json({ error: 'Saving is not set up on this server.' }, { status: 503 })
    const user = await deps.userFrom(request)
    if (!user) return Response.json({ error: 'Sign in to see your decks.' }, { status: 401 })
    const id = new URL(request.url).searchParams.get('id')

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
      let body: { id?: unknown; name?: unknown; data?: unknown }
      try { body = JSON.parse(text) as typeof body } catch { return Response.json({ error: 'Bad deck.' }, { status: 400 }) }
      if (typeof body.id !== 'string' || !ID.test(body.id) || typeof body.name !== 'string' || !body.data || typeof body.data !== 'object')
        return Response.json({ error: 'Bad deck.' }, { status: 400 })
      // A false put means the id is someone else's deck: answer as if it did not exist.
      return await db.putDeck(user.id, body.id, body.name.slice(0, 200), body.data)
        ? Response.json({ ok: true }) : Response.json({ error: 'No such deck.' }, { status: 404 })
    }
    return Response.json({ error: 'method not allowed' }, { status: 405 })
  }
}
