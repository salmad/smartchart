import { test, expect } from 'vitest'
import { applyPatch } from '@/engine/agent/patch'
import { ganttFor } from '@/engine/slides/gantt'
import type { Slide } from '@/engine/types'

const must = <T>(v: T | null | undefined): T => { if (v === null || v === undefined) throw new Error('missing'); return v }
const chartOf = (s: Slide) => must(s.chart)
const G: Slide = { template: 'chart', title: 'T', chart: { kind: 'timeline', periods: ['Q1', 'Q2', 'Q3', 'Q4'], rows: [{ label: 'Build', start: 0, end: 1 }, { label: 'Launch', start: 2, end: 3, focus: true }], milestones: [{ label: 'Go', at: 3 }] } }
const g = ganttFor(G, 'consulting')
const apply = (s: Slide, p: Record<string, unknown> | null) => must(must(applyPatch(s, must(p)).slide).chart)

test('painting a bar sets start and end together, whichever way it is dragged', () => {
  expect(apply(G, g.setBar(0, 1, 3)).rows?.[0]).toMatchObject({ label: 'Build', start: 1, end: 3 })
  expect(apply(G, g.setBar(0, 3, 1)).rows?.[0]).toMatchObject({ start: 1, end: 3 })
  expect(apply(G, g.setBar(1, 0, 0)).rows?.[1]).toMatchObject({ focus: true, start: 0, end: 0 })
})

test('a milestone moves to a period', () => {
  expect(apply(G, g.setMilestone(0, 1)).milestones).toEqual([{ label: 'Go', at: 1 }])
})

test('inserting a period shifts what lies after it and stretches a bar across it', () => {
  const c = apply(G, g.insertPeriod(2))
  expect(c.periods).toEqual(['Q1', 'Q2', '', 'Q3', 'Q4'])
  expect(c.rows?.map((r) => [r.start, r.end])).toEqual([[0, 1], [3, 4]])
  expect(c.milestones?.[0].at).toBe(4)
  expect(apply(G, g.insertPeriod(1)).rows?.[0]).toMatchObject({ start: 0, end: 2 })   // Build spans Q1–Q2: it grows
})

test('removing a period clamps bars and milestones into range; the minimum and maximum hold', () => {
  const c = apply(G, g.removePeriod(3))
  expect(c.periods).toEqual(['Q1', 'Q2', 'Q3'])
  expect(c.rows?.map((r) => [r.start, r.end])).toEqual([[0, 1], [2, 2]])
  expect(c.milestones?.[0].at).toBe(2)
  const two = ganttFor({ ...G, chart: { ...chartOf(G), periods: ['a', 'b'], rows: [{ label: 'x', start: 0, end: 1 }], milestones: [] } }, 'consulting')
  expect(two.removePeriod(0)).toBeNull()
})

test('workstreams and milestones are added, moved and removed within their limits', () => {
  expect(apply(G, g.insertRow(1)).rows?.map((r) => r.label)).toEqual(['Build', '', 'Launch'])
  expect(apply(G, g.place(0, 2, 0)).rows?.map((r) => r.label)).toEqual(['Launch', 'Build'])
  expect(g.removeRow(0)).toBeNull()                     // two workstreams is the minimum
  const three = { ...G, chart: { ...chartOf(G), rows: [...(chartOf(G).rows ?? []), { label: 'EU', start: 0, end: 0 }] } }
  expect(apply(three, ganttFor(three, 'consulting').removeRow(1)).rows?.map((r) => r.label)).toEqual(['Build', 'EU'])
  expect(apply(G, g.insertMilestone()).milestones?.length).toBe(2)
  expect(apply(G, g.removeMilestone(0)).milestones).toBeUndefined()
})

const GR: Slide = { template: 'chart', title: 'T', chart: { kind: 'timeline', periods: ['Q1', 'Q2', 'Q3', 'Q4'], rows: [
  { label: 'Platform' }, { label: 'API', level: 1, start: 0, end: 1 }, { label: 'UI', level: 1, start: 2, end: 3 }, { label: 'Launch', start: 3, end: 3 }], milestones: [] } }
const gg = ganttFor(GR, 'consulting')
const labels = (c: ReturnType<typeof chartOf>) => c.rows?.map((r) => `${r.level === 1 ? '  ' : ''}${r.label}`)

test('a sub-row is added at the end of its group, and indent makes a row a child', () => {
  expect(labels(apply(GR, gg.addSubRow(0)))).toEqual(['Platform', '  API', '  UI', '  ', 'Launch'])
  const c = apply(GR, gg.indent(3))
  expect(labels(c)).toEqual(['Platform', '  API', '  UI', '  Launch'])
  expect(c.rows?.[3]).toMatchObject({ level: 1, start: 3, end: 3 })
  expect(gg.indent(0)).toBeNull()              // nothing above to belong to
})

