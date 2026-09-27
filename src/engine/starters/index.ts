/* The starters: the one approved gallery. The landing, Add slide, the agent's worked examples, the review
   page and the tests all read this file; there is no other example set. */
import { validateDeck } from '../slides/schema'
import type { Slide, Style } from '../types'
import data from './starters.json' with { type: 'json' }

export type Group = 'charts' | 'tables' | 'cards' | 'numbers' | 'structure'
export const GROUPS: readonly { id: Group; label: string }[] = [
  { id: 'charts', label: 'Charts' }, { id: 'tables', label: 'Tables' }, { id: 'cards', label: 'Cards' },
  { id: 'numbers', label: 'Big number and plans' }, { id: 'structure', label: 'Structure' },
]
export interface Starter { id: string; group: Group; label: string; blurb: string; consulting: Slide; pitch: Slide }
export const FOOTER = 'Acme · Board memorandum'

// JSON has no literal types: the schema check below is what makes these Slides.
export const STARTERS: readonly Starter[] = data as unknown as Starter[]
for (const style of ['consulting', 'pitch'] as const) {
  const { errors } = validateDeck({ style, slides: STARTERS.map((s) => s[style]) })
  if (errors.length) throw new Error(`starters.json (${style}): ${errors.join('; ')}`)
}
for (const s of STARTERS) if (!GROUPS.some((g) => g.id === s.group)) throw new Error(`starters.json: ${s.id} has unknown group ${s.group}`)

/** A deep copy of the starter in one style, safe to put in a deck. */
export function starterSlide(s: Starter, style: Style): Slide {
  return structuredClone(s[style])
}
