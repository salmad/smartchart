import { describe, expect, it } from 'vitest'
import { briefOf, MAX_CHARS, MAX_TOTAL, readFile, withFiles, type Attached } from '@/app/files'

const file = (name: string, body: string) => new File([body], name)
const att = (name: string, text: string, cut = false): Attached => ({ name, text, about: 'x', cut })

describe('reading files', () => {
  it('reads CSV as rows and Markdown as words', async () => {
    expect(await readFile(file('q3.csv', 'Year,Revenue\r\n2024,4.8\r\n2025,9.4\r\n'))).toEqual({ name: 'q3.csv', text: 'Year,Revenue\n2024,4.8\n2025,9.4', about: '3 rows', cut: false })
    expect((await readFile(file('prd.md', '# Plan\n\n\n\nShip it now.'))).about).toBe('5 words')
  })
  it('cuts a long file and says so', async () => {
    const r = await readFile(file('dump.txt', 'a'.repeat(MAX_CHARS + 10)))
    expect(r.text.length).toBe(MAX_CHARS)
    expect(r.cut).toBe(true)
  })
  it('refuses a kind it cannot read, and an empty file, with a sentence', async () => {
    await expect(readFile(file('deck.pptx', 'x'))).rejects.toThrow('Occam reads PDF, Word, Excel, CSV, Markdown and text files, and pictures.')
    await expect(readFile(file('empty.txt', '  \n '))).rejects.toThrow('empty.txt has no text')
  })
})

describe('the message the agent reads', () => {
  it('is the ask, then each file between markers', () => {
    expect(withFiles('Make the case', [att('a.md', 'Alpha'), att('b "x".csv', '1,2', true)])).toBe(
      'Make the case\n\nAttached (a.md, b "x".csv):\n\n<file name="a.md">\nAlpha\n</file>\n\n<file name="b \'x\'.csv" cut="true">\n1,2\n</file>')
    expect(withFiles('Just text', [])).toBe('Just text')
  })
  it('asks for the slides the material argues for when the user typed nothing', () => {
    expect(withFiles('', [att('a.md', 'A')]).startsWith('Make the slides this material argues for.')).toBe(true)
  })
  it('keeps every file within the total budget, marking the one cut', () => {
    const out = withFiles('x', [att('a.txt', 'a'.repeat(MAX_TOTAL - 5)), att('b.txt', 'b'.repeat(100))])
    expect(out).toContain('<file name="b.txt" cut="true">\nbbbbb\n</file>')
  })
  it('routes on the ask and the start of each file only', () => {
    const b = briefOf('Revenue slide', [att('r.pdf', 'z'.repeat(5000))])
    expect(b.length).toBeLessThan(1400)
    expect(b).toContain('Attached r.pdf (x), starting:')
  })
})
