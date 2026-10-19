// The workspaces API: my workspaces, members and roles, and invite links. Built from its dependencies so tests run it
// against a fake database and user. A forbidden call is 403 for a member and 404 for anyone else, so a non-member
// can't learn that a workspace exists.
import { can, isRole, type Action, type Role } from './access.js'
import type { User, UserFrom } from './auth.js'
import { shareToken, type Db } from './db.js'

const ID = /^[\w-]{1,64}$/
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const INVITE_DAYS = 7

const err = (status: number, error: string) => Response.json({ error }, { status })
const NO_WORKSPACE = () => err(404, 'No such workspace.')
const KEY_REFUSED = () => err(403, 'Agent keys work on decks, not on who is in a workspace. Do this in Occam.')
const LAST_OWNER = () => err(409, 'A workspace needs an owner. Make someone else owner first.')
const body = async (r: Request) => (await r.json().catch(() => ({}))) as Record<string, unknown>
const name = (v: unknown) => (typeof v === 'string' ? v.trim().slice(0, 80) : '')

export function workspacesHandler(deps: { userFrom: UserFrom; db: () => Db | null }) {
  return async (request: Request): Promise<Response> => {
    const db = deps.db()
    if (!db) return err(503, 'Workspaces are not set up on this server.')
    const user = await deps.userFrom(request)
    if (!user) return err(401, 'Sign in to see your workspaces.')
    await db.ensureWorkspace(user)
    const q = new URL(request.url).searchParams, id = q.get('id'), m = request.method

    if (q.get('accept') !== null) return m === 'POST' ? accept(db, user, q.get('accept') ?? '') : err(405, 'method not allowed')
    if (!id) {
      if (m === 'GET') return Response.json(await db.listWorkspaces(user.id))
      if (m !== 'POST') return err(405, 'method not allowed')
      if (user.via === 'key') return KEY_REFUSED()
      const n = name((await body(request)).name)
      return n ? Response.json({ id: await db.createWorkspace(user.id, n) }) : err(400, 'Give the workspace a name.')
    }
    if (!ID.test(id)) return NO_WORKSPACE()
    const role = (await db.listWorkspaces(user.id)).find((w) => w.id === id)?.role ?? null
    /** Null when the user may; else the refusal: 404 to a non-member, 403 to a member. */
    const refuse = (action: Action) => (can(role, action) ? null : role ? err(403, 'Only an owner of this workspace can do that.') : NO_WORKSPACE())
    const manages = q.has('members') || q.has('member') || q.has('invite')
    if (manages && user.via === 'key') return role ? KEY_REFUSED() : NO_WORKSPACE()

    if (m === 'GET' && q.has('members')) {
      const members = await db.listMembers(user.id, id)
      if (!members) return NO_WORKSPACE()
      return Response.json({ members, invites: can(role, 'manage') ? await db.listInvites(user.id, id) ?? [] : [] })
    }
    if (m === 'PUT' && q.has('member')) {
      const b = await body(request), next = b.role === null ? null : isRole(b.role) ? b.role : undefined
      if (next === undefined) return err(400, 'A role is owner, editor or viewer.')
      const r = await db.setRole(user.id, id, q.get('member') ?? '', next)
      return r === 'ok' ? Response.json({ ok: true }) : r === 'last_owner' ? LAST_OWNER()
        : role ? err(403, next === null && q.get('member') === user.id ? 'You can’t leave your own workspace.' : 'Only an owner of this workspace can do that.') : NO_WORKSPACE()
    }
    if (m === 'POST' && q.has('invite')) {
      const no = refuse('manage')
      if (no) return no
      const b = await body(request), email = typeof b.email === 'string' ? b.email.trim().toLowerCase() : ''
      if (!EMAIL.test(email) || !isRole(b.role)) return err(400, 'An invite needs an email and a role.')
      const token = shareToken()
      const made = await db.addInvite(user.id, id, email, b.role as Role, token, Date.now() + INVITE_DAYS * 86_400_000)
      if (made === 'member') return err(409, `${email} is in this workspace already. Change their role in the list.`)
      if (made === 'denied') return err(403, 'Only an owner of this workspace can do that.')
      return Response.json({ link: `${new URL(request.url).origin}/i/${token}` })
    }
    if (m === 'DELETE' && q.has('invite')) {
      const no = refuse('manage')
      if (no) return no
      return await db.revokeInvite(user.id, id, q.get('invite') ?? '') ? new Response(null, { status: 204 }) : err(404, 'No such invite.')
    }
    if (m === 'PUT') {
      const b = await body(request)
      if (b.used === true) {
        const no = refuse('read')
        if (no) return no
        await db.touchWorkspace(user.id, id)
        return Response.json({ ok: true })
      }
      if (user.via === 'key') return role ? KEY_REFUSED() : NO_WORKSPACE()
      const n = name(b.name)
      if (!n) return err(400, 'Give the workspace a name.')
      const no = refuse('manage')
      if (no) return no
      await db.renameWorkspace(user.id, id, n)
      return Response.json({ ok: true })
    }
    return err(405, 'method not allowed')
  }
}

async function accept(db: Db, user: User, token: string): Promise<Response> {
  if (user.via === 'key') return KEY_REFUSED()
  const r = ID.test(token) ? await db.acceptInvite(user, token, Date.now()) : 'gone'
  if (r === 'gone') return err(410, 'This invite expired or was taken back.')
  if ('wrongEmail' in r) return err(403, `This invite is for another email. Sign in as ${r.wrongEmail} to accept it.`)
  return Response.json(r)
}
