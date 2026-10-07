/* Decks kept in this browser (localStorage): the dev account's decks, and a copy of a deck whose save to the account
   failed. A deck holds its slides, style and palette, the agent's conversation and the chat. */
import type { Slide, Style, Theme } from '@/engine/types'
import type { Check } from '@/engine/agent/checks'
import { plain } from '@/engine/slides/schema'
import type { ChatMessage } from '@/engine/agent/llm'
import type { TraceStep } from '@/engine/agent/agent'
import { record, type Version, type VersionMeta } from '@/engine/versions'
import { mergeComments, type DeckComment } from '@/engine/comments'

export const KEY = 'smartchart.journey.decks.v1'

export interface Item { id: string; slide: Slide; status: 'ok' | 'draft'; errors: string[]; warnings: string[]; checks: Check[]; checksPending?: boolean }
/** `files`: what the user attached to the message, as its chips show them; their text went to the agent. */
/** `turn`: set on an agent reply that wrote slides, so Undo can find the version before it; `undone` once it was. */
export type Message = { kind: 'user' | 'bot' | 'error'; text: string; sub?: string; trace?: TraceStep[]; files?: { name: string; about: string }[]; turn?: string; undone?: boolean }
/** `name`: what the maker called the deck; null while it follows its first title. */
/** `comments`: notes people left on slides (src/engine/comments.ts); missing on decks saved before comments. */
export interface SavedDeck { id: string; name?: string | null; style: Style; theme: Theme; accent: string | null; current: number; items: Item[]; history: ChatMessage[]; working: string[]; messages?: Message[]; updated: number; comments?: DeckComment[] }
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
  /** Null when saved; otherwise why not, as a sentence (storage full, offline, what the server said). `meta` says who
      wrote this save, for its version (by hand unless said otherwise). */
  save(deck: SavedDeck, meta?: SaveMeta): Promise<string | null>
  remove(id: string): Promise<boolean>
  /* Live view of a deck other writers may change (an agent over MCP, another tab). The local repo leaves these out. */
  rev?(id: string): Promise<{ rev: number; presence: Presence } | null>
  events?(id: string, since: number): Promise<DeckEvent[]>
  presence?(id: string, p: { busy?: boolean; editing?: string | null }): Promise<void>
  /** The last copy read from or written to the server. */
  base?(id: string): SavedDeck | null
  /** The revision this tab holds. */
  known?(id: string): number
  /* Versions (src/engine/versions.ts): newest first, and the slides their trees name, by hash. */
  versions?(id: string): Promise<Version[]>
  blobs?(id: string, hashes: string[]): Promise<{ hash: string; slide: Slide }[]>
}

/** Who wrote a save: the maker by hand, or Occam's agent; `turn` groups one turn's (or one restore's) saves. */
export interface SaveMeta { by: 'you' | 'agent'; turn?: string; label?: string }
/** The server's version rule, applied in this browser: the writer's name as the list shows it. */
export const metaOf = (m: SaveMeta | undefined): VersionMeta => ({ by: m?.by === 'agent' ? 'Occam' : 'You', turn: m?.turn ?? null, label: m?.label ?? null })

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

export const VERSIONS_KEY = 'smartchart.versions.v1'
/** The dev account keeps fewer versions than the server: they share this browser's storage with the decks. */
export const LOCAL_KEEP = 30
interface LocalVersions { [deckId: string]: { versions: (Version & { key: string })[]; blobs: Record<string, Slide> } }

/** Decks in this browser: copies kept while a save to the account fails, and the dev account's decks. The dev account
    (`versions: true`) also keeps versions, by the server's rule, so the feature works without accounts. */
