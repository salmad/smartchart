import { describe, expect, it } from 'vitest'
import {
  dueQuarter,
  liveMatrix,
  matrixGrid,
  type MatrixCell,
} from '../../src/engine/roadmaps/matrix'
import { progressUnder } from '../../src/engine/roadmaps/rollup'
import { DEFAULT_MATRIX, DEFAULT_VIEW, type ViewSettings } from '../../src/engine/roadmaps/view'
import type { FieldDef } from '../../src/engine/roadmaps/types'
import { issue, state } from './roadmap-builders'

const today = '2026-11-10'

const workstream: FieldDef = {
  id: 'ws',
  name: 'Workstream',
  type: 'choice',
  options: [{ id: 'vendors', name: 'Vendors' }],
}

const countryField: FieldDef = {
  id: 'country',
  name: 'Country',
  type: 'choice',
  options: [
    { id: 'uk', name: 'UK' },
    { id: 'fr', name: 'France' },
    { id: 'sg', name: 'Singapore' },
  ],
}

const cardField: FieldDef = {
  id: 'card',
  name: 'Card',
  type: 'choice',
  options: [
    { id: 'debit', name: 'Debit' },
    { id: 'credit', name: 'Credit' },
  ],
}

const accountField: FieldDef = {
  id: 'account',
  name: 'Account',
  type: 'choice',
  options: [
    { id: 'retail', name: 'Retail' },
    { id: 'biz', name: 'Business' },
  ],
}

function cellIds(cell: MatrixCell): string[] {
  if (cell.kind === 'empty') return []
  if (cell.kind === 'one') return [cell.issueId]
  return cell.issueIds
}

function view(over: Partial<ViewSettings> = {}): ViewSettings {
  return { ...DEFAULT_VIEW, ...over }
}

function workedIssues() {
  return [
    issue({ id: 'U', parentId: null, sortKey: 'a', title: 'Underwriting', fields: { ws: 'vendors' } }),
    issue({
      id: 'U-uk',
      parentId: 'U',
      sortKey: 'a',
      title: 'Underwriting',
      status: 'in_progress',
      due: '2027-02-01',
      fields: { ws: 'vendors', country: 'uk' },
    }),
    issue({
      id: 'T1',
      parentId: 'U-uk',
      sortKey: 'a',
      title: 'Send RFP',
      status: 'done',
      fields: { ws: 'vendors', country: 'uk' },
    }),
    issue({
      id: 'T2',
      parentId: 'U-uk',
      sortKey: 'b',
      title: 'Chase',
      status: 'blocked',
      due: '2026-01-01',
      fields: { ws: 'vendors', country: 'uk' },
    }),
    issue({
      id: 'U-fr',
      parentId: 'U',
      sortKey: 'b',
      title: 'Underwriting',
      status: 'todo',
      fields: { ws: 'vendors', country: 'fr' },
    }),
    issue({
      id: 'U-sg',
      parentId: 'U',
      sortKey: 'c',
      title: 'Underwriting',
      status: 'todo',
      fields: { ws: 'vendors', country: 'sg' },
    }),
  ]
}

function workedView(over: Partial<ViewSettings> = {}): ViewSettings {
  return view({
    matrix: {
      ...DEFAULT_MATRIX,
      rowField: 'ws',
      cols: ['country'],
    },
    ...over,
  })
}

function expandedView(expanded: string[], over: Partial<ViewSettings> = {}): ViewSettings {
  return workedView({ matrix: { ...DEFAULT_MATRIX, rowField: 'ws', cols: ['country'], expanded }, ...over })
}

