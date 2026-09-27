import { test, expect } from 'vitest'
import { slideHTML } from '@/engine/slides/render'
import type { Slide } from '@/engine/types'

test('a table column without a label renders an empty header, not "undefined"', () => {
  const s: Slide = { template: 'table', title: 'Plans', table: { columns: [{}, { label: 'Starter' }], rows: [{ cells: ['Price', '£29'] }] } }
  const html = slideHTML(s, { page: 1, section: 0, kicker: '', footer: '' }, { style: 'consulting', theme: 'ink' })
  expect(html).not.toContain('undefined')
})
