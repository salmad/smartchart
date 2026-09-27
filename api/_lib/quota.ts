// Model spend: a signed-in user may call the models; a visitor gets a small daily allowance per network,
// enough for the first slide (one turn is 2–8 model calls). The IP is kept only as a salted hash.
import { createHash } from 'node:crypto'
import type { UserFrom } from './auth'
import type { Db } from './db'

export const ANON_CALLS_PER_DAY = 20
export const QUOTA_MESSAGE = "That's the free slide for today. Sign in to keep going."

export function clientKey(request: Request, salt: string): string {
  const ip = (request.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || request.headers.get('x-real-ip') || 'unknown'
  return createHash('sha256').update(`${salt}:${ip}`).digest('hex').slice(0, 32)
}

/** Null when the call may go ahead; otherwise the 429 to send. Without a database (local dev) nothing is limited. */
export async function modelGate(request: Request, deps: { userFrom: UserFrom; db: Db | null; salt: string }): Promise<Response | null> {
  if (!deps.db) return null
  if (await deps.userFrom(request)) return null
  const calls = await deps.db.bumpUsage(clientKey(request, deps.salt))
  return calls > ANON_CALLS_PER_DAY ? Response.json({ error: QUOTA_MESSAGE, code: 'quota' }, { status: 429 }) : null
}
