import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { proposeDoc, proposeMessages } from '../../src/engine/agent/propose'
import type { CompleteFn } from '../../src/engine/agent/propose'
import { identify } from '../../src/engine/docs/ops'
import { parseDoc } from '../../src/engine/docs/parse'
import { checkProposal } from '../../src/engine/docs/proposals'

const fixture = (name: string) =>
  readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), `../fixtures/docs/${name}`), 'utf8')

const calls: { messages: unknown; max_tokens?: number }[] = []
const fakeComplete = (text: string | ((n: number) => string)): CompleteFn => async (args) => {
  calls.push(args)
  return typeof text === 'function' ? text(calls.length) : text
}

describe('proposeDoc', () => {
  it('a doc that reads well makes no call', async () => {
    calls.length = 0
    const doc = parseDoc(fixture('reels.md')).doc
    expect(await proposeDoc(doc, { rev: 1, complete: fakeComplete('{}') })).toEqual([])
    expect(calls).toHaveLength(0)
  })

  it('proposals come back checked, best first, at most 5', async () => {
    calls.length = 0
    const doc = parseDoc(fixture('wall-of-text.md')).doc
    const para = identify(doc).find(({ block }) => block.type === 'paragraph')
    expect(para?.id).toBeTruthy()
    const paraText = para!.block.type === 'paragraph' ? para!.block.text : ''
    const bullets = paraText.split(/\s+/).filter(Boolean).map((w) => `- ${w}`).join('\n')
    const payload = {
      proposals: [
        {
          blockIds: [para!.id],
          mode: 'replace' as const,
          kind: 'text',
          label: 'Bold-label bullets',
          why: 'Easier to skim',
          body: bullets,
        },
        {
          blockIds: ['nope'],
          mode: 'replace' as const,
          kind: 'text',
          label: 'Bad',
          why: 'Missing block',
          body: 'One two',
        },
      ],
    }
    const out = await proposeDoc(doc, {
      rev: 2,
      complete: fakeComplete(JSON.stringify(payload)),
      now: () => 9,
    })
    expect(out.length).toBeLessThanOrEqual(5)
    expect(out.length).toBe(1)
    expect(out[0].by).toBe('Occam')
    expect(checkProposal(doc, out[0]).ok).toBe(true)
  })

  it('an invalid proposal is repaired once, then dropped', async () => {
    calls.length = 0
    const doc = parseDoc(fixture('wall-of-text.md')).doc
    const para = identify(doc).find(({ block }) => block.type === 'paragraph')
    expect(para?.id).toBeTruthy()
    const bad = {
      proposals: [{
        blockIds: [para!.id],
        mode: 'replace' as const,
        kind: 'table',
        label: 'Try as grouped table',
        why: 'Categories',
        body: { caption: 'x'.repeat(50), table: { columns: [{ label: 'A' }], rows: [] } },
      }],
    }
    const good = {
      proposals: [{
        blockIds: [para!.id],
        mode: 'insert' as const,
        kind: 'callout',
        label: 'Callout note',
        why: 'Break the run',
        body: { tone: 'note', text: 'Skim the exhibit above.' },
      }],
    }
    const complete = fakeComplete((n) => (n === 1 ? JSON.stringify(bad) : JSON.stringify(good)))
    const out = await proposeDoc(doc, { rev: 1, complete, now: () => 10 })
    expect(calls).toHaveLength(2)
    expect(out.length).toBe(1)
    expect(out[0].figure?.kind).toBe('callout')
  })

  it('the prompt asks for grouped tables and carries the catalogue limits', () => {
    const doc = parseDoc(fixture('wall-of-text.md')).doc
    const sys = proposeMessages(doc, []).find((m) => m.role === 'system')?.content ?? ''
    expect(sys).toMatch(/group/i)
    expect(sys).toMatch(/40/)
  })
})
