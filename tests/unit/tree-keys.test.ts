import { describe, expect, it } from 'vitest'
import type { Row } from '@/app/components/sidebar/flatten'
import { step, typeahead } from '@/app/components/sidebar/treeKeys'

const row = (id: string, over: Partial<Row> = {}): Row =>
  ({ ref: { kind: 'doc', id }, name: id, depth: 1, hasChildren: false, expanded: false, open: false, parentRef: null, updated: 0, slides: null, ...over })
const P = { kind: 'doc' as const, id: 'parent' }
const rows = [
  row('parent', { hasChildren: true, expanded: true }),
  row('kid', { depth: 2, parentRef: P }),
  row('Zed', { hasChildren: true }),
  row('zebra'),
]
const at = (id: string) => {
  const r = rows.find((x) => x.ref.id === id)
  if (!r) throw new Error(`no row ${id}`)
  return r.ref
}

describe('tree keys', () => {
  it('moves with Up, Down, Home and End, and stops at the ends', () => {
    expect(step(rows, at('parent'), 'ArrowDown')).toEqual({ focus: at('kid') })
    expect(step(rows, at('kid'), 'ArrowUp')).toEqual({ focus: at('parent') })
    expect(step(rows, at('kid'), 'End')).toEqual({ focus: at('zebra') })
    expect(step(rows, at('zebra'), 'Home')).toEqual({ focus: at('parent') })
    expect(step(rows, at('parent'), 'ArrowUp')).toBeNull()
    expect(step(rows, at('zebra'), 'ArrowDown')).toBeNull()
  })
  it('Right expands a closed branch, enters an open one, and does nothing on a leaf', () => {
    expect(step(rows, at('Zed'), 'ArrowRight')).toEqual({ toggle: at('Zed'), open: true })
    expect(step(rows, at('parent'), 'ArrowRight')).toEqual({ focus: at('kid') })
    expect(step(rows, at('zebra'), 'ArrowRight')).toBeNull()
  })
  it('Left collapses an open branch, else goes to the parent', () => {
    expect(step(rows, at('parent'), 'ArrowLeft')).toEqual({ toggle: at('parent'), open: false })
    expect(step(rows, at('kid'), 'ArrowLeft')).toEqual({ focus: at('parent') })
    expect(step(rows, at('zebra'), 'ArrowLeft')).toBeNull()
  })
  it('Enter and Space open the page; other keys do nothing', () => {
    expect(step(rows, at('kid'), 'Enter')).toEqual({ open: at('kid') })
    expect(step(rows, at('kid'), ' ')).toEqual({ open: at('kid') })
    expect(step(rows, at('kid'), 'Tab')).toBeNull()
  })
  it('falls back to the first row when the focused one is gone', () => {
    expect(step(rows, { kind: 'doc', id: 'gone' }, 'ArrowDown')).toEqual({ focus: at('parent') })
    expect(step([], at('kid'), 'ArrowDown')).toBeNull()
  })
  it('typeahead jumps to the next name that starts with the letter, wrapping, ignoring case', () => {
    expect(typeahead(rows, at('parent'), 'z')).toEqual(at('Zed'))
    expect(typeahead(rows, at('Zed'), 'z')).toEqual(at('zebra'))
    expect(typeahead(rows, at('zebra'), 'z')).toEqual(at('Zed'))
    expect(typeahead(rows, at('Zed'), 'ze')).toEqual(at('Zed'))
    expect(typeahead(rows, at('Zed'), 'zeb')).toEqual(at('zebra'))
    expect(typeahead(rows, at('Zed'), 'q')).toBeNull()
  })
})
