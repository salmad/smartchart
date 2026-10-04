/* The starters: the one approved gallery. The landing, Add slide, the agent's worked examples, the review
   page and the tests all read this file; there is no other example set. */
import { validateDeck } from '../slides/schema.js'
import type { Slide, Style } from '../types.js'
import data from './starters.json' with { type: 'json' }

/** Starters are grouped by what the slide has to do for the person making it, not by what it is drawn with. */
export type Group = 'trend' | 'change' | 'compare' | 'number' | 'case' | 'plan' | 'open'
/** Deck order: the title and chapter slides open a deck, so they come first everywhere starters are listed. */
export const GROUPS: readonly { id: Group; label: string }[] = [
  { id: 'open', label: 'Open the deck' }, { id: 'trend', label: 'Show a trend' }, { id: 'change', label: 'Explain a change' }, { id: 'compare', label: 'Compare options' },
  { id: 'number', label: 'Land one number' }, { id: 'case', label: 'Make the case' }, { id: 'plan', label: 'Lay out a plan' },
]
export interface Starter { id: string; group: Group; label: string; blurb: string; consulting: Slide; pitch: Slide }
export const FOOTER = 'Occam'

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
