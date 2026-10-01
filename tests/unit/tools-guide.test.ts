import { describe, expect, it } from 'vitest'
import { guideTools } from '../../src/engine/tools/guide'
import { accountTools } from '../../src/engine/tools/account'
import { ctxFor } from './tool-ctx'
import { must } from './must'
import type { AnyTool } from '../../src/engine/tools/types'
import { guideText } from '../../src/engine/tools/guide-text'

describe('guideText', () => {
  it('carries the shared rules and the style, not the in-app parts', () => {
    const g = guideText('consulting')
    expect(g).toContain('Use every figure the user gave, exactly as given.')
    expect(g).toContain('action title')
    expect(g).toContain('Ask your user')
    expect(g).not.toContain('patch_slide')
    expect(g).not.toContain('Working slides')
    expect(g).not.toContain('suggested next steps')
  })
  it('pitch has its own style block', () => expect(guideText('pitch')).toContain('one-line topic title'))
})
const run = (tools: AnyTool[], name: string, input: unknown) => must(tools.find((t) => t.name === name), name).run(ctxFor(), input)

describe('guide and account tools', () => {
  it('whoami', async () => expect((await run(accountTools, 'whoami', {})).result).toEqual({ email: 'a@b.c', callsLeftToday: 1990, contract: '2026-10-01' }))
  it('list_templates offers no archived template', async () => {
    const r = (await run(guideTools, 'list_templates', { style: 'consulting' })).result as { templates: { template: string }[]; next: string }
    expect(r.templates.map((t) => t.template)).not.toContain('number')
    expect(r.next).toContain('suggest_template')
  })
  it('get_template gives the card and a parsed example', async () => {
    const r = (await run(guideTools, 'get_template', { template: 'chart', style: 'pitch' })).result as { card: { template: string }; example: { template: string } }
    expect(r.card.template).toBe('chart')
    expect(r.example.template).toBe('chart')
  })
})
