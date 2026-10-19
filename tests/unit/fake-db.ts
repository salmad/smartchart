import { keyId, MAX_KEYS, type Db, type DeckEventRow, type DeckRow, type KeyRow, type Presence } from '../../api/_lib/db'
import { can, type Action, type Role } from '../../api/_lib/access'
import { KEEP, type Version } from '../../src/engine/versions'
import type { Slide } from '../../src/engine/types'
import { fakeWorkspaces, type FakeWorkspaces } from './fake-db-workspaces'

/** An in-memory Db with the same access rules as the SQL one. `user` is who made the deck; `ws` its workspace (null on a
    deck from before workspaces, which only its maker can reach). */
export type FakeRow = DeckRow & { user: string; ws: string | null; share?: string | null; named: boolean; presence: Presence }
export type FakeDoc = { id: string; ws: string; user: string; name: string; text: string; rev: number; updated: number }
export type FakeDb = Db & FakeWorkspaces & {
  rows: Map<string, FakeRow>
  docs: Map<string, FakeDoc>
  events: (DeckEventRow & { user: string; deck: string })[]
  keys: Map<string, KeyRow & { hash: string; created: number }>
  rate: Map<string, number>
  calls: Map<string, number>
  versions: (Version & { user: string; deck: string; key: string })[]
  blobStore: Map<string, Slide>
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
  const summary = ({ id, name, updated, data, share }: FakeRow) => {
    const d = data as { items?: { slide: unknown }[]; style?: unknown; theme?: unknown; accent?: unknown }
    return { id, name, updated, slides: d.items?.length ?? 0, style: d.style, theme: d.theme, accent: d.accent, first: d.items?.[0]?.slide ?? null, shared: !!share }
  }
  return {
    ...ws, rows, docs, events, keys, rate, calls, versions, blobStore,
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
      const where = r ? r.ws : home(u, opts.workspaceId)
      if (where === false) return 'foreign'
      const rev = (r?.rev ?? 0) + 1
      const named = !!r?.named || !!opts.named
      rows.set(id, { id, name: r?.named && !opts.named ? r.name : name, data, chat, rev, updated: Date.now() + ++clock, user: r?.user ?? u, ws: where, share: r?.share, named, presence: r?.presence ?? {} })
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
    deleteDeck: async (u, id) => {
      if (!deckIf(u, id, 'write')) return false
      for (let i = versions.length - 1; i >= 0; i--) if (versions[i].deck === id) versions.splice(i, 1)
      for (const k of blobStore.keys()) if (k.startsWith(`${id}:`)) blobStore.delete(k)
      return rows.delete(id)
    },
    shareDeck: async (u, id, on) => {
      const r = deckIf(u, id, 'write')
      if (!r) return undefined
      if (on !== undefined) r.share = on ? r.share ?? `tok_${++n}` : null
      return r.share ?? null
    },
    sharedDeck: async (t) => { const r = [...rows.values()].find((x) => x.share === t); return r ? { name: r.name, data: r.data, rev: r.rev } : null },
    listDocs: async (u, w) => [...docs.values()].filter((d) => d.ws === w && can(role(u, d), 'read')).sort((a, b) => b.updated - a.updated)
      .map(({ id, name, updated, ws: workspaceId }) => ({ id, name, updated, workspaceId })),
    getDoc: async (u, id) => { const d = docIf(u, id, 'read'); return d ? { id: d.id, name: d.name, updated: d.updated, workspaceId: d.ws, text: d.text, rev: d.rev } : null },
    putDoc: async (u, id, name, text, baseRev, workspaceId) => {
      const d = docs.get(id)
      if (d && !can(role(u, d), 'write')) return 'foreign'
      if (d && d.rev !== baseRev) return 'conflict'
      const where = d ? d.ws : home(u, workspaceId)
      if (!where) return 'foreign'
      const rev = (d?.rev ?? 0) + 1
      docs.set(id, { id, ws: where, user: d?.user ?? u, name, text, rev, updated: Date.now() + ++clock })
      return { rev }
    },
    deleteDoc: async (u, id) => !!docIf(u, id, 'write') && docs.delete(id),
  }
}
