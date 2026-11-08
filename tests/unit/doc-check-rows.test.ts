/* The Checks panel's rows and the figure badges: grouped by block in doc order, named in the doc's words; dismissed
   checks leave the count and the badge. */
// @vitest-environment jsdom
import { expect, test } from 'vitest'
import { checkKey, type DocCheck } from '@/engine/docs/checks'
import { identify } from '@/engine/docs/ops'
import { docHTML } from '@/engine/docs/render'
import { badgeFor } from '@/app/components/docs/useDocProposals'
import { checkText, groupChecks, openChecks } from '@/app/components/docs/checkRows'
import { quietBadges } from '@/app/components/docs/useFigureBadges'
import type { FigureBlock } from '@/engine/docs/types'

const chart = (id: string, source?: string): FigureBlock => ({ type: 'figure', kind: 'chart', id, body: { caption: 'Revenue · £m', ...(source ? { source } : {}), chart: { categories: ['2024', '2025'], format: '£{v}m', series: [{ name: 'R', mark: 'bar', color: 'focus', values: [18, 25] }] } } })
const doc = { title: 'T', blocks: [{ type: 'heading' as const, level: 2 as const, id: 'mkt', text: 'Market' }, { type: 'paragraph' as const, text: 'Words.' }, chart('fig', undefined)] }
const para = identify(doc)[1].id
const checks: DocCheck[] = [
  { blockId: 'fig', id: 'R8', ok: false, msg: 'Figures with no source' },
  { blockId: para, id: 'D4', ok: false, msg: 'Long paragraph' },
  { blockId: 'doc', id: 'D7', ok: false, msg: '400 words, 0 exhibits' },
]

test('checks group under their blocks in doc order, the whole doc first, named in the doc’s words', () => {
  const g = groupChecks(doc, checks)
  expect(g.map((x) => [x.blockId, x.label])).toEqual([['doc', 'Whole doc'], [para, 'Paragraph in “Market”'], ['fig', 'Chart “Revenue · £m”']])
  expect(checkText(checks[2])).toBe('Reads as a wall of text: 400 words, 0 exhibits')
})

test('one count: open checks and stored suggestions, less what was dismissed', () => {
  const quiet = new Set([checkKey(checks[0])])
  expect(openChecks(checks, quiet)).toHaveLength(2)
  expect(badgeFor(checks, 1, quiet)).toEqual({ count: 3, pass: false })
  expect(badgeFor(checks.map((c) => ({ ...c, ok: true })), 0)).toEqual({ count: 0, pass: true })
})

test('a dismissed check leaves its figure’s badge, and the badge goes when none is left', () => {
  const root = document.createElement('div')
  root.innerHTML = docHTML({ title: 'T', blocks: [chart('fig')] })
  const badge = root.querySelector<HTMLDetailsElement>('details.fig-checks')
  const key = root.querySelector<HTMLElement>('[data-check-key]')?.dataset.checkKey ?? ''
  expect(key).toMatch(/^fig:R8:/)
  quietBadges(root, new Set([key]))
  expect(badge?.hidden).toBe(true)
  quietBadges(root, new Set())
  expect(badge?.hidden).toBe(false)
  expect(badge?.querySelector('summary')?.textContent).toBe('1 check')
})
