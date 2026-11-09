import { describe, expect, it } from 'vitest'
import {
  DEFAULT_VIEW,
  liveChips,
  tableRows,
  type Chip,
  type ViewSettings,
} from '../../src/engine/roadmaps/view'
import { country, issue, state } from './roadmap-builders'

const today = '2026-11-09'

function view(over: Partial<ViewSettings> = {}): ViewSettings {
  return { ...DEFAULT_VIEW, ...over }
}

describe('roadmap view', () => {
  it('shows a matching grandchild with dimmed ancestors', () => {
    const issues = [
      issue({ id: 'g', parentId: null, sortKey: 'a' }),
      issue({ id: 'p', parentId: 'g', sortKey: 'a', title: 'Parent' }),
      issue({ id: 'c', parentId: 'p', sortKey: 'a', title: 'Child', status: 'blocked' }),
    ]
    const s = state({ fields: [] }, issues)
    const rows = tableRows(
      s,
      view({ chips: [{ on: 'status', is: true, values: ['blocked'] }] }),
      today,
    )
    const issueRows = rows.filter((r) => r.kind === 'issue')
    expect(issueRows.map((r) => [r.issue.id, r.dim])).toEqual([
      ['g', true],
      ['p', true],
      ['c', false],
    ])
  })

  it('groups children under the parent top-most group value', () => {
    const issues = [
      issue({ id: 'root', parentId: null, fields: { f1: 'uk' }, sortKey: 'a' }),
      issue({ id: 'kid', parentId: 'root', fields: { f1: 'us' }, sortKey: 'a', title: 'Child' }),
    ]
    const s = state({ fields: [country, { id: 'f2', name: 'US', type: 'choice', options: [{ id: 'us', name: 'US' }] }] }, issues)
    const rows = tableRows(s, view({ groupBy: { on: 'field', field: 'f1' } }), today)
    const groups = rows.filter((r) => r.kind === 'group')
    expect(groups).toHaveLength(1)
    expect(groups[0].label).toBe('UK')
    const under = rows.slice(rows.indexOf(groups[0]))
    expect(under.filter((r) => r.kind === 'issue').map((r) => r.issue.id)).toEqual(['root', 'kid'])
  })

  it('treats is-not empty as issues with a field value set', () => {
    const issues = [
      issue({ id: 'a', fields: {} }),
      issue({ id: 'b', fields: { f1: 'uk' }, sortKey: 'b' }),
    ]
    const s = state({ fields: [country] }, issues)
    const rows = tableRows(
      s,
      view({ chips: [{ on: 'field', field: 'f1', is: false, values: [null] }] }),
      today,
    )
    expect(rows.filter((r) => r.kind === 'issue').map((r) => r.issue.id)).toEqual(['b'])
  })

  it('excludes done and cancelled from overdue filter', () => {
    const issues = [
      issue({ id: 'open', due: '2026-01-01', status: 'todo', sortKey: 'a' }),
      issue({ id: 'done', due: '2026-01-01', status: 'done', sortKey: 'b' }),
      issue({ id: 'cx', due: '2026-01-01', status: 'cancelled', sortKey: 'c' }),
    ]
    const s = state({}, issues)
    const rows = tableRows(s, view({ chips: [{ on: 'dates', when: 'overdue' }] }), today)
    expect(rows.filter((r) => r.kind === 'issue').map((r) => r.issue.id)).toEqual(['open'])
  })

  it('drops liveChips on deleted fields and options', () => {
    const chips: Chip[] = [
      { on: 'field', field: 'gone', is: true, values: ['x'] },
      { on: 'field', field: 'f1', is: true, values: ['uk', 'nope'] },
      { on: 'status', is: true, values: ['todo'] },
    ]
    expect(liveChips([country], chips)).toEqual([
      { on: 'field', field: 'f1', is: true, values: ['uk'] },
      { on: 'status', is: true, values: ['todo'] },
    ])
  })

  it('sorts due date among siblings without breaking the tree', () => {
    const issues = [
      issue({ id: 'root', parentId: null, sortKey: 'a' }),
      issue({ id: 'late', parentId: 'root', due: '2026-12-01', sortKey: 'a' }),
      issue({ id: 'soon', parentId: 'root', due: '2026-11-01', sortKey: 'b' }),
      issue({ id: 'other-root', parentId: null, due: '2026-10-01', sortKey: 'b' }),
    ]
    const s = state({}, issues)
    const rows = tableRows(s, view({ sort: 'due' }), today)
    expect(rows.filter((r) => r.kind === 'issue').map((r) => r.issue.id)).toEqual([
      'other-root',
      'root',
      'soon',
      'late',
    ])
  })

  it('shows a matching grandchild under a collapsed ancestor', () => {
    const issues = [
      issue({ id: 'g', parentId: null, sortKey: 'a' }),
      issue({ id: 'p', parentId: 'g', sortKey: 'a', title: 'Parent' }),
      issue({ id: 'c', parentId: 'p', sortKey: 'a', title: 'Child', status: 'blocked' }),
    ]
    const s = state({ fields: [] }, issues)
    const rows = tableRows(
      s,
      view({
        chips: [{ on: 'status', is: true, values: ['blocked'] }],
        collapsed: ['g', 'p'],
      }),
      today,
    )
    const issueRows = rows.filter((r) => r.kind === 'issue')
    expect(issueRows.map((r) => [r.issue.id, r.dim, r.open])).toEqual([
      ['g', true, false],
      ['p', true, false],
      ['c', false, true],
    ])
  })

  it('puts count and progress on group rows', () => {
    const issues = [
      issue({ id: 'a', status: 'todo', sortKey: 'a' }),
      issue({ id: 'b', status: 'done', sortKey: 'b' }),
      issue({ id: 'c', status: 'in_progress', sortKey: 'c' }),
    ]
    const s = state({}, issues)
    const rows = tableRows(s, view({ groupBy: { on: 'status' } }), today)
    const todo = rows.find((r) => r.kind === 'group' && r.key === 'todo')
    expect(todo).toMatchObject({ kind: 'group', count: 1 })
    expect(todo && todo.kind === 'group' ? todo.progress : null).toBe(0)
    const done = rows.find((r) => r.kind === 'group' && r.key === 'done')
    expect(done).toMatchObject({ kind: 'group', count: 1, progress: 1 })
  })
})
