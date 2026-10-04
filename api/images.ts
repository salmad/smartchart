// Pictures from the app (chat and edit mode): bytes in, prepared and stored pictures out. Signed-in makers only.
import { userFrom } from './_lib/auth.js'
import { getDb } from './_lib/db.js'
import { imagesHandler } from './_lib/images-route.js'

export const config = { maxDuration: 30 }
export const POST = imagesHandler({ userFrom, db: getDb })
