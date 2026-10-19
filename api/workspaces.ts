// Your workspaces: list and create them, rename, members and roles, invite links and accepting them.
import { userFrom } from './_lib/auth.js'
import { getDb } from './_lib/db.js'
import { workspacesHandler } from './_lib/workspaces.js'

const handle = workspacesHandler({ userFrom, db: getDb })
export const GET = handle, POST = handle, PUT = handle, DELETE = handle
