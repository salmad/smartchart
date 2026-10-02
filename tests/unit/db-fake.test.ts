import { describe, expect, it } from 'vitest'
import { fakeDb } from './fake-db'

describe('fake Db (the contract the SQL one follows)', () => {
  it('keeps a named deck’s name on later saves', async () => {
    const db = fakeDb()
    await db.putDeck('u', 'd_1', 'Board deck', { items: [] }, {}, 0, { named: true })
    await db.putDeck('u', 'd_1', 'Cover title', { items: [] }, {}, 1)
    expect((await db.getDeck('u', 'd_1'))?.name).toBe('Board deck')
  })
  it('presence does not bump rev', async () => {
    const db = fakeDb()
    await db.putDeck('u', 'd_1', 'x', { items: [] }, {}, 0)
    await db.setPresence('u', 'd_1', { editing: { slideId: 's_a', until: 9 } })
    expect((await db.getDeckMeta('u', 'd_1'))?.rev).toBe(1)
    expect((await db.getDeckMeta('u', 'd_1'))?.presence.editing?.slideId).toBe('s_a')
  })
  it('events since a revision', async () => {
    const db = fakeDb()
    await db.addEvents('u', 'd_1', [{ rev: 2, by: 'Claude Code', slideId: 's_a', what: 'updated', paths: ['title'] }, { rev: 3, by: 'Claude Code', slideId: 's_b', what: 'created', paths: [] }])
    expect((await db.eventsSince('u', 'd_1', 2)).map((e) => e.slideId)).toEqual(['s_b'])
  })
  it('keys and rate', async () => {
    const db = fakeDb()
    await db.addKey('u', 'a@b.c', 'h1', 'sc_ab12')
    expect(await db.keyUser('h1')).toEqual({ userId: 'u', email: 'a@b.c', prefix: 'sc_ab12' })
    await db.addKey('u', 'a@b.c', 'h2', 'sc_cd34')
    expect(await db.keyUser('h1')).not.toBeNull()
    expect((await db.listKeys('u')).map((k) => k.prefix)).toEqual(['sc_ab12', 'sc_cd34'])
    expect(await db.bumpRate('k', 100)).toBe(1)
    expect(await db.bumpRate('k', 100)).toBe(2)
    expect(await db.bumpRate('k', 101)).toBe(1)
  })
})
