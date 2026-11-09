import { afterEach, describe, expect, it, vi } from 'vitest'

describe('docBlockSuggestionsEnabled', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('is on by default', async () => {
    const { docBlockSuggestionsEnabled } = await import('../../src/app/features')
    expect(docBlockSuggestionsEnabled()).toBe(true)
  })

  it('respects VITE_DOC_BLOCK_SUGGESTIONS=0', async () => {
    vi.stubEnv('VITE_DOC_BLOCK_SUGGESTIONS', '0')
    const { docBlockSuggestionsEnabled } = await import('../../src/app/features')
    expect(docBlockSuggestionsEnabled()).toBe(false)
  })
})
