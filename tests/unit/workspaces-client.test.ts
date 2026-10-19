import { describe, expect, it } from 'vitest'
import { currentWorkspace, localWorkspaceRepo, remoteWorkspaceRepo, LOCAL_WORKSPACE } from '@/app/workspaces'
import { localDocRepo, remoteDocRepo } from '@/app/docs'
import { remoteDeckRepo } from '@/app/remote'
import { localDeckRepo, KEY, type SavedDeck } from '@/app/store'

type Call = { url: string; method: string; body: unknown }
/** A stub fetcher: records each call and answers from `answer` (status and JSON body). */
function stub(answer: (c: Call) => [number, unknown?]) {
  const calls: Call[] = []
  const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const c = { url: String(input), method: init?.method ?? 'GET', body: init?.body ? JSON.parse(String(init.body)) : undefined }
    calls.push(c)
    const [status, body] = answer(c)
    return status === 204 ? new Response(null, { status }) : Response.json(body ?? {}, { status })
  }) as typeof fetch
  return { calls, fetcher }
}
const memory = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v) } } }
const deck = (id: string): SavedDeck => ({ id, style: 'consulting', theme: 'ink', accent: null, current: 0, history: [], working: [], messages: [], updated: 1, items: [] })

describe('remote workspace repo', () => {
  it('makes each call the API expects', async () => {
    const { calls, fetcher } = stub((c) => c.url.includes('invite') && c.method === 'POST' ? [200, { link: 'https://o/i/tok' }]
      : c.url.includes('accept') ? [200, { workspaceId: 'ws_1', role: 'editor' }] : c.url.endsWith('members') ? [200, { members: [], invites: [] }]
      : c.method === 'POST' ? [200, { id: 'ws_2' }] : c.method === 'DELETE' ? [204] : [200, c.method === 'GET' ? [{ id: 'ws_1', name: 'Mine', role: 'owner', personal: true, members: 1, usedAt: null }] : { ok: true }])
    const repo = remoteWorkspaceRepo({ fetcher })
    expect(await repo.list()).toMatchObject([{ id: 'ws_1', role: 'owner' }])
    expect(await repo.create('Acme')).toBe('ws_2')
    await repo.rename('ws_1', 'New')
    await repo.use('ws_1')
    expect(await repo.members('ws_1')).toEqual({ members: [], invites: [] })
    await repo.setRole('ws_1', 'u_b', 'viewer')
    await repo.setRole('ws_1', 'u_b', null)
    expect(await repo.invite('ws_1', 'b@x.co', 'editor')).toBe('https://o/i/tok')
    await repo.revoke('ws_1', 'tok')
    expect(await repo.accept('tok')).toEqual({ workspaceId: 'ws_1', role: 'editor' })
    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual([
      'GET /api/workspaces', 'POST /api/workspaces', 'PUT /api/workspaces?id=ws_1', 'PUT /api/workspaces?id=ws_1', 'GET /api/workspaces?id=ws_1&members',
      'PUT /api/workspaces?id=ws_1&member=u_b', 'PUT /api/workspaces?id=ws_1&member=u_b', 'POST /api/workspaces?id=ws_1&invite', 'DELETE /api/workspaces?id=ws_1&invite=tok', 'POST /api/workspaces?accept=tok'])
    expect(calls.map((c) => c.body).filter(Boolean)).toEqual([{ name: 'Acme' }, { name: 'New' }, { used: true }, { role: 'viewer' }, { role: null }, { email: 'b@x.co', role: 'editor' }])
  })

  it('a refusal throws the server’s sentence; no answer throws one of ours', async () => {
    const said = 'A workspace needs an owner. Make someone else owner first.'
    const repo = remoteWorkspaceRepo({ fetcher: stub(() => [409, { error: said }]).fetcher })
    await expect(repo.setRole('ws_1', 'u_a', 'editor')).rejects.toThrow(said)
    const down = remoteWorkspaceRepo({ fetcher: (async () => { throw new TypeError('network') }) as typeof fetch })
    await expect(down.list()).rejects.toThrow('You’re offline, or the server can’t be reached.')
    const odd = remoteWorkspaceRepo({ fetcher: stub(() => [500]).fetcher })
    await expect(odd.create('x')).rejects.toThrow('The server answered 500.')
  })
})

describe('local workspace repo (the dev account)', () => {
  it('has one personal workspace that holds this browser’s decks', async () => {
    const storage = memory()
    storage.setItem(KEY, JSON.stringify({ active: null, decks: { d_1: deck('d_1'), d_2: deck('d_2') } }))
    const ws = localWorkspaceRepo()
    expect(await ws.list()).toEqual([{ id: LOCAL_WORKSPACE, name: 'Dev’s workspace', role: 'owner', personal: true, members: 1, usedAt: null }])
    expect((await localDeckRepo(storage).list(LOCAL_WORKSPACE)).map((d) => d.id).sort()).toEqual(['d_1', 'd_2'])
    await expect(ws.invite(LOCAL_WORKSPACE, 'b@x.co', 'viewer')).rejects.toThrow('Sign in to share a workspace.')
  })
})

