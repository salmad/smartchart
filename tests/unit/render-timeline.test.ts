// @vitest-environment jsdom
import { test, expect } from 'vitest'
import { allocate } from '@/engine/slides/colours'
import { barTone, timelineChart } from '@/engine/slides/charts/chart-timeline'
import { timelineLines } from '@/engine/slides/charts/timeline-rows'
import type { Chart, Slide } from '@/engine/types'

const grouped: Chart = { kind: 'timeline', periods: ['Q1', 'Q2', 'Q3', 'Q4'], rows: [
  { label: 'Platform' }, { label: 'API', level: 1, start: 0, end: 1 }, { label: 'UI', level: 1, start: 1, end: 3 },
  { label: 'Launch', start: 3, end: 3 }], milestones: [{ label: 'Beta', at: 1 }] }
const plain: Chart = { kind: 'timeline', periods: ['Q1', 'Q2', 'Q3'], rows: [{ label: 'A', start: 0, end: 1 }, { label: 'B', start: 1, end: 2, focus: true }] }

test('colour follows level only when there are sub-rows; a flat chart keeps its greys and its focus', () => {
  const g = timelineLines(grouped.rows ?? []), p = timelineLines(plain.rows ?? [])
  expect(g.map((l) => barTone(l, true))).toEqual(['ctx1', 'ctx3', 'ctx3', 'ctx1'])
  expect(p.map((l) => barTone(l, false))).toEqual(['quiet', 'focus'])
})

test('a group is a bracket over its children and a child label is indented', () => {
  const box = document.createElement('div'); document.body.append(box)
  timelineChart(box, grouped, 1600, 800)
  expect(box.querySelectorAll('.tl-group').length).toBe(3)       // the bar and its two end caps
  expect(box.querySelector('.row-lbl.group')?.textContent).toBe('Platform')
  expect(box.querySelectorAll('.row-lbl.child').length).toBe(2)
  expect(box.querySelectorAll('.tl-bar.c-ctx3').length).toBe(2)
})

test('a chart without sub-rows draws as it did', () => {
  const box = document.createElement('div'); document.body.append(box)
  timelineChart(box, plain, 1600, 800)
  expect([...box.querySelectorAll('.tl-bar')].map((b) => b.getAttribute('class'))).toEqual(['tl-bar c-quiet', 'tl-bar c-focus'])
})

test('the allocator accepts the greys in every theme', () => {
  const s: Slide = { template: 'chart', title: 'T', chart: grouped }
  for (const theme of ['ink', 'paper'] as const) expect(() => allocate(s, theme)).not.toThrow()
})
