import { describe, expect, it } from 'vitest'
import { checkDoc, figureChecks, figureSuggestions } from '../../src/engine/docs/checks'
import { serializeDoc } from '../../src/engine/docs/serialize'
import { BLOCK_STARTERS } from '../../src/engine/starters'
import type { Doc, FigureBlock, FigureBody } from '../../src/engine/docs/types'
import type { JevFn } from '../../src/engine/agent/llm'

const start = (id: string) => structuredClone(BLOCK_STARTERS.find((s) => s.id === id)?.body) as FigureBody
const fig = (kind: FigureBlock['kind'], body: FigureBody, id = 'f'): FigureBlock => ({ type: 'figure', kind, id, body })
const get = (cs: { id: string; ok: boolean }[], id: string) => cs.find((c) => c.id === id)

describe('figureChecks', () => {
  it('R8: a figure that claims figures says where from', () => {
    const body = start('chart'), { source: _s, ...bare } = body
    expect(get(figureChecks(fig('chart', bare)), 'R8')?.ok).toBe(false)
    expect(get(figureChecks(fig('chart', body)), 'R8')?.ok).toBe(true)
  })
  it('R4 is at most one focus element, with no title to carry it', () => {
    const body = start('chart'), two = structuredClone(body)
    two.chart?.series?.push({ name: 'B', mark: 'bar', color: 'focus', values: [1, 2, 3, 4, 5] })
    expect(get(figureChecks(fig('chart', body)), 'R4')?.ok).toBe(true)
    expect(get(figureChecks(fig('chart', two)), 'R4')?.ok).toBe(false)
  })
  it('R13 and R14: mixed units in a column; bars not sorted', () => {
    const t = start('table')
    t.table?.rows?.push({ cells: ['Odd', '12%', 'Soon'] })
    expect(get(figureChecks(fig('table', t)), 'R13')?.ok).toBe(false)
    const c = start('chart')
    if (c.chart) { c.chart.categories = ['A', 'B', 'C']; c.chart.series = [{ name: 'S', mark: 'bar', values: [1, 3, 2] }] }
    expect(get(figureChecks(fig('chart', c)), 'R14')?.ok).toBe(false)
  })
  it('R11: a figure claimed in the caption that the data does not show', () => {
    const c: FigureBody = { caption: 'Revenue grew 77%', chart: { categories: ['A', 'B'], format: '{v}%', series: [{ name: 'S', mark: 'bar', color: 'focus', values: [10, 20] }] }, source: 'Filings' }
    expect(get(figureChecks(fig('chart', c)), 'R11')?.ok).toBe(false)
    c.caption = 'Revenue doubled to 20%'
    expect(get(figureChecks(fig('chart', c)), 'R11')?.ok).toBe(true)
  })
  it('never says the title and layout checks, and a callout has none', () => {
    const all = ['chart', 'table', 'number', 'cards', 'steps', 'summary', 'pair'].flatMap((k) => figureChecks(fig(k as FigureBlock['kind'], start(k))))
    for (const id of ['R1', 'R2', 'R3', 'R6', 'R7', 'R10', 'R12', 'J1', 'J5', 'J6', 'J7', 'J8']) expect(get(all, id)).toBeUndefined()
    expect(figureChecks(fig('callout', { tone: 'note', text: 'x' }))).toEqual([])
  })
})

describe('pair figures', () => {
  it('soft checks run on each half chart', () => {
    const body = start('pair')
    if (body.halves?.[0]?.chart) {
      body.halves[0].chart.categories = ['2021', '2022', '2023', '2024', '2025']
      body.halves[0].chart.series = [{ name: 'R', mark: 'bar', color: 'focus', values: [2, 3, 4, 6, 9] }]
    }
    body.source = 'Filings'
    const cs = figureChecks(fig('pair', body, 'pair-fig'))
    expect(cs.some((c) => c.id === 'S4' && c.msg.includes('CAGR'))).toBe(true)
  })
})

describe('figureSuggestions', () => {
  it('returns soft checks for a changed chart figure', () => {
    const body = start('chart')
    if (body.chart) {
      body.chart.categories = ['2021', '2022', '2023', '2024', '2025']
      body.chart.series = [{ name: 'R', mark: 'bar', color: 'focus', values: [2, 3, 4, 6, 9] }]
    }
    body.source = 'Filings'
    const d: Doc = { title: 'T', blocks: [{ type: 'heading', level: 2, id: 'a', text: 'A' }, fig('chart', body, 'rev')] }
    expect(figureSuggestions(d, ['rev']).some((s) => s.startsWith('rev:') && s.includes('CAGR'))).toBe(true)
    expect(figureSuggestions(d, ['a'])).toEqual([])
  })
})

describe('checkDoc', () => {
  const doc = (blocks: Doc['blocks']): Doc => ({ title: 'T', blocks })
  it('D1: no caption; D2: an empty section', async () => {
    const { caption: _c, ...noCaption } = start('table')
    const d = doc([{ type: 'heading', level: 2, id: 'a', text: 'Empty' }, { type: 'heading', level: 2, id: 'b', text: 'Full' }, fig('table', noCaption, 't')])
    const cs = await checkDoc(d)
    expect(cs.find((c) => c.id === 'D2')).toMatchObject({ blockId: 'a', ok: false })
    expect(cs.find((c) => c.id === 'D1')).toMatchObject({ blockId: 't', ok: false })
    expect(cs.filter((c) => c.id === 'D2')).toHaveLength(1)
  })
  it('J9 and J10 come from the judgment call, for tables, and only with a jev', async () => {
    const asked: string[] = []
    const jev: JevFn = async (_p, qs) => { asked.push(...Object.keys(qs)); return { ...Object.fromEntries(Object.keys(qs).map((k) => [k, { value: 'marks', probabilities: { keep: 0.05, marks: 0.95 } }])), _ms: 1 } as never }
    const d = doc([{ type: 'heading', level: 2, id: 'a', text: 'A' }, fig('table', start('table'), 't')])
    const cs = await checkDoc(d, jev)
    expect(get(cs, 'J9')).toMatchObject({ blockId: 't', ok: false })
    expect(asked).toEqual(['J9'])
    expect(get(await checkDoc(d), 'J9')).toBeUndefined()
  })
  it('reports a figure that cannot be read, never throws, and leaves the doc as it was', async () => {
    const d = doc([{ type: 'heading', level: 2, id: 'a', text: 'A' }, fig('cards', { cards: 'nope' } as unknown as FigureBody, 'bad')])
    const before = serializeDoc(d)
    const cs = await checkDoc(d)
    expect(cs.some((c) => c.blockId === 'bad' && !c.ok)).toBe(true)
    expect(serializeDoc(d)).toBe(before)
  })
})
