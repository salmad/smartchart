// Accounts: Neon Auth (managed Better Auth), reached through /api/auth on our own origin so its cookies
// are first-party. The functions here read the signed-in user from those cookies.
import { handleAuthProxyRequest } from '@neondatabase/auth/server'
import { getDb } from './db.js'
import { bearerUser } from './keys.js'

/** `via` is how they signed in: a browser session, or an agent key (which can act on decks but not manage keys). */
export interface User { id: string; email: string; via: 'session' | 'key' }

/** Null when accounts are not configured (no Neon Auth URL or cookie secret). */
export function authConfig(): { baseUrl: string; cookieSecret: string; sameSite: 'lax' } | null {
  const baseUrl = process.env.NEON_AUTH_URL, cookieSecret = process.env.NEON_AUTH_COOKIE_SECRET
  return baseUrl && cookieSecret && cookieSecret.length >= 32 ? { baseUrl, cookieSecret, sameSite: 'lax' } : null
}

/** Forwards one /api/auth/* request to Neon Auth and passes its cookies back. */
export async function proxyAuth(request: Request): Promise<Response> {
  const cfg = authConfig()
  if (!cfg) return Response.json({ error: 'Accounts are not set up on this server.' }, { status: 503 })
  const path = new URL(request.url).pathname.replace(/^\/api\/auth\/?/, '')
  return handleAuthProxyRequest({ ...cfg, request, path })
}

export type UserFrom = (request: Request) => Promise<User | null>

/** The signed-in user: an agent key (Bearer) first, then the session cookies; null when neither holds. */
export const userFrom: UserFrom = async (request) => {
  if (request.headers.get('authorization')?.startsWith('Bearer ')) {
    const db = getDb()
    return db ? bearerUser(request, db) : null
  }
  const cfg = authConfig(), cookie = request.headers.get('cookie')
  if (!cfg || !cookie) return null
  const headers = new Headers({ cookie })
  const origin = request.headers.get('origin') ?? new URL(request.url).origin
  headers.set('origin', origin)
  const r = await handleAuthProxyRequest({ ...cfg, path: 'get-session', request: new Request(new URL('/api/auth/get-session', request.url), { headers }) })
  if (!r.ok) return null
  return sessionUser(await r.json().catch(() => null))
}

/** Better Auth's get-session body is `{ user, session }`, or null when signed out. */
export function sessionUser(body: unknown): User | null {
  if (!body || typeof body !== 'object' || !('user' in body)) return null
  const u = (body as { user: unknown }).user
  if (!u || typeof u !== 'object') return null
  const { id, email } = u as { id?: unknown; email?: unknown }
  return typeof id === 'string' && id ? { id, email: typeof email === 'string' ? email : '', via: 'session' } : null
}
