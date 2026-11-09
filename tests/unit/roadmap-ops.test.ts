import { describe, expect, it } from 'vitest'
import { applyOp, type OpResult } from '../../src/engine/roadmaps/ops'
import { issueTree, ISSUE_CYCLE } from '../../src/engine/roadmaps/tree'
import { country, ctx, issue, state } from './roadmap-builders'
import type { FieldDef } from '../../src/engine/roadmaps/types'

const ok = (r: OpResult): Exclude<OpResult, { refused: string }> => {
  if ('refused' in r) throw new Error(r.refused)
  return r
}

const s = state({ fields: [country] }, [issue({ id: 'a', fields: { f1: 'uk' } })])

const twoIssues = state({}, [issue({ id: 'a', status: 'todo' }), issue({ id: 'b', status: 'todo' })])

const tree3 = state({}, [
  issue({ id: 'f', parentId: null }),
  issue({ id: 'a', parentId: 'f' }),
  issue({ id: 'b', parentId: 'f' }),
  issue({ id: 'c', parentId: 'f' }),
])

const countryUkFr: FieldDef = {
  id: 'f1',
  name: 'Country',
  type: 'choice',
  options: [
    { id: 'uk', name: 'UK' },
    { id: 'fr', name: 'France' },
  ],
}

describe('roadmap ops', () => {
  it('numbers new issues and copies the parent’s field values once', () => {
    const base = state({ prefix: 'SME', nextNumber: 142, fields: [country] }, [issue({ id: 'p', fields: { f1: 'uk' } })])
    const r = ok(applyOp(base, { op: 'create', issues: [{ id: 'n', parentId: 'p', title: 'Send RFP' }] }, ctx))
    expect(r.state.issues.find((i) => i.id === 'n')).toMatchObject({ number: 142, fields: { f1: 'uk' }, status: 'todo' })
    expect(r.state.roadmap.nextNumber).toBe(143)
    expect(r.events[0]).toMatchObject({ issueId: 'n', what: 'created' })
  })

  it('creates a parent and child in the same op', () => {
    const r = ok(
      applyOp(state({ nextNumber: 1 }, []), { op: 'create', issues: [{ id: 'p', parentId: null, title: 'Parent' }, { id: 'c', parentId: 'p', title: 'Child' }] }, ctx),
    )
    expect(r.state.issues.map((i) => i.id).sort()).toEqual(['c', 'p'])
    expect(r.state.issues.find((i) => i.id === 'c')?.parentId).toBe('p')
  })

  it('sets properties on many issues in one op, one event each, logging from and to', () => {
    const r = ok(applyOp(twoIssues, { op: 'set', ids: ['a', 'b'], props: { status: 'done' } }, ctx))
    expect(r.events.map((e) => e.changes)).toEqual([
      [{ path: 'status', from: 'todo', to: 'done' }],
      [{ path: 'status', from: 'todo', to: 'done' }],
    ])
  })

  it('emits nothing when a set changes nothing', () => {
    const one = state({}, [issue({ id: 'a', status: 'todo' })])
    const r = ok(applyOp(one, { op: 'set', ids: ['a'], props: { status: 'todo' } }, ctx))
    expect(r.events).toEqual([])
    expect(r.changed).toEqual([])
  })

  it('refuses what the rules refuse, changing nothing', () => {
    expect(applyOp(s, { op: 'set', ids: ['a'], props: { fields: { f1: 'nope' } } }, ctx)).toEqual({ refused: expect.stringMatching(/Country/) })
    expect(applyOp(s, { op: 'set', ids: ['a'], props: { assignee: 'stranger' } }, ctx)).toEqual({ refused: expect.stringMatching(/workspace/) })
    const nested = state({}, [issue({ id: 'u', parentId: null }), issue({ id: 'a', parentId: 'u' })])
    expect(applyOp(nested, { op: 'move', id: 'u', parentId: 'a' }, ctx)).toEqual({ refused: ISSUE_CYCLE })
    expect(applyOp(s, { op: 'set', ids: ['a'], props: { start: '2026-12-01', due: '2026-11-01' } }, ctx)).toEqual({ refused: expect.stringMatching(/before/) })
    expect(applyOp(s, { op: 'set', ids: ['a'], props: { start: 'garbage' } }, ctx)).toEqual({ refused: expect.stringMatching(/YYYY-MM-DD/) })
    expect(applyOp(s, { op: 'create', issues: [{ id: 'z', parentId: null, title: '   ' }] }, ctx)).toEqual({ refused: 'Every issue needs a title.' })
  })

  it('still edits another field when an old choice value is stale on the issue', () => {
    const stale = state({ fields: [country] }, [issue({ id: 'a', fields: { f1: 'fr' } })])
    const onlyUk = state({ fields: [{ ...country, options: [{ id: 'uk', name: 'UK' }] }] }, stale.issues)
    const r = ok(applyOp(onlyUk, { op: 'set', ids: ['a'], props: { title: 'Renamed' } }, ctx))
    expect(r.state.issues[0].title).toBe('Renamed')
    expect(r.state.issues[0].fields).toEqual({ f1: 'fr' })
  })

  it('clears stale field values when a choice option is removed', () => {
    const base = state({ fields: [countryUkFr] }, [issue({ id: 'a', fields: { f1: 'fr' } })])
    const r = ok(applyOp(base, { op: 'roadmap', fields: [{ ...countryUkFr, options: [{ id: 'uk', name: 'UK' }] }] }, ctx))
    expect(r.state.issues[0].fields).toEqual({})
    expect(r.events.some((e) => e.issueId === 'a' && e.what === 'set')).toBe(true)
  })

  it('removes a field value with null in a set', () => {
    const r = ok(applyOp(s, { op: 'set', ids: ['a'], props: { fields: { f1: null } } }, ctx))
    expect(r.state.issues[0].fields).toEqual({})
  })

  it('places an issue before and after siblings', () => {
    const base = state(
      {},
      [issue({ id: 'p', parentId: null }), issue({ id: 'a', parentId: 'p' }), issue({ id: 'b', parentId: 'p' }), issue({ id: 'c', parentId: 'p' })],
    )
    const mid = ok(applyOp(base, { op: 'move', id: 'c', parentId: 'p', before: 'b' }, ctx))
    const order = issueTree(mid.state.issues).children('p').map((i) => i.id)
    expect(order).toEqual(['a', 'c', 'b'])
    const end = ok(applyOp(mid.state, { op: 'move', id: 'c', parentId: 'p', after: 'b' }, ctx))
    expect(issueTree(end.state.issues).children('p').map((i) => i.id)).toEqual(['a', 'b', 'c'])
  })

  it('deletes a subtree and restores it', () => {
    const d = ok(applyOp(tree3, { op: 'delete', ids: ['f'] }, ctx))
    expect(d.changed.map((i) => i.id).sort()).toEqual(['a', 'b', 'c', 'f'])
    expect(ok(applyOp(d.state, { op: 'restore', ids: ['f'] }, ctx)).state.issues.every((i) => i.deletedAt === null)).toBe(true)
  })

  it('deletes parent and child selected together', () => {
    const r = ok(applyOp(tree3, { op: 'delete', ids: ['f', 'a'] }, ctx))
    expect(r.state.issues.every((i) => i.deletedAt !== null)).toBe(true)
  })

  it('restores a child and its deleted parent', () => {
    const deleted = ok(applyOp(tree3, { op: 'delete', ids: ['f'] }, ctx))
    const restored = ok(applyOp(deleted.state, { op: 'restore', ids: ['a'] }, ctx))
    expect(restored.state.issues.every((i) => i.deletedAt === null)).toBe(true)
    expect(issueTree(restored.state.issues).children('f').map((i) => i.id).sort()).toEqual(['a', 'b', 'c'])
  })

  it('deleting a field definition strips its values in the same op', () => {
    const r = ok(applyOp(s, { op: 'roadmap', fields: [] }, ctx))
    expect(r.state.issues.every((i) => !('f1' in i.fields))).toBe(true)
    expect(r.events.some((e) => e.what === 'fields')).toBe(true)
  })
})
