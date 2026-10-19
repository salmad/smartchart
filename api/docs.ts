// Docs in a workspace: list, open, save and delete. Every query checks the user's role in the doc's workspace.
import { userFrom } from './_lib/auth.js'
import { getDb } from './_lib/db.js'
import { docsHandler } from './_lib/docs.js'

const handle = docsHandler({ userFrom, db: getDb })
export const GET = handle, PUT = handle, DELETE = handle
