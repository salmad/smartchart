/* Every component builds its paths under the base it is given: a doc block at blocks[3] edits blocks[3].… */
import { test, expect } from 'vitest'
import { cardsHTML } from '@/engine/components/cards'
import { notesHTML, splitHTML } from '@/engine/components/notes'
import { stepsHTML, summaryHTML } from '@/engine/components/rows'
import { pairHTML } from '@/engine/components/pair'

const B = 'blocks[3]'

test('cards carry the block path', () => {
  expect(cardsHTML([{ icon: 'star', title: 'Fast', text: 'Two days' }], 'icon', undefined, B)).toContain('data-item="blocks[3].cards[0]"')
})

test('notes carry the block path', () => {
  expect(notesHTML([{ title: 'Why', text: 'Because' }], B)).toContain('data-path="blocks[3].notes[0].title"')
})

test('steps and summary points carry the block path', () => {
  expect(stepsHTML([{ when: 'Q1', title: 'Pilot', text: 'Two banks' }], B)).toContain('data-path="blocks[3].steps[0].when"')
  expect(summaryHTML([{ title: 'Grow', text: 'Fast' }], B)).toContain('data-path="blocks[3].points[0].title"')
})

test('a pair half table carries the block path', () => {
  const html = pairHTML([{ table: { columns: [{ label: 'A' }], rows: [{ cells: ['x'] }] } }, { points: ['y'] }], B)
  expect(html).toContain('data-path="blocks[3].halves[0].table.rows[0].cells[0]"')
})

test('a split caption carries the block path', () => {
  expect(splitHTML({ caption: 'Revenue · £m', notes: [] }, '', '', B)).toContain('data-path="blocks[3].caption"')
})
