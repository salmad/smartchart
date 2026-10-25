import { describe, expect, it } from 'vitest'
import { fakeDb } from './fake-db'
import { seedUser } from './fakes'

describe('cross-workspace movePage', () => {
  it('moves a doc to another workspace at top level', async () => {
    const db = fakeDb()
    const ann = { id: 'u_ann_x', email: 'a@b.c', name: 'Ann' }
    const ws1 = await seedUser(db, ann)
    const ws2 = await db.createWorkspace(ann.id, 'Team')
    await db.putDoc(ann.id, 'doc_lombard', 'Lombard lending', '# x', 0, ws1)
    expect(await db.movePage(ann.id, { kind: 'doc', id: 'doc_lombard' }, { parent: null, workspaceId: ws2 })).toBe('ok')
    expect((await db.getDoc(ann.id, 'doc_lombard'))?.workspaceId).toBe(ws2)
    expect((await db.listPages(ann.id, ws1)).some((p) => p.id === 'doc_lombard')).toBe(false)
    expect((await db.listPages(ann.id, ws2)).some((p) => p.id === 'doc_lombard')).toBe(true)
  })
})
