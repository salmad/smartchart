import { describe, expect, it } from 'vitest'
import { applyOp, type OpResult } from '../../src/engine/roadmaps/ops'
import { ISSUE_CYCLE } from '../../src/engine/roadmaps/tree'
import { country, ctx, issue, state } from './roadmap-builders'

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

describe('roadmap ops', () => {
  it('numbers new issues and copies the parent’s field values once', () => {
    const base = state({ prefix: 'SME', nextNumber: 142, fields: [country] }, [issue({ id: 'p', fields: { f1: 'uk' } })])
    const r = ok(applyOp(base, { op: 'create', issues: [{ id: 'n', parentId: 'p', title: 'Send RFP' }] }, ctx))
    expect(r.state.issues.find((i) => i.id === 'n')).toMatchObject({ number: 142, fields: { f1: 'uk' }, status: 'todo' })
    expect(r.state.roadmap.nextNumber).toBe(143)
    expect(r.events[0]).toMatchObject({ issueId: 'n', what: 'created' })
  })

  it('sets properties on many issues in one op, one event each, logging from and to', () => {
    const r = ok(applyOp(twoIssues, { op: 'set', ids: ['a', 'b'], props: { status: 'done' } }, ctx))
    expect(r.events.map((e) => e.changes)).toEqual([
      [{ path: 'status', from: 'todo', to: 'done' }],
      [{ path: 'status', from: 'todo', to: 'done' }],
    ])
  })

  it('refuses what the rules refuse, changing nothing', () => {
    expect(applyOp(s, { op: 'set', ids: ['a'], props: { fields: { f1: 'nope' } } }, ctx)).toEqual({ refused: expect.stringMatching(/Country/) })
    expect(applyOp(s, { op: 'set', ids: ['a'], props: { assignee: 'stranger' } }, ctx)).toEqual({ refused: expect.stringMatching(/workspace/) })
    const nested = state({}, [issue({ id: 'u', parentId: null }), issue({ id: 'a', parentId: 'u' })])
    expect(applyOp(nested, { op: 'move', id: 'u', parentId: 'a' }, ctx)).toEqual({ refused: ISSUE_CYCLE })
    expect(applyOp(s, { op: 'set', ids: ['a'], props: { start: '2026-12-01', due: '2026-11-01' } }, ctx)).toEqual({ refused: expect.stringMatching(/before/) })
  })

  it('deletes a subtree and restores it', () => {
    const d = ok(applyOp(tree3, { op: 'delete', ids: ['f'] }, ctx))
    expect(d.changed.map((i) => i.id).sort()).toEqual(['a', 'b', 'c', 'f'])
    expect(ok(applyOp(d.state, { op: 'restore', ids: ['f'] }, ctx)).state.issues.every((i) => i.deletedAt === null)).toBe(true)
  })

  it('deleting a field definition strips its values in the same op', () => {
    const r = ok(applyOp(s, { op: 'roadmap', fields: [] }, ctx))
    expect(r.state.issues.every((i) => !('f1' in i.fields))).toBe(true)
    expect(r.events[0]).toMatchObject({ issueId: null, what: 'fields' })
  })
})
