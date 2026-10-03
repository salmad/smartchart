import { describe, expect, it } from 'vitest'
import starters from '@/engine/starters/starters.json'
import type { Slide } from '@/engine/types'
import { choiceChecks, factChecks, figures, renderChecks, slideText, wiringChecks } from '../../mcp-eval/checks'
import type { Case, Deck, ToolCall, Transcript } from '../../mcp-eval/types'

const key = (s: string) => figures(s).map((f) => f.key)
const scoring = starters.find((x) => x.id === 'scoring')?.consulting as unknown as Slide
const kase = (over: Partial<Case> = {}): Case => ({ id: 'c', group: 'criteria', style: 'consulting', prompt: 'Score the providers; Acme comes out on top', gold: 'table', acceptable: [], ask: false, files: [], facts: { numbers: [], names: [] }, questions: [], ...over })
const call = (tool: string, input: Record<string, unknown> = {}, result = '{}', isError = false): ToolCall => ({ name: `mcp__smartchart__${tool}`, input, result, isError })
const transcript = (calls: ToolCall[], finalText = '', denials: string[] = []): Transcript =>
  ({ init: null, calls, finalText, outcome: { isError: false, numTurns: 1, durationMs: 0, costUsd: 0, denials, text: finalText, structured: null } })
const deckOf = (slides: Slide[], style: Deck['style'] = 'consulting'): Deck => ({ id: 'd1', style, edit: 'http://localhost:5173/d/d1', slides: slides.map((slide, i) => ({ id: `s${i + 1}`, slide })) })
const good = [call('list_decks'), call('create_deck', { style: 'consulting' }), call('get_guide', { style: 'consulting' }), call('get_template', { template: 'table', style: 'consulting' }),
  call('create_slide', { deckId: 'd1', slide: scoring, request: 'Score the providers' }, '{"applied":true,"slideId":"s1"}'), call('check_slide', { deckId: 'd1', slideId: 's1' })]

describe('figures', () => {
  it('normalises format and scale, never rounds', () => {
    expect(key('£1,200k')).toEqual(key('£1.2m'))
    expect(key('(53)')).toEqual(key('-53'))
    expect(key('−53')).toEqual(key('53'))
    expect(key('42%')).not.toEqual(key('42'))
    expect(key('£84bn')).toEqual(['84000000000'])
    expect(key('11.0')).toEqual(key('11'))
    expect(key('11.4')).not.toEqual(key('11'))
  })
  it('skips codes that are not figures', () => {
    expect(key('FY25 Q1 H2')).toEqual([])
    expect(key('2019-2025')).toEqual(['2019', '2025'])
  })
  it('reads chart values raw and through their format, and skips positions', () => {
    const chart = { template: 'chart', title: 't', chart: { format: '£{v}m', categories: ['Jan'], series: [{ name: 'Spend', mark: 'bar', values: [18] }], annotations: [{ type: 'cagr', from: 0, to: 7 }] } } as unknown as Slide
    const k = key(slideText(chart))
    expect(k).toContain('18')
    expect(k).toContain('18000000')
    expect(k).not.toContain('7')
  })
})

describe('facts', () => {
  it('every request figure and name present: F1 and F2 pass', () => {
    const r = factChecks(kase({ facts: { numbers: [], names: ['Acme', 'Neobank'] } }), scoring, 'Score Acme and Neobank')
    expect(r.checks.map((c) => [c.id, c.ok])).toEqual([['F1', true], ['F2', true]])
  })
  it('a figure or name missing fails, and figures not in the request go to the judge', () => {
    const r = factChecks(kase({ facts: { numbers: ['£250k'], names: ['Amex'] } }), { ...scoring, takeaway: 'Saves £3,000 a year' }, 'limit £250k vs Amex')
    expect(r.checks.map((c) => c.ok)).toEqual([false, false])
    expect(r.unknown).toContain('£3,000')
  })
})

describe('choice', () => {
  it('right template, one slide, wrote without asking, style as expected', () => {
    expect(choiceChecks(kase(), transcript(good, 'Done'), deckOf([scoring])).map((c) => [c.id, c.ok])).toEqual([['S1', true], ['S2', true], ['S3', true], ['S4', true]])
  })
  it('two slides fail S2; another template fails S1; a pitch deck fails S4', () => {
    const r = choiceChecks(kase({ gold: 'chart' }), transcript(good), deckOf([scoring, scoring], 'pitch'))
    expect(r.filter((c) => !c.ok).map((c) => c.id)).toEqual(['S1', 'S2', 'S4'])
  })
  it('a clear request answered with a question fails S3; an ask case passes it', () => {
    const asked = transcript([call('list_decks')], 'Which competitors, and on what?')
    expect(choiceChecks(kase(), asked, null).find((c) => c.id === 'S3')?.ok).toBe(false)
    expect(choiceChecks(kase({ ask: true, gold: null }), asked, null).map((c) => [c.id, c.ok])).toEqual([['S2', true], ['S3', true]])
  })
})

describe('render', () => {
  it('fit issues fail R1, layout lints R2; a valid gallery slide passes R3', () => {
    const r = renderChecks(deckOf([scoring]), [{ slideId: 's1', fit: ['title wraps to 3 lines'], issues: ['table: L1'], warnings: [], png: '' }])
    expect(r.map((c) => [c.id, c.ok])).toEqual([['R1', false], ['R2', false], ['R3', true]])
  })
  it('no slide, no render checks', () => expect(renderChecks(null, [])).toEqual([]))
})

describe('wiring', () => {
  it('a well-behaved run passes P1–P7', () => {
    const r = wiringChecks(kase(), transcript(good, 'Added it: http://localhost:5173/d/d1'), deckOf([scoring]))
    expect(r.filter((c) => !c.ok)).toEqual([])
    expect(r.map((c) => c.id)).toEqual(['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7'])
  })
  it('writing first, leaving issues, no check, no request, setting the look, a long reply, a denied tool', () => {
    const bad = [call('create_deck', { style: 'consulting', theme: 'paper' }), call('create_slide', { deckId: 'd1', slide: { ...scoring, footer: 'x' } }, '{"applied":true,"issues":["title: too long"]}')]
    const r = wiringChecks(kase(), transcript(bad, `${'word '.repeat(130)} {"slide":1}`, ['Bash']), deckOf([scoring]))
    expect(r.filter((c) => !c.ok).map((c) => c.id)).toEqual(['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7'])
  })
})
