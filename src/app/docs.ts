/* Docs as the app reaches them: on the server (/api/docs) for a signed-in user, or in this browser for the dev account.
   The same shape as DeckRepo's list, get, save and remove. A doc is its Markdown text; writing in it comes in M4. */
import { hash, nextStep, KEEP, type VersionMeta } from '@/engine/versions'
import { parseDoc } from '@/engine/docs/parse'
import { docTree, type DocTree } from '@/engine/docs/versions'
import type { Block } from '@/engine/docs/types'
import { newCommentId, type CommentOp, type DocComment } from '@/engine/comments'
import type { PageRef } from '@/engine/pages/tree'
import { DOC_VERSIONS_KEY as VERSIONS, DOCS_KEY as DOCS, placeNew, removeBranch } from './local-pages'
import { refOf } from './pages-wire'
import { OFFLINE, type Role } from './workspaces'
import { LOCAL_KEEP } from './store'

export interface DocSummary { id: string; name: string; updated: number; workspaceId: string; parent: PageRef | null; sortKey: string | null }
export interface Doc extends Omit<DocSummary, 'parent' | 'sortKey'> { text: string }
/** What a save sends: the doc as this tab holds it. */
export type DocDraft = Omit<Doc, 'updated'> & { /** Where a new doc goes (last under this page); a save never moves a doc. */ parent?: PageRef | null }

/** The doc's live state: its revision, who is editing now (expires at `until`), and the caller's role. */
export interface DocMeta { rev: number; presence: { editing?: { by: string; until: number } }; role: Role }
/** A saved version as the panel lists it: who, when, and the tree (front matter and block hashes). */
export interface DocVersionRow { n: number; rev: number; by: string; label: string | null; at: number; tree: DocTree }
export type { CommentOp, DocComment }

export interface DocRepo {
  list(workspaceId: string): Promise<DocSummary[]>
  get(id: string): Promise<Doc | null>
  /** Null when saved; otherwise why not, as a sentence. */
  save(doc: DocDraft, opts?: { label?: string }): Promise<string | null>
  remove(id: string): Promise<boolean>
  /** Null when the doc is gone or not readable. */
  meta(id: string): Promise<DocMeta | null>
  /** The revision this tab last read or wrote. */
  known(id: string): number
  /** Says this tab is editing (renewed while it lasts) or has stopped. Never throws. */
  presence(id: string, editing: boolean): Promise<void>
  /** Newest first. */
  versions(id: string): Promise<DocVersionRow[]>
  blobs(id: string, hashes: string[]): Promise<Record<string, Block>>
  comments(id: string): Promise<DocComment[]>
  /** The doc's comments after the change, or why not as a sentence. */
  comment(id: string, op: CommentOp): Promise<DocComment[] | string>
  /** The copy kept in memory from an earlier read or save (see cachedDocRepo); null when there is none. */
  peek?(id: string): { doc: Doc | null; comments: DocComment[] } | null
  /** The kept copy, from memory or this browser. */
  kept?(id: string): Promise<{ doc: Doc | null; comments: DocComment[] } | null>
}

export const DOC_STALE = 'This doc was changed in another tab or window. Reload to see the latest.'
const DOC_FAILED: Record<number, string> = { 401: 'Your session ended.', 404: 'This doc belongs to another workspace.', 409: DOC_STALE, 413: 'This doc is too large to save.' }

