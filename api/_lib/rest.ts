// REST: POST /api/v1/<tool> with the input as the JSON body; the same tools and results as MCP.
import type { JevFn } from '../../src/engine/agent/llm.js'
import type { ErrorCode } from '../../src/engine/tools/types.js'
import type { UserFrom } from './auth.js'
import type { Db } from './db.js'
import { runTool } from './deck-service.js'

const STATUS: Record<ErrorCode, number> = { unauthorized: 401, bad_input: 400, refused: 403, not_found: 404, conflict: 409, busy: 409, rate: 429, quota: 429, upstream: 502 }

export function restHandler(deps: { userFrom: UserFrom; db: () => Db | null; jev?: JevFn }) {
  return async (request: Request): Promise<Response> => {
    if (request.method !== 'POST') return Response.json({ error: { code: 'bad_input', message: 'Use POST.' } }, { status: 405 })
    const db = deps.db()
    if (!db) return Response.json({ error: { code: 'upstream', message: 'Not set up on this server.' } }, { status: 503 })
    const user = await deps.userFrom(request)
    if (!user) return Response.json({ error: { code: 'unauthorized', message: 'Send Authorization: Bearer <your SmartChart agent key>.' } }, { status: 401, headers: { 'WWW-Authenticate': 'Bearer' } })
    const url = new URL(request.url), name = url.searchParams.get('tool') ?? url.pathname.split('/').filter(Boolean).at(-1) ?? ''
    const input = await request.json().catch(() => null)
    const reply = await runTool(name, input ?? {}, { user, client: request.headers.get('x-client') ?? 'API', key: user.id }, { db, origin: url.origin, jev: deps.jev })
    return reply.ok ? Response.json(reply.result) : Response.json({ error: reply.error }, { status: STATUS[reply.error.code] })
  }
}
