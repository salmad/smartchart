/* App state as a pure reducer, so React components stay thin. */
import type { Deck, Slide, Style, Theme } from '@/engine/types'
import type { ChatMessage } from '@/engine/agent/llm'
import type { Pill } from '@/engine/agent/suggest'
import { plain } from '@/engine/slides/schema'
import { newDeckId, type Item, type Message, type SavedDeck } from './store'

export type View = 'landing' | 'editor' | 'add'
export interface AppState {
  deckId: string | null; style: Style; theme: Theme; accent: string | null
  /** What the maker called the deck; null while it follows its first title. */
  name: string | null
  items: Item[]; current: number; history: ChatMessage[]; working: Set<string>
  messages: Message[]
  busy: boolean; live: boolean; view: View
  pills: Record<string, { key: string; pending: boolean; pills: Pill[] }>
  /** The last slide deleted and where it was, so it can come back (Undo). */
  removed: { item: Item; at: number } | null
  /** The slide being edited by hand; while set, nothing else writes the deck (spec 4). */
  editing: string | null
  /** Slides saved by hand since the last turn: the next turn's deck state names them, then this clears. */
  edited: string[]
}
export type Action =
  | { type: 'open'; deck: SavedDeck } | { type: 'new' } | { type: 'set'; patch: Partial<AppState> }
  | { type: 'select'; index: number } | { type: 'message'; message: Message } | { type: 'items'; items: Item[]; focusId?: string }
  | { type: 'pickStarter'; slide: Slide; id: string } | { type: 'insertStarter'; slide: Slide; id: string }
  | { type: 'removeSlide'; id: string } | { type: 'restoreSlide' } | { type: 'moveSlide'; id: string; to: number }
  | { type: 'edit'; id: string | null }

const PICKED = "Here's your slide. Tell me what to change: your numbers, your words, a different chart."

export function initialState(): AppState {
  return {
    deckId: null, name: null, style: 'consulting', theme: 'ink', accent: null,
    items: [], current: 0, history: [], working: new Set(), messages: [],
    busy: false, live: false, view: 'landing', pills: {}, removed: null, editing: null, edited: [],
  }
}

/** A turn runs or a slide is being edited: nothing else may change the deck. */
export const locked = (s: Pick<AppState, 'busy' | 'editing'>) => s.busy || s.editing !== null

const clamp = (i: number, items: Item[]) => Math.max(0, Math.min(i, items.length - 1))
const starterItem = (id: string, slide: Slide): Item => ({ id, slide, status: 'ok', errors: [], warnings: [], checks: [] })

export function reducer(s: AppState, a: Action): AppState {
  switch (a.type) {
    case 'open': {
      if (s.editing) return s
      const d = a.deck, items = d.items || []
      return {
        ...s, deckId: d.id, name: d.name ?? null, style: d.style, theme: d.theme, accent: d.accent || null,
        items, current: clamp(d.current || 0, items), history: d.history || [], working: new Set(d.working || []),
        messages: d.messages ?? [],
        view: items.length ? 'editor' : 'landing', pills: {}, removed: null, editing: null, edited: [],
      }
    }
    case 'new':
      if (s.editing) return s
      return { ...initialState(), deckId: newDeckId(), live: s.live, style: s.style, theme: s.theme, accent: s.accent, view: 'landing' }
    case 'set':
      return { ...s, ...a.patch }
    case 'edit':
      if (a.id === null) return { ...s, editing: null }
      if (locked(s) || !s.items.some((it) => it.id === a.id)) return s
      return { ...s, editing: a.id }
    case 'select':
      if (s.editing) return s
      return { ...s, current: clamp(a.index, s.items) }
    case 'message':
      return { ...s, messages: [...s.messages, a.message] }
    case 'items': {
      const at = a.focusId ? a.items.findIndex((it) => it.id === a.focusId) : -1
      return { ...s, items: a.items, current: at >= 0 ? at : clamp(s.current, a.items) }
    }
    case 'pickStarter':
      // Double clicks and clicks while busy must still give one deck with one slide.
      if (locked(s) || s.items.length) return s
      return {
        ...s, deckId: s.deckId ?? newDeckId(), items: [starterItem(a.id, a.slide)], current: 0, view: 'editor',
        messages: [...s.messages, { kind: 'bot', text: PICKED }],
      }
    case 'insertStarter': {
      if (locked(s)) return s
      const at = Math.min(s.current + 1, s.items.length), items = s.items.slice()
      items.splice(at, 0, starterItem(a.id, a.slide))
      return { ...s, items, current: at, view: 'editor' }
    }
    // Deleting and moving wait for a running turn: the agent is writing to these slides.
    case 'removeSlide': {
      const at = s.items.findIndex((it) => it.id === a.id)
      if (locked(s) || at < 0) return s
      const items = s.items.filter((it) => it.id !== a.id), working = new Set(s.working)
      working.delete(a.id)
      return { ...s, items, working, removed: { item: s.items[at], at }, current: clamp(at < s.current || (at === s.current && at === items.length) ? s.current - 1 : s.current, items) }
    }
    case 'restoreSlide': {
      if (locked(s) || !s.removed) return s
      const at = Math.min(s.removed.at, s.items.length), items = s.items.slice()
      items.splice(at, 0, s.removed.item)
      return { ...s, items, current: at, removed: null }
    }
    case 'moveSlide': {
      const from = s.items.findIndex((it) => it.id === a.id), to = Math.max(0, Math.min(a.to, s.items.length - 1))
      if (locked(s) || from < 0 || from === to) return s
      const items = s.items.slice(), [it] = items.splice(from, 1)
      items.splice(to, 0, it)
      const cur = s.items[s.current]?.id
      return { ...s, items, current: Math.max(0, items.findIndex((x) => x.id === cur)) }
    }
  }
}

/** The deck as saved; null for an empty deck, which is not kept. */
export function toSaved(s: AppState): SavedDeck | null {
  if (!s.deckId || (!s.items.length && !s.history.length)) return null
  return {
    id: s.deckId, name: s.name, style: s.style, theme: s.theme, accent: s.accent, current: s.current,
    items: s.items.map(({ checksPending: _pending, ...it }) => it), history: s.history, working: [...s.working],
    messages: s.messages,
    updated: Date.now(),
  }
}

/** What counts as an edit: the slides and their order, the name, the look, and the chat. Opening a deck, selecting a slide or
    re-running its checks is not one, so it neither saves the deck nor moves it up the list of decks. */
export const editKey = (d: SavedDeck): string =>
  JSON.stringify([d.name ?? null, d.style, d.theme, d.accent, d.items.map((it) => [it.id, it.slide]), (d.messages ?? []).map((m) => [m.kind, m.text]), d.history.length])

/** The engine's deck: the footer is the cover title; with no cover, only the page number. */
export function deckOf(s: AppState): Deck {
  const cover = s.items.find((i) => i.slide.template === 'cover')
  const footer = cover ? plain(cover.slide.title) : ''
  return { style: s.style, theme: s.theme, accent: s.accent, footer, slides: s.items.map((i) => i.slide) }
}
