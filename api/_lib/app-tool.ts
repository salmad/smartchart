// In-app agent: run one registry tool with the signed-in user's session (not an agent key).
import type { JevFn } from '../../src/engine/agent/llm.js'
import type { ErrorCode } from '../../src/engine/tools/types.js'
import type { UserFrom } from './auth.js'
import type { Db } from './db.js'
import { runTool } from './deck-service.js'

const STATUS: Record<ErrorCode, number> = { unauthorized: 401, bad_input: 400, refused: 403, not_found: 404, conflict: 409, busy: 409, rate: 429, quota: 429, upstream: 502 }

export function appToolHandler(deps: { userFrom: UserFrom; db: () => Db | null; jev?: JevFn }) {
  return async (request: Request): Promise<Response> => {
    if (request.method !== 'POST') return Response.json({ error: 'Use POST.' }, { status: 405 })
    const db = deps.db()
    if (!db) return Response.json({ error: 'Not set up on this server.' }, { status: 503 })
    const user = await deps.userFrom(request)
    if (!user) return Response.json({ error: 'Sign in to use the agent.' }, { status: 401 })
    if (user.via === 'key') return Response.json({ error: 'Use the app, not a key.' }, { status: 403 })
    const body = (await request.json().catch(() => null)) as { name?: unknown; input?: unknown } | null
    const name = typeof body?.name === 'string' ? body.name : ''
    const input = body?.input ?? {}
    const reply = await runTool(name, input, { user: { id: user.id, email: user.email, name: user.name ?? '' }, client: 'Occam', key: user.id }, { db, origin: new URL(request.url).origin, jev: deps.jev })
    return reply.ok ? Response.json(reply.result) : Response.json({ error: reply.error }, { status: STATUS[reply.error.code] })
  }
}
