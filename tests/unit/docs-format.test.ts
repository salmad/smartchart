/* The doc file: Markdown with front matter and occam:<kind> component blocks. Parse and serialize round-trip. */
import { test, expect } from 'vitest'
import { parseDoc } from '@/engine/docs/parse'
import { serializeDoc } from '@/engine/docs/serialize'
import type { Doc } from '@/engine/docs/types'

const DOC: Doc = {
  title: 'Finbridge competitor research', subtitle: 'Five issuers, **revenue** and position', theme: 'paper', accent: '#2447D1',
  blocks: [
    { type: 'paragraph', text: 'Revolut grew fastest, **[[3.1× in four years]]**; see [the chart](#rev).' },
    { type: 'heading', level: 2, id: 'growth', text: 'Revenue growth' },
    { type: 'figure', kind: 'chart', id: 'rev', body: { caption: 'Revenue · £m', chart: { kind: 'bars', categories: ['2024', '2025'], series: [{ name: 'Revolut', values: [1800, 2500], mark: 'bar' }] }, notes: [{ title: 'Fastest', text: 'Why' }] } },
    { type: 'heading', level: 3, id: 'detail', text: 'In detail' },
    { type: 'bullets', items: ['One **bold**', 'Two'] },
    { type: 'numbered', items: ['First', 'Second'] },
    { type: 'quote', text: 'Cards are a distribution business. — A founder' },
    { type: 'divider' },
    { type: 'code', lang: 'ts', text: 'const a = 1\nconst b = 2' },
    { type: 'figure', kind: 'callout', id: 'risk-1', body: { tone: 'risk', text: 'FCA approval takes **9 months**.' } },
  ],
}

test('a doc round-trips', () => {
  const { doc, errors } = parseDoc(serializeDoc(DOC))
  expect(errors).toEqual([])
  expect(doc).toEqual(DOC)
})

test('text that looks like syntax stays text', () => {
  for (const text of ['- not a list', '1. not a list', '## not a heading', '> not a quote', '---', '```js']) {
    const doc: Doc = { title: 'T', blocks: [{ type: 'paragraph', text }] }
    expect(parseDoc(serializeDoc(doc)).doc).toEqual(doc)
  }
})

test('code with a fence inside comes back whole', () => {
  const doc: Doc = { title: 'T', blocks: [{ type: 'code', lang: 'md', text: 'a\n```\nb' }] }
  expect(parseDoc(serializeDoc(doc)).doc).toEqual(doc)
})

test('missing ids are given', () => {
  const { doc } = parseDoc('---\ntitle: T\n---\n\n## Revenue growth\n\n## Revenue growth\n\n```occam:chart\n{}\n```')
  expect(doc.blocks.map((b) => ('id' in b ? b.id : null))).toEqual(['revenue-growth', 'revenue-growth-2', 'chart-1'])
})

test('broken JSON is kept', () => {
  const text = '```occam:table {#t}\n{ nope\n```'
  const { doc, errors } = parseDoc(text)
  expect(doc.blocks).toEqual([{ type: 'raw', text }])
  expect(errors).toHaveLength(1)
  expect(errors[0]).toMatch(/^line 1: /)
  expect(serializeDoc(doc)).toContain(text)
})

test('CRLF parses like LF', () => {
  const text = serializeDoc(DOC)
  expect(parseDoc(text.replace(/\n/g, '\r\n')).doc).toEqual(parseDoc(text).doc)
})

test('no front matter', () => {
  const { doc } = parseDoc('Hello')
  expect(doc.title).toBe('')
  expect(doc.blocks).toEqual([{ type: 'paragraph', text: 'Hello' }])
})