export function localDeckRepo(storage?: Pick<Storage, 'getItem' | 'setItem'>, opts: { versions?: boolean } = {}): DeckRepo {
  const read = () => loadStore(storage), write = (s: Store) => saveStore(s, storage)
  const readV = (): LocalVersions => {
    try { return (JSON.parse((storage ?? localStorage).getItem(VERSIONS_KEY) ?? 'null') as LocalVersions | null) ?? {} } catch { return {} }
  }
  const writeV = (v: LocalVersions) => { try { (storage ?? localStorage).setItem(VERSIONS_KEY, JSON.stringify(v)) } catch { /* full: versions are a convenience here */ } }
  const recordLocal = async (deck: SavedDeck, meta: SaveMeta | undefined) => {
    const all = readV(), mine = (all[deck.id] ??= { versions: [], blobs: {} })
    await record({
      head: async () => { const v = mine.versions.at(-1); return v ? { n: v.n, by: v.by, turn: v.turn, at: v.at, key: v.key, hashes: v.tree.slides.map(([, h]) => h) } : null },
      write: async (_step, v) => {
        for (const [h, sl] of v.blobs) mine.blobs[h] ??= sl
        const top = mine.versions.at(-1)
        if (v.replace !== null && top) Object.assign(top, { key: v.key, tree: v.tree, at: v.at, label: top.label ?? v.meta.label })
        else mine.versions.push({ n: (top?.n ?? 0) + 1, rev: v.rev, by: v.meta.by, turn: v.meta.turn, label: v.meta.label, at: v.at, key: v.key, tree: v.tree })
        mine.versions = mine.versions.slice(-LOCAL_KEEP)
        // Blobs no kept version names go with the versions that named them.
        const used = new Set(mine.versions.flatMap((x) => x.tree.slides.map(([, h]) => h)))
        mine.blobs = Object.fromEntries(Object.entries(mine.blobs).filter(([h]) => used.has(h)))
      },
    }, deck, metaOf(meta), 0, Date.now())
    writeV(all)
  }
  return {
    list: async () => deckList(read()).map(summaryOf),
    get: async (id) => read().decks[id] ?? null,
    save: async (deck, meta) => {
      const s = read(); s.decks[deck.id] = deck; s.active = deck.id
      if (!write(s)) return 'This browser’s storage is full.'
      if (opts.versions) await recordLocal(deck, meta)
      return null
    },
    remove: async (id) => {
      const s = read(); if (!s.decks[id]) return false; delete s.decks[id]; if (s.active === id) s.active = null
      if (opts.versions) { const v = readV(); delete v[id]; writeV(v) }
      return write(s)
    },
    ...(opts.versions ? {
      versions: async (id: string) => (readV()[id]?.versions ?? []).map(({ key: _k, ...v }) => v).reverse(),
      blobs: async (id: string, hashes: string[]) => { const b = readV()[id]?.blobs ?? {}; return hashes.filter((h) => b[h]).map((h) => ({ hash: h, slide: b[h] })) },
    } : {}),
  }
}

export const newDeckId = (): string => `d_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

/** Newest first. */
export const deckList = (store: Store): SavedDeck[] => Object.values(store.decks).sort((a, b) => (b.updated || 0) - (a.updated || 0))

/** Named after the cover, else the first slide's title. */
export function deckName(d: { name?: string | null; items?: Item[] }): string {
  if (d.name?.trim()) return d.name.trim()
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
    // Deleted here and untouched on the server: it stays deleted.
    if (base && B.has(s.id) && !L.has(s.id) && same(s, B.get(s.id))) continue
    items.push(s)
    if (!same(s, B.get(s.id))) changed.push(s.id)
  }
  // Kept here: added locally, or edited locally but deleted on the server. Each goes after its local predecessor.
  local.items.forEach((it, i) => {
    if (S.has(it.id) || !mine(it.id)) return
    const prev = local.items.slice(0, i).reverse().find((p) => items.some((x) => x.id === p.id))
    items.splice(prev ? items.findIndex((x) => x.id === prev.id) + 1 : 0, 0, it)
  })
  // A move made here is kept when the server did not reorder; slides new on the server stay after their server neighbour.
  const order = (d: SavedDeck | null, only: Map<string, Item>) => (d?.items ?? []).map((x) => x.id).filter((id) => only.has(id)).join()
  if (base && order(local, B) !== order(base, L) && order(server, B) === order(base, S)) {
    const rank = new Map(local.items.map((x, i) => [x.id, i]))
    const placed = items.filter((x) => rank.has(x.id)).sort((a, b) => (rank.get(a.id) as number) - (rank.get(b.id) as number))
    items.forEach((x, i) => {
      if (rank.has(x.id)) return
      const prev = items.slice(0, i).reverse().find((p) => rank.has(p.id))
      placed.splice(prev ? placed.findIndex((p) => p.id === prev.id) + 1 : 0, 0, x)
    })
    items.splice(0, items.length, ...placed)
  }
  // The look follows the same rule as slides: a field changed here since `base` is kept, otherwise the server's is taken.
  const take = <K extends 'name' | 'style' | 'theme' | 'accent'>(k: K): SavedDeck[K] => (base && local[k] !== base[k] ? local[k] : server[k])
  return { deck: { ...local, name: take('name'), style: take('style'), theme: take('theme'), accent: take('accent'), items,
    comments: mergeComments(local.comments ?? [], server.comments ?? [], base ? base.comments ?? [] : null) }, changed }
}
