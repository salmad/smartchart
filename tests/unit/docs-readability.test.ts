import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { checkDoc } from '../../src/engine/docs/checks'
import { parseDoc } from '../../src/engine/docs/parse'
import { readabilityChecks, LONG_PARAGRAPH } from '../../src/engine/docs/readability'
import { identify } from '../../src/engine/docs/ops'
import type { Doc } from '../../src/engine/docs/types'

const fixture = (name: string) => parseDoc(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../fixtures/docs', name), 'utf8')).doc
const get = (cs: { id: string; ok: boolean }[], id: string) => cs.find((c) => c.id === id)

describe('readabilityChecks', () => {
  it('the wall-of-text fixture fails D7 and flags long paragraphs', async () => {
    const cs = await checkDoc(fixture('wall-of-text.md'))
    expect(get(cs, 'D7')?.ok).toBe(false)
    expect(cs.some((c) => c.id === 'D4' && !c.ok)).toBe(true)
    expect(cs.some((c) => c.id === 'D6' && !c.ok)).toBe(true)
  })

  it('the restructured reels doc passes', async () => {
    const cs = await checkDoc(fixture('reels.md'))
    expect(get(cs, 'D7')?.ok).toBe(true)
    expect(cs.filter((c) => (c.id === 'D5' || c.id === 'D6') && !c.ok)).toEqual([])
  })

  it('a 91-word paragraph fails D4, a 90-word one passes', () => {
    const word = 'word'
    const p91 = Array.from({ length: LONG_PARAGRAPH + 1 }, () => word).join(' ')
    const p90 = Array.from({ length: LONG_PARAGRAPH }, () => word).join(' ')
    const one = (text: string) => readabilityChecks({ title: 'T', blocks: [{ type: 'heading', level: 2, id: 'a', text: 'A' }, { type: 'paragraph', text }] })
    const id91 = identify({ title: 'T', blocks: [{ type: 'heading', level: 2, id: 'a', text: 'A' }, { type: 'paragraph', text: p91 }] })[1].id
    expect(one(p91).some((c) => c.id === 'D4' && c.blockId === id91 && !c.ok)).toBe(true)
    expect(one(p90).some((c) => c.id === 'D4')).toBe(false)
  })

  it('a list between two paragraphs breaks a prose run', () => {
    const para = (n: number) => Array.from({ length: n }, () => 'word').join(' ')
    const doc: Doc = {
      title: 'T',
      blocks: [
        { type: 'heading', level: 2, id: 'a', text: 'A' },
        { type: 'paragraph', text: para(80) },
        { type: 'bullets', items: ['one', 'two'] },
        { type: 'paragraph', text: para(80) },
      ],
    }
    const cs = readabilityChecks(doc)
    expect(cs.some((c) => c.id === 'D5' && !c.ok)).toBe(false)
  })
})
