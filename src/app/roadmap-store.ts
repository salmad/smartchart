/* One roadmap in memory: paints from the kept copy, merges polls, and applies each write at once with pending ops on top. */
import { applyOp, type RoadmapOp } from '@/engine/roadmaps/ops'
import type { Issue, LoadedRoadmap, MemberLite, Roadmap, RoadmapState, Role } from '@/engine/roadmaps/types'
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

/** Rows saved or served before sprints existed lack the keys; every issue and roadmap enters the store through these. */
const issueIn = (i: Issue): Issue => ({ ...i, sprint: i.sprint ?? null, carried: i.carried ?? 0 })
const roadmapIn = (r: Roadmap): Roadmap => ({ ...r, sprints: r.sprints ?? null })

export function roadmapStore(repo: RoadmapRepo, id: string, ctx: { by: string; now: () => number }) {
  const subs = new Set<() => void>()
  const queue = ordered()
  let base: LoadedRoadmap | null = null
  let pending: RoadmapOp[] = []
  let error: string | null = null
  let said: string | null = null
  let pollTimer: ReturnType<typeof setInterval> | null = null
  let closed = false

  let snapshot: RoadmapView = { state: null, role: null, members: [], error: null, said: null }
  const refresh = () => { snapshot = view(); subs.forEach((fn) => fn()) }

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
    for (const raw of rows) {
      const row = issueIn(raw)
      const prev = map.get(row.id)
      if (!prev || row.seq >= prev.seq) map.set(row.id, row)
    }
    base = { ...base, issues: [...map.values()] }
  }

  const paint = (r: LoadedRoadmap) => {
    base = { ...r, roadmap: roadmapIn(r.roadmap), issues: r.issues.map(issueIn) }
    repo.keep(id, base)
    error = null
    refresh()
  }

  const syncFromServer = async (kept: LoadedRoadmap | null) => {
    try {
      if (kept) {
        const ch = await repo.changes(id, kept.roadmap.seq)
        if (!ch) return
        if (ch.roadmap && base) base = { ...base, roadmap: roadmapIn(ch.roadmap) }
        if (ch.issues.length) mergeIssues(ch.issues)
        if (ch.seq > (base?.roadmap.seq ?? 0) && base) base = { ...base, roadmap: { ...base.roadmap, seq: ch.seq } }
        if (base) repo.keep(id, base)
        refresh()
        return
      }
      const full = await repo.get(id)
      if (!full) { error = GONE; refresh(); return }
      paint(full)
    } catch {
      if (!base) { error = 'Couldn’t read the roadmap.'; refresh() }
    }
  }

  const poll = async () => {
    if (!base || closed) return
    try {
      const ch = await repo.changes(id, base.roadmap.seq)
      if (!ch || !base) return
      if (ch.roadmap) base = { ...base, roadmap: roadmapIn(ch.roadmap) }
      if (ch.issues.length) mergeIssues(ch.issues)
      if (ch.seq > base.roadmap.seq) base = { ...base, roadmap: { ...base.roadmap, seq: ch.seq } }
      repo.keep(id, base)
      refresh()
    } catch { /* next poll */ }
  }

  refresh()

  return {
    get: () => snapshot,
    subscribe(fn: () => void) { subs.add(fn); return () => { subs.delete(fn) } },

    async open() {
      closed = false
      const kept = await repo.kept(id)
      if (kept) {
        // Paint the kept copy at once, then replace it with a full read. A changes-only catch-up would leave dates
        // that an older parse wrote into the keep (a day early) forever, since those rows never bump seq again.
        paint(kept)
        void syncFromServer(null)
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
      refresh()
      queue.run(id, async () => {
        const out = await repo.write(id, op)
        if (typeof out === 'string') {
          pending = pending.filter((p) => p !== op)
          said = out
          refresh()
          return out
        }
        // The server's rows are the truth (numbers, keys, seq). The roadmap's seq stays where the last poll left it, so
        // the next poll still fetches what other tabs wrote before this save; the poll right after makes that quick.
        if (base) {
          const settled = applyOp({ roadmap: base.roadmap, issues: base.issues }, op, opCtx())
          if (!('refused' in settled)) {
            const { name, fields, sprints } = settled.state.roadmap
            base = { ...base, roadmap: { ...base.roadmap, name, fields, sprints } }
          }
          mergeIssues(out.changed)
          repo.keep(id, base)
        }
        pending = pending.filter((p) => p !== op)
        refresh()
        void poll()
        return out
      }).catch(() => {
        pending = pending.filter((p) => p !== op)
        said = 'Couldn’t save.'
        refresh()
      })
      return 'ok'
    },

    poll: () => poll(),

    close() {
      closed = true
      if (pollTimer) clearInterval(pollTimer)
      pollTimer = null
    },
  }
}
