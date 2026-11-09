/* Roadmaps as the app reaches them: on the server (/api/roadmaps) for a signed-in user, or in this browser for the dev
   account. The remote repo keeps what it last read in memory and in cache.ts so the next open paints at once. */
import { parseDoc } from '@/engine/docs/parse'
import { serializeDoc } from '@/engine/docs/serialize'
import { newCommentId } from '@/engine/comments'
import type { PageRef } from '@/engine/pages/tree'
import { applyOp, type RoadmapOp } from '@/engine/roadmaps/ops'
import type { Changes, Issue, IssueComment, IssueDetail, IssueEvent, LoadedRoadmap, RoadmapState } from '@/engine/roadmaps/types'
import { cacheDelete, cacheGet, cacheSet } from './cache'
import { DOC_STALE } from './docs'
import { placeNew, removeBranch, ROADMAPS_KEY } from './local-pages'
import { OFFLINE } from './workspaces'

export type { LoadedRoadmap, Changes, IssueDetail }
export type { RoadmapOp }
export { ROADMAPS_KEY }

export interface RoadmapRepo {
  get(id: string): Promise<LoadedRoadmap | null>
  changes(id: string, since: number): Promise<Changes | null>
  /** The saved rows come back as the server wrote them (keys, numbers, seq). */
  write(id: string, op: RoadmapOp): Promise<{ seq: number; changed: Issue[] } | string>
  detail(id: string, issueId: string): Promise<IssueDetail | null>
  putBody(id: string, issueId: string, text: string, baseRev: number): Promise<{ bodyRev: number } | 'stale' | string>
  comment(id: string, issueId: string, text: string, replyTo?: string): Promise<IssueComment[] | string>
  create(r: { id: string; name: string; prefix: string; workspaceId: string; parent?: PageRef | null }): Promise<string | null>
  remove(id: string): Promise<boolean>
  kept(id: string): Promise<LoadedRoadmap | null>
  keep(id: string, r: LoadedRoadmap): void
}

const GONE = 'No such roadmap.'
const ROADMAP_FAILED: Record<number, string> = { 401: 'Your session ended.', 404: GONE, 409: 'Busy, try again.' }
const roadmapKey = (id: string) => `roadmap:${id}`

const validKept = (v: unknown): v is LoadedRoadmap => {
  const r = v as Partial<LoadedRoadmap> | null
  return !!r && !!r.roadmap && typeof r.roadmap.id === 'string' && Array.isArray(r.issues) && typeof r.role === 'string' && Array.isArray(r.members)
}

