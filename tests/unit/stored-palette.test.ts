import { describe, expect, it } from 'vitest'
import { stripDeckData, stripDocText } from '../../src/engine/stored-palette'

describe('stored palette cleanup', () => {
  it('strips theme and accent from deck data', () => {
    const { data, changed } = stripDeckData({ style: 'pitch', theme: 'ink', accent: '#2447D1', items: [] })
    expect(changed).toBe(true)
    expect(data).toEqual({ style: 'pitch', items: [] })
  })

  it('strips theme and accent from doc front matter', () => {
    const raw = '---\ntitle: Memo\ntheme: ink\naccent: "#2447D1"\n---\n\nHello.\n'
    const { text, changed } = stripDocText(raw)
    expect(changed).toBe(true)
    expect(text).not.toContain('theme:')
    expect(text).toContain('title: Memo')
  })
})
