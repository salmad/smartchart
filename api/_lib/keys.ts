// Agent keys: up to five per user, each shown once, stored as a SHA-256 hash. A key acts only for its own user.
import { createHash } from 'node:crypto'
import type { User, UserFrom } from './auth.js'
import { keyId, MAX_KEYS, type Db } from './db.js'

export function hashKey(key: string): string { return createHash('sha256').update(key).digest('hex') }

export function mintKey(): { key: string; hash: string; prefix: string } {
  const b = crypto.getRandomValues(new Uint8Array(32))
  const key = `sc_${btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}`
  return { key, hash: hashKey(key), prefix: key.slice(0, 7) }
}

export async function bearerUser(request: Request, db: Db): Promise<User | null> {
  const m = /^Bearer (sc_[\w-]+)$/.exec(request.headers.get('authorization') ?? '')
  if (!m) return null
  const row = await db.keyUser(hashKey(m[1])).catch(() => null)
  return row ? { id: row.userId, email: row.email, via: 'key' } : null
}

/** GET: the user's keys (prefix, no secret). POST: a new key, shown only now; refused at five. DELETE ?id=: that key. */
export function keysHandler(deps: { userFrom: UserFrom; db: () => Db | null }) {
  return async (request: Request): Promise<Response> => {
    const db = deps.db()
    if (!db) return Response.json({ error: 'Agent keys are not set up on this server.' }, { status: 503 })
    const user = await deps.userFrom(request)
    if (!user) return Response.json({ error: 'Sign in to connect an agent.' }, { status: 401 })
    if (user.via === 'key') return Response.json({ error: 'Keys are managed in the app.' }, { status: 403 })
    if (request.method === 'GET') return Response.json({ keys: await db.listKeys(user.id), max: MAX_KEYS })
    if (request.method === 'POST') {
      const k = mintKey()
      if (!(await db.addKey(user.id, user.email, k.hash, k.prefix))) return Response.json({ error: `You can have ${MAX_KEYS} keys. Remove one to make another.` }, { status: 409 })
      return Response.json({ key: k.key, id: keyId(k.hash), prefix: k.prefix })
    }
    if (request.method === 'DELETE') {
      const id = new URL(request.url).searchParams.get('id')
      if (!id || !(await db.deleteKey(user.id, id))) return Response.json({ error: 'No such key.' }, { status: 404 })
      return new Response(null, { status: 204 })
    }
    return Response.json({ error: 'method not allowed' }, { status: 405 })
  }
}