describe('decks by workspace', () => {
  it('lists one workspace, places a new deck there, and names a viewer’s refused save', async () => {
    const { calls, fetcher } = stub((c) => c.method === 'PUT' ? [403, { error: 'You can view this deck, not edit it.' }] : [200, []])
    const repo = remoteDeckRepo({ fetcher, workspace: () => 'ws_9' })
    await repo.list('ws_9')
    expect(calls[0].url).toBe('/api/decks?workspace=ws_9')
    expect(await repo.save(deck('d_1'))).toBe('You can view this deck, not edit it.')
    expect(calls[1].body).toMatchObject({ id: 'd_1', workspaceId: 'ws_9' })
  })
  it('remembers the role a deck was opened with', async () => {
    const repo = remoteDeckRepo({ fetcher: stub(() => [200, { id: 'd_1', name: 'x', updated: 1, rev: 3, role: 'viewer', data: deck('d_1'), chat: null }]).fetcher })
    await repo.get('d_1')
    expect(repo.role?.('d_1')).toBe('viewer')
  })
})

describe('doc repos', () => {
  it('remote: list by workspace, open, save with the revision read, conflict and refusal sentences, delete', async () => {
    let rev = 0
    const { calls, fetcher } = stub((c) => {
      if (c.method === 'PUT') { const b = c.body as { baseRev: number; text: string }; if (b.text === 'viewer') return [403, { error: 'You can view this doc, not edit it.' }]; if (b.baseRev !== rev) return [409, { error: 'x' }]; return [200, { ok: true, rev: ++rev }] }
      if (c.method === 'DELETE') return [204]
      return c.url.includes('?id=') ? [200, { id: 'doc_1', name: 'Memo', text: '# Memo', rev, updated: 5, workspaceId: 'ws_1' }] : [200, [{ id: 'doc_1', name: 'Memo', updated: 5, workspaceId: 'ws_1' }]]
    })
    const docs = remoteDocRepo({ fetcher })
    expect(await docs.list('ws_1')).toMatchObject([{ id: 'doc_1' }])
    expect(await docs.save({ id: 'doc_1', name: 'Memo', text: '# Memo', workspaceId: 'ws_1' })).toBeNull()
    expect(await docs.get('doc_1')).toMatchObject({ text: '# Memo' })
    expect(await docs.save({ id: 'doc_1', name: 'Memo', text: '# Memo 2', workspaceId: 'ws_1' })).toBeNull()
    rev = 9
    expect(await docs.save({ id: 'doc_1', name: 'Memo', text: '# Memo 3', workspaceId: 'ws_1' })).toBe('This doc was changed in another tab or window. Reload to see the latest.')
    expect(await docs.save({ id: 'doc_1', name: 'Memo', text: 'viewer', workspaceId: 'ws_1' })).toBe('You can view this doc, not edit it.')
    expect(await docs.remove('doc_1')).toBe(true)
    expect(calls[0].url).toBe('/api/docs?workspace=ws_1')
    expect(calls[1].body).toEqual({ id: 'doc_1', name: 'Memo', text: '# Memo', baseRev: 0, workspaceId: 'ws_1' })
    expect(calls[3].body).toMatchObject({ baseRev: 1 })
  })
  it('local: kept in this browser, newest first', async () => {
    const docs = localDocRepo(memory())
    expect(await docs.save({ id: 'doc_a', name: 'A', text: '# A', workspaceId: LOCAL_WORKSPACE })).toBeNull()
    expect(await docs.save({ id: 'doc_b', name: 'B', text: '# B', workspaceId: LOCAL_WORKSPACE })).toBeNull()
    expect((await docs.list(LOCAL_WORKSPACE)).map((d) => d.id)).toEqual(['doc_b', 'doc_a'])
    expect(await docs.get('doc_a')).toMatchObject({ name: 'A', text: '# A' })
    expect(await docs.remove('doc_a')).toBe(true)
    expect(await docs.get('doc_a')).toBeNull()
  })
})

describe('the current workspace', () => {
  const ws = (id: string) => ({ id, name: id, role: 'owner' as const, personal: false, members: 1, usedAt: null })
  it('is the one asked for if the user is in it, else the most recently used', () => {
    expect(currentWorkspace([ws('a'), ws('b')], 'b')?.id).toBe('b')
    expect(currentWorkspace([ws('a'), ws('b')], 'gone')?.id).toBe('a')
    expect(currentWorkspace([ws('a')], null)?.id).toBe('a')
    expect(currentWorkspace([], null)).toBeNull()
  })
})
