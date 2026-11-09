/* One roadmap in memory: paints from the kept copy, merges polls, and applies each write at once with pending ops on top. */
import { applyOp, type RoadmapOp } from '@/engine/roadmaps/ops'
import type { Issue, LoadedRoadmap, MemberLite, RoadmapState, Role } from '@/engine/roadmaps/types'
import type { OpCtx } from '@/engine/roadmaps/ops'
import { ordered } from './optimistic'
import type { RoadmapRepo } from './roadmaps'

export const POLL_MS = 5000
const BY_CLIENT = 'app'
const GONE = 'No such roadmap.'

export interface RoadmapView {
  state: RoadmapState | null
  role: Role | null
  members: MemberLite[]
  error: string | null
  said: string | null
}

export function roadmapStore(repo: RoadmapRepo, id: string, ctx: { by: string; now: () => number }) {
  const subs = new Set<() => void>()
  const queue = ordered()
  let base: LoadedRoadmap | null = null
  let pending: RoadmapOp[] = []
  let error: string | null = null
  let said: string | null = null
  let pollTimer: ReturnType<typeof setInterval> | null = null
  let closed = false

  const notify = () => { subs.forEach((fn) => fn()) }

  const opCtx = (): OpCtx => ({
    by: ctx.by,
    byClient: BY_CLIENT,
    now: ctx.now(),
    members: base?.members.map((m) => m.id) ?? [],
  })

  const overlay = (from: RoadmapState, ops: readonly RoadmapOp[]): RoadmapState => {
    let state = from
    for (const op of ops) {
      const r = applyOp(state, op, opCtx())
      if ('refused' in r) break
      state = r.state
    }
    return state
  }

  const view = (): RoadmapView => ({
    state: base ? overlay({ roadmap: base.roadmap, issues: base.issues }, pending) : null,
    role: base?.role ?? null,
    members: base?.members ?? [],
    error,
    said,
  })

  const mergeIssues = (rows: Issue[]) => {
    if (!base) return
    const map = new Map(base.issues.map((i) => [i.id, i]))
    for (const row of rows) {
      const prev = map.get(row.id)
      if (!prev || row.seq >= prev.seq) map.set(row.id, row)
    }
    base = { ...base, issues: [...map.values()] }
  }

  const paint = (r: LoadedRoadmap) => {
    base = r
    repo.keep(id, r)
    error = null
    notify()
  }

  const syncFromServer = async (kept: LoadedRoadmap | null) => {
    try {
      if (kept) {
        const ch = await repo.changes(id, kept.roadmap.seq)
        if (!ch) return
        if (ch.roadmap && base) base = { ...base, roadmap: ch.roadmap }
        if (ch.issues.length) mergeIssues(ch.issues)
        if (ch.seq > (base?.roadmap.seq ?? 0) && base) base = { ...base, roadmap: { ...base.roadmap, seq: ch.seq } }
        if (base) repo.keep(id, base)
        notify()
        return
      }
      const full = await repo.get(id)
      if (!full) { error = GONE; notify(); return }
      paint(full)
    } catch {
      if (!base) { error = 'Couldn’t read the roadmap.'; notify() }
    }
  }

  return {
    get: view,
    subscribe(fn: () => void) { subs.add(fn); return () => { subs.delete(fn) } },

    async open() {
      closed = false
      const kept = await repo.kept(id)
      if (kept) {
        paint(kept)
        void syncFromServer(kept)
        return
      }
      await syncFromServer(null)
    },

    act(op: RoadmapOp): 'ok' | string {
      if (!base) return GONE
      const now = overlay({ roadmap: base.roadmap, issues: base.issues }, pending)
      const trial = applyOp(now, op, opCtx())
      if ('refused' in trial) return trial.refused
      said = null
      pending = [...pending, op]
      notify()
      queue.run(id, async () => {
        const out = await repo.write(id, op)
        if (typeof out === 'string') {
          pending = pending.filter((p) => p !== op)
          said = out
          notify()
          return out
        }
        const settled = applyOp({ roadmap: base!.roadmap, issues: base!.issues }, op, opCtx())
        if (!('refused' in settled)) {
          base = { ...base!, roadmap: settled.state.roadmap, issues: settled.state.issues }
          if (out.seq > base.roadmap.seq) base = { ...base, roadmap: { ...base.roadmap, seq: out.seq } }
          repo.keep(id, base)
        }
        pending = pending.filter((p) => p !== op)
        notify()
        return out
      }).catch(() => undefined)
      return 'ok'
    },

    async poll() {
      if (!base || closed) return
      try {
        const ch = await repo.changes(id, base.roadmap.seq)
        if (!ch) return
        if (ch.roadmap) base = { ...base, roadmap: ch.roadmap }
        if (ch.issues.length) mergeIssues(ch.issues)
        if (ch.seq > base.roadmap.seq) base = { ...base, roadmap: { ...base.roadmap, seq: ch.seq } }
        repo.keep(id, base)
        notify()
      } catch { /* next poll */ }
    },

    close() {
      closed = true
      if (pollTimer) clearInterval(pollTimer)
      pollTimer = null
    },
  }
}
