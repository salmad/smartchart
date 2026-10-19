/* The slash menu's choices: what a query finds, and what a pick does to the paragraph it was typed in. */
import { test, expect } from 'vitest'
import { keyed, unkeyed } from '@/engine/docs/blocks'
import { CHOICES, matching, pick } from '@/app/components/docs/slash'
import { BLOCK_STARTERS } from '@/engine/starters'
import type { Block } from '@/engine/docs/types'

const p = (text: string): Block => ({ type: 'paragraph', text })
const choice = (id: string) => { const c = CHOICES.find((x) => x.id === id); if (!c) throw new Error(id); return c }

test('a query finds choices by a word’s start; none lists them all', () => {
  expect(matching('tab').map((c) => c.id)).toEqual(['table'])
  expect(matching('num').map((c) => c.id)).toEqual(['numbered', 'number'])
  expect(matching('')).toHaveLength(CHOICES.length)
  expect(matching('zzz')).toEqual([])
})

test('every figure starter is offered once, and code is not', () => {
  expect(CHOICES.filter((c) => BLOCK_STARTERS.some((s) => s.id === c.id)).length).toBe(BLOCK_STARTERS.length)
  expect(CHOICES.some((c) => c.id === 'code')).toBe(false)
})

test('a figure takes the paragraph’s place, selected, with a fresh body and a paragraph after when it ends the doc', () => {
  const r = pick(keyed([p('a'), p('/tab')]), 'b2', choice('table'))
  const [, fig, after] = unkeyed(r.list)
  expect(fig).toMatchObject({ type: 'figure', kind: 'table', id: '' })
  expect(after).toEqual(p(''))
  expect(r.focus).toEqual({ key: 'b2', select: true })
  const starter = BLOCK_STARTERS.find((s) => s.id === 'table')
  expect(fig.type === 'figure' && fig.body).not.toBe(starter?.body)
})

test('text kinds turn the paragraph, empty, and keep the cursor in it', () => {
  expect(unkeyed(pick(keyed([p('/b')]), 'b1', choice('bullets')).list)).toEqual([{ type: 'bullets', items: [''] }])
  expect(pick(keyed([p('/h')]), 'b1', choice('heading2')).focus).toEqual({ key: 'b1', at: 0 })
  const d = pick(keyed([p('/d'), p('x')]), 'b1', choice('divider'))
  expect(unkeyed(d.list)).toEqual([{ type: 'divider' }, p(''), p('x')])
})
