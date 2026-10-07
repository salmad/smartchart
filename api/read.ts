// Links in the chat, fetched for the browser to read (signed-in makers only).
import { userFrom } from './_lib/auth.js'
import { getDb } from './_lib/db.js'
import { readHandler } from './_lib/read-route.js'

export const config = { maxDuration: 30 }
export const POST = readHandler({ userFrom, db: getDb })
