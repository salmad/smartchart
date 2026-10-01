// Agent keys for the signed-in user: read the prefix, make a new one, remove it.
import { userFrom } from './_lib/auth.js'
import { getDb } from './_lib/db.js'
import { keysHandler } from './_lib/keys.js'

const handle = keysHandler({ userFrom, db: getDb })
export const GET = handle, POST = handle, DELETE = handle
