// Share links: the owner turns a deck's link on and off; anyone with the link can read the deck.
import { userFrom } from './_lib/auth.js'
import { getDb } from './_lib/db.js'
import { shareHandler } from './_lib/share.js'

const handle = shareHandler({ userFrom, db: getDb })
export const GET = handle, POST = handle, DELETE = handle
