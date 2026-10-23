/* The docs and comments this tab has read or saved, kept in memory and (signed in) in this browser, so a doc opened again,
   pointed at in the sidebar, or opened on the next visit paints at once while the server is asked again. The server's
   answer always replaces what is kept; a doc deleted, or an account that signed out, takes its copy with it. */
import { cacheDelete, cacheGet, cacheSet } from './cache'
import type { Doc, DocComment, DocRepo } from './docs'

export interface KeptDoc { doc: Doc | null; comments: DocComment[] }

const valid = (v: unknown): v is KeptDoc => {
  const k = v as Partial<KeptDoc> | null
  return !!k && typeof k === 'object' && Array.isArray(k.comments) && (k.doc === null || (!!k.doc && typeof k.doc.id === 'string' && typeof k.doc.text === 'string'))
}

/** The same repo, remembering what it reads and saves. Without an `account` the copies live in memory only. */
export function cachedDocRepo(inner: DocRepo, account?: string): DocRepo {
  const memory = new Map<string, KeptDoc>()
  const keep = (id: string, patch: Partial<KeptDoc>) => {
    const next = { doc: null, comments: [], ...memory.get(id), ...patch }
    memory.set(id, next)
    // Comments read before the doc are held in memory only: written alone, they would replace the stored doc with none.
    if (account && next.doc) void cacheSet(account, `doc:${id}`, next)
  }
  // A read already on its way (pointing at a row in the sidebar starts one) is shared: opening the doc waits for it rather than asking again.
  const reading = new Map<string, Promise<Doc | null>>()
  return {
    ...inner,
    get: (id) => {
      const have = reading.get(id)
      if (have) return have
      const p = inner.get(id).then((d) => { if (d) keep(id, { doc: d }); else forget(id); return d }).finally(() => reading.delete(id))
      reading.set(id, p)
      return p
    },
    save: async (doc, opts) => {
      const why = await inner.save(doc, opts)
      if (!why) { const { parent: _p, ...rest } = doc; keep(doc.id, { doc: { ...rest, updated: Date.now() } }) }
      return why
    },
    remove: async (id) => {
      const ok = await inner.remove(id)
      if (ok) forget(id)
      return ok
    },
    comments: async (id) => {
      const c = await inner.comments(id)
      keep(id, { comments: c })
      return c
    },
    comment: async (id, op) => {
      const r = await inner.comment(id, op)
      if (typeof r !== 'string') keep(id, { comments: r })
      return r
    },
    peek: (id) => memory.get(id) ?? null,
    kept: async (id) => {
      if (memory.get(id)?.doc || !account) return memory.get(id) ?? null
      const stored = await cacheGet<unknown>(account, `doc:${id}`)
      if (!valid(stored) || !stored.doc) return memory.get(id) ?? null
      // A read that landed while this one waited is newer: it wins.
      const now = memory.get(id)
      if (!now?.doc) memory.set(id, { doc: stored.doc, comments: now?.comments.length ? now.comments : stored.comments })
      return memory.get(id) ?? null
    },
  }
  function forget(id: string) { memory.delete(id); if (account) void cacheDelete(account, `doc:${id}`) }
}
