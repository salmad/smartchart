// Share links, built from their dependencies so tests can run them against a fake database and user.
// The owner turns a deck's link on and off (?id=); anyone with the link reads the deck (?s=), and only its slides and look.
import type { UserFrom } from './auth.js'
import type { Db } from './db.js'

const ID = /^[\w-]{1,64}$/

/** What the room sees: the deck's name, look and slides. Never the chat, the agent's history or who made it. */
export interface SharedDeck { name: string; style: unknown; theme: unknown; accent: unknown; slides: unknown[] }

export function publicDeck(name: string, data: unknown): SharedDeck {
  const d = (data && typeof data === 'object' ? data : {}) as { style?: unknown; theme?: unknown; accent?: unknown; items?: unknown }
  const items = Array.isArray(d.items) ? d.items as { slide?: unknown }[] : []
  return { name, style: d.style ?? null, theme: d.theme ?? null, accent: d.accent ?? null, slides: items.map((i) => i?.slide).filter(Boolean) }
}

export function shareHandler(deps: { userFrom: UserFrom; db: () => Db | null }) {
  return async (request: Request): Promise<Response> => {
    const db = deps.db()
    if (!db) return Response.json({ error: 'Sharing is not set up on this server.' }, { status: 503 })
    const q = new URL(request.url).searchParams, token = q.get('s'), id = q.get('id')

    if (token !== null) {
      if (request.method !== 'GET') return Response.json({ error: 'method not allowed' }, { status: 405 })
      const d = ID.test(token) ? await db.sharedDeck(token) : null
      // The link always shows the latest version, so nothing is cached along the way.
      return d ? Response.json(publicDeck(d.name, d.data), { headers: { 'Cache-Control': 'no-store' } })
        : Response.json({ error: 'This link was turned off, or never existed.' }, { status: 404 })
    }

    const user = await deps.userFrom(request)
    if (!user) return Response.json({ error: 'Sign in to share your decks.' }, { status: 401 })
    if (!id || !ID.test(id)) return Response.json({ error: 'No such deck.' }, { status: 404 })
    const on = request.method === 'POST' ? true : request.method === 'DELETE' ? false : request.method === 'GET' ? undefined : null
    if (on === null) return Response.json({ error: 'method not allowed' }, { status: 405 })
    const share = await db.shareDeck(user.id, id, on)
    return share === undefined ? Response.json({ error: 'No such deck.' }, { status: 404 }) : Response.json({ share })
  }
}
