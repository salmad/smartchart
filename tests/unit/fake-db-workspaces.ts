import type { Db, DbUser, InviteRow, MemberRow } from '../../api/_lib/db'
import { can, ROLES, type Role } from '../../api/_lib/access'

/** The workspace half of the fake Db: workspaces, members and invites, and the moves of old decks into a personal one. */
type Calls = 'ensureWorkspace' | 'listWorkspaces' | 'createWorkspace' | 'renameWorkspace' | 'touchWorkspace' | 'listMembers'
  | 'setRole' | 'addInvite' | 'listInvites' | 'revokeInvite' | 'acceptInvite'
export type FakeWorkspace = { id: string; name: string; personalOf: string | null; brand: unknown }
export type FakeWorkspaces = Pick<Db, Calls> & {
  workspaces: Map<string, FakeWorkspace>
  /** Keyed `${workspace}:${user}`. */
  members: Map<string, Omit<MemberRow, 'personal'> & { ws: string; usedAt: number | null; joined: number }>
  invites: Map<string, InviteRow & { ws: string; by: string }>
  roleIn(userId: string, ws: string): Role | null
  personalOf(userId: string): string | null
}

const stronger = (a: Role, b: Role) => (ROLES.indexOf(a) <= ROLES.indexOf(b) ? a : b)

export function fakeWorkspaces(decks: Map<string, { user: string; ws: string | null }>): FakeWorkspaces {
  const workspaces = new Map<string, FakeWorkspace>()
  const members: FakeWorkspaces['members'] = new Map()
  const invites: FakeWorkspaces['invites'] = new Map()
  let n = 0, clock = 0
  const roleIn = (u: string, ws: string) => members.get(`${ws}:${u}`)?.role ?? null
  const personalOf = (u: string) => [...workspaces.values()].find((w) => w.personalOf === u)?.id ?? null
  const inWs = (ws: string) => [...members.values()].filter((m) => m.ws === ws)
  const join = (ws: string, u: DbUser, role: Role) => members.set(`${ws}:${u.id}`, { ws, userId: u.id, email: u.email, name: u.name, role, usedAt: null, joined: ++clock })
  const make = (name: string, personal: string | null) => { const id = `ws_${++n}`; workspaces.set(id, { id, name, personalOf: personal, brand: null }); return id }
  return {
    workspaces, members, invites, roleIn, personalOf,
    ensureWorkspace: async (u) => {
      let id = personalOf(u.id)
      if (!id) { id = make(`${u.name || u.email.split('@')[0]}’s workspace`, u.id); join(id, u, 'owner') }
      for (const d of decks.values()) if (d.user === u.id && d.ws === null) d.ws = id
      return id
    },
    listWorkspaces: async (u) => [...members.values()].filter((m) => m.userId === u)
      .sort((a, b) => (b.usedAt ?? -1) - (a.usedAt ?? -1) || a.joined - b.joined)
      .map((m) => { const w = workspaces.get(m.ws) as FakeWorkspace; return { id: w.id, name: w.name, role: m.role, personal: w.personalOf === u, members: inWs(w.id).length, usedAt: m.usedAt } }),
    // The maker's email and name come from their other memberships (their personal workspace has them).
    createWorkspace: async (u, name) => {
      const me = [...members.values()].find((m) => m.userId === u), id = make(name, null)
      join(id, { id: u, email: me?.email ?? '', name: me?.name ?? '' }, 'owner')
      return id
    },
    renameWorkspace: async (u, id, name) => { const w = workspaces.get(id); if (!w || !can(roleIn(u, id), 'manage')) return false; w.name = name; return true },
    touchWorkspace: async (u, id) => { const m = members.get(`${id}:${u}`); if (m) m.usedAt = Date.now() + ++clock },
    listMembers: async (u, id) => can(roleIn(u, id), 'read')
      ? inWs(id).sort((a, b) => ROLES.indexOf(a.role) - ROLES.indexOf(b.role) || a.joined - b.joined)
        .map(({ userId, email, name, role }) => ({ userId, email, name, role, personal: workspaces.get(id)?.personalOf === userId })) : null,
    setRole: async (u, id, member, role) => {
      const m = members.get(`${id}:${member}`)
      const self = member === u && role === null
      if (!m || !(can(roleIn(u, id), 'manage') || self)) return 'denied'
      if (role !== 'owner' && workspaces.get(id)?.personalOf === member) return 'denied'
      if (m.role === 'owner' && role !== 'owner' && inWs(id).filter((x) => x.role === 'owner').length === 1) return 'last_owner'
      if (role === null) members.delete(`${id}:${member}`)
      else m.role = role
      return 'ok'
    },
    addInvite: async (u, id, email, role, token, expires) => {
      if (!can(roleIn(u, id), 'manage')) return 'denied'
      if (inWs(id).some((m) => m.email.toLowerCase() === email.toLowerCase())) return 'member'
      invites.set(token, { token, ws: id, email: email.toLowerCase(), role, expires, by: u })
      return 'ok'
    },
    listInvites: async (u, id) => can(roleIn(u, id), 'manage')
      ? [...invites.values()].filter((i) => i.ws === id && i.expires > Date.now() && !inWs(id).some((m) => m.email.toLowerCase() === i.email)).map(({ token, email, role, expires }) => ({ token, email, role, expires })) : null,
    revokeInvite: async (u, id, token) => can(roleIn(u, id), 'manage') && invites.get(token)?.ws === id && invites.delete(token),
    acceptInvite: async (u, token, now) => {
      const i = invites.get(token)
      if (!i || i.expires <= now) return 'gone'
      if (i.email !== u.email.toLowerCase()) return { wrongEmail: i.email }
      for (const [t, o] of invites) if (o.ws === i.ws && o.email === i.email) invites.delete(t)
      const had = roleIn(u.id, i.ws)
      if (had) (members.get(`${i.ws}:${u.id}`) as { role: Role }).role = stronger(had, i.role)
      else join(i.ws, u, i.role)
      return { workspaceId: i.ws, role: roleIn(u.id, i.ws) as Role }
    },
  }
}
