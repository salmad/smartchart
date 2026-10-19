// The signed-in user's small routes behind one function, as Vercel's Hobby plan allows 12: /api/keys, /api/share, /api/docs and
// /api/workspaces. vercel.json rewrites each to this file with ?route=<name>; the path's last segment serves where there is no rewrite.
import { userFrom } from './_lib/auth.js'
import { getDb } from './_lib/db.js'
import { docsHandler } from './_lib/docs.js'
import { keysHandler } from './_lib/keys.js'
import { shareHandler } from './_lib/share.js'
import { workspacesHandler } from './_lib/workspaces.js'

const deps = { userFrom, db: getDb }
const routes: Record<string, (request: Request) => Promise<Response> | Response> = {
  keys: keysHandler(deps), share: shareHandler(deps), docs: docsHandler(deps), workspaces: workspacesHandler(deps),
}

const handle = (request: Request) => {
  const url = new URL(request.url), name = url.searchParams.get('route') ?? url.pathname.split('/').filter(Boolean).at(-1) ?? ''
  const route = Object.hasOwn(routes, name) ? routes[name] : undefined
  return route ? route(request) : Response.json({ error: 'not found' }, { status: 404 })
}
export const GET = handle, POST = handle, PUT = handle, DELETE = handle
