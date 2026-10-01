import { test, expect } from 'vitest'
import { actionsFor, cellField, tonePatch, type Target } from '@/engine/slides/actions'
import { applyPatch } from '@/engine/agent/patch'
import { autofix } from '@/engine/agent/autofix'
import { validate } from '@/engine/slides/schema'
import { STARTERS, starterSlide } from '@/engine/starters'
import type { Slide, Style } from '@/engine/types'

const must = <T>(v: T | undefined): T => { if (v === undefined) throw new Error('missing'); return v }
const starter = (id: string, style: Style = 'consulting') => starterSlide(must(STARTERS.find((s) => s.id === id)), style)
const ids = (t: Target, s: Slide, style: Style = 'consulting') => actionsFor(t, s, style).map((a) => a.id)
const run = (t: Target, s: Slide, id: string, style: Style = 'consulting') => must(actionsFor(t, s, style).find((a) => a.id === id)).run()

test('a text selection in a markup field offers Bold and Focus; in a plain field, nothing', () => {
  const s = starter('cards-icon')
  expect(ids({ kind: 'text', path: 'title', from: 0, to: 3 }, s)).toEqual(expect.arrayContaining(['bold', 'focus']))
  expect(ids({ kind: 'text', path: 'cards[0].label', from: 0, to: 0 }, s)).not.toContain('bold')
  const r = run({ kind: 'text', path: 'title', from: 0, to: 3 }, s, 'bold')
  expect(String(r.set.title)).toMatch(/^\*\*/)
})

test('a card offers insert, move and delete, and the limits hide what cannot be done', () => {
  const s = starter('cards-icon'), n = must(s.cards).length
  const first = ids({ kind: 'item', item: 'cards[0]' }, s), last = ids({ kind: 'item', item: `cards[${n - 1}]` }, s)
  expect(first).toEqual(expect.arrayContaining(['insert-after', 'move-later']))
  expect(first).not.toContain('move-earlier')
  expect(last).not.toContain('move-later')
  const full = { ...s, cards: [...must(s.cards), ...must(s.cards)].slice(0, 4) } as Slide
  expect(ids({ kind: 'item', item: 'cards[0]' }, full)).not.toContain('insert-after')
  const mv = run({ kind: 'item', item: 'cards[0]' }, s, 'move-later')
  expect((mv.set.cards as { title: string }[])[1].title).toBe(must(s.cards)[0].title)
  expect(mv.target).toEqual({ kind: 'item', item: 'cards[1]' })
})

const TABLE = starter('table')
test('table cells: marks across a range, row and column actions, each producing a valid slide', () => {
  const t: Target = { kind: 'cells', r0: 0, c0: 1, r1: 1, c1: 2 }
  const set = run(t, TABLE, 'bold').set
  expect(Object.keys(set).length).toBeGreaterThanOrEqual(2)
  for (const id of ['row-insert-after', 'row-move-later', 'col-insert-after', 'col-move-later']) {
    const r = actionsFor({ kind: 'cells', r0: 0, c0: 1, r1: 0, c1: 1 }, TABLE, 'consulting').find((a) => a.id === id)
    if (!r) continue
    const patched = applyPatch(TABLE, r.run().set)
    expect(patched.slide, id).toBeTruthy()
    const errors = validate(autofix(must(patched.slide), 'consulting').slide, 'consulting').errors.filter((e) => !/characters|at most|budget|label: required|wraps/.test(e))
    expect(errors, id).toEqual([])
  }
})

test('column format: bold and italic toggle; tone is one of normal, muted, focus', () => {
  const t: Target = { kind: 'cells', r0: -1, c0: 1, r1: 100, c1: 1 }
  const acts = actionsFor(t, TABLE, 'consulting')
  expect(acts.map((a) => a.id)).toEqual(expect.arrayContaining(['col-bold', 'col-italic', 'col-tone-muted', 'col-tone-focus', 'col-tone-normal']))
  expect(must(acts.find((a) => a.id === 'col-bold')).run().set).toEqual({ 'table.columns[1].bold': true })
})

test('cellField finds the path that holds a cell\'s words, string or object', () => {
  const s: Slide = { template: 'table', title: 'T', table: { columns: [{ label: 'A' }, { label: 'B' }], rows: [{ cells: ['x', { value: 'y', note: 'n' }] }] } }
  expect(cellField(s, 0, 0)).toBe('table.rows[0].cells[0]')
  expect(cellField(s, 0, 1)).toBe('table.rows[0].cells[1].value')
})

test('tonePatch frees the other focus column', () => {
  const s: Slide = { template: 'table', title: 'T', table: { columns: [{ label: 'A' }, { label: 'B', focus: true }, { label: 'C' }], rows: [{ cells: ['a', 'b', 'c'] }] } }
  expect(tonePatch(s, 2, 'focus')).toEqual({ 'table.columns[2].muted': null, 'table.columns[2].focus': true, 'table.columns[1].focus': null })
})
