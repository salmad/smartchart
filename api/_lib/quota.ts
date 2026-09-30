// Model spend: only a signed-in user may call the models, up to a daily limit. Without a database (local dev)
// sign-in is not set up and nothing is gated.
import type { UserFrom } from './auth.js'
import type { Db } from './db.js'

export const SIGN_IN_MESSAGE = 'Sign in to make slides.'
/** Model calls a user may make per UTC day. A turn is roughly 10-40 (agent steps, Jev decisions, checks, suggestions). */
export const DAILY_CALLS = Number(process.env.MODEL_CALLS_PER_DAY) || 2000

/** Null when the call may go ahead; otherwise the 401 (signed out) or 429 (over today's limit) to send. */
export async function modelGate(request: Request, deps: { userFrom: UserFrom; db: Db | null }, limit = DAILY_CALLS): Promise<Response | null> {
  if (!deps.db) return null
  const user = await deps.userFrom(request)
  if (!user) return Response.json({ error: SIGN_IN_MESSAGE, code: 'signin' }, { status: 401 })
  // A failing counter never blocks the models: sign-in alone was the gate until now.
  const used = await deps.db.countCall(user.id).catch(() => 0)
  return used > limit
    ? Response.json({ error: 'You’ve used today’s model calls. They reset at midnight UTC.', code: 'limit' }, { status: 429 })
    : null
}
