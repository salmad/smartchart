/* Docs as the app reaches them: on the server (/api/docs) for a signed-in user, or in this browser for the dev account.
   The same shape as DeckRepo's list, get, save and remove. A doc is its Markdown text; writing in it comes in M4. */
import { OFFLINE } from './workspaces'

export interface DocSummary { id: string; name: string; updated: number; workspaceId: string }
export interface Doc extends DocSummary { text: string }
/** What a save sends: the doc as this tab holds it. */
export type DocDraft = Omit<Doc, 'updated'>

export interface DocRepo {
  list(workspaceId: string): Promise<DocSummary[]>
  get(id: string): Promise<Doc | null>
  /** Null when saved; otherwise why not, as a sentence. */
  save(doc: DocDraft): Promise<string | null>
  remove(id: string): Promise<boolean>
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
      return (await r.json()) as DocSummary[]
    },
    get: async (id) => {
      const r = await call(`?id=${encodeURIComponent(id)}`)
      if (r.status === 404) return null
      if (!r.ok) throw new Error(`doc: ${r.status}`)
      const d = (await r.json()) as Doc & { rev: number }
      revs.set(id, d.rev)
      return { id: d.id, name: d.name, text: d.text, updated: d.updated, workspaceId: d.workspaceId }
    },
    save: async (doc) => {
      try {
        const r = await call('', { method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: doc.id, name: doc.name, text: doc.text, baseRev: revs.get(doc.id) ?? 0, workspaceId: doc.workspaceId }) })
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
  }
}

export const DOCS_KEY = 'smartchart.docs.v1'

/** The dev account's docs, in this browser. */
export function localDocRepo(storage?: Pick<Storage, 'getItem' | 'setItem'>): DocRepo {
  const read = (): Record<string, Doc> => { try { return (JSON.parse((storage ?? localStorage).getItem(DOCS_KEY) ?? 'null') as Record<string, Doc> | null) ?? {} } catch { return {} } }
  const write = (all: Record<string, Doc>) => { try { (storage ?? localStorage).setItem(DOCS_KEY, JSON.stringify(all)); return true } catch { return false } }
  return {
    list: async (ws) => Object.values(read()).filter((d) => d.workspaceId === ws).sort((a, b) => b.updated - a.updated)
      .map(({ id, name, updated, workspaceId }) => ({ id, name, updated, workspaceId })),
    get: async (id) => read()[id] ?? null,
    save: async (doc) => {
      const all = read()
      // Later than every doc kept, so two saves in one millisecond still list newest first.
      const updated = Math.max(Date.now(), ...Object.values(all).map((d) => d.updated + 1))
      all[doc.id] = { ...doc, updated }
      return write(all) ? null : 'This browser’s storage is full.'
    },
    remove: async (id) => { const all = read(); if (!all[id]) return false; delete all[id]; return write(all) },
  }
}