export function remoteDocRepo({ fetcher = (...a) => fetch(...a), onSignedOut }: { fetcher?: typeof fetch; onSignedOut?: () => void } = {}): DocRepo {
  const call = async (query: string, init?: RequestInit) => {
    const r = await fetcher(`/api/docs${query}`, { credentials: 'same-origin', ...init })
    if (r.status === 401) onSignedOut?.()
    return r
  }
  // The revision last read or written per doc: a save from an older one is refused (409).
  const revs = new Map<string, number>()
  return {
    list: async (ws) => {
      const r = await call(`?workspace=${encodeURIComponent(ws)}`)
      if (!r.ok) throw new Error(`docs: ${r.status}`)
      return ((await r.json()) as Partial<DocSummary>[]).map((d) => ({ id: String(d.id), name: d.name ?? '', updated: Number(d.updated) || 0, workspaceId: String(d.workspaceId ?? ws), parent: refOf(d.parent), sortKey: typeof d.sortKey === 'string' ? d.sortKey : null }))
    },
    get: async (id) => {
      const r = await call(`?id=${encodeURIComponent(id)}`)
      if (r.status === 404) return null
      if (!r.ok) throw new Error(`doc: ${r.status}`)
      const d = (await r.json()) as Doc & { rev: number }
      revs.set(id, d.rev)
      return { id: d.id, name: d.name, text: d.text, updated: d.updated, workspaceId: d.workspaceId }
    },
    save: async (doc, opts) => {
      try {
        const r = await call('', { method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: doc.id, name: doc.name, text: doc.text, baseRev: revs.get(doc.id) ?? 0, workspaceId: doc.workspaceId, ...(doc.parent ? { parent: doc.parent } : {}), ...(opts?.label ? { version: { label: opts.label } } : {}) }) })
        const body = (await r.json().catch(() => null)) as { rev?: number; error?: unknown } | null
        if (r.ok) { revs.set(doc.id, body?.rev ?? (revs.get(doc.id) ?? 0) + 1); return null }
        // A 403 says why in the server's words (a viewer); the rest have our own sentence.
        if (r.status === 403 && typeof body?.error === 'string') return body.error
        return DOC_FAILED[r.status] ?? `The server answered ${r.status}${typeof body?.error === 'string' ? `: ${body.error}` : '.'}`
      } catch { return OFFLINE }
    },
    remove: async (id) => {
      try { const ok = (await call(`?id=${encodeURIComponent(id)}`, { method: 'DELETE' })).ok; if (ok) revs.delete(id); return ok } catch { return false }
    },
    meta: async (id) => {
      try {
        const r = await call(`?id=${encodeURIComponent(id)}&rev=1`), m = (r.ok ? await r.json() : null) as Partial<DocMeta> | null
        return m && typeof m.rev === 'number' && m.presence && typeof m.presence === 'object' ? m as DocMeta : null
      } catch { return null }
    },
    known: (id) => revs.get(id) ?? 0,
    presence: async (id, editing) => {
      try { await call(`?id=${encodeURIComponent(id)}&presence=1`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ editing }) }) } catch { /* presence is a courtesy */ }
    },
    versions: async (id) => {
      const r = await call(`?id=${encodeURIComponent(id)}&versions`)
      const v: unknown = r.ok ? await r.json() : []
      return Array.isArray(v) ? v as DocVersionRow[] : []
    },
    blobs: async (id, hashes) => {
      const r = hashes.length ? await call(`?id=${encodeURIComponent(id)}&blobs=${hashes.join(',')}`) : null
      const list: unknown = r?.ok ? await r.json() : []
      return Object.fromEntries(Array.isArray(list) ? (list as { hash: string; block: Block }[]).map((b) => [b.hash, b.block]) : [])
    },
    comments: async (id) => {
      const r = await call(`?id=${encodeURIComponent(id)}&comments`)
      const c: unknown = r.ok ? await r.json() : []
      return Array.isArray(c) ? c as DocComment[] : []
    },
    comment: async (id, op) => {
      try {
        const r = await call(`?id=${encodeURIComponent(id)}&comment=1`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(op) })
        const body = (await r.json().catch(() => null)) as DocComment[] | { error?: unknown } | null
        if (r.ok && Array.isArray(body)) return body
        return !Array.isArray(body) && typeof body?.error === 'string' ? body.error : DOC_FAILED[r.status] ?? `The server answered ${r.status}.`
      } catch { return OFFLINE }
    },
  }
}

export const DOCS_KEY = DOCS
export const DOC_VERSIONS_KEY = VERSIONS

type Stored = Doc & { rev?: number; comments?: DocComment[]; parent?: PageRef | null; sortKey?: string | null }
interface LocalVersions { list: (DocVersionRow & { key: string })[]; blobs: Record<string, Block> }
const LOCAL_ME = 'You'

