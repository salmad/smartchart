import { describe, expect, it } from 'vitest'
import { checkFieldDefs, checkValue, checkValues, keyOf, stripField } from '../../src/engine/roadmaps/fields'
import type { FieldDef } from '../../src/engine/roadmaps/types'
import { issue, roadmap } from './roadmap-builders'

describe('roadmap fields', () => {
  it('refuses duplicate field names, a choice without options and unknown types', () => {
    expect(checkFieldDefs([{ id: 'f1', name: 'Country', type: 'choice', options: [{ id: 'o1', name: 'UK' }] }])).toBe('ok')
    expect(checkFieldDefs([{ id: 'f1', name: 'A', type: 'text' }, { id: 'f2', name: 'a', type: 'text' }])).toMatch(/already/)
    expect(checkFieldDefs([{ id: 'f1', name: 'Country', type: 'choice', options: [] }])).toMatch(/option/)
  })

  it('checks a value against its field', () => {
    const country: FieldDef = { id: 'f1', name: 'Country', type: 'choice', options: [{ id: 'o1', name: 'UK' }] }
    expect(checkValue(country, 'o1')).toBe('ok')
    expect(checkValue(country, 'o9')).toMatch(/Country/)
    expect(checkValue({ id: 'f2', name: 'Size', type: 'number' }, '3')).toMatch(/number/)
    expect(checkValue({ id: 'f3', name: 'Go-live', type: 'date' }, '2026-13-01')).toMatch(/date/)
    expect(checkValues([country], { f9: 'x' })).toMatch(/No such field/)
  })

  it('strips a deleted field from every issue that used it', () => {
    const out = stripField([issue({ id: 'a', fields: { f1: 'o1', f2: 3 } }), issue({ id: 'b', fields: {} })], 'f1')
    expect(out.map((i) => [i.id, i.fields])).toEqual([['a', { f2: 3 }]])
  })

  it('makes readable keys', () => expect(keyOf(roadmap({ prefix: 'SME' }), { number: 142 })).toBe('SME-142'))

  it('refuses a person who is not in the workspace and non-finite numbers', () => {
    const owner: FieldDef = { id: 'o1', name: 'Owner', type: 'person' }
    expect(checkValue(owner, 'ann', ['ann'])).toBe('ok')
    expect(checkValue(owner, 'stranger', ['ann'])).toMatch(/workspace member/)
    expect(checkValue({ id: 'n1', name: 'Size', type: 'number' }, Infinity)).toMatch(/number/)
  })
})
