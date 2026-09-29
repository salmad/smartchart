import { describe, expect, it } from 'vitest'
import { phaseLinesOf } from '../../src/app/phase'

const step = (s: string) => ({ step: s, detail: '', model: 'x' })
const phaseOf = (trace: Parameters<typeof phaseLinesOf>[0]) => phaseLinesOf(trace)[0]

describe('phaseLinesOf', () => {
  it('starts before any step has run', () => {
    expect(phaseOf(undefined)).toBe('Reading what you asked')
    expect(phaseOf([])).toBe('Reading what you asked')
  })
  it('follows the last step that says something', () => {
    expect(phaseOf([step('Pre'), step('create_slide')])).toBe('Writing the slide')
    expect(phaseOf([step('Pre'), step('create_slide'), step('edit_slide')])).toBe('Measuring it at full size')
  })
  it('keeps the phrase through steps that say nothing new', () => {
    expect(phaseOf([step('Pre'), step('create_slide'), step('Agent')])).toBe('Writing the slide')
  })
  it('reviews logic, meaning and design while the checks run', () => {
    expect(phaseLinesOf([step('Pre'), step('create_slide'), step('Checks')])).toEqual(['Logic review', 'Semantic check', 'Spacing and design review'])
  })
})
