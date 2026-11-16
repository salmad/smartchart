import { describe, expect, it } from 'vitest'
import { matrixGrid } from '../../src/engine/roadmaps/matrix'
import { nameMatches, nameQuery } from '../../src/engine/roadmaps/search'
import {
  DEFAULT_MATRIX,
  DEFAULT_VIEW,
  filtering,
  liveChips,
  liveGroupBy,
  toggleFolded,
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

  it('places a parent under every group its work reaches, each time with only that part', () => {
    const issues = [
      issue({ id: 'root', parentId: null, fields: { f1: 'uk' }, sortKey: 'a' }),
      issue({ id: 'kid', parentId: 'root', fields: { f1: 'us' }, sortKey: 'a', title: 'Child' }),
    ]
    const s = state({ fields: [country, { id: 'f2', name: 'US', type: 'choice', options: [{ id: 'us', name: 'US' }] }] }, issues)
    const rows = tableRows(s, view({ groupBy: [{ on: 'field', field: 'f1' }] }), today)
    expect(rows.map((r) => (r.kind === 'group' ? r.label : r.issue.id))).toEqual(['UK', 'root', 'us', 'root', 'kid'])
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

  it('filters with a check chip and dims ancestors', () => {
    const issues = [
      issue({ id: 'g', parentId: null, sortKey: 'a' }),
      issue({ id: 'c', parentId: 'g', sortKey: 'a', due: '2026-01-01', status: 'todo' }),
    ]
    const s = state({}, issues)
    const rows = tableRows(s, view({ chips: [{ on: 'check', id: 'overdue' }] }), today)
    const issueRows = rows.filter((r) => r.kind === 'issue')
    expect(issueRows.map((r) => [r.issue.id, r.dim])).toEqual([
      ['g', true],
      ['c', false],
    ])
  })

  it('keeps a check chip when a field is removed from liveChips', () => {
    const chips: Chip[] = [{ on: 'check', id: 'blocked' }, { on: 'field', field: 'gone', is: true, values: ['x'] }]
    expect(liveChips([country], chips)).toEqual([{ on: 'check', id: 'blocked' }])
  })

  it('puts count and progress on group rows', () => {
    const issues = [
      issue({ id: 'a', status: 'todo', sortKey: 'a' }),
      issue({ id: 'b', status: 'done', sortKey: 'b' }),
      issue({ id: 'c', status: 'in_progress', sortKey: 'c' }),
    ]
    const s = state({}, issues)
    const rows = tableRows(s, view({ groupBy: [{ on: 'status' }] }), today)
    const todo = rows.find((r) => r.kind === 'group' && r.key === 'status=todo')
    expect(todo).toMatchObject({ kind: 'group', count: 1 })
    expect(todo && todo.kind === 'group' ? todo.progress : null).toBe(0)
    const done = rows.find((r) => r.kind === 'group' && r.key === 'status=done')
    expect(done).toMatchObject({ kind: 'group', count: 1, progress: 1 })
  })
  it('groups by assignee under the person\'s name, in name order, with Unassigned last', () => {
    const issues = [
      issue({ id: 'a', assignee: 'u_zed', sortKey: 'a' }),
      issue({ id: 'b', assignee: null, sortKey: 'b' }),
      issue({ id: 'c', assignee: 'u_amy', sortKey: 'c' }),
    ]
    const s = state({}, issues)
    const names = new Map([['u_zed', 'Amy Zhou'], ['u_amy', 'Zoe Adams']])
    const labels = (m?: ReadonlyMap<string, string>) =>
      tableRows(s, view({ groupBy: [{ on: 'assignee' }] }), today, m).flatMap((r) => (r.kind === 'group' ? [r.label] : []))
    expect(labels(names)).toEqual(['Amy Zhou', 'Zoe Adams', 'Unassigned'])
    expect(labels()).toEqual(['u_amy', 'u_zed', 'Unassigned'])
  })
  it('groups by a text, number or person field: numbers in numeric order, people by name', () => {
    const fields = [
      { id: 'n', name: 'Size', type: 'number' as const },
      { id: 'p', name: 'Owner', type: 'person' as const },
    ]
    const issues = [
      issue({ id: 'a', sortKey: 'a', fields: { n: 10, p: 'u1' } }),
      issue({ id: 'b', sortKey: 'b', fields: { n: 2, p: 'u2' } }),
    ]
    const s = state({ fields }, issues)
    const labels = (level: ViewSettings['groupBy'][number]) =>
      tableRows(s, view({ groupBy: [level] }), today, new Map([['u1', 'Zoe'], ['u2', 'Amy']])).flatMap((r) => (r.kind === 'group' ? [r.label] : []))
    expect(labels({ on: 'field', field: 'n' })).toEqual(['2', '10'])
    expect(labels({ on: 'field', field: 'p' })).toEqual(['Amy', 'Zoe'])
  })

  describe('shared grouping', () => {
    const ws = { id: 'ws', name: 'Workstream', type: 'choice' as const, options: [{ id: 'risk', name: 'Risk' }, { id: 'ops', name: 'Operations' }] }
    const issues = [
      issue({ id: 'a', sortKey: 'a', fields: { ws: 'risk', f1: 'uk' }, start: '2027-01-01', due: '2027-02-01' }),
      issue({ id: 'b', sortKey: 'b', fields: { ws: 'risk', f1: 'fr' }, start: '2027-03-01', due: '2027-05-01' }),
      issue({ id: 'c', sortKey: 'c', fields: { ws: 'ops', f1: 'uk' } }),
      issue({ id: 'a1', parentId: 'a', sortKey: 'a', fields: {} }),
    ]
    const s = state({ fields: [country, ws] }, issues)
    const two: ViewSettings['groupBy'] = [{ on: 'field', field: 'ws' }, { on: 'field', field: 'f1' }]

    it('groups on two levels, in the field’s own order, keyed by their path', () => {
      const rows = tableRows(s, view({ groupBy: two }), today)
      expect(rows.map((r) => (r.kind === 'group' ? `${r.depth}:${r.key}` : r.issue.id))).toEqual([
        '0:ws=risk', '1:ws=risk/f1=uk', 'a', 'a1', '1:ws=risk/f1=fr', 'b', '0:ws=ops', '1:ws=ops/f1=uk', 'c',
      ])
    })

    it('a folded group keeps its header, count and span and hides what is inside', () => {
      const rows = tableRows(s, view({ groupBy: two, folded: ['ws=risk'] }), today)
      const risk = rows.find((r) => r.kind === 'group' && r.key === 'ws=risk')
      expect(risk?.kind === 'group' && [risk.open, risk.count, risk.tops]).toEqual([false, 3, ['a1', 'b']])
      expect(rows.some((r) => r.kind === 'issue' && r.issue.id === 'a')).toBe(false)
      expect(rows.some((r) => r.kind === 'group' && r.key === 'ws=risk/f1=uk')).toBe(false)
      const inner = tableRows(s, view({ groupBy: two, folded: ['ws=risk/f1=uk'] }), today)
      expect(inner.some((r) => r.kind === 'issue' && r.issue.id === 'a')).toBe(false)
      expect(inner.some((r) => r.kind === 'issue' && r.issue.id === 'b')).toBe(true)
    })

    it('toggleFolded folds one group, or every group at its level with all', () => {
      expect(toggleFolded([], 'ws=risk', ['ws=risk', 'ws=ops'], false)).toEqual(['ws=risk'])
      expect(toggleFolded([], 'ws=risk', ['ws=risk', 'ws=ops'], true)).toEqual(['ws=risk', 'ws=ops'])
      expect(toggleFolded(['ws=risk', 'ws=ops', 'x'], 'ws=ops', ['ws=risk', 'ws=ops'], true)).toEqual(['x'])
    })

    it('a parent under a group carries that group’s key, dates and progress', () => {
      const c2 = { ...country, options: [{ id: 'uk', name: 'UK' }, { id: 'fr', name: 'France' }] }
      const kids = [
        issue({ id: 'p', sortKey: 'a' }),
        issue({ id: 'p-uk', parentId: 'p', sortKey: 'a', status: 'done', fields: { f1: 'uk' }, start: '2027-01-01', due: '2027-03-01' }),
        issue({ id: 'p-fr', parentId: 'p', sortKey: 'b', fields: { f1: 'fr' }, start: '2027-04-01', due: '2027-09-01' }),
      ]
      const rows = tableRows(state({ fields: [c2] }, kids), view({ groupBy: [{ on: 'field', field: 'f1' }] }), today)
      const parents = rows.flatMap((r) => (r.kind === 'issue' && r.issue.id === 'p' ? [r] : []))
      expect(parents.map((r) => [r.key, r.part])).toEqual([
        ['f1=uk/p', { start: '2027-01-01', due: '2027-03-01', progress: 1 }],
        ['f1=fr/p', { start: '2027-04-01', due: '2027-09-01', progress: 0 }],
      ])
    })

    it('a deleted field drops out of the grouping', () => {
      expect(liveGroupBy([country], two)).toEqual([{ on: 'field', field: 'f1' }])
    })
  })
})

describe('roadmap search', () => {
  const hit = (query: string, title: string) => {
    const q = nameQuery(query)
    return q !== null && nameMatches(q, title)
  }

  it('finds a title by its exact name, a part of it, or its words in any order', () => {
    expect(hit('Launch pricing page', 'Launch pricing page')).toBe(true)
    expect(hit('pric', 'Launch pricing page')).toBe(true)
    expect(hit('page launch', 'Launch pricing page')).toBe(true)
    expect(hit('mktg', 'Marketing site')).toBe(true)
    expect(hit('roadmap', 'Road map review')).toBe(true)
    expect(hit('café', 'Cafe opening')).toBe(true)
  })

  it('forgives a slip of the keys', () => {
    expect(hit('lanch', 'Launch pricing page')).toBe(true)
    expect(hit('pricnig', 'Launch pricing page')).toBe(true)
    expect(hit('onbaording flow', 'Onboarding flow')).toBe(true)
    expect(hit('underwritting', 'Underwriting')).toBe(true)
  })

  it('does not stretch to unrelated names', () => {
    expect(hit('xyz', 'Launch pricing page')).toBe(false)
    expect(hit('budget', 'Launch pricing page')).toBe(false)
    expect(hit('launch budget', 'Launch pricing page')).toBe(false)
    // Short words need to be there as typed: no typo and no scattered letters.
    expect(hit('lp', 'Launch pricing page')).toBe(false)
    expect(hit('lau', 'Hire a lawyer')).toBe(false)
  })

  it('a blank query is no query', () => {
    expect(nameQuery('')).toBeNull()
    expect(nameQuery('  · ')).toBeNull()
  })

  describe('in the views', () => {
    const issues = [
      issue({ id: 'a', parentId: null, sortKey: 'a', title: 'Launch pricing page' }),
      issue({ id: 'a1', parentId: 'a', sortKey: 'a', title: 'Write copy' }),
      issue({ id: 'b', parentId: null, sortKey: 'b', title: 'Hiring', fields: { f1: 'uk' } }),
      issue({ id: 'b1', parentId: 'b', sortKey: 'a', title: 'Interview designers', fields: { f1: 'uk' } }),
      issue({ id: 'b2', parentId: 'b', sortKey: 'b', title: 'Offer letters', fields: { f1: 'uk' } }),
    ]
    const s = state({ fields: [country] }, issues)
    const shown = (v: ViewSettings) => tableRows(s, v, today).flatMap((r) => (r.kind === 'issue' ? [[r.issue.id, r.dim]] : []))

    it('an empty search shows everything, undimmed', () => {
      expect(shown(view({ search: '' }))).toEqual(shown(view()))
      expect(filtering(view({ search: '   ' }))).toBe(false)
      expect(filtering(view({ search: 'a' }))).toBe(true)
    })

    it('keeps the parent of a matching sub-issue, dimmed, and drops the rest', () => {
      expect(shown(view({ search: 'intervew' }))).toEqual([['b', true], ['b1', false]])
    })

    const chevrons = (v: ViewSettings) =>
      tableRows(s, v, today).flatMap((r) => (r.kind === 'issue' ? [[r.issue.id, r.hasChildren, r.open]] : []))

    it('a parent folded under the search keeps its found sub-issue behind a closed chevron', () => {
      expect(chevrons(view({ search: 'designers', collapsed: ['b'] }))).toEqual([['b', true, false], ['b1', false, true]])
    })

    it('a matching parent shows without its unmatched sub-issues, and without a chevron', () => {
      expect(shown(view({ search: 'pricing' }))).toEqual([['a', false]])
      expect(chevrons(view({ search: 'pricing' }))).toEqual([['a', false, true]])
      expect(chevrons(view())[0]).toEqual(['a', true, true])
    })

    it('works with chips and inside groups', () => {
      expect(shown(view({ search: 'offer', chips: [{ on: 'status', is: true, values: ['done'] }] }))).toEqual([])
      const grouped = tableRows(s, view({ search: 'offer', groupBy: [{ on: 'field', field: 'f1' }] }), today)
      expect(grouped.map((r) => (r.kind === 'group' ? r.label : r.issue.id))).toEqual(['UK', 'b', 'b2'])
    })

    it('opens the matrix rows it finds sub-issues under, and keeps the columns', () => {
      const m = view({ search: 'offer', matrix: { ...DEFAULT_MATRIX, cols: ['f1'] } })
      const { cols, rows } = matrixGrid(s, m, today)
      expect(rows.flatMap((r) => (r.kind === 'issue' ? [[r.issue.id, r.dim]] : []))).toEqual([['b', true], ['b2', false]])
      expect(cols.map((c) => c.key)).toEqual(matrixGrid(s, view({ matrix: m.matrix }), today).cols.map((c) => c.key))
    })

    it('a matrix row folded while searching closes', () => {
      const m = view({ search: 'offer', collapsed: ['b'], matrix: { ...DEFAULT_MATRIX, cols: ['f1'] } })
      const rows = matrixGrid(s, m, today).rows.flatMap((r) => (r.kind === 'issue' ? [[r.issue.id, r.hasChildren, r.open]] : []))
      expect(rows).toEqual([['b', true, false]])
    })
  })
})