/** The dev account's docs, their versions and comments, in this browser. A version is recorded as the server does. */
export function localDocRepo(storage?: Pick<Storage, 'getItem' | 'setItem'>): DocRepo {
  const store = () => storage ?? localStorage
  const load = <T,>(key: string): Record<string, T> => { try { return (JSON.parse(store().getItem(key) ?? 'null') as Record<string, T> | null) ?? {} } catch { return {} } }
  const put = (key: string, v: unknown) => { try { store().setItem(key, JSON.stringify(v)); return true } catch { return false } }
  const read = () => load<Stored>(DOCS_KEY), versionsOf = () => load<LocalVersions>(DOC_VERSIONS_KEY)
  const write = (all: Record<string, Stored>) => put(DOCS_KEY, all)
  const record = (id: string, text: string, rev: number, label: string | undefined) => {
    const all = versionsOf(), mine = all[id] ?? { list: [], blobs: {} }, { tree, blobs } = docTree(parseDoc(text).doc), key = hash(JSON.stringify(tree)), now = Date.now()
    const head = mine.list.at(-1), meta: VersionMeta = { by: LOCAL_ME, turn: null, label: label ?? null }
    // A restore stands alone, as on the server.
    const step = label ? (head?.key === key ? 'skip' : 'add') : nextStep(head ? { n: head.n, by: head.by, turn: null, at: head.at, key: head.key } : null, meta, key, now)
    if (step === 'skip') return
    Object.assign(mine.blobs, blobs)
    if (step === 'replace' && head) Object.assign(head, { rev, key, tree, at: now, label: head.label ?? meta.label })
    else mine.list.push({ n: (head?.n ?? 0) + 1, rev, by: LOCAL_ME, label: meta.label, at: now, key, tree })
    mine.list = mine.list.slice(-Math.min(LOCAL_KEEP, KEEP))
    const used = new Set(mine.list.flatMap((v) => v.tree.blocks))
    mine.blobs = Object.fromEntries(Object.entries(mine.blobs).filter(([h]) => used.has(h)))
    all[id] = mine
    put(DOC_VERSIONS_KEY, all)
  }
  // The revision this tab last read or wrote per doc: a save over a newer one is refused, as the server refuses it.
  const revs = new Map<string, number>()
  const strip = ({ id, name, text, updated, workspaceId }: Stored): Doc => ({ id, name, text, updated, workspaceId })
  return {
    list: async (ws) => Object.values(read()).filter((d) => d.workspaceId === ws).sort((a, b) => b.updated - a.updated)
      .map(({ id, name, updated, workspaceId, parent, sortKey }) => ({ id, name, updated, workspaceId, parent: parent ?? null, sortKey: sortKey ?? null })),
    get: async (id) => { const d = read()[id]; if (d) revs.set(id, d.rev ?? 1); return d ? strip(d) : null },
    save: async (doc, opts) => {
      const all = read(), was = all[doc.id], rev = (was?.rev ?? 1) + (was ? 1 : 0)
      if (was && revs.has(doc.id) && revs.get(doc.id) !== (was.rev ?? 1)) return DOC_STALE
      // Later than every doc kept, so two saves in one millisecond still list newest first.
      const updated = Math.max(Date.now(), ...Object.values(all).map((d) => d.updated + 1))
      // A save never moves a doc: a new one goes where it asked (last under its parent), an existing one keeps its place.
      const at = was ? { parent: was.parent ?? null, sortKey: was.sortKey ?? null } : placeNew(storage, doc.workspaceId, doc.parent)
      if ('refused' in at) return at.refused
      const { parent: _asked, ...rest } = doc
      all[doc.id] = { ...rest, updated, rev, comments: was?.comments, parent: at.parent, sortKey: at.sortKey }
      if (!write(all)) return 'This browser’s storage is full.'
      revs.set(doc.id, rev)
      record(doc.id, doc.text, rev, opts?.label)
      return null
    },
    remove: async (id) => {
      return removeBranch(storage, { kind: 'doc', id }) // the doc and every page below it
    },
    meta: async (id) => { const d = read()[id]; return d ? { rev: d.rev ?? 1, presence: {}, role: 'owner' } : null },
    known: (id) => revs.get(id) ?? read()[id]?.rev ?? 1,
    presence: async () => undefined,
    versions: async (id) => (versionsOf()[id]?.list ?? []).map(({ key: _k, ...v }) => v).reverse(),
    blobs: async (id, hashes) => { const b = versionsOf()[id]?.blobs ?? {}; return Object.fromEntries(hashes.filter((h) => Object.hasOwn(b, h)).map((h) => [h, b[h]])) },
    comments: async (id) => read()[id]?.comments ?? [],
    comment: async (id, op) => {
      const all = read(), d = all[id]
      if (!d) return 'No such doc.'
      const list = d.comments ?? [], now = Date.now()
      if ('add' in op) list.push({ id: newCommentId(list.map((c) => c.id)), anchor: op.add.anchor, text: op.add.text, by: LOCAL_ME, at: now, userId: 'local', ...(op.add.quote ? { quote: op.add.quote } : {}) })
      else {
        const cid = 'resolve' in op ? op.resolve.id : op.remove.id, c = list.find((x) => x.id === cid)
        if (!c) return 'No such comment.'
        if ('resolve' in op) { if (c.done) return 'That comment is already resolved.'; c.done = { by: LOCAL_ME, at: now, ...(op.resolve.reply?.trim() ? { reply: op.resolve.reply.trim() } : {}) } }
        else list.splice(list.indexOf(c), 1)
      }
      d.comments = list
      return write(all) ? structuredClone(list) : 'This browser’s storage is full.'
    },
  }
}
