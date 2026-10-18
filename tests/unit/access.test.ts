import { describe, expect, it } from 'vitest'
import { can, isRole, ROLES, rolesFor, type Action } from '../../api/_lib/access'

const ACTIONS: Action[] = ['read', 'write', 'manage']

describe('access rule', () => {
  it('a viewer reads, an editor also writes, an owner also manages, nobody else does anything', () => {
    const table = Object.fromEntries([...ROLES, null].map((r) => [String(r), ACTIONS.filter((a) => can(r, a))]))
    expect(table).toEqual({ owner: ['read', 'write', 'manage'], editor: ['read', 'write'], viewer: ['read'], null: [] })
  })
  it('lists the roles an action allows, strongest first, for SQL', () => {
    expect(rolesFor('read')).toEqual(['owner', 'editor', 'viewer'])
    expect(rolesFor('write')).toEqual(['owner', 'editor'])
    expect(rolesFor('manage')).toEqual(['owner'])
  })
  it('knows a role when it sees one', () => {
    expect(ROLES.every(isRole)).toBe(true)
    expect([null, 'admin', 1, ''].some(isRole)).toBe(false)
  })
})
