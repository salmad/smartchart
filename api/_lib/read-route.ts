// Links in the chat: the maker pastes a link to a report, a PDF or an article, and the server fetches it (public https
// only, never a private address; images.ts fetchPublicFull) and hands the bytes back. The browser reads them with the
// same readers as a dropped file, so a link is just another attachment.
import type { UserFrom } from './auth.js'
import type { Db } from './db.js'
import { fetchPublicFull, ImageError, type Lookup } from './images.js'

export const DAILY_READS = 200

export function readHandler(deps: { userFrom: UserFrom; db: () => Db | null; fetch?: typeof fetch; lookup?: Lookup; now?: () => number }) {
  return async (request: Request): Promise<Response> => {
    if (request.method !== 'POST') return new Response(null, { status: 405, headers: { Allow: 'POST' } })
    const user = await deps.userFrom(request)
    if (!user) return Response.json({ error: 'Sign in to read links.' }, { status: 401 })
    const db = deps.db()
    if (!db) return Response.json({ error: 'Reading links is not set up on this server.' }, { status: 503 })
    const body = (await request.json().catch(() => null)) as { url?: unknown } | null
    if (typeof body?.url !== 'string' || !body.url.trim()) return Response.json({ error: 'url: required.' }, { status: 400 })
    const now = deps.now ?? Date.now
    if (await db.bumpRate(`read:${user.id}`, Math.floor(now() / 86_400_000)) > DAILY_READS) return Response.json({ error: `At most ${DAILY_READS} links a day.` }, { status: 429 })
    try {
      const got = await fetchPublicFull(body.url.trim(), { fetch: deps.fetch, lookup: deps.lookup, noun: 'page' })
      return new Response(got.bytes, { headers: { 'content-type': got.type || 'application/octet-stream', 'x-final-url': got.url, 'cache-control': 'no-store' } })
    } catch (e) {
      if (e instanceof ImageError) return Response.json({ error: `${e.message.replace(/^url: /, '')} ${e.fix}` }, { status: 422 })
      throw e
    }
  }
}
