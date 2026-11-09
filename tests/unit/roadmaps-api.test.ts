import { describe, expect, it } from 'vitest'
import type { User } from '../../api/_lib/auth'
import { roadmapsHandler } from '../../api/_lib/roadmaps'
import { DOC_STALE } from '../../src/app/docs'
import { fakeDb, type FakeDb } from './fake-db'

const user = (name: string, via: User['via'] = 'session'): User => ({ id: `u_${name.toLowerCase()}`, email: `${name.toLowerCase()}@example.com`, name, via })
const ann = user('Ann'), cy = user('Cy'), dee = user('Dee')
const call = (method: string, query = '', body?: unknown) =>
  new Request(`http://occam.test/api/roadmaps${query}`, { method, body: body === undefined ? undefined : JSON.stringify(body) })

function world(db: FakeDb = fakeDb()) {
  const as = (who: User) => ({
    roadmaps: (method: string, query = '', body?: unknown) =>
      roadmapsHandler({ userFrom: async () => who, db: () => db })(call(method, query, body)),
    ws: async () => {
      const { workspacesHandler } = await import('../../api/_lib/workspaces')
      const r = await workspacesHandler({ userFrom: async () => who, db: () => db })(
        new Request('http://occam.test/api/workspaces', { method: 'GET' }),
      )
      const list = (await r.json()) as { id: string; personal?: boolean }[]
      return list.find((x) => x.personal)?.id as string
    },
  })
  return { db, as }
}
const json = async <T = Record<string, unknown>>(r: Response | Promise<Response>) => (await (await r).json()) as T

async function setupRoadmap(A: ReturnType<ReturnType<typeof world>['as']>, id = 'rm_1') {
  const ws = await A.ws()
  expect((await A.roadmaps('POST', '', { id, name: 'Plan', prefix: 'PLN', workspaceId: ws })).status).toBe(200)
  return { ws, id }
}

