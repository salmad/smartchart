import { describe, expect, it } from 'vitest'
import { applyOp, rolloverDue, SYSTEM_USER, type OpResult } from '../../src/engine/roadmaps/ops'
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

  it('inheritFields false does not copy the parent’s field values', () => {
    const base = state({ fields: [country] }, [issue({ id: 'p', fields: { f1: 'uk' } })])
    const bare = ok(applyOp(base, { op: 'create', issues: [{ id: 'n', parentId: 'p', title: 'Child', inheritFields: false }] }, ctx))
    expect(bare.state.issues.find((i) => i.id === 'n')?.fields).toEqual({})
    const named = ok(applyOp(base, { op: 'create', issues: [{ id: 'n2', parentId: 'p', title: 'Named', inheritFields: false, props: { fields: { f1: 'uk' } } }] }, ctx))
    expect(named.state.issues.find((i) => i.id === 'n2')?.fields).toEqual({ f1: 'uk' })
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

  it('duplicates a subtree once when parent and child are selected', () => {
    const base = state({ nextNumber: 10 }, [
      issue({ id: 'p', parentId: null, title: 'UK' }),
      issue({ id: 'c', parentId: 'p', title: 'Task' }),
    ])
    const r = ok(
      applyOp(
        base,
        {
          op: 'duplicate',
          copies: [
            { id: 'p2', sourceId: 'p' },
            { id: 'c2', sourceId: 'c' },
          ],
        },
        ctx,
      ),
    )
    expect(r.state.issues.map((i) => i.id).sort()).toEqual(['c', 'c2', 'p', 'p2'])
    expect(r.state.issues.find((i) => i.id === 'c2')).toMatchObject({ parentId: 'p2', title: 'Task' })
    expect(r.events).toHaveLength(2)
    expect(r.events.every((e) => e.what === 'created')).toBe(true)
    expect(r.events.find((e) => e.issueId === 'p2')?.changes).toEqual([
      { path: 'title', from: null, to: 'UK' },
      { path: 'duplicatedFrom', from: null, to: 'p' },
    ])
  })

  it('places duplicate roots after their sources in sibling order', () => {
    const base = state({ nextNumber: 1 }, [
      issue({ id: 'f', parentId: null }),
      issue({ id: 'a', parentId: 'f', sortKey: 'a' }),
      issue({ id: 'b', parentId: 'f', sortKey: 'b' }),
    ])
    const r = ok(
      applyOp(
        base,
        {
          op: 'duplicate',
          copies: [
            { id: 'a2', sourceId: 'a' },
            { id: 'b2', sourceId: 'b' },
          ],
        },
        ctx,
      ),
    )
    expect(issueTree(r.state.issues).children('f').map((i) => i.id)).toEqual(['a', 'a2', 'b', 'b2'])
  })

  it('numbers duplicated issues in preorder and copies fields and status', () => {
    const base = state({ nextNumber: 42, fields: [country] }, [
      issue({ id: 'p', parentId: null, status: 'in_progress', fields: { f1: 'uk' } }),
      issue({ id: 'c', parentId: 'p', status: 'done', assignee: 'bob', start: '2026-01-01', due: '2026-03-01' }),
    ])
    const r = ok(
      applyOp(
        base,
        {
          op: 'duplicate',
          copies: [
            { id: 'p2', sourceId: 'p' },
            { id: 'c2', sourceId: 'c' },
          ],
        },
        ctx,
      ),
    )
    expect(r.state.issues.find((i) => i.id === 'p2')).toMatchObject({
      number: 42,
      status: 'in_progress',
      fields: { f1: 'uk' },
      bodyRev: 0,
      createdBy: 'ann',
    })
    expect(r.state.issues.find((i) => i.id === 'c2')).toMatchObject({
      number: 43,
      status: 'done',
      assignee: 'bob',
      start: '2026-01-01',
      due: '2026-03-01',
      bodyRev: 0,
    })
    expect(r.state.roadmap.nextNumber).toBe(44)
  })

  it('refuses duplicate ops that break the rules without changing state', () => {
    const base = state({ nextNumber: 1 }, [issue({ id: 'a', parentId: null }), issue({ id: 'c', parentId: 'a' })])
    const dup = (copies: { id: string; sourceId: string }[]) => applyOp(base, { op: 'duplicate', copies }, ctx)

    expect(dup([])).toEqual({ refused: 'Select an issue to duplicate.' })
    expect(dup([{ id: 'z', sourceId: 'nope' }])).toEqual({ refused: 'No such issue.' })
    expect(dup([{ id: 'a2', sourceId: 'a' }, { id: 'a3', sourceId: 'a' }])).toEqual({ refused: 'Each copy needs its own id.' })
    expect(dup([{ id: 'a', sourceId: 'a' }])).toEqual({ refused: 'That issue already exists.' })
    expect(dup([{ id: 'a2', sourceId: 'a' }])).toEqual({ refused: 'Duplicate needs a new id for each issue.' })
    expect(dup([{ id: 'a2', sourceId: 'a' }, { id: 'a2', sourceId: 'c' }])).toEqual({ refused: 'Each copy needs its own id.' })
    expect(dup([{ id: 'p2', sourceId: 'a' }, { id: 'c2', sourceId: 'c' }])).not.toHaveProperty('refused')
    expect(base.issues).toHaveLength(2)
  })
})

