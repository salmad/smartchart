// The tools over REST for scripts and agent skills. Auth: Authorization: Bearer <agent key>.
import { userFrom } from './_lib/auth.js'
import { getDb } from './_lib/db.js'
import { restHandler } from './_lib/rest.js'

export const config = { maxDuration: 60 }
const handle = restHandler({ userFrom, db: getDb })
export const POST = handle, GET = handle
