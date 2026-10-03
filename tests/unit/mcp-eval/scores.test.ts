import { describe, expect, it } from 'vitest'
import starters from '@/engine/starters/starters.json'
import type { Slide } from '@/engine/types'
import { galleryHtml, reportMd } from '../../mcp-eval/report'
import { allChecks, isMagic, summarize } from '../../mcp-eval/scores'
import type { Case, Run, Verdict } from '../../mcp-eval/types'

const scoring = starters.find((x) => x.id === 'scoring')?.consulting as unknown as Slide
const c: Case = { id: 't01', group: 'criteria', style: 'consulting', prompt: 'p', gold: 'table', acceptable: [], ask: false, files: [], facts: { numbers: [], names: [] },
  questions: [{ q: 'Is Acme highlighted?', must: true }, { q: 'Nice icons?', must: false }] }
const ask: Case = { ...c, id: 'q01', group: 'ask', gold: null, ask: true, questions: [] }
const passing = ['S1', 'S2', 'S3', 'S4', 'F1', 'F2', 'R1', 'R2', 'R3', 'P1'].map((id) => ({ id, ok: true, msg: '' }))
const verdict = (over: Partial<Verdict> = {}): Verdict => ({
  generic: [{ id: 'G1', yes: true, why: '' }, { id: 'G2', yes: true, why: '' }],
  case: [{ q: 'Is Acme highlighted?', yes: true, why: '' }, { q: 'Nice icons?', yes: false, why: 'decorative' }],
  numbers: [], magic: { presentAsIs: false, fix: 'shorter title' },
  confusedBy: [{ mismatch: 'Nice icons? no', quote: 'Header icons: columns that are categories', source: 'template card', why: 'read as decoration', fix: 'say: not over entities' }], ...over })
const run = (over: Partial<Run> = {}): Run => ({ id: 't01#1', caseId: 't01', n: 1, status: 'done', transcript: null,
  deck: { id: 'd', style: 'consulting', edit: 'e', slides: [{ id: 's1', slide: scoring }] }, measured: [], checks: passing, unknownFigures: [], verdict: verdict(), judgeModel: 'opus', ...over })

describe('scores', () => {
  it('magic: gating checks and must questions pass; a failed non-must question and M1 do not block it', () => {
    expect(isMagic(run(), c)).toBe(true)
  })
  it('a failed must question blocks magic', () => {
    expect(isMagic(run({ verdict: verdict({ case: [{ q: 'x', yes: false, why: 'no' }, { q: 'y', yes: true, why: '' }] }) }), c)).toBe(false)
  })
  it('an unjudged slide is not magic yet; an ask case needs no judge', () => {
    expect(isMagic(run({ verdict: undefined }), c)).toBe(false)
    expect(isMagic(run({ caseId: 'q01', deck: null, verdict: undefined, checks: [{ id: 'S2', ok: true, msg: '' }, { id: 'S3', ok: true, msg: '' }] }), ask)).toBe(true)
  })
  it('an invented figure fails F3 and is fatal; derived ones pass', () => {
    const invented = allChecks(run({ unknownFigures: ['£3,000'], verdict: verdict({ numbers: [{ value: '£3,000', kind: 'invented', why: 'not in the request' }] }) }), c)
    expect(invented.find((k) => k.id === 'F3')?.ok).toBe(false)
    const derived = allChecks(run({ unknownFigures: ['£1.2m'], verdict: verdict({ numbers: [{ value: '£1.2m', kind: 'derived', why: 'sum' }] }) }), c)
    expect(derived.find((k) => k.id === 'F3')?.ok).toBe(true)
  })
  it('summary: rates by check, group and case; limited and errors apart; runs of removed cases ignored', () => {
    const s = summarize([run(), run({ id: 't01#2', n: 2, verdict: undefined }), run({ id: 't01#3', status: 'limited' }), run({ id: 'gone#1', caseId: 'gone' })], [c])
    expect([s.done, s.limited, s.judged, s.magic]).toEqual([2, 1, 1, { n: 1, of: 2 }])
    expect(s.cases.t01).toEqual({ n: 1, of: 2 })
    expect(s.checks.Q1).toEqual({ n: 1, of: 1 })
  })
  it('a failed generic question blocks magic', () => {
    expect(isMagic(run({ verdict: verdict({ generic: [{ id: 'G1', yes: false, why: 'topic label' }, { id: 'G2', yes: true, why: '' }] }) }), c)).toBe(false)
  })
  it('report: headline, deltas against a baseline, failures listed, confusions grouped by source; gallery escapes text', () => {
    const runs = [run()], s = summarize(runs, [c]), base = { ...s, magic: { n: 0, of: 2 } }
    const md = reportMd('abc-2026-10-03', s, runs, [c], { label: 'old', s: base })
    expect(md).toContain('| Magic rate | 100% (1/1) | +100 |')
    expect(md).toContain('Q2')
    expect(md).toContain('### template card')
    expect(md).toContain('Header icons: columns that are categories')
    expect(galleryHtml('x', [run({ transcript: { init: null, calls: [], finalText: '<b>', outcome: null } })], [c], (p) => p)).toContain('&lt;b&gt;')
  })
})
