/* The page tree: docs and decks nested in one workspace. Pure helpers over a flat list of pages, shared by the sidebar, the
   server's checks and the fake Db, so every place applies the same rules and says the same sentences. */

export type PageKind = 'deck' | 'doc'
/** A deck and a doc may share an id (clients choose ids), so a page is always named by kind and id together. */
export interface PageRef { kind: PageKind; id: string }
export interface PageNode extends PageRef { parent: PageRef | null; sortKey: string | null }
/** One page of the tree as the sidebar needs it. `slides` is a deck's slide count (null for a doc). */
export interface PageSummary extends PageNode { name: string; updated: number; slides: number | null }

/** Levels from the top: a page at the top is level 1. */
export const MAX_DEPTH = 6

export const NO_PAGE = 'No such page.'
export const CYCLE = 'A page can’t go inside itself or its subpages.'
export const TOO_DEEP = `Pages nest ${MAX_DEPTH} levels deep at most.`

const same = (a: PageRef, b: PageRef) => a.kind === b.kind && a.id === b.id
export const keyOf = (p: PageRef) => `${p.kind}:${p.id}`

/* Order keys: strings over base 62 digits that sort as plain text (compared with < and >, never localeCompare). A key never
   ends in the lowest digit, so there is always room between it and the next one. A page with no key reads as before all. */
const DIGITS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
const BASE = DIGITS.length

export const isKey = (k: string): boolean => k.length > 0 && k[k.length - 1] !== DIGITS[0] && [...k].every((c) => DIGITS.includes(c))

function midpoint(a: string, b: string | null): string {
  if (b !== null) {
    let n = 0
    while ((a[n] ?? DIGITS[0]) === b[n]) n++
    if (n > 0) return b.slice(0, n) + midpoint(a.slice(n), b.slice(n))
  }
  const lo = a ? DIGITS.indexOf(a[0]) : 0, hi = b !== null ? DIGITS.indexOf(b[0]) : BASE
  if (hi - lo > 1) return DIGITS[Math.round((lo + hi) / 2)]
  if (b !== null && b.length > 1) return b.slice(0, 1)
  return DIGITS[lo] + midpoint(a.slice(1), null)
}

/** A key strictly between `a` and `b`; null for `a` means before the first, null for `b` after the last. Throws on a key it
    could not have made, or when `a` is not before `b`. */
export function keyBetween(a: string | null, b: string | null): string {
  if ((a !== null && !isKey(a)) || (b !== null && !isKey(b))) throw new Error('Not an order key.')
  if (a !== null && b !== null && a >= b) throw new Error('keyBetween needs a before b.')
  return midpoint(a ?? '', b)
}

/** The siblings' order: by key, then kind and id, so two pages that share a key still sort the same everywhere. */
const byOrder = (a: PageNode, b: PageNode) => {
  const ka = a.sortKey ?? '', kb = b.sortKey ?? ''
  return ka < kb ? -1 : ka > kb ? 1 : keyOf(a) < keyOf(b) ? -1 : keyOf(a) > keyOf(b) ? 1 : 0
}

export interface Tree { roots: PageNode[]; children: (ref: PageRef | null) => PageNode[]; get: (ref: PageRef) => PageNode | undefined }

/** The tree of a list of pages. A page whose parent is not in the list is at the top, so a missing parent never hides it. */
export function buildTree(nodes: PageNode[]): Tree {
  const by = new Map(nodes.map((n) => [keyOf(n), n]))
  const kids = new Map<string, PageNode[]>()
  for (const n of nodes) {
    const p = n.parent && by.has(keyOf(n.parent)) ? keyOf(n.parent) : ''
    kids.set(p, [...(kids.get(p) ?? []), n])
  }
  for (const list of kids.values()) list.sort(byOrder)
  return { roots: kids.get('') ?? [], children: (ref) => kids.get(ref ? keyOf(ref) : '') ?? [], get: (ref) => by.get(keyOf(ref)) }
}

