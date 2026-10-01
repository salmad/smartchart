import { describe, expect, it } from 'vitest'
import { guideText } from '../../src/engine/tools/guide-text'

describe('guideText', () => {
  it('carries the shared rules and the style, not the in-app parts', () => {
    const g = guideText('consulting')
    expect(g).toContain('Use every figure the user gave, exactly as given.')
    expect(g).toContain('action title')
    expect(g).toContain('Ask your user')
    expect(g).not.toContain('patch_slide')
    expect(g).not.toContain('Working slides')
    expect(g).not.toContain('suggested next steps')
  })
  it('pitch has its own style block', () => expect(guideText('pitch')).toContain('one-line topic title'))
})
