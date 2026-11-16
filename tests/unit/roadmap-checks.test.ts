import { describe, expect, it } from 'vitest'
import { issueFailsCheck, runChecks, CHECK_THRESHOLDS } from '../../src/engine/roadmaps/checks'
import { buildIndex } from '../../src/engine/roadmaps/index'
import { tableRows } from '../../src/engine/roadmaps/view'
import type { ViewSettings } from '../../src/engine/roadmaps/view'
import { issue, state } from './roadmap-builders'

const today = '2026-06-15'
const idx = (issues: ReturnType<typeof issue>[]) => buildIndex(issues)

describe('runChecks', () => {
  it('overdue matches tableRows overdue chip', () => {
    const issues = [
      issue({ id: 'a', due: '2026-06-14', status: 'todo' }),
      issue({ id: 'b', due: '2026-06-15', status: 'todo' }),
      issue({ id: 'c', due: '2026-06-14', status: 'done' }),
    ]
    const report = runChecks(issues, { today })
    expect(report.cards.find((c) => c.id === 'overdue')?.issueIds).toEqual(['a'])
    const rows = tableRows(state({}, issues), { ...baseView(), chips: [{ on: 'dates', when: 'overdue' }] }, today)
    const ids = rows
      .filter((r): r is Extract<(typeof rows)[number], { kind: 'issue' }> => r.kind === 'issue' && !r.dim)
      .map((r) => r.issue.id)
    expect(ids).toEqual(['a'])
  })

  it('counts each alarmed issue once, and no advisory ones', () => {
    const issues = [
      issue({ id: 'x', status: 'blocked', due: '2026-06-01', start: '2026-05-01', assignee: 'bob' }),
    ]
    const report = runChecks([...issues, issue({ id: 'y', status: 'todo', start: null, due: null, assignee: null })], { today })
    expect(report.alarms).toBe(1)
    expect(report.cards.find((c) => c.id === 'no_assignee')?.issueIds).toEqual(['y'])
    expect(report.cards.find((c) => c.id === 'blocked')?.count).toBe(1)
    expect(report.cards.find((c) => c.id === 'overdue')?.count).toBe(1)
    expect(report.cards.filter((c) => c.id === 'blocked' || c.id === 'overdue').reduce((s, c) => s + c.count, 0)).toBe(2)
  })

  it('ignores check chip in opts when counting', () => {
    const issues = [issue({ id: 'a', due: '2026-06-01', status: 'todo' })]
    const plain = runChecks(issues, { today })
    const withChip = runChecks(issues, { today, chips: [{ on: 'check', id: 'overdue' }] })
    expect(withChip).toEqual(plain)
  })

  it('field chip AND narrows card counts', () => {
    const issues = [
      issue({ id: 'a', due: '2026-06-01', status: 'todo', fields: { f1: 'uk' } }),
      issue({ id: 'b', due: '2026-06-01', status: 'todo', fields: { f1: 'fr' } }),
    ]
    const all = runChecks(issues, { today })
    expect(all.cards.find((c) => c.id === 'overdue')?.count).toBe(2)
    const uk = runChecks(issues, {
      today,
      chips: [{ on: 'field', field: 'f1', is: true, values: ['uk'] }],
    })
    expect(uk.cards.find((c) => c.id === 'overdue')?.count).toBe(1)
  })
})

describe('issueFailsCheck', () => {
  it('long boundary 92 vs 93 days', () => {
    const quiet = issue({ id: 'q', start: '2025-01-01', due: '2025-04-03', status: 'todo' })
    const fire = issue({ id: 'f', start: '2025-01-01', due: '2025-04-04', status: 'todo' })
    expect(daySpan(quiet)).toBe(CHECK_THRESHOLDS.longDays)
    expect(issueFailsCheck('long', quiet, idx([quiet]), today)).toBe(false)
    expect(issueFailsCheck('long', fire, idx([fire]), today)).toBe(true)
  })

  it('no dates: open leaf only', () => {
    const parent = issue({ id: 'p', status: 'todo' })
    const child = issue({ id: 'c', parentId: 'p', status: 'todo', due: '2026-07-01' })
    const i = idx([parent, child])
    expect(issueFailsCheck('no_dates', parent, i, today)).toBe(false)
    const leaf = issue({ id: 'l', status: 'todo' })
    expect(issueFailsCheck('no_dates', leaf, idx([leaf]), today)).toBe(true)
  })

  it('done_open walks descendants', () => {
    const p = issue({ id: 'p', status: 'done' })
    const c = issue({ id: 'c', parentId: 'p', status: 'todo' })
    expect(issueFailsCheck('done_open', p, idx([p, c]), today)).toBe(true)
    const cancelled = issue({ id: 'x', parentId: 'p', status: 'cancelled' })
    expect(issueFailsCheck('done_open', p, idx([p, cancelled]), today)).toBe(false)
  })

  it('outside_parent uses own parent dates only', () => {
    const p = issue({ id: 'p', start: '2026-03-01', due: '2026-06-30' })
    const ok = issue({ id: 'ok', parentId: 'p', start: '2026-03-01', due: '2026-06-30' })
    const bad = issue({ id: 'bad', parentId: 'p', start: '2026-02-01', due: '2026-06-30' })
    const i = idx([p, ok, bad])
    expect(issueFailsCheck('outside_parent', ok, i, today)).toBe(false)
    expect(issueFailsCheck('outside_parent', bad, i, today)).toBe(true)
    expect(issueFailsCheck('outside_parent', { ...bad, status: 'cancelled' }, i, today)).toBe(false)
  })
})

function daySpan(row: ReturnType<typeof issue>): number {
  if (!row.start || !row.due) return -1
  const a = Date.parse(`${row.start}T00:00:00Z`)
  const b = Date.parse(`${row.due}T00:00:00Z`)
  return Math.floor((b - a) / 86_400_000)
}

function baseView(): ViewSettings {
  return {
    chips: [],
    groupBy: [],
    folded: [],
    sort: 'order',
    columns: ['status'],
    collapsed: [],
    layout: 'table',
    scale: 'month',
    matrix: { expanded: [], foldedCols: [], cols: [], pins: [], show: { progress: true, dates: true, assignee: false } },
  }
}
