// Agent keys: one per user, shown once, stored as a SHA-256 hash. A key acts only for its own user.
import { createHash } from 'node:crypto'
import type { User, UserFrom } from './auth.js'
import type { Db } from './db.js'

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

/** GET: the key's prefix (or null). POST: a new key, replacing the old one; the only time it is shown. DELETE: no key. */
export function keysHandler(deps: { userFrom: UserFrom; db: () => Db | null }) {
  return async (request: Request): Promise<Response> => {
    const db = deps.db()
    if (!db) return Response.json({ error: 'Agent keys are not set up on this server.' }, { status: 503 })
    const user = await deps.userFrom(request)
    if (!user) return Response.json({ error: 'Sign in to connect an agent.' }, { status: 401 })
    if (user.via === 'key') return Response.json({ error: 'Keys are managed in the app.' }, { status: 403 })
    if (request.method === 'GET') return Response.json({ prefix: await db.keyPrefix(user.id) })
    if (request.method === 'POST') { const k = mintKey(); await db.putKey(user.id, user.email, k.hash, k.prefix); return Response.json({ key: k.key, prefix: k.prefix }) }
    if (request.method === 'DELETE') { await db.deleteKey(user.id); return new Response(null, { status: 204 }) }
    return Response.json({ error: 'method not allowed' }, { status: 405 })
  }
}
