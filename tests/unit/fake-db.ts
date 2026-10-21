import { keyId, MAX_KEYS, NO_COMMENT, type Db, type DeckEventRow, type DeckRow, type DocPresence, type DocVersion, type KeyRow, type Presence } from '../../api/_lib/db'
import { can, type Action, type Role } from '../../api/_lib/access'
import { KEEP, type Version } from '../../src/engine/versions'
import type { Slide } from '../../src/engine/types'
import type { Block } from '../../src/engine/docs/types'
import { MAX_DOC_COMMENTS, type DocComment } from '../../src/engine/comments'
import { appendKey, canAdd, canMove, descendants, NO_EDIT, NO_PAGE, slotKey, type PageNode, type PageRef } from '../../src/engine/pages/tree'
import { fakeWorkspaces, type FakeWorkspaces } from './fake-db-workspaces'

/** An in-memory Db with the same access rules as the SQL one. `user` is who made the deck; `ws` its workspace (null on a
    deck from before workspaces, which only its maker can reach). */
export type FakeRow = DeckRow & { user: string; ws: string | null; share?: string | null; named: boolean; presence: Presence; parent?: PageRef | null; sortKey?: string | null }
export type FakeDoc = { id: string; ws: string; user: string; name: string; text: string; rev: number; updated: number; presence?: DocPresence; comments?: DocComment[]; parent?: PageRef | null; sortKey?: string | null }
export type FakeDb = Db & FakeWorkspaces & {
  rows: Map<string, FakeRow>
  docs: Map<string, FakeDoc>
  events: (DeckEventRow & { user: string; deck: string })[]
  keys: Map<string, KeyRow & { hash: string; created: number }>
  rate: Map<string, number>
  calls: Map<string, number>
  versions: (Version & { user: string; deck: string; key: string })[]
  blobStore: Map<string, Slide>
  docVersions: (DocVersion & { user: string; doc: string; key: string })[]
  docBlobStore: Map<string, Block>
}

