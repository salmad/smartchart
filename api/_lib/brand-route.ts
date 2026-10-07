// The Look panel's "from your website": a domain in, the brand colour out (brand.ts). Signed-in makers only.
import type { UserFrom } from './auth.js'
import type { Db } from './db.js'
import { brandColours } from './brand.js'
import { ImageError, type Lookup } from './images.js'

export function brandHandler(deps: { userFrom: UserFrom; db: () => Db | null; fetch?: typeof fetch; lookup?: Lookup; now?: () => number }) {
  return async (request: Request): Promise<Response> => {
    if (request.method !== 'POST') return new Response(null, { status: 405, headers: { Allow: 'POST' } })
    const user = await deps.userFrom(request)
    if (!user) return Response.json({ error: 'Sign in to take a colour from a website.' }, { status: 401 })
    const db = deps.db()
    if (!db) return Response.json({ error: 'Not set up on this server.' }, { status: 503 })
    const body = (await request.json().catch(() => null)) as { domain?: unknown } | null
    if (typeof body?.domain !== 'string' || !body.domain.trim()) return Response.json({ error: 'Type the website, e.g. stripe.com.' }, { status: 400 })
    if (await db.bumpRate(`brand:${user.id}`, Math.floor((deps.now ?? Date.now)() / 60_000)) > 10) return Response.json({ error: 'Too many in a minute; wait a moment.' }, { status: 429 })
    try { return Response.json({ colours: await brandColours(body.domain.trim(), deps) }) }
    catch (e) { if (e instanceof ImageError) return Response.json({ error: `${e.message} ${e.fix}` }, { status: 422 }); throw e }
  }
}
