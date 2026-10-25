// The page tree over HTTP: the workspace's pages in one list, and what decks and docs share to move a page and count its subpages.
// Built from its dependencies so tests can run it against a fake database and user.
import type { UserFrom } from './auth.js'
import type { Db } from './db.js'
import { NO_EDIT, type PageRef, type Slot } from '../../src/engine/pages/tree.js'

const ID = /^[\w-]{1,64}$/
const err = (status: number, error: string) => Response.json({ error }, { status })

/** A page named in a request body, or undefined when it is not one. */
export function pageRef(v: unknown): PageRef | undefined {
  const o = (v && typeof v === 'object' ? v : {}) as { kind?: unknown; id?: unknown }
  return (o.kind === 'deck' || o.kind === 'doc') && typeof o.id === 'string' && ID.test(o.id) ? { kind: o.kind, id: o.id } : undefined
}

/** The `parent` of a new page: absent or null for the top, a page, or 'bad' when it is something else. */
export function parentOf(v: unknown): PageRef | undefined | 'bad' {
  if (v === undefined || v === null) return undefined
  return pageRef(v) ?? 'bad'
}

/** A move request's body: where the page goes, or null when it is not one. */
export function moveBody(v: unknown): ({ parent: PageRef | null; workspaceId?: string } & Slot) | null {
  const o = (v && typeof v === 'object' ? v : null) as { parent?: unknown; before?: unknown; after?: unknown; workspaceId?: unknown } | null
  if (!o || !('parent' in o)) return null
  const parent = o.parent === null ? null : pageRef(o.parent)
  if (parent === undefined) return null
  const before = o.before === undefined ? undefined : pageRef(o.before), after = o.after === undefined ? undefined : pageRef(o.after)
  if ((o.before !== undefined && !before) || (o.after !== undefined && !after) || (before && after)) return null
  const workspaceId = typeof o.workspaceId === 'string' && ID.test(o.workspaceId) ? o.workspaceId : undefined
  return { parent, ...(workspaceId ? { workspaceId } : {}), ...(before ? { before } : {}), ...(after ? { after } : {}) }
}

/** The answer to a move: a page the user can't read reads as missing, a viewer is told so, any other sentence is a refused move. */
export async function movePage(db: Db, userId: string, page: PageRef, request: Request, missing: () => Response): Promise<Response> {
  const to = moveBody(await request.json().catch(() => null))
  if (!to) return err(400, 'Bad move.')
  const r = await db.movePage(userId, page, to)
  if (r === 'ok') return Response.json({ ok: true })
  if (r === 'foreign') return missing()
  return err(r === NO_EDIT ? 403 : 409, r)
}

/** How many pages sit below this one, for the delete dialog. */
export async function subpages(db: Db, userId: string, page: PageRef, missing: () => Response): Promise<Response> {
  const count = await db.countSubpages(userId, page)
  return count === null ? missing() : Response.json({ count }, { headers: { 'Cache-Control': 'no-store' } })
}

/** GET /api/pages?workspace=<id>: every deck and doc of the workspace the user can read, with parents and keys. */
export function pagesHandler(deps: { userFrom: UserFrom; db: () => Db | null }) {
  return async (request: Request): Promise<Response> => {
    const db = deps.db()
    if (!db) return err(503, 'Saving is not set up on this server.')
    const user = await deps.userFrom(request)
    if (!user) return err(401, 'Sign in to see your pages.')
    if (request.method !== 'GET') return err(405, 'method not allowed')
    await db.ensureWorkspace(user)
    const ws = new URL(request.url).searchParams.get('workspace')
    if (!ws || !ID.test(ws)) return err(400, 'Say which workspace.')
    return Response.json(await db.listPages(user.id, ws), { headers: { 'Cache-Control': 'no-store' } })
  }
}
