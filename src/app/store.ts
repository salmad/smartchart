/* Decks kept in this browser (localStorage): the dev account's decks, and a copy of a deck whose save to the account
   failed. A deck holds its slides, style and palette, the agent's conversation and the chat. */
import type { Slide, Style, Theme } from '@/engine/types'
import type { Check } from '@/engine/agent/checks'
import { plain } from '@/engine/slides/schema'
import type { ChatMessage } from '@/engine/agent/llm'
import type { TraceStep } from '@/engine/agent/agent'

export const KEY = 'smartchart.journey.decks.v1'

export interface Item { id: string; slide: Slide; status: 'ok' | 'draft'; errors: string[]; warnings: string[]; checks: Check[]; checksPending?: boolean }
/** `files`: what the user attached to the message, as its chips show them; their text went to the agent. */
export type Message = { kind: 'user' | 'bot' | 'error'; text: string; sub?: string; trace?: TraceStep[]; files?: { name: string; about: string }[] }
export interface SavedDeck { id: string; style: Style; theme: Theme; accent: string | null; current: number; items: Item[]; history: ChatMessage[]; working: string[]; messages?: Message[]; updated: number }
export interface Store { active: string | null; decks: Record<string, SavedDeck> }

/** How the app reaches saved decks, one deck at a time: on the server, or in this browser (a copy kept while saves fail; the dev account). */
/** A deck as a list shows it: name, time, size and the first slide in the deck's look. Open it with `get`. */
export interface DeckSummary { id: string; name: string; updated: number; slides: number; style: Style; theme: Theme; accent: string | null; first: Slide | null }
export const summaryOf = (d: SavedDeck): DeckSummary => ({
  id: d.id, name: deckName(d), updated: d.updated, slides: d.items?.length ?? 0, style: d.style, theme: d.theme, accent: d.accent ?? null, first: d.items?.[0]?.slide ?? null,
})

export interface Presence { busy?: { by: string; until: number }; editing?: { slideId: string; until: number } }
export interface DeckEvent { rev: number; by: string; slideId: string | null; what: string }

export interface DeckRepo {
  list(): Promise<DeckSummary[]>
  get(id: string): Promise<SavedDeck | null>
  /** Null when saved; otherwise why not, as a sentence (storage full, offline, what the server said). */
  save(deck: SavedDeck): Promise<string | null>
  remove(id: string): Promise<boolean>
  /* Live view of a deck other writers may change (an agent over MCP, another tab). The local repo leaves these out. */
  rev?(id: string): Promise<{ rev: number; presence: Presence } | null>
  events?(id: string, since: number): Promise<DeckEvent[]>
  presence?(id: string, p: { busy?: boolean; editing?: string | null }): Promise<void>
  /** The last copy read from or written to the server. */
  base?(id: string): SavedDeck | null
  /** The revision this tab holds. */
  known?(id: string): number
}

/** { active, decks }; an empty store when storage is missing, blocked or corrupt. */
export function loadStore(storage?: Pick<Storage, 'getItem'>): Store {
  try {
    // Reached inside the try: a browser that blocks storage throws on access.
    const s: unknown = JSON.parse((storage ?? localStorage).getItem(KEY) ?? 'null')
    if (s && typeof s === 'object' && 'decks' in s && s.decks && typeof s.decks === 'object') return s as Store
  } catch { /* private mode or bad JSON: start empty */ }
  return { active: null, decks: {} }
}

/** False when the browser refuses the write (storage full or blocked). */
export function saveStore(store: Store, storage?: Pick<Storage, 'setItem'>): boolean {
  try { (storage ?? localStorage).setItem(KEY, JSON.stringify(store)); return true } catch { return false }
}

/** Decks in this browser: copies kept while a save to the account fails, and the dev account's decks. */
export function localDeckRepo(storage?: Pick<Storage, 'getItem' | 'setItem'>): DeckRepo {
  const read = () => loadStore(storage), write = (s: Store) => saveStore(s, storage)
  return {
    list: async () => deckList(read()).map(summaryOf),
    get: async (id) => read().decks[id] ?? null,
    save: async (deck) => { const s = read(); s.decks[deck.id] = deck; s.active = deck.id; return write(s) ? null : 'This browser’s storage is full.' },
    remove: async (id) => { const s = read(); if (!s.decks[id]) return false; delete s.decks[id]; if (s.active === id) s.active = null; return write(s) },
  }
}

export const newDeckId = (): string => `d_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

/** Newest first. */
export const deckList = (store: Store): SavedDeck[] => Object.values(store.decks).sort((a, b) => (b.updated || 0) - (a.updated || 0))

/** Named after the cover, else the first slide's title. */
export function deckName(d: { items?: Item[] }): string {
  const slides = (d.items || []).map((it) => it.slide)
  const t = (slides.find((s) => s.template === 'cover') || slides[0])?.title
  // Markup is stripped in pairs, as the slide draws it, so the name reads exactly as the title on the slide.
  return t ? plain(t).trim() || 'Untitled deck' : 'Untitled deck'
}

/** Server-changed slides are taken; slides changed here since `base` are kept; order follows the server, with local-only slides after their previous neighbour. Chat (history, messages, working) stays local. */
const same = (a: Item | undefined, b: Item | undefined) => !!a && !!b && JSON.stringify(a.slide) === JSON.stringify(b.slide)

export function mergeDecks(local: SavedDeck, server: SavedDeck, base: SavedDeck | null): { deck: SavedDeck; changed: string[] } {
  const byId = (d: SavedDeck | null) => new Map((d?.items ?? []).map((it) => [it.id, it]))
  const L = byId(local), S = byId(server), B = byId(base)
  const mine = (id: string) => L.has(id) && !same(L.get(id), B.get(id))           // changed or added here
  const items: Item[] = [], changed: string[] = []
  for (const s of server.items) {
    if (mine(s.id)) { items.push(L.get(s.id) as Item); continue }
    items.push(s)
    if (!same(s, B.get(s.id))) changed.push(s.id)
  }
  // Kept here: added locally, or edited locally but deleted on the server. Each goes after its local predecessor.
  local.items.forEach((it, i) => {
    if (S.has(it.id) || !mine(it.id)) return
    const prev = local.items.slice(0, i).reverse().find((p) => items.some((x) => x.id === p.id))
    items.splice(prev ? items.findIndex((x) => x.id === prev.id) + 1 : 0, 0, it)
  })
  // The look follows the same rule as slides: a field changed here since `base` is kept, otherwise the server's is taken.
  const take = <K extends 'style' | 'theme' | 'accent'>(k: K): SavedDeck[K] => (base && local[k] !== base[k] ? local[k] : server[k])
  return { deck: { ...local, style: take('style'), theme: take('theme'), accent: take('accent'), items }, changed }
}