describe('roadmaps API', () => {
  it('signed out gets 401', async () => {
    const r = await roadmapsHandler({ userFrom: async () => null, db: () => fakeDb() })(call('GET', '?id=rm_1'))
    expect(r.status).toBe(401)
    expect(await json(r)).toEqual({ error: 'Sign in to see your roadmaps.' })
  })

  it('GET id returns roadmap state, role and members', async () => {
    const { as } = world(), A = as(ann)
    const { ws, id } = await setupRoadmap(A)
    const r = await A.roadmaps('GET', `?id=${id}`)
    expect(r.status).toBe(200)
    expect(await json(r)).toMatchObject({
      roadmap: { id, workspaceId: ws, name: 'Plan', prefix: 'PLN', seq: 0 },
      issues: [],
      role: 'owner',
      members: [{ id: ann.id, name: ann.name, email: ann.email }],
    })
  })

  it('GET since returns changes', async () => {
    const { as } = world(), A = as(ann)
    const { id } = await setupRoadmap(A)
    const op = await A.roadmaps('POST', `?id=${id}`, { op: { op: 'create', issues: [{ id: 'i_1', parentId: null, title: 'One' }] } })
    expect(op.status).toBe(200)
    const { seq } = await json<{ seq: number }>(op)
    const r = await A.roadmaps('GET', `?id=${id}&since=${seq - 1}`)
    expect(r.status).toBe(200)
    const delta = await json<{ issues: { id: string }[] }>(r)
    expect(delta.issues.map((i) => i.id)).toEqual(['i_1'])
  })

  it('GET issue returns detail', async () => {
    const { as } = world(), A = as(ann)
    const { id } = await setupRoadmap(A)
    await A.roadmaps('POST', `?id=${id}`, { op: { op: 'create', issues: [{ id: 'i_1', parentId: null, title: 'One' }] } })
    const r = await A.roadmaps('GET', `?id=${id}&issue=i_1`)
    expect(r.status).toBe(200)
    expect(await json(r)).toMatchObject({ body: '', bodyRev: 0, comments: [] })
  })

  it('GET subpages returns count', async () => {
    const { as, db } = world(), A = as(ann)
    const { id } = await setupRoadmap(A)
    const { docsHandler } = await import('../../api/_lib/docs')
    expect((await docsHandler({ userFrom: async () => ann, db: () => db })(new Request('http://occam.test/api/docs', {
      method: 'PUT',
      body: JSON.stringify({ id: 'doc_1', name: 'Memo', text: '# M', baseRev: 0, parent: { kind: 'roadmap', id } }),
    }))).status).toBe(200)
    const r = await A.roadmaps('GET', `?id=${id}&subpages=1`)
    expect(r.status).toBe(200)
    expect(await json(r)).toEqual({ count: 1 })
  })

  it('POST creates a roadmap', async () => {
    const { as } = world(), A = as(ann)
    const ws = await A.ws()
    const r = await A.roadmaps('POST', '', { id: 'rm_new', name: 'Road', prefix: 'RD', workspaceId: ws })
    expect(r.status).toBe(200)
    expect(await json(r)).toEqual({ ok: true })
  })

  it('POST id op returns seq and changed', async () => {
    const { as } = world(), A = as(ann)
    const { id } = await setupRoadmap(A)
    const r = await A.roadmaps('POST', `?id=${id}`, { op: { op: 'create', issues: [{ id: 'i_1', parentId: null, title: 'Task' }] } })
    expect(r.status).toBe(200)
    const out = await json<{ seq: number; changed: { id: string }[] }>(r)
    expect(out.seq).toBeGreaterThan(0)
    expect(out.changed.map((c) => c.id)).toEqual(['i_1'])
  })

  it('POST id body saves issue text with parseDoc', async () => {
    const { as } = world(), A = as(ann)
    const { id } = await setupRoadmap(A)
    await A.roadmaps('POST', `?id=${id}`, { op: { op: 'create', issues: [{ id: 'i_1', parentId: null, title: 'One' }] } })
    const r = await A.roadmaps('POST', `?id=${id}`, { body: { issueId: 'i_1', text: '# Hello\n\nWorld', baseRev: 0 } })
    expect(r.status).toBe(200)
    expect(await json(r)).toMatchObject({ bodyRev: 1, seq: expect.any(Number) })
    const detail = await json(await A.roadmaps('GET', `?id=${id}&issue=i_1`))
    expect(detail.body).toContain('Hello')
  })

  it('POST id body with stale baseRev returns 409', async () => {
    const { as } = world(), A = as(ann)
    const { id } = await setupRoadmap(A)
    await A.roadmaps('POST', `?id=${id}`, { op: { op: 'create', issues: [{ id: 'i_1', parentId: null, title: 'One' }] } })
    await A.roadmaps('POST', `?id=${id}`, { body: { issueId: 'i_1', text: '# First', baseRev: 0 } })
    const r = await A.roadmaps('POST', `?id=${id}`, { body: { issueId: 'i_1', text: '# Stale', baseRev: 0 } })
    expect(r.status).toBe(409)
    expect(await json(r)).toEqual({ error: DOC_STALE })
  })

  it('POST id comment returns comments', async () => {
    const { as } = world(), A = as(ann)
    const { id } = await setupRoadmap(A)
    await A.roadmaps('POST', `?id=${id}`, { op: { op: 'create', issues: [{ id: 'i_1', parentId: null, title: 'One' }] } })
    const r = await A.roadmaps('POST', `?id=${id}`, { comment: { issueId: 'i_1', text: 'Looks good' } })
    expect(r.status).toBe(200)
    const { comments } = await json<{ comments: { text: string }[] }>(r)
    expect(comments).toHaveLength(1)
    expect(comments[0].text).toBe('Looks good')
  })

  it('POST id move delegates to movePage', async () => {
    const { as, db } = world(), A = as(ann)
    const { ws, id } = await setupRoadmap(A)
    const { docsHandler } = await import('../../api/_lib/docs')
    await docsHandler({ userFrom: async () => ann, db: () => db })(new Request('http://occam.test/api/docs', {
      method: 'PUT',
      body: JSON.stringify({ id: 'doc_1', name: 'Memo', text: '# M', baseRev: 0, workspaceId: ws }),
    }))
    const r = await A.roadmaps('POST', `?id=${id}`, { move: { parent: { kind: 'doc', id: 'doc_1' } } })
    expect(r.status).toBe(200)
    expect(await json(r)).toEqual({ ok: true })
  })

  it('DELETE removes a roadmap', async () => {
    const { as } = world(), A = as(ann)
    const { id } = await setupRoadmap(A)
    const r = await A.roadmaps('DELETE', `?id=${id}`)
    expect(r.status).toBe(204)
    expect((await A.roadmaps('GET', `?id=${id}`)).status).toBe(404)
  })

  it('malformed op is 400 with a sentence', async () => {
    const { as } = world(), A = as(ann)
    const { id } = await setupRoadmap(A)
    const r = await A.roadmaps('POST', `?id=${id}`, { op: { op: 'set', ids: 'not-array', props: {} } })
    expect(r.status).toBe(400)
    expect((await json(r)).error).toMatch(/./)
  })

  it('op on a roadmap in another workspace is 404', async () => {
    const { as } = world(), A = as(ann), D = as(dee)
    const { id } = await setupRoadmap(A)
    const r = await D.roadmaps('POST', `?id=${id}`, { op: { op: 'create', issues: [{ id: 'i_1', parentId: null, title: 'Nope' }] } })
    expect(r.status).toBe(404)
    expect(await json(r)).toEqual({ error: 'No such roadmap.' })
  })

  it('a viewer can read but not write', async () => {
    const { as, db } = world(), A = as(ann), C = as(cy)
    const { ws, id } = await setupRoadmap(A)
    const { workspacesHandler } = await import('../../api/_lib/workspaces')
    const tok = await (async () => {
      const r = await workspacesHandler({ userFrom: async () => ann, db: () => db })(new Request(`http://occam.test/api/workspaces?id=${ws}&invite`, {
        method: 'POST', body: JSON.stringify({ email: cy.email, role: 'viewer' }),
      }))
      const { link } = await json<{ link: string }>(r)
      return link.split('/i/')[1]
    })()
    await workspacesHandler({ userFrom: async () => cy, db: () => db })(new Request(`http://occam.test/api/workspaces?accept=${tok}`, { method: 'POST' }))
    expect((await C.roadmaps('GET', `?id=${id}`)).status).toBe(200)
    const w = await C.roadmaps('POST', `?id=${id}`, { op: { op: 'create', issues: [{ id: 'i_1', parentId: null, title: 'Nope' }] } })
    expect(w.status).toBe(403)
    expect(await json(w)).toEqual({ error: 'You can view this workspace, not change it.' })
  })

  it('a viewer cannot delete', async () => {
    const { as, db } = world(), A = as(ann), C = as(cy)
    const { ws, id } = await setupRoadmap(A)
    const { workspacesHandler } = await import('../../api/_lib/workspaces')
    const r = await workspacesHandler({ userFrom: async () => ann, db: () => db })(new Request(`http://occam.test/api/workspaces?id=${ws}&invite`, {
      method: 'POST', body: JSON.stringify({ email: cy.email, role: 'viewer' }),
    }))
    const tok = (await json<{ link: string }>(r)).link.split('/i/')[1]
    await workspacesHandler({ userFrom: async () => cy, db: () => db })(new Request(`http://occam.test/api/workspaces?accept=${tok}`, { method: 'POST' }))
    const del = await C.roadmaps('DELETE', `?id=${id}`)
    expect(del.status).toBe(403)
    expect(await json(del)).toEqual({ error: 'You can view this roadmap, not edit it.' })
  })

  it('refused op returns 409', async () => {
    const { as } = world(), A = as(ann)
    const { id } = await setupRoadmap(A)
    const r = await A.roadmaps('POST', `?id=${id}`, { op: { op: 'set', ids: ['missing'], props: { title: 'X' } } })
    expect(r.status).toBe(409)
    expect((await json(r)).error).toBe('No such issue.')
  })
})
