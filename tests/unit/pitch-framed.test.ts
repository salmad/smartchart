import { expect, test } from 'vitest'
import { catalogue, describe as card, validate } from '@/engine/slides/schema'
import { agentSystem } from '@/engine/agent/agent-prompt'
import { GUIDE, MENU_OPTIONS, exampleFor } from '@/engine/agent/prompts'
import { leadQ, leads } from '@/engine/agent/pre'
import { startersFor } from '@/engine/starters'

// Framed contrast cards are withdrawn from pitch decks until their pitch form is solved: nothing a pitch model reads
// may offer them, while slides made before still render, with a warning.
test('pitch never offers framed cards', () => {
  const seen = [JSON.stringify(card('cards', 'pitch')), agentSystem('pitch'), catalogue(), GUIDE, JSON.stringify(MENU_OPTIONS),
    leadQ('pitch'), JSON.stringify(leads('pitch')), exampleFor('cards', 'pitch'), exampleFor('cards', 'pitch', 'framed')]
  for (const text of seen) expect(text).not.toMatch(/framed|them vs us/i)
  expect(startersFor('pitch').map((s) => s.id)).not.toContain('cards-framed')
  expect(JSON.stringify(card('cards', 'consulting'))).toMatch(/framed/)
  expect(leads('consulting')).toHaveProperty('framed')
})

test('a pitch slide made with framed cards still validates, with a warning', () => {
  const r = validate({ template: 'cards', title: 'The difference', subtitle: 'Set once, checked every time.', framed: true, cards: [
    { tone: 'neutral', label: 'Blank canvas', title: 'Start over', text: 'Every slide sized and spaced again.' },
    { tone: 'focus', label: 'Occam', title: 'Set once', text: 'Rules set the layout.' }] }, 'pitch')
  expect(r.errors).toEqual([])
  expect(r.warnings.join(' ')).toMatch(/no longer offered in pitch/)
})
