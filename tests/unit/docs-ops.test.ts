import { describe, expect, it } from 'vitest'
import { parseDoc } from '../../src/engine/docs/parse'
import { serializeDoc } from '../../src/engine/docs/serialize'
import { createFigure, createText, deleteBlock, identify, moveBlock, parseText, setLook, updateFigure, writeText, type Edit } from '../../src/engine/docs/ops'
import type { Doc } from '../../src/engine/docs/types'

const FILE = ['---', 'title: Memo', '---', '', '## Plan {#plan}', '', 'First paragraph.', '', 'Same words.', '', 'Same words.', '', '## Risks {#risks}', '',
  '```occam:cards {#risk-cards}', JSON.stringify({ cards: [{ title: 'One', text: 'a', value: '1' }, { title: 'Two', text: 'b', value: '2' }, { title: 'Three', text: 'c', value: '3' }] }), '```', ''].join('\n')
const doc = (): Doc => parseDoc(FILE).doc
const ok = (e: Edit): { doc: Doc; ids: string[] } => { if (typeof e === 'string') throw new Error(e); return e }
const roundTrips = (d: Doc) => expect(parseDoc(serializeDoc(d)).doc).toEqual(d)
const idOf = (d: Doc, text: string) => identify(d).find((x) => x.block.type === 'paragraph' && x.block.text === text)?.id ?? ''

describe('identify', () => {
  it('keeps heading and figure ids, hashes the rest, and numbers repeats', () => {
    const ids = identify(doc()).map((x) => x.id)
    expect(ids[0]).toBe('plan'); expect(ids.at(-1)).toBe('risk-cards')
    expect(ids[1]).toMatch(/^t_/); expect(ids[3]).toBe(`${ids[2]}-2`)
    expect(identify(doc()).map((x) => x.id)).toEqual(ids)
  })
})

describe('writeText', () => {
  it('replaces one block and nothing else, and the file still round trips', () => {
    const d = doc(), r = ok(writeText(d, idOf(d, 'First paragraph.'), 'Reworded.'))
    expect(r.doc.blocks.map((b) => b.type)).toEqual(d.blocks.map((b) => b.type))
    expect(r.doc.blocks[1]).toEqual({ type: 'paragraph', text: 'Reworded.' })
    expect(r.ids).toHaveLength(1); roundTrips(r.doc)
  })
  it('parses Markdown that looks like syntax as what it is', () => {
    const d = doc(), r = ok(writeText(d, idOf(d, 'First paragraph.'), '## Not a paragraph'))
    expect(r.doc.blocks[1]).toMatchObject({ type: 'heading', level: 2, id: 'not-a-paragraph' }); roundTrips(r.doc)
    const e = ok(writeText(d, idOf(d, 'First paragraph.'), '\\## Really a paragraph'))
    expect(e.doc.blocks[1]).toEqual({ type: 'paragraph', text: '## Really a paragraph' }); roundTrips(e.doc)
  })
  it('refuses a figure in the Markdown, a stale id and a figure target, changing nothing', () => {
    const d = doc(), before = serializeDoc(d)
    expect(writeText(d, idOf(d, 'First paragraph.'), '```occam:cards\n{}\n```')).toMatch(/create_block/)
    expect(writeText(d, 't_gone', 'x')).toMatch(/read the doc again/i)
    expect(writeText(d, 'risk-cards', 'x')).toMatch(/update_block/)
    expect(serializeDoc(d)).toBe(before)
  })
  it('reaches either of two equal paragraphs by its own id', () => {
    const d = doc(), [a, b] = identify(d).filter((x) => x.block.type === 'paragraph' && x.block.text === 'Same words.')
    const r = ok(writeText(d, b.id, 'Second.'))
    expect(r.doc.blocks.filter((x) => x.type === 'paragraph').map((x) => x.text)).toEqual(['First paragraph.', 'Same words.', 'Second.'])
    expect(a.id).not.toBe(b.id)
  })
})

describe('createText and createFigure', () => {
  it('put the block at the start, the end or after an id', () => {
    const d = doc()
    expect(ok(createText(d, 'start', 'Intro.')).doc.blocks[0]).toEqual({ type: 'paragraph', text: 'Intro.' })
    expect(ok(createText(d, 'end', 'Last.')).doc.blocks.at(-1)).toEqual({ type: 'paragraph', text: 'Last.' })
    const r = ok(createText(d, 'plan', '- a\n- b'))
    expect(r.doc.blocks[1]).toEqual({ type: 'bullets', items: ['a', 'b'] }); roundTrips(r.doc)
  })
  it('makes a figure with an id, and refuses one the schema rejects with the path named', () => {
    const d = doc(), r = ok(createFigure(d, 'risks', 'cards', { cards: [{ title: 'A', text: 'a', value: '1' }, { title: 'B', text: 'b', value: '2' }, { title: 'C', text: 'c', value: '3' }] }))
    expect(r.doc.blocks[5]).toMatchObject({ type: 'figure', kind: 'cards', id: 'cards-1' }); expect(r.ids).toEqual(['cards-1']); roundTrips(r.doc)
    expect(createFigure(d, 'end', 'chart', {})).toMatch(/#chart-1\.chart/)
  })
})

describe('updateFigure', () => {
  it('changes only the path named, and refuses a bad path or value, changing nothing', () => {
    const d = doc(), r = ok(updateFigure(d, 'risk-cards', { 'cards[1].title': 'New' }))
    expect(JSON.stringify(r.doc.blocks.at(-1))).toContain('"New"'); expect(JSON.stringify(r.doc.blocks.at(-1))).toContain('"One"')
    expect(updateFigure(d, 'risk-cards', { 'cards[9].title': 'x' })).toMatch(/past the end/)
    expect(typeof updateFigure(d, 'risk-cards', { cards: 'nope' })).toBe('string')
    expect(updateFigure(d, 'plan', { x: 1 })).toMatch(/write_doc_text|text/)
    expect(updateFigure(d, 'nope', { x: 1 })).toMatch(/read the doc again/i)
  })
})

describe('moveBlock, deleteBlock, setLook', () => {
  it('move a figure after a heading, and refuse a block after itself', () => {
    const d = doc(), r = ok(moveBlock(d, 'risk-cards', 'plan'))
    expect(r.doc.blocks[1]).toMatchObject({ type: 'figure', id: 'risk-cards' }); roundTrips(r.doc)
    expect(moveBlock(d, 'plan', 'plan')).toMatch(/itself/)
    expect(moveBlock(d, 'plan', 'nope')).toMatch(/read the doc again/i)
  })
  it('delete removes a block', () => {
    const d = doc(), r = ok(deleteBlock(d, 'risk-cards'))
    expect(r.doc.blocks).toHaveLength(d.blocks.length - 1); expect(r.ids).toEqual([])
  })
  it('setLook renames, clears a subtitle, and refuses a red accent', () => {
    const d = { ...doc(), subtitle: 'Sub' }
    expect(ok(setLook(d, { title: 'Renamed', subtitle: null, theme: 'ink' })).doc).toMatchObject({ title: 'Renamed', theme: 'ink' })
    expect('subtitle' in ok(setLook(d, { subtitle: null })).doc).toBe(false)
    expect(setLook(d, { accent: '#ff0000' })).toMatch(/^accent:/)
    expect(setLook(d, { title: '  ' })).toMatch(/^title:/)
  })
})

describe('parseText', () => {
  it('refuses empty text and a # heading', () => {
    expect(parseText('  ')).toMatch(/at least one block/)
    expect(parseText('# Title')).toMatch(/^markdown: line/)
  })
})
