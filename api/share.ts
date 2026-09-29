// Share links: the owner turns a deck's link on and off; anyone with the link can read the deck.
import { userFrom } from './_lib/auth'
import { getDb } from './_lib/db'
import { shareHandler } from './_lib/share'

const handle = shareHandler({ userFrom, db: getDb })
export const GET = handle, POST = handle, DELETE = handle
