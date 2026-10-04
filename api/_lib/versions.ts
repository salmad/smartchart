// Records a version after a save that landed. A failure is logged and never fails the save: the deck is what matters.
import { record, type VersionMeta } from '../../src/engine/versions.js'
import type { Db } from './db.js'

export async function recordVersion(db: Db, userId: string, deckId: string, data: unknown, meta: VersionMeta, rev: number, now = Date.now()): Promise<void> {
  try {
    await record({ head: () => db.versionHead(userId, deckId), write: (_step, v) => db.writeVersion(userId, deckId, v) }, data, meta, rev, now)
  } catch (e) { console.error('version not recorded', deckId, e) }
}

/** The app's save says who wrote it: the maker by hand, or SmartChart's own agent (with the turn and the request). */
export function appMeta(v: unknown): VersionMeta {
  const o = (v && typeof v === 'object' ? v : {}) as { by?: unknown; turn?: unknown; label?: unknown }
  const str = (x: unknown, max: number) => (typeof x === 'string' && x.trim() ? x.trim().slice(0, max) : null)
  return { by: o.by === 'agent' ? 'SmartChart' : 'You', turn: str(o.turn, 80), label: str(o.label, 300) }
}
