// Your decks: list, open, save and delete. Every query is scoped to the signed-in user.
import { userFrom } from './_lib/auth.js'
import { getDb } from './_lib/db.js'
import { decksHandler } from './_lib/decks.js'

const handle = decksHandler({ userFrom, db: getDb })
export const GET = handle, PUT = handle, DELETE = handle
