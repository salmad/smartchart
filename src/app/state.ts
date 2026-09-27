/* App state as a pure reducer, so React components stay thin. */
import type { Deck, Slide, Style, Theme } from '@/engine/types'
import type { ChatMessage } from '@/engine/agent/llm'
import type { Pill } from '@/engine/agent/suggest'
import { newDeckId, type Item, type Message, type SavedDeck } from './store'

export type View = 'landing' | 'editor' | 'add'
export interface AppState {
  deckId: string | null; style: Style; theme: Theme; accent: string | null
  items: Item[]; current: number; history: ChatMessage[]; working: Set<string>
  messages: Message[]; legacyThread: string | null
  busy: boolean; live: boolean; view: View
  pills: Record<string, { key: string; pending: boolean; pills: Pill[] }>
}
export type Action =
  | { type: 'open'; deck: SavedDeck } | { type: 'new' } | { type: 'set'; patch: Partial<AppState> }
  | { type: 'select'; index: number } | { type: 'message'; message: Message } | { type: 'items'; items: Item[]; focusId?: string }
  | { type: 'pickStarter'; slide: Slide; id: string } | { type: 'insertStarter'; slide: Slide; id: string }

/** The first instruction on a new deck; it goes once a slide is picked, so two instructions never stack. */
export const LANDING = 'Pick a ready-made slide, or describe your own. Paste numbers, a table or notes and say what the slide should argue.'
const PICKED = "Here's your slide. Tell me what to change: your numbers, your words, a different chart."

export function initialState(): AppState {
  return {
    deckId: null, style: 'consulting', theme: 'ink', accent: null,
    items: [], current: 0, history: [], working: new Set(), messages: [], legacyThread: null,
    busy: false, live: false, view: 'landing', pills: {},
  }
}

const clamp = (i: number, items: Item[]) => Math.max(0, Math.min(i, items.length - 1))
const starterItem = (id: string, slide: Slide): Item => ({ id, slide, status: 'ok', errors: [], warnings: [], checks: [] })

export function reducer(s: AppState, a: Action): AppState {
  switch (a.type) {
    case 'open': {
      const d = a.deck, items = d.items || []
      return {
        ...s, deckId: d.id, style: d.style, theme: d.theme, accent: d.accent || null,
        items, current: clamp(d.current || 0, items), history: d.history || [], working: new Set(d.working || []),
        messages: d.messages ?? [], legacyThread: d.thread ?? null,
        view: items.length ? 'editor' : 'landing', pills: {},
      }
    }
    case 'new':
      return { ...initialState(), deckId: newDeckId(), live: s.live, style: s.style, theme: s.theme, accent: s.accent, view: 'landing' }
    case 'set':
      return { ...s, ...a.patch }
    case 'select':
      return { ...s, current: clamp(a.index, s.items) }
    case 'message':
      return { ...s, messages: [...s.messages, a.message] }
    case 'items': {
      const at = a.focusId ? a.items.findIndex((it) => it.id === a.focusId) : -1
      return { ...s, items: a.items, current: at >= 0 ? at : clamp(s.current, a.items) }
    }
    case 'pickStarter':
      // Double clicks and clicks while busy must still give one deck with one slide.
      if (s.busy || s.items.length) return s
      return {
        ...s, deckId: s.deckId ?? newDeckId(), items: [starterItem(a.id, a.slide)], current: 0, view: 'editor',
        messages: [...s.messages.filter((m) => m.text !== LANDING), { kind: 'bot', text: PICKED }],
      }
    case 'insertStarter': {
      if (s.busy) return s
      const at = Math.min(s.current + 1, s.items.length), items = s.items.slice()
      items.splice(at, 0, starterItem(a.id, a.slide))
      return { ...s, items, current: at, view: 'editor' }
    }
  }
}

/** The deck as saved; null for an empty deck, which is not kept. */
export function toSaved(s: AppState): SavedDeck | null {
  if (!s.deckId || (!s.items.length && !s.history.length)) return null
  return {
    id: s.deckId, style: s.style, theme: s.theme, accent: s.accent, current: s.current,
    items: s.items.map(({ checksPending: _pending, ...it }) => it), history: s.history, working: [...s.working],
    messages: s.messages,
    // A deck opened from the prototype keeps its old chat, so it still shows the next time.
    ...(s.legacyThread !== null ? { thread: s.legacyThread } : {}),
    updated: Date.now(),
  }
}

/** The engine's deck: the footer is the cover title, else "SmartChart · Draft". */
export function deckOf(s: AppState): Deck {
  const cover = s.items.find((i) => i.slide.template === 'cover')
  const footer = cover ? cover.slide.title.replace(/\[\[|\]\]/g, '') : 'SmartChart · Draft'
  return { style: s.style, theme: s.theme, accent: s.accent, footer, slides: s.items.map((i) => i.slide) }
}
