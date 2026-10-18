// Who may do what in a workspace: the one rule, read by the SQL (as a role list) and by the fake Db alike.
// read: open and list. write: create, save, delete, share, presence. manage: members, invites, the workspace's name.

export type Role = 'owner' | 'editor' | 'viewer'
export type Action = 'read' | 'write' | 'manage'

/** Strongest first. */
export const ROLES: readonly Role[] = ['owner', 'editor', 'viewer']

/** The weakest role that may take each action; every stronger role may too. */
const LEAST: Record<Action, Role> = { read: 'viewer', write: 'editor', manage: 'owner' }

export const isRole = (v: unknown): v is Role => typeof v === 'string' && (ROLES as readonly string[]).includes(v)

/** The roles allowed an action, strongest first, for SQL: `role = any($n)`. */
export const rolesFor = (action: Action): Role[] => ROLES.slice(0, ROLES.indexOf(LEAST[action]) + 1)

/** Null is not a member: they may do nothing. */
export const can = (role: Role | null, action: Action): boolean => role !== null && rolesFor(action).includes(role)
