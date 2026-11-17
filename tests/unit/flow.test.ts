import { test, expect } from 'vitest'
import { flowHTML, innerKind } from '@/engine/components/flow'
import type { Flow } from '@/engine/types'

const g = (f: (r: number, c: number) => number) => [0, 1, 2, 3, 4].map((r) => [0, 1, 2, 3, 4].map((c) => f(r, c)))
const S3: Flow = { tiers: [
  { boxes: ['Team size', 'Role', 'Deck volume', 'Tools today', 'Templates', 'Sign-up page'].map((text) => ({ text })) },
  { boxes: [{ text: 'Occam scores every new team on its fit' }], tone: 'strong' },
  { boxes: [{ text: 'Will the team activate?' }, { text: 'How many seats it buys?' }], tone: 'light' },
  { boxes: [{ text: 'Days to first deck set the order' }], tone: 'outline' },
  { boxes: [{ text: 'Onboarding calls' }, { text: 'Email' }], label: 'Feeds' },
] }
const S4: Flow = { tiers: [
  { boxes: [{ label: 'Take-up', grid: g((r, c) => 50 - c * 9 + r * 4) }, { label: 'Use', grid: g((r) => 10 + r * 10) }, { label: 'AI cost', grid: g((r, c) => 5 + r * 3 + c * 2) }], op: '·' },
  { boxes: [{ text: 'Gross profit for every seat count and price' }], tone: 'strong' },
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
  expect(h).toContain('data-path="flow.tiers[0].boxes[5].text" data-kind="md">Sign-up page<')
  expect(h).toContain('data-path="flow.tiers[4].label" data-kind="esc">Feeds<')
  expect(h).toContain('data-path="flow.tiers[0].boxes[0].label" data-kind="esc">Take-up<')
  expect(h).toContain('data-item="flow.tiers[1]"')
  expect(h).toContain('data-item="flow.tiers[1].boxes[0]"')
})

test('box text takes the inline markup', () => {
  expect(flowHTML({ tiers: [{ boxes: [{ text: 'Scores **every** company' }] }, { boxes: [{ text: 'b' }] }] }, 'flow')).toContain('Scores <strong>every</strong> company')
})

/* ── The flow's fields and limits (schema) ── */
import { validateFlow } from '@/engine/slides/schema'
const S4_FULL: Flow = { tiers: [...S4.tiers, { boxes: [{ text: 'Margin ≥ 70%' }, { text: 'Churn under 3%' }], tone: 'outline', label: 'Tests' }, { boxes: [{ text: 'Most profitable cell that passes' }], tone: 'light' }] }
const errsOf = (f: unknown, style: 'consulting' | 'pitch' = 'consulting') => validateFlow(f, style).errors

test('both sample flows validate in consulting', () => {
  expect(errsOf(S3)).toEqual([])
  expect(errsOf(S4_FULL)).toEqual([])
})

test('in pitch they are refused with their cost in the message; a wrapped box costs a quarter row per extra line', () => {
  // S3: chips 1.2, a 38-character strong box (2 lines) 1.25, a light tier of two 23-character boxes (2 lines) 1.25,
  // an outline box 1, a labelled tier with "Onboarding calls" (2 lines beside its label) 1.25.
  expect(errsOf(S3, 'pitch').some((e) => e.startsWith('flow: this flow costs 5.95') && /4\.5/.test(e))).toBe(true)
  expect(errsOf(S4_FULL, 'pitch').some((e) => e.startsWith('flow: this flow costs 5.1'))).toBe(true)
})

test('a takeaway leaves the flow less room: consulting 6.5 without, 5.5 with', () => {
  expect(validateFlow(S3, 'consulting').errors).toEqual([])
  expect(validateFlow(S3, 'consulting', true).errors.some((e) => e.startsWith('flow: this flow costs 5.95, budget 5.5'))).toBe(true)
  expect(validateFlow(S4_FULL, 'consulting', true).errors).toEqual([])
})

