/* The page tree as the dev account keeps it: decks and docs both live in this browser's storage, so the tree rules that the
   server applies in SQL are applied here to the stored records. Reads the raw JSON, so the deck and doc repos can use it
   without importing each other. */
import { appendKey, canAdd, descendants, type PageNode, type PageRef } from '@/engine/pages/tree'

export const DECKS_KEY = 'smartchart.journey.decks.v1'
export const DECK_VERSIONS_KEY = 'smartchart.versions.v1'
export const DOCS_KEY = 'smartchart.docs.v1'
export const DOC_VERSIONS_KEY = 'smartchart.docs.versions.v1'

export type LocalStorage = Pick<Storage, 'getItem' | 'setItem'>
interface Rec { parent?: PageRef | null; sortKey?: string | null; workspaceId?: string }
interface DeckStore { active: string | null; decks: Record<string, Rec> }

const store = (s?: LocalStorage): LocalStorage => s ?? localStorage
function read<T>(s: LocalStorage | undefined, key: string, empty: T): T {
  try { const v: unknown = JSON.parse(store(s).getItem(key) ?? 'null'); return v && typeof v === 'object' ? v as T : empty } catch { return empty }
}
const decksOf = (s?: LocalStorage): DeckStore => {
  const d = read<Partial<DeckStore>>(s, DECKS_KEY, {})
  return { active: d.active ?? null, decks: d.decks && typeof d.decks === 'object' ? d.decks : {} }
}
const docsOf = (s?: LocalStorage) => read<Record<string, Rec>>(s, DOCS_KEY, {})
const write = (s: LocalStorage | undefined, key: string, v: unknown): boolean => { try { store(s).setItem(key, JSON.stringify(v)); return true } catch { return false } }

/** Every stored deck and the docs of workspace `ws` (every doc when none is named), as tree nodes. */
export function localNodes(s?: LocalStorage, ws?: string): PageNode[] {
  const node = (kind: 'deck' | 'doc', id: string, r: Rec): PageNode => ({ kind, id, parent: r.parent ?? null, sortKey: r.sortKey ?? null })
  return [
    ...Object.entries(decksOf(s).decks).map(([id, r]) => node('deck', id, r)),
    ...Object.entries(docsOf(s)).filter(([, r]) => ws === undefined || r.workspaceId === ws).map(([id, r]) => node('doc', id, r)),
  ]
}

/** Where a new page goes: under `parent` (the top when none), last among its siblings, or the sentence saying why it can't. */
export function placeNew(s: LocalStorage | undefined, ws: string | undefined, parent: PageRef | null | undefined): { parent: PageRef | null; sortKey: string } | { refused: string } {
  const nodes = localNodes(s, ws), ok = canAdd(nodes, parent ?? null)
  return ok === 'ok' ? { parent: parent ?? null, sortKey: appendKey(nodes, parent ?? null) } : { refused: ok }
}

/** Writes a page's parent and key. False when the page is not stored or the browser refuses the write. */
export function setPlace(s: LocalStorage | undefined, page: PageRef, parent: PageRef | null, sortKey: string): boolean {
  if (page.kind === 'deck') {
    const d = decksOf(s), r = d.decks[page.id]
    if (!r) return false
    d.decks[page.id] = { ...r, parent, sortKey }
    return write(s, DECKS_KEY, d)
  }
  const all = docsOf(s), r = all[page.id]
  if (!r) return false
  all[page.id] = { ...r, parent, sortKey }
  return write(s, DOCS_KEY, all)
}

/** Removes the page and every page below it, with their versions, as the server does. False when the page is not stored. */
export function removeBranch(s: LocalStorage | undefined, page: PageRef): boolean {
  const d = decksOf(s), docs = docsOf(s)
  if (!(page.kind === 'deck' ? d.decks[page.id] : docs[page.id])) return false
  const doomed = [page, ...descendants(localNodes(s), page)]
  const dv = read<Record<string, unknown>>(s, DECK_VERSIONS_KEY, {}), ov = read<Record<string, unknown>>(s, DOC_VERSIONS_KEY, {})
  for (const p of doomed) {
    if (p.kind === 'deck') { delete d.decks[p.id]; delete dv[p.id]; if (d.active === p.id) d.active = null }
    else { delete docs[p.id]; delete ov[p.id] }
  }
  // Versions are a convenience here: a full browser still loses the pages, so the answer is the pages' write.
  write(s, DECK_VERSIONS_KEY, dv); write(s, DOC_VERSIONS_KEY, ov)
  return write(s, DECKS_KEY, d) && write(s, DOCS_KEY, docs)
}
