import { describe, expect, it } from 'vitest'
import { sprintCandidates, sprintRows, type SprintRow } from '../../src/engine/roadmaps/sprintView'
import { sprintAt } from '../../src/engine/roadmaps/sprints'
import type { ViewFilter } from '../../src/engine/roadmaps/view'
import { issue, state } from './roadmap-builders'

const rhythm = { start: '2026-11-02', weeks: 2, rolled: null }
const sprint = sprintAt(rhythm, 2) as NonNullable<ReturnType<typeof sprintAt>>
const IN = '2026-11-16'
const names = new Map([['ann', 'Ann'], ['bob', 'Bob'], ['zed', 'Zed']])
const opts = { me: 'zed', today: '2026-11-17', filters: [] as ViewFilter[], folded: [] as string[], names }

const rows = (issues: ReturnType<typeof issue>[], over: Partial<typeof opts> = {}) =>
  sprintRows(state({ sprints: rhythm }, issues), sprint, { ...opts, ...over })
const ids = (r: SprintRow[]) => r.map((x) => (x.kind === 'group' ? `[${x.label}]` : x.issue.id))

describe('sprintRows', () => {
  it('lists only live leaves that are open and in the sprint', () => {
    const r = rows([
      issue({ id: 'p', sprint: IN }),
      issue({ id: 'c', parentId: 'p', sprint: IN }),
      issue({ id: 'lone', sprint: IN }),
      issue({ id: 'orphaned', sprint: IN }),
      issue({ id: 'gone', parentId: 'orphaned', sprint: IN, deletedAt: 5 }),
      issue({ id: 'done', status: 'done', sprint: IN }),
      issue({ id: 'bl', status: 'backlog', sprint: IN }),
      issue({ id: 'x', status: 'cancelled', sprint: IN }),
      issue({ id: 'earlier', sprint: '2026-11-02' }),
      issue({ id: 'later', sprint: '2026-11-30' }),
      issue({ id: 'none' }),
      issue({ id: 'dead', sprint: IN, deletedAt: 5 }),
    ])
    expect(ids(r).filter((x) => !x.startsWith('['))).toEqual(['c', 'lone', 'orphaned'])
  })

  it('puts my group first, the others by name, Unassigned last', () => {
    const r = rows([
      issue({ id: 'u', sprint: IN }),
      issue({ id: 'b', assignee: 'bob', sprint: IN }),
      issue({ id: 'z', assignee: 'zed', sprint: IN }),
      issue({ id: 'a', assignee: 'ann', sprint: IN }),
    ])
    expect(ids(r)).toEqual(['[Zed]', 'z', '[Ann]', 'a', '[Bob]', 'b', '[Unassigned]', 'u'])
    expect(r[0]).toMatchObject({ kind: 'group', mine: true, count: 1, key: 'sprint/zed' })
    expect(r[6]).toMatchObject({ key: 'sprint/none', assignee: null, mine: false })
  })

  it('orders a group Blocked, In progress, To do, then by due date (none last), then tree order', () => {
    const r = rows([
      issue({ id: 't1', assignee: 'ann', sprint: IN }),
      issue({ id: 't2', assignee: 'ann', sprint: IN, due: '2026-11-20' }),
      issue({ id: 'p', assignee: 'ann', sprint: IN, status: 'in_progress' }),
      issue({ id: 'b', assignee: 'ann', sprint: IN, status: 'blocked', due: '2026-11-25' }),
      issue({ id: 't3', assignee: 'ann', sprint: IN, due: '2026-11-19' }),
    ])
    expect(ids(r)).toEqual(['[Ann]', 'b', 'p', 't3', 't2', 't1'])
  })

  it('shows the parent title and the carried flag', () => {
    const r = rows([
      issue({ id: 'p', title: 'Launch', sprint: null }),
      issue({ id: 'c', parentId: 'p', sprint: IN, carried: 2 }),
    ])
    expect(r[1]).toMatchObject({ kind: 'issue', parentTitle: 'Launch', carried: true })
    expect(rows([issue({ id: 'a', sprint: IN })])[1]).toMatchObject({ parentTitle: null, carried: false })
  })

  it('keeps a folded group and its count but hides its issues', () => {
    const r = rows([issue({ id: 'a', assignee: 'ann', sprint: IN }), issue({ id: 'b', assignee: 'ann', sprint: IN })], { folded: ['sprint/ann'] })
    expect(r).toEqual([expect.objectContaining({ kind: 'group', count: 2, open: false })])
  })

  it('applies filters and search on top', () => {
    const issues = [issue({ id: 'a', title: 'Draft memo', assignee: 'ann', sprint: IN }), issue({ id: 'b', title: 'Book room', assignee: 'bob', sprint: IN })]
    const r = rows(issues, { filters: [{ on: 'name', matches: (t: string) => t.includes('memo') }] })
    expect(ids(r)).toEqual(['[Ann]', 'a'])
    const byAssignee = rows(issues, { filters: [{ on: 'assignee', is: true, values: ['bob'] }] })
    expect(ids(byAssignee)).toEqual(['[Bob]', 'b'])
  })

  it('labels a person the workspace no longer lists by their id, as the table does', () => {
    expect(ids(rows([issue({ id: 'a', assignee: 'gone', sprint: IN })]))).toEqual(['[gone]', 'a'])
  })

  it('lists nothing for issues saved before sprints existed', () => {
    const old = issue({ id: 'old', assignee: 'ann' }) as Partial<ReturnType<typeof issue>>
    delete old.sprint
    delete old.carried
    expect(rows([old as ReturnType<typeof issue>])).toEqual([])
  })

  it('is empty when nothing is in the sprint', () => {
    expect(rows([])).toEqual([])
  })
})

describe('sprintCandidates', () => {
  it('offers open live leaves not already in the sprint, in tree order', () => {
    const s = state({ sprints: rhythm }, [
      issue({ id: 'p' }),
      issue({ id: 'c', parentId: 'p' }),
      issue({ id: 'bl', status: 'backlog' }),
      issue({ id: 'in', sprint: IN }),
      issue({ id: 'later', sprint: '2026-11-30', status: 'in_progress' }),
      issue({ id: 'done', status: 'done' }),
      issue({ id: 'x', status: 'cancelled' }),
      issue({ id: 'dead', deletedAt: 5 }),
    ])
    expect(sprintCandidates(s, sprint).map((i) => i.id)).toEqual(['c', 'bl', 'later'])
  })
})