export function remoteRoadmapRepo({ fetcher = (...a) => fetch(...a), onSignedOut, account }: { fetcher?: typeof fetch; onSignedOut?: () => void; account?: string } = {}): RoadmapRepo {
  const call = async (query: string, init?: RequestInit) => {
    const r = await fetcher(`/api/roadmaps${query}`, { credentials: 'same-origin', ...init })
    if (r.status === 401) onSignedOut?.()
    return r
  }
  const memory = new Map<string, LoadedRoadmap>()
  const reading = new Map<string, Promise<LoadedRoadmap | null>>()
  const remember = (r: LoadedRoadmap) => {
    memory.set(r.roadmap.id, r)
    if (account) void cacheSet(account, roadmapKey(r.roadmap.id), r)
  }
  const forget = (id: string) => {
    memory.delete(id)
    if (account) void cacheDelete(account, roadmapKey(id))
  }
  const resolveKept = async (id: string): Promise<LoadedRoadmap | null> => {
    const mem = memory.get(id)
    if (mem) return mem
    if (!account) return null
    const stored = await cacheGet<unknown>(account, roadmapKey(id))
    if (!validKept(stored)) return null
    memory.set(id, stored)
    return stored
  }
  return {
    get: (id) => {
      const have = reading.get(id)
      if (have) return have
      const p = (async () => {
        const r = await call(`?id=${encodeURIComponent(id)}`)
        if (r.status === 404) return null
        if (!r.ok) throw new Error(`roadmap: ${r.status}`)
        const loaded = (await r.json()) as LoadedRoadmap
        remember(loaded)
        return loaded
      })().finally(() => reading.delete(id))
      reading.set(id, p)
      return p
    },
    changes: async (id, since) => {
      const r = await call(`?id=${encodeURIComponent(id)}&since=${since}`)
      if (r.status === 404) return null
      if (!r.ok) throw new Error(`roadmap changes: ${r.status}`)
      return (await r.json()) as Changes
    },
    write: async (id, op) => {
      try {
        const r = await call(`?id=${encodeURIComponent(id)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ op }) })
        const body = (await r.json().catch(() => null)) as { seq?: number; changed?: Issue[]; error?: unknown } | null
        if (r.ok && typeof body?.seq === 'number') return { seq: body.seq, changed: Array.isArray(body.changed) ? body.changed : [] }
        if (r.status === 403 && typeof body?.error === 'string') return body.error
        if (typeof body?.error === 'string' && body.error) return body.error
        return ROADMAP_FAILED[r.status] ?? `The server answered ${r.status}.`
      } catch { return OFFLINE }
    },
    detail: async (id, issueId) => {
      const r = await call(`?id=${encodeURIComponent(id)}&issue=${encodeURIComponent(issueId)}`)
      if (r.status === 404) return null
      if (!r.ok) throw new Error(`issue: ${r.status}`)
      return (await r.json()) as IssueDetail
    },
    putBody: async (id, issueId, text, baseRev) => {
      try {
        const r = await call(`?id=${encodeURIComponent(id)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body: { issueId, text, baseRev } }) })
        const body = (await r.json().catch(() => null)) as { bodyRev?: number; error?: unknown } | null
        if (r.ok && typeof body?.bodyRev === 'number') return { bodyRev: body.bodyRev }
        if (r.status === 409 && body?.error === DOC_STALE) return 'stale'
        if (typeof body?.error === 'string') return body.error
        return ROADMAP_FAILED[r.status] ?? `The server answered ${r.status}.`
      } catch { return OFFLINE }
    },
    comment: async (id, issueId, text, replyTo) => {
      try {
        const r = await call(`?id=${encodeURIComponent(id)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ comment: { issueId, text, ...(replyTo ? { replyTo } : {}) } }) })
        const body = (await r.json().catch(() => null)) as { comments?: IssueComment[]; error?: unknown } | null
        if (r.ok && Array.isArray(body?.comments)) return body.comments
        if (typeof body?.error === 'string') return body.error
        return ROADMAP_FAILED[r.status] ?? `The server answered ${r.status}.`
      } catch { return OFFLINE }
    },
    create: async (r) => {
      try {
        const res = await call('', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(r) })
        if (res.ok) return null
        const body = (await res.json().catch(() => null)) as { error?: unknown } | null
        return typeof body?.error === 'string' ? body.error : ROADMAP_FAILED[res.status] ?? `The server answered ${res.status}.`
      } catch { return OFFLINE }
    },
    remove: async (id) => {
      try {
        const ok = (await call(`?id=${encodeURIComponent(id)}`, { method: 'DELETE' })).status === 204
        if (ok) forget(id)
        return ok
      } catch { return false }
    },
    kept: (id) => resolveKept(id),
    keep: (id, r) => { if (r.roadmap.id === id) remember(r) },
  }
}

type StoredIssue = Issue & { body: string; comments: IssueComment[] }
type StoredEvent = IssueEvent & { seq: number }
interface StoredRoadmap {
  id: string; name: string; prefix: string; workspaceId: string; updated: number
  parent?: PageRef | null; sortKey?: string | null
  fields: RoadmapState['roadmap']['fields']; nextNumber: number; seq: number
  issues: StoredIssue[]; events: StoredEvent[]
}

const LOCAL_USER = 'local'
const LOCAL_MEMBERS = [{ id: LOCAL_USER, name: 'You', email: 'dev@local' }]
const WRITE_GATE = '/api/roadmaps?writeGate=1'

async function localWriteGate(store: Pick<Storage, 'getItem'>): Promise<'ok' | typeof OFFLINE> {
  try {
    if (store.getItem('smartchart.roadmapWriteGate') !== '1') return 'ok'
    const r = await fetch(WRITE_GATE, { credentials: 'same-origin' })
    if (r.status >= 500) return OFFLINE
    return 'ok'
  } catch {
    return OFFLINE
  }
}

/** The dev account's roadmaps in this browser; ops run through applyOp as on the server. */
export function localRoadmapRepo(storage?: Pick<Storage, 'getItem' | 'setItem'>): RoadmapRepo {
  const store = () => storage ?? localStorage
  const read = (): Record<string, StoredRoadmap> => { try { return (JSON.parse(store().getItem(ROADMAPS_KEY) ?? 'null') as Record<string, StoredRoadmap> | null) ?? {} } catch { return {} } }
  const write = (all: Record<string, StoredRoadmap>) => { try { store().setItem(ROADMAPS_KEY, JSON.stringify(all)); return true } catch { return false } }
  const loadState = (m: StoredRoadmap): RoadmapState => ({
    roadmap: { id: m.id, workspaceId: m.workspaceId, name: m.name, prefix: m.prefix, fields: structuredClone(m.fields), nextNumber: m.nextNumber, seq: m.seq },
    issues: m.issues.map(({ body: _b, comments: _c, ...issue }) => structuredClone(issue)),
  })
  const loaded = (m: StoredRoadmap): LoadedRoadmap => ({ ...loadState(m), role: 'owner', members: LOCAL_MEMBERS })
  const tick = () => Date.now()

  return {
    get: async (id) => { const m = read()[id]; return m ? loaded(m) : null },
    changes: async (id, since) => {
      const m = read()[id]
      if (!m) return null
      const issues = m.issues.filter((i) => i.seq > since).map(({ body: _b, comments: _c, ...issue }) => structuredClone(issue))
      const events = m.events.filter((e) => e.seq > since).map(({ seq: _s, ...e }) => structuredClone(e))
      return { seq: m.seq, roadmap: m.seq > since ? loadState(m).roadmap : null, issues, events }
    },
    write: async (id, op) => {
      const gated = await localWriteGate(store())
      if (gated !== 'ok') return gated
      const all = read(), m = all[id]
      if (!m) return GONE
      const now = tick()
      const r = applyOp(loadState(m), op, { by: LOCAL_USER, byClient: 'app', now, members: [LOCAL_USER] })
      if ('refused' in r) return r.refused
      m.name = r.state.roadmap.name
      m.fields = structuredClone(r.state.roadmap.fields)
      m.nextNumber = r.state.roadmap.nextNumber
      m.seq = r.state.roadmap.seq
      m.updated = now
      for (const row of r.changed) {
        const prev = m.issues.find((i) => i.id === row.id)
        const base = prev ?? { body: '', comments: [] as IssueComment[] }
        const next = { ...structuredClone(row), body: base.body, comments: base.comments }
        const i = m.issues.findIndex((x) => x.id === row.id)
        if (i >= 0) m.issues[i] = next
        else m.issues.push(next)
      }
      for (const e of r.events) m.events.push({ ...e, seq: m.seq })
      return write(all) ? { seq: m.seq, changed: structuredClone(r.changed) } : 'This browser’s storage is full.'
    },
    detail: async (id, issueId) => {
      const m = read()[id], row = m?.issues.find((i) => i.id === issueId)
      if (!m || !row) return null
      const events = m.events.filter((e) => e.issueId === issueId).map(({ seq: _s, ...e }) => structuredClone(e))
      return { body: row.body, bodyRev: row.bodyRev, comments: structuredClone(row.comments), events }
    },
    putBody: async (id, issueId, text, baseRev) => {
      const all = read(), m = all[id], row = m?.issues.find((i) => i.id === issueId)
      if (!m || !row) return GONE
      if (row.bodyRev !== baseRev) return 'stale'
      const { doc } = parseDoc(text)
      const { theme: _t, accent: _a, ...body } = doc
      const stored = serializeDoc(body)
      const now = tick()
      m.seq += 1
      m.updated = now
      row.body = stored
      row.bodyRev = baseRev + 1
      row.seq = m.seq
      row.updatedAt = now
      m.events.push({ seq: m.seq, issueId, by: LOCAL_USER, byClient: 'app', at: now, what: 'set', changes: [{ path: 'body', from: null, to: stored }] })
      return write(all) ? { bodyRev: row.bodyRev } : 'This browser’s storage is full.'
    },
    comment: async (id, issueId, text, replyTo) => {
      const all = read(), m = all[id], row = m?.issues.find((i) => i.id === issueId)
      if (!m || !row) return GONE
      const now = tick()
      const c: IssueComment = { id: newCommentId(row.comments.map((x) => x.id)), by: LOCAL_USER, text, at: now, ...(replyTo ? { replyTo } : {}) }
      m.seq += 1
      m.updated = now
      row.comments.push(c)
      row.seq = m.seq
      row.updatedAt = now
      m.events.push({ seq: m.seq, issueId, by: LOCAL_USER, byClient: 'app', at: now, what: 'commented', changes: [{ path: 'comment', from: null, to: text }] })
      return write(all) ? structuredClone(row.comments) : 'This browser’s storage is full.'
    },
    create: async (r) => {
      const all = read()
      if (all[r.id]) return GONE
      const at = placeNew(storage, r.workspaceId, r.parent ?? null)
      if ('refused' in at) return at.refused
      const now = tick()
      all[r.id] = {
        id: r.id, name: r.name.trim(), prefix: r.prefix.trim(), workspaceId: r.workspaceId, updated: now,
        parent: at.parent, sortKey: at.sortKey, fields: [], nextNumber: 1, seq: 0, issues: [], events: [],
      }
      return write(all) ? null : 'This browser’s storage is full.'
    },
    remove: async (id) => removeBranch(storage, { kind: 'roadmap', id }),
    kept: async (id) => { const m = read()[id]; return m ? loaded(m) : null },
    keep: () => { /* local copy is always the storage */ },
  }
}
