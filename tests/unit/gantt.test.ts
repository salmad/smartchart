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
  expect(apply(G, g.moveRow(0, 1)).rows?.map((r) => r.label)).toEqual(['Launch', 'Build'])
  expect(g.removeRow(0)).toBeNull()                     // two workstreams is the minimum
  const three = { ...G, chart: { ...chartOf(G), rows: [...(chartOf(G).rows ?? []), { label: 'EU', start: 0, end: 0 }] } }
  expect(apply(three, ganttFor(three, 'consulting').removeRow(1)).rows?.map((r) => r.label)).toEqual(['Build', 'EU'])
  expect(apply(G, g.insertMilestone()).milestones?.length).toBe(2)
  expect(apply(G, g.removeMilestone(0)).milestones).toBeUndefined()
})