test('a box over its characters is an error naming the path; the limit narrows with the boxes in its tier', () => {
  const t = (boxes: string[]) => ({ tiers: [{ boxes: boxes.map((text) => ({ text })) }, { boxes: [{ text: 'b' }] }] })
  expect(errsOf(t(['x'.repeat(44)]))).toEqual([])
  expect(errsOf(t(['x'.repeat(45)])).some((e) => e.startsWith('flow.tiers[0].boxes[0].text') && /44/.test(e))).toBe(true)
  expect(errsOf(t(['x'.repeat(29), 'y'])).some((e) => e.startsWith('flow.tiers[0].boxes[0].text') && /28/.test(e))).toBe(true)
  expect(errsOf(t(['x'.repeat(17), 'y', 'z'])).some((e) => e.startsWith('flow.tiers[0].boxes[0].text') && /16/.test(e))).toBe(true)
  expect(errsOf(t(['x'.repeat(15), 'a', 'b', 'c'])).some((e) => e.startsWith('flow.tiers[0].boxes[0].text') && /14/.test(e))).toBe(true)
})

test('a sixth tier, a seventh chip, a fourth grid box, two strong tiers, a 4×5 grid and an op on one box are each an error', () => {
  const box = { text: 'a' }, tier = { boxes: [box] }
  expect(errsOf({ tiers: Array(6).fill(tier) }).some((e) => e.startsWith('flow.tiers'))).toBe(true)
  expect(errsOf({ tiers: [{ boxes: Array(7).fill(box) }, tier] }).some((e) => e.startsWith('flow.tiers[0].boxes'))).toBe(true)
  const grid = S4.tiers[0].boxes[0]
  expect(errsOf({ tiers: [{ boxes: [grid, grid, grid, grid] }, tier] }).some((e) => e.startsWith('flow.tiers[0].boxes'))).toBe(true)
  expect(errsOf({ tiers: [{ ...tier, tone: 'strong' }, { ...tier, tone: 'strong' }] }).some((e) => /one strong tier/.test(e))).toBe(true)
  expect(errsOf({ tiers: [{ boxes: [{ label: 'X', grid: [[1, 2, 3, 4, 5], [1, 2, 3, 4, 5], [1, 2, 3, 4, 5], [1, 2, 3, 4, 5]] }] }, tier] }).some((e) => e.startsWith('flow.tiers[0].boxes[0].grid'))).toBe(true)
  expect(errsOf({ tiers: [{ boxes: [box], op: '×' }, tier] }).some((e) => e.startsWith('flow.tiers[0].op'))).toBe(true)
})

test('a box is text or a label over a grid, never both or neither; chips are text only', () => {
  const tier = { boxes: [{ text: 'b' }] }
  expect(errsOf({ tiers: [{ boxes: [{ text: 'a', label: 'L', grid: S4.tiers[0].boxes[0] && (S4.tiers[0].boxes[0] as { grid: number[][] }).grid }] }, tier] }).some((e) => e.startsWith('flow.tiers[0].boxes[0]'))).toBe(true)
  expect(errsOf({ tiers: [{ boxes: [{}] }, tier] }).some((e) => e.startsWith('flow.tiers[0].boxes[0]'))).toBe(true)
  expect(errsOf({ tiers: [{ boxes: [{ label: 'Take-up', text: 'x' }] }, tier] }).some((e) => e.startsWith('flow.tiers[0].boxes[0]'))).toBe(true)
})

test('the height budget names its cost', () => {
  const g = S4.tiers[0], t = { boxes: [{ text: 'a' }] }
  expect(errsOf({ tiers: [g, g, g, g, g] }).some((e) => e.startsWith('flow: this flow costs 8') && /6\.5/.test(e))).toBe(true)
  expect(errsOf({ tiers: [t, t, t, t, t] })).toEqual([])
})
