// A company's brand colour from its website, for the deck's accent.
import { userFrom } from './_lib/auth.js'
import { getDb } from './_lib/db.js'
import { brandHandler } from './_lib/brand-route.js'

export const config = { maxDuration: 30 }
export const POST = brandHandler({ userFrom, db: getDb })
