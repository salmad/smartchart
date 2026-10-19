// Records a version after a save that landed. A failure is logged and never fails the save: the deck is what matters.
import { hash, nextStep, record, type VersionMeta } from '../../src/engine/versions.js'
import { parseDoc } from '../../src/engine/docs/parse.js'
import { docTree } from '../../src/engine/docs/versions.js'
import type { Db } from './db.js'

export async function recordVersion(db: Db, userId: string, deckId: string, data: unknown, meta: VersionMeta, rev: number, now = Date.now()): Promise<void> {
  try {
    await record({ head: () => db.versionHead(userId, deckId), write: (_step, v) => db.writeVersion(userId, deckId, v) }, data, meta, rev, now)
  } catch (e) { console.error('version not recorded', deckId, e) }
}

/** The app's save says who wrote it: the maker by hand, or Occam's own agent (with the turn and the request). */
export function appMeta(v: unknown): VersionMeta {
  const o = (v && typeof v === 'object' ? v : {}) as { by?: unknown; turn?: unknown; label?: unknown }
  const str = (x: unknown, max: number) => (typeof x === 'string' && x.trim() ? x.trim().slice(0, max) : null)
  return { by: o.by === 'agent' ? 'Occam' : 'You', turn: str(o.turn, 80), label: str(o.label, 300) }
}

/** After a doc save that landed: the doc's text as a version. Like a deck's, a failure is logged and never fails the save. */
export async function recordDocVersion(db: Db, userId: string, docId: string, text: string, by: string, rev: number, label: string | null = null, now = Date.now()): Promise<void> {
  try {
    const { tree, blobs } = docTree(parseDoc(text).doc), key = hash(JSON.stringify(tree)), meta: VersionMeta = { by, turn: null, label }
    const head = await db.docVersionHead(userId, docId)
    // A restore (it carries a label) stands alone; other saves by the same writer fold together within GROUP_MS.
    const step = label ? (head?.key === key ? 'skip' : 'add') : nextStep(head, meta, key, now)
    if (step === 'skip') return
    const stored = new Set(head?.hashes ?? []), fresh = new Map(Object.entries(blobs).filter(([h]) => !stored.has(h)))
    await db.writeDocVersion(userId, docId, { replace: step === 'replace' ? (head as { n: number }).n : null, rev, meta, tree, key, blobs: fresh, at: now })
  } catch (e) { console.error('doc version not recorded', docId, e) }
}
