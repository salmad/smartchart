import { describe, expect, it } from 'vitest'
import { phaseOf } from '../../src/app/phase'

const step = (s: string) => ({ step: s, detail: '', model: 'x' })

describe('phaseOf', () => {
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
})
