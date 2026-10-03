import { expect, test } from 'vitest'
import { iconsMayStack } from '@/engine/slides/head-icons'
import { validate } from '@/engine/slides/schema'
import type { Slide, Table } from '@/engine/types'

const table = (labels: string[], icon = true): Table => ({ columns: [{ label: 'Provider' }, ...labels.map((label) => ({ label, ...(icon ? { icon: 'zap' as const } : {}) }))], rows: [{ cells: ['Acme', ...labels.map(() => '✓')] }] })

test('icons sit inline while every label fits beside its icon in the narrowest column the table could get', () => {
  expect(iconsMayStack(table(['Credit limit', 'Rewards', 'Speed', 'No fees']), 'full')).toBe(false)
  // 14 characters is too long for 4 data columns at their narrowest (about 12), fine in 3 (about 17).
  expect(iconsMayStack(table(['Approval speed', 'Rewards', 'Limit', 'No fees']), 'full')).toBe(true)
  expect(iconsMayStack(table(['Approval speed', 'Rewards', 'Limit']), 'full')).toBe(false)
  // Beside notes the table is narrower.
  expect(iconsMayStack(table(['Approval speed', 'Rewards', 'Limit']), 'split')).toBe(true)
  expect(iconsMayStack(table(['Approval speed', 'Rewards'], false), 'full')).toBe(false)
})

test('the budget costs icons only when they may go above', () => {
  const slide = (t: Table): Slide => ({ template: 'table', title: 'Acme leads on every criterion SMEs ask for', table: t })
  const rows = Array.from({ length: 9 }, (_, i) => ({ cells: [`P${i}`, 'a', 'b', 'c', 'd'] }))
  // 9 rows + 1.5 takeaway = 10.5: in budget with inline icons, over it when the icons go above.
  const inline = validate({ ...slide({ ...table(['Limit', 'Rewards', 'Speed', 'Fees']), rows }), takeaway: 'So what.' }, 'consulting').errors.join()
  const above = validate({ ...slide({ ...table(['Approval speed', 'Rewards', 'Speed', 'Fees']), rows }), takeaway: 'So what.' }, 'consulting').errors.join()
  expect(inline).not.toMatch(/costs/)
  expect(above).toMatch(/costs 11\.5 rows/)
})
