/* Decks kept in this browser (localStorage). A deck holds its slides, style and palette, the agent's
   conversation and the chat, so a reload continues where it stopped. Nothing leaves the browser.
   Same key and shape as the prototype's decks.js, so decks saved there open here. */
import type { Slide, Style, Theme } from '@/engine/types'
import type { Check } from '@/engine/agent/checks'
import type { ChatMessage } from '@/engine/agent/llm'
import type { TraceStep } from '@/engine/agent/agent'

export const KEY = 'smartchart.journey.decks.v1'

export interface Item { id: string; slide: Slide; status: 'ok' | 'draft'; errors: string[]; warnings: string[]; checks: Check[]; checksPending?: boolean }
export type Message = { kind: 'user' | 'bot' | 'error'; text: string; sub?: string; trace?: TraceStep[] }
/** `thread` is the prototype's chat as HTML; v1 writes `messages` instead and keeps an old `thread` as is. */
export interface SavedDeck { id: string; style: Style; theme: Theme; accent: string | null; current: number; items: Item[]; history: ChatMessage[]; working: string[]; messages?: Message[]; thread?: string; updated: number }
export interface Store { active: string | null; decks: Record<string, SavedDeck> }

/** How the app reaches saved decks: async, so a server-backed repo can replace the browser one. */
export interface DeckRepo { load(): Promise<Store>; save(store: Store): Promise<boolean> }

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

export function localDeckRepo(storage?: Pick<Storage, 'getItem' | 'setItem'>): DeckRepo {
  return { load: async () => loadStore(storage), save: async (store) => saveStore(store, storage) }
}

export const newDeckId = (): string => `d_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

/** Newest first. */
export const deckList = (store: Store): SavedDeck[] => Object.values(store.decks).sort((a, b) => (b.updated || 0) - (a.updated || 0))

/** Named after the cover, else the first slide's title. */
export function deckName(d: { items?: Item[] }): string {
  const slides = (d.items || []).map((it) => it.slide)
  const t = (slides.find((s) => s.template === 'cover') || slides[0])?.title
  return t ? t.replace(/\[\[|\]\]|\[[-+]|[-+]\]|\*\*/g, '').trim() : 'Untitled deck'
}
