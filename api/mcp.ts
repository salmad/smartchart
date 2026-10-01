// MCP endpoint (/mcp/v1 rewrites here). Connect: claude mcp add --transport http smartchart https://<host>/mcp/v1 --header "Authorization: Bearer <key>"
import { userFrom } from './_lib/auth.js'
import { getDb } from './_lib/db.js'
import { mcpHandler } from './_lib/mcp.js'

export const config = { maxDuration: 300 }
const handle = mcpHandler({ userFrom, db: getDb })
export const POST = handle, GET = handle, DELETE = handle