describe('roadmap matrix', () => {
  it('dueQuarter maps ISO dates to UTC calendar quarters', () => {
    expect(dueQuarter('2027-02-01')).toBe('Q1 2027')
    expect(dueQuarter('2026-04-15')).toBe('Q2 2026')
    expect(dueQuarter('2026-12-31')).toBe('Q4 2026')
  })

  it('liveMatrix drops stale fields, pins, and row/col overlap', () => {
    const defs = [countryField, workstream]
    const raw = {
      ...DEFAULT_MATRIX,
      rowField: 'ws',
      cols: ['ws', 'country', 'gone'],
      pins: [
        { fieldId: 'country', optionId: 'sg' },
        { fieldId: 'country', optionId: 'nope' },
        { fieldId: 'gone', optionId: 'x' },
      ],
    }
    expect(liveMatrix(defs, raw)).toEqual({
      ...raw,
      cols: ['country'],
      pins: [{ fieldId: 'country', optionId: 'sg' }],
    })
  })

  it('builds the worked grid with top-most UK cell on U', () => {
    const s = state({ fields: [workstream, countryField] }, workedIssues())
    const { cols, rows } = matrixGrid(s, workedView(), today)
    expect(cols.map((c) => c.parts.map((p) => p.optionId))).toEqual([['uk'], ['fr'], ['sg']])

    const u = rows.find((r) => r.kind === 'issue' && r.issue.id === 'U')
    expect(u?.kind).toBe('issue')
    if (u?.kind !== 'issue') return
    const uk = u.cells[0]
    expect(uk).toEqual({ kind: 'one', issueId: 'U-uk' })
    expect(cellIds(uk)).not.toContain('T1')

    const vendors = rows.find((r) => r.kind === 'group' && r.key === 'vendors')
    expect(vendors?.kind).toBe('group')
    if (vendors?.kind === 'group') {
      expect(vendors.cells[0].issueIds).toEqual(['U-uk'])
      expect(vendors.cells[0].progress).toBeCloseTo(0.5)
    }
  })

  it('opens compact: only top-level rows until a row is expanded, whatever the table has collapsed', () => {
    const s = state({ fields: [workstream, countryField] }, workedIssues())
    const ids = (v: ViewSettings) => matrixGrid(s, v, today).rows.flatMap((r) => (r.kind === 'issue' ? [r.issue.id] : []))
    expect(ids(workedView())).toEqual(['U'])
    expect(ids(workedView({ collapsed: ['U'] }))).toEqual(['U'])
    expect(ids(expandedView(['U']))).toEqual(['U', 'U-uk', 'U-fr', 'U-sg'])
    const u = matrixGrid(s, workedView(), today).rows.find((r) => r.kind === 'issue')
    if (u?.kind === 'issue') expect([u.hasChildren, u.open]).toEqual([true, false])
  })

  it('a group holding one issue of its own name draws no header above it', () => {
    const issues = workedIssues().map((i) => (i.id === 'U' ? { ...i, title: 'vendors ' } : i))
    const s = state({ fields: [workstream, countryField] }, issues)
    expect(matrixGrid(s, workedView(), today).rows.map((r) => r.kind)).toEqual(['issue'])
    const two = [...issues, issue({ id: 'V', parentId: null, sortKey: 'b', title: 'Other', fields: { ws: 'vendors' } })]
    const kinds = matrixGrid(state({ fields: [workstream, countryField] }, two), workedView(), today).rows.map((r) => r.kind)
    expect(kinds).toEqual(['group', 'issue', 'issue'])
  })

  it('issues with no row value gather under a plainly named last group', () => {
    const issues = [...workedIssues(), issue({ id: 'L', parentId: null, sortKey: 'z', title: 'Loose', fields: { country: 'uk' } })]
    const { rows } = matrixGrid(state({ fields: [workstream, countryField] }, issues), workedView(), today)
    const last = rows.filter((r) => r.kind === 'group').pop()
    expect(last?.kind === 'group' && [last.key, last.label, last.count]).toEqual(['', 'No workstream', 1])
  })

  it('liveMatrix picks fields when none are set: first groups rows, second makes columns; one field makes columns', () => {
    expect(liveMatrix([workstream, countryField], DEFAULT_MATRIX)).toMatchObject({ rowField: 'ws', cols: ['country'] })
    expect(liveMatrix([countryField], DEFAULT_MATRIX)).toMatchObject({ rowField: null, cols: ['country'] })
    expect(liveMatrix([countryField], { ...DEFAULT_MATRIX, rowField: 'country' })).toMatchObject({ rowField: null, cols: ['country'] })
    expect(liveMatrix([workstream, countryField], { ...DEFAULT_MATRIX, cols: ['gone'] })).toMatchObject({ rowField: null, cols: ['ws'] })
    expect(liveMatrix([], DEFAULT_MATRIX)).toMatchObject({ rowField: null, cols: [] })
  })

  it('puts T1 alone in its UK cell when U is expanded', () => {
    const s = state({ fields: [workstream, countryField] }, workedIssues())
    const { rows } = matrixGrid(s, expandedView(['U', 'U-uk']), today)
    const t1 = rows.find((r) => r.kind === 'issue' && r.issue.id === 'T1')
    expect(t1?.kind).toBe('issue')
    if (t1?.kind !== 'issue') return
    expect(t1.cells[0]).toEqual({ kind: 'one', issueId: 'T1' })
    const u = rows.find((r) => r.kind === 'issue' && r.issue.id === 'U')
    if (u?.kind === 'issue') expect(cellIds(u.cells[0])).toEqual(['U-uk'])
  })

  it('blocked filter shows T2 on dim U and drops empty country rows', () => {
    const s = state({ fields: [workstream, countryField] }, workedIssues())
    const chips: ViewSettings['chips'] = [{ on: 'status', is: true, values: ['blocked'] }]
    const compact = matrixGrid(s, workedView({ chips }), today)
    expect(compact.rows.flatMap((r) => (r.kind === 'issue' ? [r.issue.id] : []))).toEqual(['U'])
    const grid = matrixGrid(s, expandedView(['U', 'U-uk'], { chips }), today)
    expect(grid.cols.map((c) => c.parts[0]?.optionId)).toEqual(['uk'])
    const ids = grid.rows.filter((r) => r.kind === 'issue').map((r) => (r.kind === 'issue' ? r.issue.id : ''))
    expect(ids).toEqual(['U', 'U-uk', 'T2'])
    const u = grid.rows.find((r) => r.kind === 'issue' && r.issue.id === 'U')
    if (u?.kind === 'issue') {
      expect(u.dim).toBe(true)
      expect(cellIds(u.cells[0])).toEqual(['T2'])
    }
  })

  it('pinned empty country columns survive a filter', () => {
    const s = state({ fields: [workstream, countryField] }, workedIssues())
    const grid = matrixGrid(
      s,
      workedView({
        chips: [{ on: 'status', is: true, values: ['blocked'] }],
        matrix: {
          ...DEFAULT_MATRIX,
          rowField: 'ws',
          cols: ['country'],
          pins: [{ fieldId: 'country', optionId: 'fr' }],
        },
      }),
      today,
    )
    expect(grid.cols.map((c) => c.parts[0]?.optionId)).toEqual(['uk', 'fr'])
    const u = grid.rows.find((r) => r.kind === 'issue' && r.issue.id === 'U')
    if (u?.kind === 'issue') expect(u.cells[1]?.kind).toBe('empty')
  })

  it('collapse does not change cell ids on U', () => {
    const s = state({ fields: [workstream, countryField] }, workedIssues())
    const open = matrixGrid(s, expandedView(['U']), today)
    const shut = matrixGrid(s, workedView(), today)
    const uOpen = open.rows.find((r) => r.kind === 'issue' && r.issue.id === 'U')
    const uShut = shut.rows.find((r) => r.kind === 'issue' && r.issue.id === 'U')
    if (uOpen?.kind === 'issue' && uShut?.kind === 'issue') {
      expect(cellIds(uOpen.cells[0])).toEqual(cellIds(uShut.cells[0]))
    }
  })

  it('in_progress chip dims parent and puts the country issue in the UK cell', () => {
    const s = state({ fields: [workstream, countryField] }, workedIssues())
    const grid = matrixGrid(
      s,
      workedView({ chips: [{ on: 'status', is: true, values: ['in_progress'] }] }),
      today,
    )
    const u = grid.rows.find((r) => r.kind === 'issue' && r.issue.id === 'U')
    expect(u?.kind).toBe('issue')
    if (u?.kind !== 'issue') return
    expect(u.dim).toBe(true)
    expect(cellIds(u.cells[0])).toEqual(['U-uk'])
    const open = matrixGrid(s, expandedView(['U'], { chips: [{ on: 'status', is: true, values: ['in_progress'] }] }), today)
    const uk = open.rows.find((r) => r.kind === 'issue' && r.issue.id === 'U-uk')
    expect(uk?.kind === 'issue' && cellIds(uk.cells[0])).toEqual(['U-uk'])
  })

  it('in_progress chip keeps group progress on leaves the chip hides', () => {
    const s = state({ fields: [workstream, countryField] }, workedIssues())
    const grid = matrixGrid(
      s,
      workedView({ chips: [{ on: 'status', is: true, values: ['in_progress'] }] }),
      today,
    )
    const vendors = grid.rows.find((r) => r.kind === 'group' && r.key === 'vendors')
    expect(vendors?.kind).toBe('group')
    if (vendors?.kind === 'group') {
      expect(vendors.cells[0].issueIds).toEqual(['U-uk'])
      expect(vendors.cells[0].progress).toBeCloseTo(0.5)
      expect(progressUnder(s.issues, vendors.cells[0].issueIds)).toBeCloseTo(0.5)
    }
  })

  it('two-field columns list used pairs only, not the full cartesian', () => {
    const issues = [
      issue({ id: 'h1', fields: { card: 'debit', account: 'retail' }, sortKey: 'a' }),
      issue({ id: 'h2', fields: { card: 'credit', account: 'retail' }, sortKey: 'b' }),
    ]
    const s = state({ fields: [cardField, accountField] }, issues)
    const grid = matrixGrid(
      s,
      view({
        matrix: {
          ...DEFAULT_MATRIX,
          cols: ['card', 'account'],
          pins: [],
        },
      }),
      today,
    )
    const keys = grid.cols.map((c) => c.parts.map((p) => p.optionId).join('×'))
    expect(keys).toEqual(['debit×retail', 'credit×retail'])
    expect(grid.cols).toHaveLength(2)
  })

  it('two-field columns cross pins with used options only', () => {
    const issues = [
      issue({ id: 'h1', fields: { card: 'debit', account: 'retail' }, sortKey: 'a' }),
      issue({ id: 'h2', fields: { card: 'credit', account: 'retail' }, sortKey: 'b' }),
    ]
    const s = state({ fields: [cardField, accountField] }, issues)
    const grid = matrixGrid(
      s,
      view({
        matrix: {
          ...DEFAULT_MATRIX,
          cols: ['card', 'account'],
          pins: [{ fieldId: 'account', optionId: 'biz' }],
        },
      }),
      today,
    )
    const keys = grid.cols.map((c) => c.parts.map((p) => p.optionId).join('×'))
    expect(keys).toEqual(['debit×retail', 'debit×biz', 'credit×retail', 'credit×biz'])
    expect(keys).not.toContain('debit×retail'.replace('retail', 'bogus'))
  })

  it('pin on one field alone does not invent columns until the other field has use or pin', () => {
    const issues = [issue({ id: 'bare', sortKey: 'a' })]
    const s = state({ fields: [cardField, accountField] }, issues)
    const grid = matrixGrid(
      s,
      view({
        matrix: {
          ...DEFAULT_MATRIX,
          cols: ['card', 'account'],
          pins: [{ fieldId: 'account', optionId: 'biz' }],
        },
      }),
      today,
    )
    expect(grid.cols).toEqual([])
  })

  it('group progress pools leaves via progressUnder', () => {
    const issues = workedIssues()
    const s = state({ fields: [workstream, countryField] }, issues)
    const grid = matrixGrid(s, workedView(), today)
    const vendors = grid.rows.find((r) => r.kind === 'group' && r.key === 'vendors')
    expect(vendors?.kind).toBe('group')
    if (vendors?.kind === 'group') {
      expect(progressUnder(issues, vendors.cells[0].issueIds)).toBeCloseTo(0.5)
    }
  })

  it('any field can make rows and columns: one line per value in use, numbers by size, people by name', () => {
    const owner: FieldDef = { id: 'owner', name: 'Owner', type: 'person' }
    const wave: FieldDef = { id: 'wave', name: 'Wave', type: 'number' }
    const issues = [
      issue({ id: 'a', number: 1, fields: { owner: 'u2', wave: 10 } }),
      issue({ id: 'b', number: 2, sortKey: 'b', fields: { owner: 'u1', wave: 2 } }),
      issue({ id: 'c', number: 3, sortKey: 'c', fields: { wave: 2 } }),
    ]
    const view: ViewSettings = { ...DEFAULT_VIEW, layout: 'matrix', matrix: { ...DEFAULT_MATRIX, rowField: 'owner', cols: ['wave'] } }
    const grid = matrixGrid(state({ fields: [owner, wave] }, issues), view, today, { names: new Map([['u1', 'Ana'], ['u2', 'Bo']]) })
    expect(grid.cols.map((c) => c.parts[0].name)).toEqual(['2', '10'])
    expect(grid.rows.filter((r) => r.kind === 'group').map((r) => r.kind === 'group' && r.label)).toEqual(['Ana', 'Bo', 'No owner'])
    const a = grid.rows.find((r) => r.kind === 'issue' && r.issue.id === 'a')
    expect(a?.cells).toEqual([{ kind: 'empty' }, { kind: 'one', issueId: 'a' }])
  })

  it('with no choice field, liveMatrix still picks a column field', () => {
    expect(liveMatrix([{ id: 'note', name: 'Note', type: 'text' }], DEFAULT_MATRIX)).toMatchObject({ rowField: null, cols: ['note'] })
  })
})