test('indent under a plain row turns it into a group and drops its own dates', () => {
  const flat: Slide = { ...GR, chart: { ...chartOf(GR), rows: [{ label: 'A', start: 0, end: 1 }, { label: 'B', start: 2, end: 3 }] } }
  const c = apply(flat, ganttFor(flat, 'consulting').indent(1))
  expect(c.rows?.[0]).toEqual({ label: 'A' })
  expect(c.rows?.[1]).toMatchObject({ level: 1, start: 2, end: 3 })
})

test('outdent moves a child after its group, keeping its siblings', () => {
  const c = apply(GR, gg.outdent(1))
  expect(labels(c)).toEqual(['Platform', '  UI', 'API', 'Launch'])
  expect(c.rows?.[2]).toEqual({ label: 'API', start: 0, end: 1 })
})

test('the last child leaving turns the group back into a plain row with its old span', () => {
  const one: Slide = { ...GR, chart: { ...chartOf(GR), rows: [{ label: 'Platform' }, { label: 'API', level: 1, start: 1, end: 2 }, { label: 'Launch', start: 3, end: 3 }] } }
  const c = apply(one, ganttFor(one, 'consulting').outdent(1))
  expect(c.rows?.[0]).toEqual({ label: 'Platform', start: 1, end: 2 })
  const d = apply(one, ganttFor(one, 'consulting').removeRow(1))
  expect(d.rows?.[0]).toEqual({ label: 'Platform', start: 1, end: 2 })
})

test('place moves a row, or a whole group, and sets its level', () => {
  expect(labels(apply(GR, gg.place(3, 1, 1)))).toEqual(['Platform', '  Launch', '  API', '  UI'])
  expect(labels(apply(GR, gg.place(0, 4, 0)))).toEqual(['Launch', 'Platform', '  API', '  UI'])   // the group travels with its children
  expect(gg.place(0, 2, 0)).toBeNull()                                                           // not into its own children
  expect(apply(GR, gg.place(1, 0, 1)).rows?.[0]).toMatchObject({ label: 'API', start: 0, end: 1 }) // level 1 at the top becomes 0
})

test('deleting a group lifts its children, or takes them along', () => {
  const lift = apply(GR, gg.removeRow(0))
  expect(labels(lift)).toEqual(['API', 'UI', 'Launch'])
  expect(lift.rows?.[0]).toEqual({ label: 'API', start: 0, end: 1 })
  expect(gg.removeRow(0, true)).toBeNull()      // would leave one workstream: two is the minimum
  const more: Slide = { ...GR, chart: { ...chartOf(GR), rows: [...(chartOf(GR).rows ?? []), { label: 'EU', start: 0, end: 0 }] } }
  expect(labels(apply(more, ganttFor(more, 'consulting').removeRow(0, true)))).toEqual(['Launch', 'EU'])
})

test('a highlight sits on one row at a time, and clears', () => {
  const c = apply(GR, gg.setHighlight(1, true))
  expect(c.rows?.map((r) => r.focus)).toEqual([undefined, true, undefined, undefined])
  const again = { ...GR, chart: c }
  const d = apply(again, ganttFor(again, 'consulting').setHighlight(0, true))   // a group can carry it too
  expect(d.rows?.map((r) => r.focus)).toEqual([true, undefined, undefined, undefined])
  expect(apply(again, ganttFor(again, 'consulting').setHighlight(1, false)).rows?.some((r) => r.focus)).toBe(false)
})

test('periods shift children and skip groups', () => {
  const c = apply(GR, gg.insertPeriod(1))
  expect(c.rows?.[0]).toEqual({ label: 'Platform' })
  expect(c.rows?.map((r) => [r.start, r.end])).toEqual([[undefined, undefined], [0, 2], [3, 4], [4, 4]])
  const d = apply(GR, gg.removePeriod(0))
  expect(d.rows?.[0]).toEqual({ label: 'Platform' })
  expect(d.rows?.slice(1).every((r) => Number.isInteger(r.start) && Number.isInteger(r.end))).toBe(true)
})

test('limits: eight workstreams, twelve lines, six milestones', () => {
  const rows = (n: number, level?: 1) => Array.from({ length: n }, (_, i) => ({ label: `r${i}`, start: 0, end: 1, ...(level ? { level } : {}) }))
  const eight = { ...GR, chart: { ...chartOf(GR), rows: rows(8) } }
  expect(ganttFor(eight, 'consulting').insertRow(8)).toBeNull()
  const twelve = { ...GR, chart: { ...chartOf(GR), rows: [{ label: 'G' }, ...rows(8, 1), ...rows(3)] } }
  expect(ganttFor(twelve, 'consulting').addSubRow(0)).toBeNull()
  const six = { ...GR, chart: { ...chartOf(GR), milestones: Array.from({ length: 6 }, (_, i) => ({ label: `m${i}`, at: 0 })) } }
  expect(ganttFor(six, 'consulting').insertMilestone()).toBeNull()
})
