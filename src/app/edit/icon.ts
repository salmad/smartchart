/* "Pick for me" on a card's icon: the same single Jev question the agent's write asks for an "auto" icon (resolve.ts),
   asked about one card from its own words. It returns the icon; the caller writes it, so the user sees it before saving. */
import { resolveAuto } from '@/engine/agent/resolve'
import type { JevFn } from '@/engine/agent/llm'
import type { Slide, Style } from '@/engine/types'

export async function pickIcon(slide: Slide, index: number, style: Style, jev: JevFn): Promise<string> {
  const card = slide.cards?.[index]
  if (!card || card.icon === undefined) throw new Error('This card has no icon to pick.')
  const ask = structuredClone(slide)
  // Only this card is "auto": every other icon is concrete and untouched, so the call is about one card.
  ask.cards = ask.cards?.map((c, i) => (i === index ? { ...c, icon: 'auto' } : c))
  const { slide: done } = await resolveAuto(ask, style, jev)
  return done.cards?.[index]?.icon ?? 'circle-check'
}
