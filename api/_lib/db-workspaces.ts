// Workspaces, members and invites in Postgres. The role a call needs comes from access.ts; owner checks sit in the
// writing query itself, so nothing is decided on a read that another request could change first.
import { can, isRole, rolesFor, ROLES, type Role } from './access.js'
import { shareToken, type Db, type DbUser, type InviteRow, type MemberRow, type Q, type WorkspaceRow } from './db.js'

type Calls = 'ensureWorkspace' | 'listWorkspaces' | 'createWorkspace' | 'renameWorkspace' | 'touchWorkspace' | 'listMembers'
  | 'setRole' | 'addInvite' | 'listInvites' | 'revokeInvite' | 'acceptInvite'

const newId = () => `ws_${shareToken().slice(0, 16)}`
/** The caller ($u) holds one of `roles` in workspace `ws`. */
const member = (ws: string, u: string, roles: string) => `exists (select 1 from members m where m.workspace_id = ${ws} and m.user_id = ${u} and m.role = any(${roles}::text[]))`
const MANAGE = rolesFor('manage')

export function workspaceCalls(q: Q): Pick<Db, Calls> {
  /** Once per user per cold start: after the first call it changes nothing. */
  const ensured = new Map<string, Promise<string>>()
  const ensure = async (u: DbUser): Promise<string> => {
    // Two first requests at once: the unique personal_of lets one insert win; both then read the same row.
    await q(`insert into workspaces (id, name, personal_of) values ($1, $2, $3) on conflict (personal_of) do nothing`,
      [newId(), `${u.name || u.email.split('@')[0]}’s workspace`, u.id])
    const ws = (await q<{ id: string }>('select id from workspaces where personal_of = $1', [u.id]))[0].id
    await q(`insert into members (workspace_id, user_id, email, name, role) values ($1, $2, $3, $4, 'owner') on conflict do nothing`, [ws, u.id, u.email.toLowerCase(), u.name])
    await q('update decks set workspace_id = $1 where user_id = $2 and workspace_id is null', [ws, u.id])
    return ws
  }
  const roleIn = async (ws: string, u: string): Promise<Role | null> =>
    (await q<{ role: string }>('select role from members where workspace_id = $1 and user_id = $2', [ws, u])).map((r) => r.role).find(isRole) ?? null
  return {
    ensureWorkspace: (u) => {
      const p = ensured.get(u.id) ?? ensure(u).catch((e: unknown) => { ensured.delete(u.id); throw e })
      ensured.set(u.id, p)
      return p
    },
    listWorkspaces: async (u) => (await q<Omit<WorkspaceRow, 'usedAt' | 'members'> & { usedAt: string | Date | null; members: string | number }>(
      `select w.id, w.name, m.role, coalesce(w.personal_of = $1, false) as personal, (select count(*) from members x where x.workspace_id = w.id) as members, m.used_at as "usedAt"
       from members m join workspaces w on w.id = m.workspace_id where m.user_id = $1 order by m.used_at desc nulls last, m.joined, w.id`, [u]))
      .map((r) => ({ ...r, members: Number(r.members), usedAt: r.usedAt === null ? null : new Date(r.usedAt).getTime() })),
    // The maker's email and name come from their other memberships (their personal workspace has them).
    createWorkspace: async (u, name) => {
      const id = newId()
      await q('insert into workspaces (id, name) values ($1, $2)', [id, name])
      await q(`insert into members (workspace_id, user_id, email, name, role)
        select $1, $2, coalesce((select email from members where user_id = $2 limit 1), ''), coalesce((select name from members where user_id = $2 limit 1), ''), 'owner'`, [id, u])
      return id
    },
    renameWorkspace: async (u, id, name) => (await q(`update workspaces set name = $3 where id = $2 and ${member('$2', '$1', '$4')} returning id`, [u, id, name, MANAGE])).length > 0,
    touchWorkspace: async (u, id) => { await q('update members set used_at = now() where workspace_id = $1 and user_id = $2', [id, u]) },
    // A member always sees at least themselves, so no rows means not a member.
    listMembers: async (u, id) => {
      const r = await q<MemberRow>(`select user_id as "userId", email, name, role from members where workspace_id = $2 and ${member('$2', '$1', '$3')}
        order by array_position($4::text[], role), joined, user_id`, [u, id, rolesFor('read'), ROLES])
      return r.length ? r : null
    },
    setRole: async (u, id, who, role) => {
      const s = (await q<{ me: string | null; them: string | null; owners: string; personal: string | null }>(
        `select (select role from members where workspace_id = $1 and user_id = $2) as me, (select role from members where workspace_id = $1 and user_id = $3) as them,
           (select count(*) from members where workspace_id = $1 and role = 'owner') as owners, (select personal_of from workspaces where id = $1) as personal`, [id, u, who]))[0]
      const me = isRole(s.me) ? s.me : null
      if (!s.them || !(can(me, 'manage') || (who === u && role === null))) return 'denied'
      if (role === null && s.personal === who) return 'denied'
      if (s.them === 'owner' && role !== 'owner' && Number(s.owners) <= 1) return 'last_owner'
      // The last-owner guard is in the write too, for two owners stepping down at once.
      const keepsOwner = `(members.role <> 'owner' or (select count(*) from members o where o.workspace_id = $1 and o.role = 'owner') > 1)`
      const done = role === null
        ? await q(`delete from members where workspace_id = $1 and user_id = $2 and ${keepsOwner} returning user_id`, [id, who])
        : await q(`update members set role = $3 where workspace_id = $1 and user_id = $2 and ($3 = 'owner' or ${keepsOwner}) returning user_id`, [id, who, role])
      return done.length ? 'ok' : 'last_owner'
    },
    addInvite: async (u, id, email, role, token, expires) => (await q(
      `insert into invites (token, workspace_id, email, role, by_user, expires) select $3, $2, $4, $5, $1, $6 where ${member('$2', '$1', '$7')} returning token`,
      [u, id, token, email.toLowerCase(), role, new Date(expires).toISOString(), MANAGE])).length > 0,
    listInvites: async (u, id) => {
      if (!can(await roleIn(id, u), 'manage')) return null
      return (await q<Omit<InviteRow, 'expires'> & { expires: string | Date }>('select token, email, role, expires from invites where workspace_id = $1 order by expires', [id]))
        .map((i) => ({ ...i, expires: new Date(i.expires).getTime() }))
    },
    revokeInvite: async (u, id, token) => (await q(`delete from invites where token = $3 and workspace_id = $2 and ${member('$2', '$1', '$4')} returning token`, [u, id, token, MANAGE])).length > 0,
    // An invite stays usable until it expires or is revoked; accepting again, or a weaker invite, never lowers a role.
    acceptInvite: async (u, token, now) => {
      const i = (await q<{ ws: string; email: string; role: string; expires: string | Date }>('select workspace_id as ws, email, role, expires from invites where token = $1', [token]))[0]
      if (!i || new Date(i.expires).getTime() <= now || !isRole(i.role)) return 'gone'
      if (i.email !== u.email.toLowerCase()) return 'wrong_email'
      const r = await q<{ role: string }>(
        `insert into members (workspace_id, user_id, email, name, role) values ($1, $2, $3, $4, $5)
         on conflict (workspace_id, user_id) do update set role = case when array_position($6::text[], excluded.role) < array_position($6::text[], members.role) then excluded.role else members.role end
         returning role`, [i.ws, u.id, u.email.toLowerCase(), u.name, i.role, ROLES])
      return { workspaceId: i.ws, role: isRole(r[0]?.role) ? r[0].role : i.role }
    },
  }
}