export function fakeDb(): FakeDb {
  const rows = new Map<string, FakeRow>()
  const docs = new Map<string, FakeDoc>()
  const events: FakeDb['events'] = []
  const keys: FakeDb['keys'] = new Map()
  const rate = new Map<string, number>()
  const calls = new Map<string, number>()
  const versions: FakeDb['versions'] = []
  const blobStore = new Map<string, Slide>()
  const docVersions: FakeDb['docVersions'] = []
  const docBlobStore = new Map<string, Block>()
  let n = 0, clock = 0
  const ws = fakeWorkspaces(rows)
  /** The one access check every deck call goes through. */
  const role = (u: string, r: { ws: string | null; user: string } | undefined): Role | null =>
    !r ? null : r.ws === null ? (r.user === u ? 'owner' : null) : ws.roleIn(u, r.ws)
  const deckIf = (u: string, id: string, action: Action) => { const r = rows.get(id); return r && can(role(u, r), action) ? r : undefined }
  const docIf = (u: string, id: string, action: Action) => { const d = docs.get(id); return d && can(role(u, d), action) ? d : undefined }
  /** Where a new deck or doc may go: the named workspace, else the writer's personal one, if they may edit there. */
  const home = (u: string, wanted: string | undefined): string | null | false => {
    const w = wanted ?? ws.personalOf(u)
    if (w === null) return wanted === undefined ? null : false
    return can(ws.roleIn(u, w), 'write') ? w : false
  }
  /** The workspace's pages as the tree sees them, whatever the caller may read (the callers check). */
  const nodesIn = (w: string): PageNode[] => [
    ...[...rows.values()].filter((r) => r.ws === w).map((r): PageNode => ({ kind: 'deck', id: r.id, parent: r.parent ?? null, sortKey: r.sortKey ?? null })),
    ...[...docs.values()].filter((d) => d.ws === w).map((d): PageNode => ({ kind: 'doc', id: d.id, parent: d.parent ?? null, sortKey: d.sortKey ?? null })),
  ]
  /** A new page's workspace, parent and key, or the sentence saying why it can't go there (as the SQL does). */
  const place = (u: string, wanted: string | undefined, parent: PageRef | undefined): { ws: string | null | false; parent: PageRef | null; key: string | null } | { refused: string } => {
    const at = parent ? (parent.kind === 'deck' ? deckIf(u, parent.id, 'read') : docIf(u, parent.id, 'read'))?.ws : undefined
    if (parent && (!at || (wanted && wanted !== at))) return { refused: NO_PAGE }
    const w = parent ? home(u, at as string) : home(u, wanted)
    if (!w) return { ws: w, parent: null, key: null }
    const nodes = nodesIn(w), ok = canAdd(nodes, parent ?? null)
    return ok === 'ok' ? { ws: w, parent: parent ?? null, key: appendKey(nodes, parent ?? null) } : { refused: ok }
  }
  /** The page and everything below it, with versions and blobs; false when the caller may not edit the page. */
  const removeTree = (u: string, page: PageRef): boolean => {
    const r = page.kind === 'deck' ? deckIf(u, page.id, 'write') : docIf(u, page.id, 'write')
    if (!r) return false
    for (const p of [page, ...(r.ws ? descendants(nodesIn(r.ws), page) : [])]) {
      if (p.kind === 'deck') {
        for (let i = versions.length - 1; i >= 0; i--) if (versions[i].deck === p.id) versions.splice(i, 1)
        for (const k of blobStore.keys()) if (k.startsWith(`${p.id}:`)) blobStore.delete(k)
        rows.delete(p.id)
      } else {
        for (let i = docVersions.length - 1; i >= 0; i--) if (docVersions[i].doc === p.id) docVersions.splice(i, 1)
        for (const k of docBlobStore.keys()) if (k.startsWith(`${p.id}:`)) docBlobStore.delete(k)
        docs.delete(p.id)
      }
    }
    return true
  }
  const summary = ({ id, name, updated, data, share, parent, sortKey }: FakeRow) => {
    const d = data as { items?: { slide: unknown }[]; style?: unknown; theme?: unknown; accent?: unknown }
    return { id, name, updated, slides: d.items?.length ?? 0, style: d.style, theme: d.theme, accent: d.accent, shared: !!share, parent: parent ?? null, sortKey: sortKey ?? null }
  }
  return {
    ...ws, rows, docs, events, keys, rate, calls, versions, blobStore, docVersions, docBlobStore,
    deckRole: async (u, id) => role(u, rows.get(id)),
    versionHead: async (u, id) => {
      const v = deckIf(u, id, 'read') && versions.filter((x) => x.deck === id).at(-1)
      return v ? { n: v.n, by: v.by, turn: v.turn, at: v.at, key: v.key, hashes: v.tree.slides.map(([, h]) => h) } : null
    },
    writeVersion: async (u, id, v) => {
      if (!deckIf(u, id, 'write')) return
      for (const [h, s] of v.blobs) if (!blobStore.has(`${id}:${h}`)) blobStore.set(`${id}:${h}`, structuredClone(s))
      const mine = versions.filter((x) => x.deck === id)
      if (v.replace !== null) {
        const x = mine.find((y) => y.n === v.replace)
        if (x) Object.assign(x, { rev: v.rev, key: v.key, tree: structuredClone(v.tree), at: v.at, label: x.label ?? v.meta.label })
        return
      }
      const top = Math.max(0, ...mine.map((x) => x.n)) + 1
      versions.push({ user: u, deck: id, n: top, rev: v.rev, by: v.meta.by, turn: v.meta.turn, label: v.meta.label, at: v.at, key: v.key, tree: structuredClone(v.tree) })
      for (let i = versions.length - 1; i >= 0; i--) if (versions[i].deck === id && versions[i].n <= top - KEEP) versions.splice(i, 1)
    },
    listVersions: async (u, id) => deckIf(u, id, 'read')
      ? versions.filter((x) => x.deck === id).map(({ user: _u, deck: _d, key: _k, ...v }) => structuredClone(v)).reverse() : [],
    blobs: async (u, id, hashes) => deckIf(u, id, 'read') && versions.some((x) => x.deck === id)
      ? hashes.filter((h) => blobStore.has(`${id}:${h}`)).map((h) => ({ hash: h, slide: structuredClone(blobStore.get(`${id}:${h}`) as Slide) })) : [],
    listDecks: async (u, w) => [...rows.values()].filter((r) => (w === undefined || r.ws === w) && can(role(u, r), 'read'))
      .sort((a, b) => b.updated - a.updated).map(summary),
    getDeck: async (u, id) => { const r = deckIf(u, id, 'read'); return r ? { ...structuredClone(r), role: role(u, r) as Role } : null },
    putDeck: async (u, id, name, data, chat, baseRev, opts = {}) => {
      const r = rows.get(id)
      if (r && !can(role(u, r), 'write')) return 'foreign'
      if (r && r.rev !== baseRev) return 'conflict'
      const fresh = r ? null : place(u, opts.workspaceId, opts.parent)
      if (fresh && 'refused' in fresh) return fresh
      const at = fresh && !('refused' in fresh) ? fresh : null
      const where = r ? r.ws : at ? at.ws : false
      if (where === false) return 'foreign'
      const rev = (r?.rev ?? 0) + 1
      const named = !!r?.named || !!opts.named
      rows.set(id, { id, name: r?.named && !opts.named ? r.name : name, data, chat, rev, updated: Date.now() + ++clock, user: r?.user ?? u, ws: where, share: r?.share, named, presence: r?.presence ?? {},
        parent: r ? r.parent : at?.parent ?? null, sortKey: r ? r.sortKey : at?.key ?? null })
      return { rev }
    },
    getDeckMeta: async (u, id) => { const r = deckIf(u, id, 'read'); return r ? { rev: r.rev, share: r.share ?? null, presence: r.presence, named: r.named, role: role(u, r) as Role } : null },
    sharedRev: async (t) => { const r = [...rows.values()].find((x) => x.share === t); return r ? { rev: r.rev } : null },
    setPresence: async (u, id, presence) => { const r = deckIf(u, id, 'write'); if (!r) return false; r.presence = presence; return true },
    addEvents: async (u, id, evs) => { if (deckIf(u, id, 'write')) for (const e of evs) events.push({ ...e, at: Date.now(), user: u, deck: id }) },
    eventsSince: async (u, id, rev) => !deckIf(u, id, 'read') ? [] : events.filter((e) => e.deck === id && e.rev > rev).sort((a, b) => a.rev - b.rev).slice(0, 200)
      .map(({ user: _u, deck: _d, ...e }) => e),
    countCall: async (u) => { const c = (calls.get(u) ?? 0) + 1; calls.set(u, c); return c },
    callsToday: async (u) => calls.get(u) ?? 0,
    addKey: async (userId, email, hash, prefix) => {
      if ([...keys.values()].filter((k) => k.userId === userId).length >= MAX_KEYS) return false
      keys.set(hash, { userId, email, prefix, hash, created: Date.now() })
      return true
    },
    keyUser: async (hash) => { const k = keys.get(hash); return k ? { userId: k.userId, email: k.email, prefix: k.prefix } : null },
    listKeys: async (u) => [...keys.values()].filter((k) => k.userId === u).map((k) => ({ id: keyId(k.hash), prefix: k.prefix, created: k.created, lastUsed: null })),
    deleteKey: async (u, id) => { const k = [...keys.values()].find((x) => x.userId === u && keyId(x.hash) === id); return !!k && keys.delete(k.hash) },
    bumpRate: async (key, minute) => { const k = `${key}:${minute}`, c = (rate.get(k) ?? 0) + 1; rate.set(k, c); return c },
    deleteDeck: async (u, id) => removeTree(u, { kind: 'deck', id }),
    shareDeck: async (u, id, on) => {
      const r = deckIf(u, id, 'write')
      if (!r) return undefined
      if (on !== undefined) r.share = on ? r.share ?? `tok_${++n}` : null
      return r.share ?? null
    },
    sharedDeck: async (t) => { const r = [...rows.values()].find((x) => x.share === t); return r ? { name: r.name, data: r.data, rev: r.rev } : null },
    listDocs: async (u, w) => [...docs.values()].filter((d) => d.ws === w && can(role(u, d), 'read')).sort((a, b) => b.updated - a.updated)
      .map(({ id, name, updated, ws: workspaceId, parent, sortKey }) => ({ id, name, updated, workspaceId, parent: parent ?? null, sortKey: sortKey ?? null })),
    listPages: async (u, w) => [
      ...[...rows.values()].filter((r) => r.ws === w && can(role(u, r), 'read')).map((r) => ({ kind: 'deck' as const, id: r.id, name: r.name, updated: r.updated, slides: summary(r).slides, parent: r.parent ?? null, sortKey: r.sortKey ?? null })),
      ...[...docs.values()].filter((d) => d.ws === w && can(role(u, d), 'read')).map((d) => ({ kind: 'doc' as const, id: d.id, name: d.name, updated: d.updated, slides: null, parent: d.parent ?? null, sortKey: d.sortKey ?? null })),
    ].sort((a, b) => b.updated - a.updated).slice(0, 5000),
    getDoc: async (u, id) => { const d = docIf(u, id, 'read'); return d ? { id: d.id, name: d.name, updated: d.updated, workspaceId: d.ws, text: d.text, rev: d.rev } : null },
    movePage: async (u, page, to) => {
      const r = page.kind === 'deck' ? rows.get(page.id) : docs.get(page.id)
      if (!r?.ws || !can(role(u, r), 'read')) return 'foreign'
      if (!can(role(u, r), 'write')) return NO_EDIT
      const nodes = nodesIn(r.ws), ok = canMove(nodes, page, to.parent)
      if (ok !== 'ok') return ok
      const slot = slotKey(nodes, page, to.parent, to)
      if ('refused' in slot) return slot.refused
      r.parent = to.parent; r.sortKey = slot.key
      return 'ok'
    },
    putDoc: async (u, id, name, text, baseRev, workspaceId, parent) => {
      const d = docs.get(id)
      if (d && !can(role(u, d), 'write')) return 'foreign'
      if (d && d.rev !== baseRev) return 'conflict'
      const fresh = d ? null : place(u, workspaceId, parent)
      if (fresh && 'refused' in fresh) return fresh
      const at = fresh && !('refused' in fresh) ? fresh : null
      const where = d ? d.ws : at ? at.ws : false
      if (!where) return 'foreign'
      const rev = (d?.rev ?? 0) + 1
      docs.set(id, { id, ws: where, user: d?.user ?? u, name, text, rev, updated: Date.now() + ++clock, parent: d ? d.parent : at?.parent ?? null, sortKey: d ? d.sortKey : at?.key ?? null })
      return { rev }
    },
    deleteDoc: async (u, id) => removeTree(u, { kind: 'doc', id }),
    countSubpages: async (u, page) => {
      const r = page.kind === 'deck' ? rows.get(page.id) : docs.get(page.id)
      return r && can(role(u, r), 'read') ? (r.ws ? descendants(nodesIn(r.ws), page).length : 0) : null
    },

    getDocMeta: async (u, id) => { const d = docIf(u, id, 'read'); return d ? { rev: d.rev, presence: structuredClone(d.presence ?? {}), role: role(u, d) as Role } : null },
    setDocPresence: async (u, id, p) => { const d = docIf(u, id, 'write'); if (!d) return false; d.presence = structuredClone(p); return true },
    docVersionHead: async (u, id) => {
      const v = docIf(u, id, 'read') && docVersions.filter((x) => x.doc === id).at(-1)
      return v ? { n: v.n, by: v.by, turn: null, at: v.at, key: v.key, hashes: v.tree.blocks } : null
    },
    writeDocVersion: async (u, id, v) => {
      if (!docIf(u, id, 'write')) return
      for (const [h, b] of v.blobs) if (!docBlobStore.has(`${id}:${h}`)) docBlobStore.set(`${id}:${h}`, structuredClone(b))
      const mine = docVersions.filter((x) => x.doc === id)
      if (v.replace !== null) {
        const x = mine.find((y) => y.n === v.replace)
        if (x) Object.assign(x, { rev: v.rev, key: v.key, tree: structuredClone(v.tree), at: v.at, label: x.label ?? v.meta.label })
        return
      }
      const top = Math.max(0, ...mine.map((x) => x.n)) + 1
      docVersions.push({ user: u, doc: id, n: top, rev: v.rev, by: v.meta.by, label: v.meta.label, at: v.at, key: v.key, tree: structuredClone(v.tree) })
      for (let i = docVersions.length - 1; i >= 0; i--) if (docVersions[i].doc === id && docVersions[i].n <= top - KEEP) docVersions.splice(i, 1)
    },
    listDocVersions: async (u, id) => docIf(u, id, 'read')
      ? docVersions.filter((x) => x.doc === id).map(({ user: _u, doc: _d, key: _k, ...v }) => structuredClone(v)).reverse() : [],
    docBlobs: async (u, id, hashes) => docIf(u, id, 'read') && docVersions.some((x) => x.doc === id)
      ? hashes.filter((h) => docBlobStore.has(`${id}:${h}`)).map((h) => ({ hash: h, block: structuredClone(docBlobStore.get(`${id}:${h}`) as Block) })) : [],
    docComments: async (u, id) => { const d = docIf(u, id, 'read'); return d ? structuredClone(d.comments ?? []) : null },
    docComment: async (u, id, op, ctx) => {
      const d = docIf(u, id, 'read')
      if (!d) return 'foreign'
      const list = d.comments ??= []
      if ('add' in op) {
        if (list.length >= MAX_DOC_COMMENTS) return 'This doc has too many comments.'
        list.push({ id: ctx.id, anchor: op.add.anchor, text: op.add.text, by: ctx.by, at: ctx.now, userId: u, ...(op.add.quote ? { quote: op.add.quote } : {}) })
        return structuredClone(list)
      }
      const resolve = 'resolve' in op, cid = resolve ? op.resolve.id : (op as { remove: { id: string } }).remove.id, c = list.find((x) => x.id === cid)
      if (!c) return NO_COMMENT
      if (resolve) {
        if (c.done) return 'That comment is already resolved.'
        if (c.userId !== u && !can(role(u, d), 'write')) return 'Only an editor or the author can resolve a comment.'
        c.done = { by: ctx.by, at: ctx.now, ...(op.resolve.reply?.trim() ? { reply: op.resolve.reply.trim() } : {}) }
      } else {
        if (c.userId !== u) return 'Only the author can delete a comment.'
        list.splice(list.indexOf(c), 1)
      }
      return structuredClone(list)
    },
  }
}
