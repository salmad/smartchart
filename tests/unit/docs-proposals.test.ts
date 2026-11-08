import { describe, expect, it } from 'vitest'
import { applyProposal, checkProposal, keepCheck, type DocProposal } from '../../src/engine/docs/proposals'
import { identify } from '../../src/engine/docs/ops'
import { parseDoc } from '../../src/engine/docs/parse'
import { ToolError } from '../../src/engine/tools/types'
import type { Doc } from '../../src/engine/docs/types'

const doc = (): Doc => parseDoc(`---
title: Memo
---

## Plan {#plan}

Revenue reached **774** in Q3 per "Board pack".

- **UK:** strong
- **EU:** soft
`).doc

const firstPara = (d: Doc) => {
  const p = identify(d).find((x) => x.block.type === 'paragraph')
  if (!p) throw new Error('no paragraph')
  return p
}

const base = (over: Partial<DocProposal>): DocProposal => ({
  id: 'p1', blockIds: [], mode: 'replace', label: 'Try as grouped table', why: 'Easier to scan', by: 'Occam', at: 1, rev: 1, ...over,
})

describe('keepCheck', () => {
  it('text that keeps every word is all', () => {
    const orig = 'Revenue reached 774 in Q3'
    expect(keepCheck(orig, { markdown: 'Revenue reached **774** in Q3' }).keeps).toBe('all')
  })

  it('a grouped table that keeps every number and quote is facts', () => {
    const orig = 'Revenue reached **774** per "Board pack".'
    const figure = {
      kind: 'table' as const,
      body: {
        caption: 'Revenue by region',
        source: 'Board pack',
        table: {
          columns: [{ label: 'Region' }, { label: 'Revenue' }],
          rows: [
            { cells: ['UK', '774'], style: 'group' as const },
            { cells: ['EU', 'soft'] },
          ],
        },
      },
    }
    expect(keepCheck(orig, { figure }).keeps).toBe('facts')
  })

  it('a table that loses "774" is drops and lists it', () => {
    const orig = 'Revenue reached **774** in Q3'
    const figure = {
      kind: 'table' as const,
      body: {
        caption: 'By region',
        source: 'Board pack',
        table: { columns: [{ label: 'Region' }, { label: 'Rev' }], rows: [{ cells: ['EU', 'soft'] }] },
      },
    }
    const k = keepCheck(orig, { figure })
    expect(k.keeps).toBe('drops')
    expect(k.dropped.some((x) => x.includes('774'))).toBe(true)
  })

  it('a number inside a longer one is not kept: 1774 does not keep 774, and one digit counts', () => {
    const table = (cells: string[]) => ({ figure: { kind: 'table' as const, body: { caption: 'Q', source: 'S', table: { columns: [{ label: 'A' }], rows: cells.map((c) => ({ cells: [c] })) } } } })
    expect(keepCheck('Revenue reached 774', table(['1774'])).dropped).toContain('774')
    expect(keepCheck('Opened 3 stores', table(['Opened', 'stores'])).dropped).toContain('3')
  })

  it('a condensed table lists the words it leaves out', () => {
    const k = keepCheck('Revenue reached 774 overall', { figure: { kind: 'table', body: { caption: 'Revenue', source: 'S', table: { columns: [{ label: 'Revenue' }], rows: [{ cells: ['774'] }] } } } })
    expect(k.keeps).toBe('facts')
    expect(k.dropped).toEqual(expect.arrayContaining(['reached', 'overall']))
  })
})

describe('checkProposal', () => {
  it('a text suggestion that drops words is refused', () => {
    const ids = identify(doc()).filter((x) => x.block.type === 'paragraph').map((x) => x.id)
    const r = checkProposal(doc(), base({ blockIds: [ids[0]], markdown: 'Revenue dipped in Q3' }))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/every word/i)
  })

  it('a figure replace that drops facts becomes insert', () => {
    const id = firstPara(doc()).id
    const r = checkProposal(doc(), base({
      blockIds: [id],
      mode: 'replace',
      figure: {
        kind: 'table',
        body: {
          caption: 'Revenue',
          source: 'Board pack',
          table: {
            columns: [{ label: 'Region' }, { label: 'Note' }],
            rows: [{ cells: ['EU', 'soft'] }],
          },
        },
      },
    }))
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.mode).toBe('insert')
  })

  it('an invalid cell (41 characters) is refused with the path', () => {
    const id = firstPara(doc()).id
    const long = 'x'.repeat(41)
    const r = checkProposal(doc(), base({
      blockIds: [id],
      figure: {
        kind: 'table',
        body: {
          caption: 'T',
          source: 'S',
          table: { columns: [{ label: 'A' }], rows: [{ cells: [long] }] },
        },
      },
    }))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/41|table|rows/)
  })
})

describe('applyProposal', () => {
  it('replace swaps the blocks, insert keeps them', () => {
    const d = doc()
    const para = firstPara(d)
    const p: DocProposal = {
      ...base({ blockIds: [para.id], markdown: 'Revenue reached **774** in Q3 per "Board pack".' }),
      figure: undefined,
    }
    const replaced = applyProposal(d, p)
    expect(replaced.blocks.some((b) => b.type === 'paragraph' && b.text.includes('774'))).toBe(true)
    const ins = applyProposal(d, base({ blockIds: [para.id], mode: 'insert', figure: { kind: 'callout', body: { tone: 'note', text: 'Board pack figure.' } } }))
    expect(ins.blocks.length).toBeGreaterThan(d.blocks.length)
  })

  it('a text suggestion cannot insert: the words would show twice', () => {
    const para = firstPara(doc())
    const r = checkProposal(doc(), base({ blockIds: [para.id], mode: 'insert', markdown: 'Revenue reached **774** in Q3 per "Board pack".' }))
    expect(r.ok).toBe(false)
  })

  it('with a stale blockId throws not_found', () => {
    expect(() => applyProposal(doc(), base({ blockIds: ['nope'] }))).toThrow(ToolError)
    try { applyProposal(doc(), base({ blockIds: ['nope'] })) } catch (e) { expect((e as ToolError).code).toBe('not_found') }
  })
})
