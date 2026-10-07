import type { AccountPort, DeckDoc, ToolContext } from '../../src/engine/tools/types'
import type { JevFn } from '../../src/engine/agent/llm'
import { fakeJev } from './fakes'

export const emptyDeck = (over: Partial<DeckDoc> = {}): DeckDoc => ({ id: 'd_1', name: 'Deck', style: 'consulting', theme: 'ink', accent: null, slides: [], comments: [], ...over })
export function fakePort(over: Partial<AccountPort> = {}): AccountPort {
  let n = 0
  return { email: 'a@b.c', callsLeftToday: async () => 1990, listDecks: async () => ({ decks: [] }), share: async () => 'https://x/s/tok', newDeckId: () => `d_new${++n}`, versions: async () => [], blobs: async () => [],
    addImage: async ({ kind }) => ({ src: `https://store1.public.blob.vercel-storage.com/img/0123456789abcdef-${kind}-800x200.png`, width: 800, height: 200, kind }), ...over }
}
export function ctxFor(over: Partial<ToolContext> & { jev?: JevFn } = {}): ToolContext {
  return { deck: emptyDeck(), rev: 1, links: { edit: 'https://x/d/d_1', share: null }, presence: {}, port: fakePort(), jev: fakeJev(), now: () => 1000, ...over }
}
