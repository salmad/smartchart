import { describe, expect, it, vi } from 'vitest'
import { applyOp, type RoadmapOp } from '@/engine/roadmaps/ops'
import type { Changes, LoadedRoadmap } from '@/engine/roadmaps/types'
import type { RoadmapRepo } from '@/app/roadmaps'
import { roadmapStore } from '@/app/roadmap-store'
import { ctx, issue, state } from './roadmap-builders'

const loaded = (issues = [issue({ id: 'a', status: 'todo' })]): LoadedRoadmap => ({
  ...state({ id: 'rm_1', seq: 1 }, issues),
  role: 'owner',
  members: [{ id: 'ann', name: 'Ann', email: 'a@x.com' }, { id: 'bob', name: 'Bob', email: 'b@x.com' }],
})

function repo(partial: Partial<RoadmapRepo> & { writeDelay?: number; failWrite?: boolean }): RoadmapRepo & { writeGate?: () => void } {
  let kept: LoadedRoadmap | null = loaded()
  const writes: RoadmapOp[] = []
  let releaseWrite: (() => void) | undefined
  const writePromise = () => new Promise<void>((resolve) => { releaseWrite = resolve })
  const out: RoadmapRepo & { writeGate?: () => void } = {
    get: async () => kept,
    changes: async (_id, since) => {
      if (!kept) return null
      const issues = kept.issues.filter((i) => i.seq > since)
      return { seq: kept.roadmap.seq, roadmap: kept.roadmap.seq > since ? kept.roadmap : null, issues, events: [] } satisfies Changes
    },
    write: async (_id, op) => {
      writes.push(op)
      if (partial.writeDelay) await writePromise()
      if (partial.failWrite) return 'Offline.'
      const r = applyOp({ roadmap: kept!.roadmap, issues: kept!.issues }, op, ctx)
      if ('refused' in r) return r.refused
      kept = { ...kept!, roadmap: r.state.roadmap, issues: r.state.issues }
      return { seq: kept.roadmap.seq }
    },
    detail: async () => null,
    putBody: async () => 'stale',
    comment: async () => [],
    create: async () => null,
    remove: async () => true,
    kept: async () => kept,
    keep: (_id, r) => { kept = r },
    ...partial,
  }
  out.writeGate = () => releaseWrite?.()
  return out
}

describe('roadmapStore', () => {
  it('act changes get().state before the send resolves', async () => {
    const r = repo({ writeDelay: 1 })
    const store = roadmapStore(r, 'rm_1', { by: 'ann', now: () => 1 })
    await store.open()
    expect(store.get().state?.issues[0].status).toBe('todo')
    store.act({ op: 'set', ids: ['a'], props: { status: 'done' } })
    expect(store.get().state?.issues[0].status).toBe('done')
    r.writeGate?.()
    await vi.waitFor(() => expect(store.get().state?.issues[0].status).toBe('done'))
  })

  it('a failed send restores the old status and sets said', async () => {
    const r = repo({ failWrite: true })
    const store = roadmapStore(r, 'rm_1', { by: 'ann', now: () => 1 })
    await store.open()
    store.act({ op: 'set', ids: ['a'], props: { status: 'done' } })
    await vi.waitFor(() => expect(store.get().state?.issues[0].status).toBe('todo'))
    expect(store.get().said).toBe('Offline.')
  })

  it('poll keeps our pending status while showing another user’s assignee', async () => {
    const snap = loaded()
    const r = repo({})
    r.keep('rm_1', snap)
    let serverLive = false
    r.changes = async (_id, since) => {
      if (!serverLive || since >= 99) return null
      return {
        seq: 99,
        roadmap: { ...snap.roadmap, seq: 99 },
        issues: [{ ...snap.issues[0], assignee: 'bob', seq: 99 }],
        events: [],
      } satisfies Changes
    }
    const store = roadmapStore(r, 'rm_1', { by: 'ann', now: () => 1 })
    await store.open()
    await vi.waitFor(() => expect(store.get().state).not.toBeNull())
    expect(store.get().state?.issues[0].assignee).toBeNull()
    store.act({ op: 'set', ids: ['a'], props: { status: 'in_progress' } })
    serverLive = true
    await store.poll()
    expect(store.get().state?.issues[0].status).toBe('in_progress')
    expect(store.get().state?.issues[0].assignee).toBe('bob')
  })

  it('open with a kept copy shows it before changes resolves', async () => {
    const snap = loaded([issue({ id: 'a', title: 'Cached' })])
    const r: RoadmapRepo = {
      get: () => new Promise(() => undefined),
      changes: () => new Promise(() => undefined),
      write: async () => ({ seq: 1 }),
      detail: async () => null,
      putBody: async () => 'stale',
      comment: async () => [],
      create: async () => null,
      remove: async () => true,
      kept: async () => snap,
      keep: () => undefined,
    }
    const store = roadmapStore(r, 'rm_1', { by: 'ann', now: () => 1 })
    const opening = store.open()
    await Promise.resolve()
    expect(store.get().state?.issues[0].title).toBe('Cached')
    await expect(opening).resolves.toBeUndefined()
  })

  it('two acts on one issue send in order', async () => {
    const order: string[] = []
    const r = repo({ writeDelay: 1 })
    const base = r
    const wrapped: RoadmapRepo = {
      ...r,
      write: async (id, op) => {
        if (op.op === 'set' && op.props.title) order.push(op.props.title)
        return base.write(id, op)
      },
    }
    const store = roadmapStore(wrapped, 'rm_1', { by: 'ann', now: () => 1 })
    await store.open()
    store.act({ op: 'set', ids: ['a'], props: { title: 'First' } })
    store.act({ op: 'set', ids: ['a'], props: { title: 'Second' } })
    await vi.waitFor(() => {
      if (order.length < 2) r.writeGate?.()
      expect(order).toEqual(['First', 'Second'])
    })
  })
})
