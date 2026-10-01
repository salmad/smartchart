import { describe, expect, it } from 'vitest'
import { INSTRUCTIONS } from '../../src/engine/tools/instructions'
import { guideText } from '../../src/engine/tools/guide-text'
import { describe as card, MENU, OFFERED } from '../../src/engine/slides/schema'
import { exampleFor } from '../../src/engine/agent/prompts'

const tokens = (s: string) => Math.ceil(s.length / 4)
const list = JSON.stringify({ templates: OFFERED.map((id) => ({ template: id, summary: MENU[id].summary, use: MENU[id].use })), next: 'get_template for the one you pick; suggest_template to have SmartChart choose from the content.' })

describe('context budgets (tokens ≈ chars / 4)', () => {
  it('instructions ≤ 400', () => expect(tokens(INSTRUCTIONS)).toBeLessThanOrEqual(400))
  it.each(['consulting', 'pitch'] as const)('get_guide %s ≤ 1500', (s) => expect(tokens(guideText(s))).toBeLessThanOrEqual(1500))
  it('list_templates ≤ 400', () => expect(tokens(list)).toBeLessThanOrEqual(400))
  for (const s of ['consulting', 'pitch'] as const) for (const t of OFFERED) {
    it(`${t} card (${s}) ≤ 3000`, () => expect(tokens(JSON.stringify(card(t, s)))).toBeLessThanOrEqual(3000))
    it(`${t} example (${s}) ≤ 1000`, () => expect(tokens(exampleFor(t, s))).toBeLessThanOrEqual(1000))
  }
})
