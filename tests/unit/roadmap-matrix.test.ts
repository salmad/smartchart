import { describe, expect, it } from 'vitest'
import {
  cellWorst,
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

  it('puts T1 alone in its UK cell when U is expanded', () => {
    const s = state({ fields: [workstream, countryField] }, workedIssues())
    const { rows } = matrixGrid(s, workedView({ collapsed: [] }), today)
    const t1 = rows.find((r) => r.kind === 'issue' && r.issue.id === 'T1')
    expect(t1?.kind).toBe('issue')
    if (t1?.kind !== 'issue') return
    expect(t1.cells[0]).toEqual({ kind: 'one', issueId: 'T1' })
    const u = rows.find((r) => r.kind === 'issue' && r.issue.id === 'U')
    if (u?.kind === 'issue') expect(cellIds(u.cells[0])).toEqual(['U-uk'])
  })

  it('blocked filter shows T2 on dim U and drops empty country rows', () => {
    const s = state({ fields: [workstream, countryField] }, workedIssues())
    const grid = matrixGrid(
      s,
      workedView({ chips: [{ on: 'status', is: true, values: ['blocked'] }] }),
      today,
    )
    expect(grid.cols.map((c) => c.parts[0]?.optionId)).toEqual(['uk'])
    const ids = grid.rows.filter((r) => r.kind === 'issue').map((r) => (r.kind === 'issue' ? r.issue.id : ''))
    expect(ids).toEqual(['U', 'U-uk', 'T2'])
    const u = grid.rows.find((r) => r.kind === 'issue' && r.issue.id === 'U')
    if (u?.kind === 'issue') {
      expect(u.dim).toBe(true)
      expect(cellIds(u.cells[0])).toEqual(['T2'])
      expect(cellWorst(s.issues, ['T2'], today)).toBe(true)
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
    const open = matrixGrid(s, workedView({ collapsed: [] }), today)
    const shut = matrixGrid(s, workedView({ collapsed: ['U'] }), today)
    const uOpen = open.rows.find((r) => r.kind === 'issue' && r.issue.id === 'U')
    const uShut = shut.rows.find((r) => r.kind === 'issue' && r.issue.id === 'U')
    if (uOpen?.kind === 'issue' && uShut?.kind === 'issue') {
      expect(cellIds(uOpen.cells[0])).toEqual(cellIds(uShut.cells[0]))
    }
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
    const grid = matrixGrid(s, workedView({ collapsed: ['U'] }), today)
    const vendors = grid.rows.find((r) => r.kind === 'group' && r.key === 'vendors')
    expect(vendors?.kind).toBe('group')
    if (vendors?.kind === 'group') {
      expect(progressUnder(issues, vendors.cells[0].issueIds)).toBeCloseTo(0.5)
    }
  })
})
