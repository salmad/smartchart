/* The docs and comments this tab has read, kept in memory per repo, so a doc opened again (or pointed at in the sidebar)
   paints at once while the server is asked again. The server's answer always replaces what is kept. */
import type { Doc, DocComment, DocRepo } from './docs'

interface Kept { doc?: Doc; comments?: DocComment[] }
const kept = new WeakMap<DocRepo, Map<string, Kept>>()

const of = (repo: DocRepo) => { const m = kept.get(repo) ?? new Map<string, Kept>(); kept.set(repo, m); return m }

export const peekDoc = (repo: DocRepo, id: string): Doc | null => of(repo).get(id)?.doc ?? null
export const peekComments = (repo: DocRepo, id: string): DocComment[] => of(repo).get(id)?.comments ?? []
export const keepDoc = (repo: DocRepo, doc: Doc) => { const m = of(repo); m.set(doc.id, { ...m.get(doc.id), doc }) }
export const keepComments = (repo: DocRepo, id: string, comments: DocComment[]) => { const m = of(repo); m.set(id, { ...m.get(id), comments }) }

/** Reads a doc and its comments into memory ahead of opening it; once per doc while it is kept. */
export function readDocAhead(repo: DocRepo, id: string) {
  if (of(repo).get(id)?.doc) return
  void repo.get(id).then((d) => { if (d) keepDoc(repo, d) }, () => undefined)
  void repo.comments(id).then((c) => keepComments(repo, id, c), () => undefined)
}
