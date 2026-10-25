import { DEFAULT_USER_LOOK } from '../../src/engine/look'
import type { AccountPort, DeckDoc, ToolContext } from '../../src/engine/tools/types'
import type { JevFn } from '../../src/engine/agent/llm'
import { fakeJev } from './fakes'

export const emptyDeck = (over: Partial<DeckDoc> = {}): DeckDoc => ({ id: 'd_1', name: 'Deck', style: 'consulting', theme: 'ink', accent: null, slides: [], comments: [], ...over })
export function fakePort(over: Partial<AccountPort> = {}): AccountPort {
  let n = 0
  return { email: 'a@b.c', callsLeftToday: async () => 1990, workspaces: async () => [{ workspaceId: 'ws_1', name: 'Mine', role: 'owner' }], listDecks: async () => ({ workspaceId: 'ws_1', decks: [] }), share: async () => 'https://x/s/tok', newDeckId: () => `d_new${++n}`, newDocId: () => `doc_new${++n}`, listDocs: async () => ({ workspaceId: 'ws_1', docs: [] }), versions: async () => [], blobs: async () => [],
    movePage: async () => 'ok',
    addImage: async ({ kind }) => ({ src: `https://store1.public.blob.vercel-storage.com/img/0123456789abcdef-${kind}-800x200.png`, width: 800, height: 200, kind }), ...over }
}
export function ctxFor(over: Partial<ToolContext> & { jev?: JevFn } = {}): ToolContext {
  return { deck: emptyDeck(), rev: 1, userLook: DEFAULT_USER_LOOK, links: { edit: 'https://x/d/d_1', share: null }, presence: {}, file: null, docPresence: {}, port: fakePort(), jev: fakeJev(), now: () => 1000, ...over }
}
