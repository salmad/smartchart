import { test, expect } from 'vitest'
import { flowHTML, innerKind } from '@/engine/components/flow'
import type { Flow } from '@/engine/types'

const g = (f: (r: number, c: number) => number) => [0, 1, 2, 3, 4].map((r) => [0, 1, 2, 3, 4].map((c) => f(r, c)))
const S3: Flow = { tiers: [
  { boxes: ['Accounts', 'Age', 'Industry', 'Directors', 'Web presence', 'Web traffic'].map((text) => ({ text })) },
  { boxes: [{ text: 'Acquisition engine scores every company' }], tone: 'strong' },
  { boxes: [{ text: 'Will they activate?' }, { text: 'What are they worth?' }], tone: 'light' },
  { boxes: [{ text: 'Predicted payback sets the ranking' }], tone: 'outline' },
  { boxes: [{ text: 'Direct mail' }, { text: 'Outbound sales' }], label: 'Feeds' },
] }
const S4: Flow = { tiers: [
  { boxes: [{ label: 'Take-up', grid: g((r, c) => 50 - c * 9 + r * 4) }, { label: 'Balance', grid: g((r) => 10 + r * 10) }, { label: 'Losses', grid: g((r, c) => 5 + r * 3 + c * 2) }], op: '·' },
  { boxes: [{ text: 'Expected profit for every limit and price' }], tone: 'strong' },
] }

test('one arrow between tiers, none before the first', () => {
  const h = flowHTML(S3, 'flow')
  expect(h.match(/class="fl-arrow"/g)?.length).toBe(4)
  expect(h.indexOf('fl-arrow')).toBeGreaterThan(h.indexOf('fl-tier'))
})

test('operators sit between boxes of a tier', () => {
  const h = flowHTML(S4, 'flow')
  expect(h.match(/<span class="fl-op" aria-hidden="true">·<\/span>/g)?.length).toBe(2)
  expect(flowHTML(S3, 'flow')).not.toContain('fl-op')
})

test('six text boxes in a tier render as chips in three columns', () => {
  const h = flowHTML(S3, 'flow')
  expect(h).toContain('<div class="fl-tier chips" style="--n:3"')
  expect(h).toContain('<div class="fl-tier t-light" style="--n:2"')
})

test('a grid box renders 25 cells with heat classes from heatSteps, each grid on its own scale (its own measure)', () => {
  const h = flowHTML(S4, 'flow')
  expect(h.match(/<div class="mini"/g)?.length).toBe(3)
  expect(h.match(/<i class="h\d"><\/i>/g)?.length).toBe(75)
  expect(h).toContain('<i class="h5"></i>')
  expect(innerKind({ label: 'x', grid: [[1]] })).toBe('grid')
  expect(innerKind({ text: 'x' })).toBe('text')
})

test('every text has its data-path, and tiers and boxes are items', () => {
  const h = flowHTML(S3, 'flow') + flowHTML(S4, 'flow')
  expect(h).toContain('data-path="flow.tiers[0].boxes[5].text" data-kind="md">Web traffic<')
  expect(h).toContain('data-path="flow.tiers[4].label" data-kind="esc">Feeds<')
  expect(h).toContain('data-path="flow.tiers[0].boxes[0].label" data-kind="esc">Take-up<')
  expect(h).toContain('data-item="flow.tiers[1]"')
  expect(h).toContain('data-item="flow.tiers[1].boxes[0]"')
})

test('box text takes the inline markup', () => {
  expect(flowHTML({ tiers: [{ boxes: [{ text: 'Scores **every** company' }] }, { boxes: [{ text: 'b' }] }] }, 'flow')).toContain('Scores <strong>every</strong> company')
})