/** The page's level: 1 at the top. A loop in the data (which the rules never make) ends the count. */
export function depthOf(nodes: PageNode[], ref: PageRef): number {
  const by = new Map(nodes.map((n) => [keyOf(n), n]))
  const seen = new Set<string>()
  let depth = 0
  for (let at: PageNode | undefined = by.get(keyOf(ref)); at && !seen.has(keyOf(at)); at = at.parent ? by.get(keyOf(at.parent)) : undefined) { seen.add(keyOf(at)); depth++ }
  return depth
}

/** Every page below `ref`, nearest first. */
export function descendants(nodes: PageNode[], ref: PageRef): PageNode[] {
  const tree = buildTree(nodes), out: PageNode[] = [], seen = new Set([keyOf(ref)])
  const queue = [...tree.children(ref)]
  for (let n = queue.shift(); n; n = queue.shift()) {
    if (seen.has(keyOf(n))) continue
    seen.add(keyOf(n)); out.push(n); queue.push(...tree.children(n))
  }
  return out
}

/** Levels in the page's own subtree, itself included: 1 for a page with no children. */
export function heightBelow(nodes: PageNode[], ref: PageRef): number {
  const tree = buildTree(nodes), seen = new Set<string>()
  const h = (n: PageRef): number => {
    if (seen.has(keyOf(n))) return 0
    seen.add(keyOf(n))
    return 1 + Math.max(0, ...tree.children(n).map(h))
  }
  return h(ref)
}

/** 'ok', or the sentence to show when `ref` can't go under `parent` (null: the top). The server answers with these same sentences. */
export function canMove(nodes: PageNode[], ref: PageRef, parent: PageRef | null): 'ok' | string {
  const by = new Map(nodes.map((n) => [keyOf(n), n]))
  if (!by.has(keyOf(ref)) || (parent && !by.has(keyOf(parent)))) return NO_PAGE
  if (parent && (same(parent, ref) || descendants(nodes, ref).some((d) => same(d, parent)))) return CYCLE
  return (parent ? depthOf(nodes, parent) : 0) + heightBelow(nodes, ref) > MAX_DEPTH ? TOO_DEEP : 'ok'
}

/** 'ok', or the sentence to show when a new page can't be made under `parent` (null: the top). */
export function canAdd(nodes: PageNode[], parent: PageRef | null): 'ok' | string {
  if (!parent) return 'ok'
  if (!nodes.some((n) => same(n, parent))) return NO_PAGE
  return depthOf(nodes, parent) + 1 > MAX_DEPTH ? TOO_DEEP : 'ok'
}

/** The key for a page added last under `parent` (null: the top level): new pages go to the bottom of their siblings. */
export function appendKey(nodes: PageNode[], parent: PageRef | null): string {
  const kids = buildTree(nodes).children(parent && nodes.some((n) => same(n, parent)) ? parent : null)
  return keyBetween(kids.at(-1)?.sortKey || null, null)
}

export const NO_EDIT = 'You can view this workspace, not change it.'

/** Where among its new siblings a moved page goes: right after one of them, right before one, or (neither) last. */
export interface Slot { before?: PageRef; after?: PageRef }

/** The order key for `ref` placed at `slot` under `parent`, or a sentence when the slot's page is not a child of `parent`.
    Siblings that share a key with the page before the slot are stepped over, so the key is always strictly after that one. */
export function slotKey(nodes: PageNode[], ref: PageRef, parent: PageRef | null, slot: Slot): { key: string } | { refused: string } {
  const sibs = buildTree(nodes).children(parent).filter((n) => !same(n, ref))
  const at = (p: PageRef) => sibs.findIndex((n) => same(n, p))
  let i = sibs.length
  if (slot.after) i = at(slot.after) + 1 || -1
  else if (slot.before) i = at(slot.before)
  if (i < 0) return { refused: NO_PAGE }
  const a = sibs[i - 1]?.sortKey || null
  let b: string | null = null
  for (let j = i; j < sibs.length && b === null; j++) { const k = sibs[j].sortKey || null; if (k !== null && (a === null || k > a)) b = k }
  return { key: keyBetween(a, b) }
}
