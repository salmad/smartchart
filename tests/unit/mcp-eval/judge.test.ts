import { describe, expect, it } from 'vitest'
import starters from '@/engine/starters/starters.json'
import type { Slide } from '@/engine/types'
import { genericQuestions, judgePrompt, judgeSchema, transcriptText } from '../../mcp-eval/judge'
import type { Case, Transcript } from '../../mcp-eval/types'

const scoring = starters.find((x) => x.id === 'scoring')?.consulting as unknown as Slide
const c: Case = { id: 't', group: 'criteria', style: 'consulting', prompt: 'p', gold: 'table', acceptable: [], ask: false, files: [], facts: { numbers: [], names: [] },
  questions: [{ q: 'Is Acme highlighted?', must: true }, { q: 'Are marks used?', must: false }] }
const t: Transcript = { init: null, finalText: 'REPLY', outcome: null, calls: [
  { name: 'mcp__smartchart__create_slide', input: { slide: { title: 'x' } }, result: '{"issues":["title: too long"]}', isError: false },
  { name: 'mcp__smartchart__check_slide', input: {}, result: '{"checks":[{"id":"J9","ok":false,"msg":"Judgements in words may read faster as marks"}]}', isError: false },
] }

describe('judge', () => {
  it('generic questions: the so-what title in consulting only, the body proving it in both', () => {
    expect(genericQuestions('consulting').map((g) => g.id)).toEqual(['G1', 'G2'])
    expect(genericQuestions('pitch').map((g) => g.id)).toEqual(['G2'])
  })
  it('schema: exact counts, the sources enum for what confused the agent', () => {
    const s = judgeSchema(2, 3)
    expect([s.properties?.generic.minItems, s.properties?.case.maxItems]).toEqual([2, 3])
    expect(s.properties?.confusedBy.items?.properties?.source.enum).toContain('template card')
  })
  it('the transcript shows every call with Occam’s issues and Jev’s verdicts, then the reply', () => {
    const x = transcriptText(t)
    for (const s of ['1. create_slide', 'title: too long', '2. check_slide', 'J9', 'REPLY']) expect(x).toContain(s)
  })
  it('the prompt carries the screenshot, request, transcript, lints, every question and the figures to classify', () => {
    const p = judgePrompt({ c, request: 'REQ', t, slide: scoring, style: 'consulting', lints: ['table: L1'], unknown: ['£3,000'] })
    for (const s of ['slide.png', 'REQ', 'title: too long', 'table: L1', 'G1.', '1. Is Acme highlighted?', '2. Are marks used?', '£3,000', 'confusedBy']) expect(p).toContain(s)
  })
})
