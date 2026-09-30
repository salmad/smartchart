// Model spend: only a signed-in user may call the models. Without a database (local dev) sign-in is not set up
// and nothing is gated.
import type { UserFrom } from './auth.js'
import type { Db } from './db.js'

export const SIGN_IN_MESSAGE = 'Sign in to make slides.'

/** Null when the call may go ahead; otherwise the 401 to send. */
export async function modelGate(request: Request, deps: { userFrom: UserFrom; db: Db | null }): Promise<Response | null> {
  if (!deps.db) return null
  return (await deps.userFrom(request)) ? null : Response.json({ error: SIGN_IN_MESSAGE, code: 'signin' }, { status: 401 })
}
