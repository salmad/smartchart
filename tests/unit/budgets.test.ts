import { describe, expect, it } from 'vitest'
import { INSTRUCTIONS } from '../../src/engine/tools/instructions'
import { docGuideText, guideText } from '../../src/engine/tools/guide-text'
import { describe as card, MENU, OFFERED } from '../../src/engine/slides/schema'
import { exampleFor } from '../../src/engine/agent/prompts'

const tokens = (s: string) => Math.ceil(s.length / 4)
const list = JSON.stringify({ templates: OFFERED.map((id) => ({ template: id, summary: MENU[id].summary, use: MENU[id].use })), next: 'get_template for the one you pick; suggest_template to have Occam choose from the content.' })

describe('context budgets (tokens ≈ chars / 4)', () => {
  // 400 for decks; the docs paragraph (spec 2026-10-19 §6) is about 60 more.
  it('instructions ≤ 495', () => expect(tokens(INSTRUCTIONS)).toBeLessThanOrEqual(495))
  it('get_guide doc ≤ 1100', () => expect(tokens(docGuideText())).toBeLessThanOrEqual(1100))
  it.each(['consulting', 'pitch'] as const)('get_guide %s ≤ 2000', (s) => expect(tokens(guideText(s))).toBeLessThanOrEqual(2000))
  // 660 for fifteen templates (450 for ten, 400 for seven): about 44 tokens each.
  it('list_templates ≤ 660', () => expect(tokens(list)).toBeLessThanOrEqual(660))
  for (const s of ['consulting', 'pitch'] as const) for (const t of OFFERED) {
    // Cards with capability guidance may add ~600 tokens (spec 2026-10-03 §2).
    const cap = MENU[t].capabilities?.length ? 3600 : 3000
    it(`${t} card (${s}) ≤ ${cap}`, () => expect(tokens(JSON.stringify(card(t, s)))).toBeLessThanOrEqual(cap))
    it(`${t} example (${s}) ≤ 1000`, () => expect(tokens(exampleFor(t, s))).toBeLessThanOrEqual(1000))
  }
})
