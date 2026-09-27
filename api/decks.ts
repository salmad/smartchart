// Your decks: list, open, save and delete. Every query is scoped to the signed-in user.
import { userFrom } from './_lib/auth'
import { getDb } from './_lib/db'
import { decksHandler } from './_lib/decks'

const handle = decksHandler({ userFrom, db: getDb })
export const GET = handle, PUT = handle, DELETE = handle
