/* Components build their data-paths from a base: "" on a slide (paths as they always were), a block's path in a doc. */
import { test, expect } from 'vitest'
import { join } from '@/engine/components/text'
import { teamHTML } from '@/engine/components/pictures'

test('join puts a key under its base, or alone at the root', () => {
  expect(join('', 'cards[0]')).toBe('cards[0]')
  expect(join('halves[1]', 'table')).toBe('halves[1].table')
})

test('a team under a doc block carries the block path', () => {
  const html = teamHTML([{ name: 'Ana Ruiz', role: 'CEO' }], 'row', 'blocks[2]')
  expect(html).toContain('data-item="blocks[2].people[0]"')
  expect(html).toContain('data-path="blocks[2].people[0].name"')
})
