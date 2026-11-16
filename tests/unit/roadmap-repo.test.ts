import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'
import { localPageRepo } from '@/app/pages'
import { LOCAL_WORKSPACE } from '@/app/workspaces'
import type { LoadedRoadmap } from '@/engine/roadmaps/types'
import { localRoadmapRepo, remoteRoadmapRepo } from '@/app/roadmaps'

beforeEach(() => { vi.stubGlobal('indexedDB', new IDBFactory()); vi.stubGlobal('IDBKeyRange', IDBKeyRange) })
afterEach(() => { vi.unstubAllGlobals(); vi.resetModules() })

const mem = () => { const m: Record<string, string> = {}; return { getItem: (k: string) => m[k] ?? null, setItem: (k: string, v: string) => { m[k] = v }, m } }

const sample = (id: string): LoadedRoadmap => ({
  roadmap: { id, workspaceId: 'w1', name: 'Plan', prefix: 'PLN', fields: [], sprints: null, nextNumber: 1, seq: 0 },
  issues: [],
  role: 'owner',
  members: [{ id: 'u1', name: 'Ann', email: 'ann@example.com' }],
})

describe('remoteRoadmapRepo', () => {
  it('a read is kept in memory and, signed in, in this browser', async () => {
    const loaded = sample('rm_1')
    const fetcher = (async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('?id=rm_1') && !url.includes('since') && !url.includes('issue')) return new Response(JSON.stringify(loaded), { status: 200 })
      return new Response('{}', { status: 404 })
    }) as typeof fetch
    const repo = remoteRoadmapRepo({ fetcher, account: 'u1' })
    await repo.get('rm_1')
    const next = remoteRoadmapRepo({ fetcher: (async () => new Response('{}', { status: 404 })) as typeof fetch, account: 'u1' })
    await vi.waitFor(async () => expect((await next.kept('rm_1'))?.roadmap.name).toBe('Plan'))
    expect(await remoteRoadmapRepo({ fetcher, account: 'u2' }).kept('rm_1')).toBeNull()
  })

  it('write maps 409 to the server’s sentence', async () => {
    const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'POST' && String(input).includes('?id=rm_1'))
        return new Response(JSON.stringify({ error: 'No such issue.' }), { status: 409 })
      return new Response('{}', { status: 200 })
    }) as typeof fetch
    const out = await remoteRoadmapRepo({ fetcher }).write('rm_1', { op: 'set', ids: ['nope'], props: { title: 'X' } })
    expect(out).toBe('No such issue.')
  })
})

describe('localRoadmapRepo', () => {
  it('creates in the page tree, applies ops, and survives a new repo over the same storage', async () => {
    const storage = mem(), pages = localPageRepo(storage)
    const repo = localRoadmapRepo(storage)
    expect(await repo.create({ id: 'rm_1', name: 'Launch', prefix: 'LN', workspaceId: LOCAL_WORKSPACE })).toBeNull()
    expect((await pages.list(LOCAL_WORKSPACE)).find((p) => p.id === 'rm_1')).toMatchObject({ kind: 'roadmap', name: 'Launch' })
    expect(await repo.write('rm_1', { op: 'create', issues: [{ id: 'i_1', parentId: null, title: 'One' }] })).toMatchObject({ seq: expect.any(Number), changed: [expect.objectContaining({ id: 'i_1' })] })
    const again = localRoadmapRepo(storage)
    const r = await again.get('rm_1')
    expect(r?.issues.map((i) => i.id)).toEqual(['i_1'])
    expect(r?.issues[0].title).toBe('One')
  })

  it('duplicate copies issue body and leaves comments empty', async () => {
    const storage = mem()
    const repo = localRoadmapRepo(storage)
    await repo.create({ id: 'rm_1', name: 'Launch', prefix: 'LN', workspaceId: LOCAL_WORKSPACE })
    await repo.write('rm_1', { op: 'create', issues: [{ id: 'i_src', parentId: null, title: 'Source' }] })
    expect(await repo.putBody('rm_1', 'i_src', '# Brief', 0)).toMatchObject({ bodyRev: 1 })
    await repo.comment('rm_1', 'i_src', 'Note')
    expect(await repo.write('rm_1', { op: 'duplicate', copies: [{ id: 'i_copy', sourceId: 'i_src' }] })).toMatchObject({ seq: expect.any(Number) })
    expect(await repo.detail('rm_1', 'i_copy')).toMatchObject({ body: expect.stringContaining('Brief'), bodyRev: 0, comments: [] })
    expect((await repo.detail('rm_1', 'i_src'))?.comments).toHaveLength(1)
  })
})