describe('sprints in ops', () => {
  const rhythm = { start: '2026-11-02', weeks: 2, rolled: null }
  const sctx = { ...ctx, now: Date.UTC(2026, 10, 17, 9) }
  const withRhythm = (issues = [issue({ id: 'a' })]) => state({ sprints: rhythm }, issues)

  it('stores the start of the sprint a date falls in, resets carried and logs it', () => {
    const r = ok(applyOp(withRhythm([issue({ id: 'a', carried: 2 })]), { op: 'set', ids: ['a'], props: { sprint: '2026-11-20' } }, sctx))
    expect(r.state.issues[0]).toMatchObject({ sprint: '2026-11-16', carried: 0 })
    expect(r.events[0].changes).toEqual([{ path: 'sprint', from: null, to: '2026-11-16' }])
  })

  it('refuses a sprint without a rhythm or one that has ended, and lets it be cleared', () => {
    expect(applyOp(state({}, [issue({ id: 'a' })]), { op: 'set', ids: ['a'], props: { sprint: '2026-11-20' } }, sctx)).toEqual({ refused: "Sprints aren't set up for this roadmap." })
    expect(applyOp(withRhythm(), { op: 'set', ids: ['a'], props: { sprint: '2026-11-03' } }, sctx)).toEqual({ refused: 'That sprint has ended.' })
    const cleared = ok(applyOp(state({}, [issue({ id: 'a', sprint: '2026-11-02' })]), { op: 'set', ids: ['a'], props: { sprint: null } }, sctx))
    expect(cleared.state.issues[0].sprint).toBeNull()
  })

  it('keeps carried when the sprint does not change', () => {
    const r = ok(applyOp(withRhythm([issue({ id: 'a', sprint: '2026-11-16', carried: 1 })]), { op: 'set', ids: ['a'], props: { sprint: '2026-11-17' } }, sctx))
    expect(r.changed).toEqual([])
    expect(r.state.issues[0].carried).toBe(1)
  })

  it('sets, validates and clears the rhythm', () => {
    const r = ok(applyOp(state(), { op: 'roadmap', sprints: { start: '2026-11-02', weeks: 2 } }, sctx))
    expect(r.state.roadmap.sprints).toEqual({ start: '2026-11-02', weeks: 2, rolled: null })
    expect(applyOp(state(), { op: 'roadmap', sprints: { start: '2026-11-02', weeks: 9 } }, sctx)).toHaveProperty('refused')
    const gone = ok(applyOp(r.state, { op: 'roadmap', sprints: null }, sctx))
    expect(gone.state.roadmap.sprints).toBeNull()
  })

  it('rolls open work in ended sprints to the current one, once', () => {
    const base = withRhythm([
      issue({ id: 'todo', status: 'todo', sprint: '2026-11-02' }),
      issue({ id: 'prog', status: 'in_progress', sprint: '2026-11-02', carried: 1 }),
      issue({ id: 'blk', status: 'blocked', sprint: '2026-11-02' }),
      issue({ id: 'bl', status: 'backlog', sprint: '2026-11-02' }),
      issue({ id: 'done', status: 'done', sprint: '2026-11-02' }),
      issue({ id: 'x', status: 'cancelled', sprint: '2026-11-02' }),
      issue({ id: 'gone', status: 'todo', sprint: '2026-11-02', deletedAt: 5 }),
      issue({ id: 'now', status: 'todo', sprint: '2026-11-16' }),
      issue({ id: 'none', status: 'todo' }),
    ])
    expect(rolloverDue(base.roadmap, '2026-11-17')).toBe(true)
    const r = ok(applyOp(base, { op: 'rollover', today: '2026-11-17' }, sctx))
    const by = (id: string) => r.state.issues.find((i) => i.id === id)
    expect(by('todo')).toMatchObject({ sprint: '2026-11-16', carried: 1 })
    expect(by('prog')).toMatchObject({ sprint: '2026-11-16', carried: 2 })
    expect(by('blk')?.sprint).toBe('2026-11-16')
    for (const id of ['bl', 'done', 'x', 'gone']) expect(by(id)?.sprint).toBe('2026-11-02')
    expect(by('now')?.carried).toBe(0)
    expect(r.changed.map((i) => i.id).sort()).toEqual(['blk', 'prog', 'todo'])
    expect(r.events).toHaveLength(3)
    expect(r.events.every((e) => e.by === SYSTEM_USER && e.what === 'set')).toBe(true)
    expect(r.events[0].changes).toEqual([{ path: 'sprint', from: '2026-11-02', to: '2026-11-16' }])
    expect(r.state.roadmap.sprints?.rolled).toBe('2026-11-16')
    expect(rolloverDue(r.state.roadmap, '2026-11-17')).toBe(false)
    const again = ok(applyOp(r.state, { op: 'rollover', today: '2026-11-17' }, sctx))
    expect(again.changed).toEqual([])
    expect(again.events).toEqual([])
  })

  it('moves work from several missed sprints straight to the current one', () => {
    const base = withRhythm([issue({ id: 'a', sprint: '2026-11-02' })])
    const r = ok(applyOp(base, { op: 'rollover', today: '2026-12-10' }, sctx))
    expect(r.state.issues[0].sprint).toBe('2026-11-30')
  })

  it('does nothing before the rhythm starts or without one', () => {
    expect(rolloverDue(withRhythm().roadmap, '2026-10-01')).toBe(false)
    expect(rolloverDue(state().roadmap, '2026-11-17')).toBe(false)
  })

  it('duplicates a sprint but not its carried count', () => {
    const base = withRhythm([issue({ id: 'a', sprint: '2026-11-16', carried: 3 })])
    const r = ok(applyOp(base, { op: 'duplicate', copies: [{ id: 'b', sourceId: 'a' }] }, sctx))
    expect(r.state.issues.find((i) => i.id === 'b')).toMatchObject({ sprint: '2026-11-16', carried: 0 })
  })
})
