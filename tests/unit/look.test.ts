import { describe, expect, it } from 'vitest'
import { DEFAULT_USER_LOOK, parseUserLook, userLookOf } from '../../src/engine/look'
import { deckBody } from '../../src/app/store'
import { serializeDoc } from '../../src/engine/docs/serialize'

describe('user look', () => {
  it('defaults to paper with no accent', () => {
    expect(userLookOf(null)).toEqual(DEFAULT_USER_LOOK)
  })

  it('reads theme and accent from stored prefs', () => {
    expect(parseUserLook({ theme: 'ink', accent: '#665EFD' })).toEqual({ theme: 'ink', accent: '#665EFD' })
    expect(parseUserLook({ theme: 'paper' })).toEqual({ theme: 'paper', accent: null })
  })
})

describe('deck and doc saves omit palette', () => {
  it('deckBody drops theme and accent', () => {
    const body = deckBody({
      id: 'd_1', style: 'consulting', theme: 'ink', accent: '#112233', current: 0, updated: 1, history: [], working: [], messages: [],
      items: [{ id: 's1', slide: { template: 'cover', title: 'T' }, status: 'ok', errors: [], warnings: [], checks: [] }],
    })
    expect(body).not.toHaveProperty('theme')
    expect(body).not.toHaveProperty('accent')
    expect(body.style).toBe('consulting')
  })

  it('serializeDoc omits theme and accent from front matter', () => {
    const text = serializeDoc({ title: 'T', theme: 'ink', accent: '#112233', blocks: [{ type: 'paragraph', text: 'Hi' }] })
    expect(text).not.toMatch(/^theme:/m)
    expect(text).not.toMatch(/^accent:/m)
  })
})
