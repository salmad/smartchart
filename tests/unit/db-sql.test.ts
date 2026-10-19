// The Db contract against real Postgres: runs only with TEST_DATABASE_URL (a throwaway Neon branch), and empties its tables first.
import { beforeAll, describe, expect, it } from 'vitest'
import { neon } from '@neondatabase/serverless'
import { makeDb } from '../../api/_lib/db'
import type { User } from '../../api/_lib/auth'
import { decksHandler } from '../../api/_lib/decks'
import { workspacesHandler } from '../../api/_lib/workspaces'
import { dbContract } from './db-contract'

const url = process.env.TEST_DATABASE_URL ?? ''
const TABLES = ['decks', 'deck_events', 'deck_versions', 'deck_blobs', 'workspaces', 'members', 'invites', 'docs', 'doc_versions', 'doc_blobs']

// M3's done-when, through the real API handlers. Signing in is the one step left out: each person is handed to the
// handlers as the user Neon Auth would name.
const run = Date.now()
const person = (name: string): User => ({ id: `u_${name.toLowerCase()}_${run}`, email: `${name.toLowerCase()}.${run}@example.com`, name, via: 'session' })
const call = (path: string, method: string, query = '', body?: unknown) =>
  new Request(`http://occam.test/api/${path}${query}`, { method, body: body === undefined ? undefined : JSON.stringify(body) })
const as = (who: User) => {
  const db = makeDb(url) // a fresh Db per person, as on separate cold starts
  return {
    ws: (method: string, query = '', body?: unknown) => workspacesHandler({ userFrom: async () => who, db: () => db })(call('workspaces', method, query, body)),
    decks: (method: string, query = '', body?: unknown) => decksHandler({ userFrom: async () => who, db: () => db })(call('decks', method, query, body)),
  }
}
const json = async <T = Record<string, unknown>>(r: Response | Promise<Response>) => (await (await r).json()) as T

describe.skipIf(!url)('SQL Db', () => {
  beforeAll(async () => {
    await makeDb(url).listWorkspaces('nobody') // creates the schema
    await neon(url).query(`truncate ${TABLES.join(', ')}`)
  }, 60_000)

  dbContract('Postgres', async () => makeDb(url))

  it('two first requests at once make one personal workspace', async () => {
    const user = { id: `u_race_${Date.now()}`, email: `race.${Date.now()}@example.com`, name: 'Race' }
    const [a, b] = await Promise.all([makeDb(url).ensureWorkspace(user), makeDb(url).ensureWorkspace(user)])
    expect(a).toBe(b)
    expect(await makeDb(url).listWorkspaces(user.id)).toHaveLength(1)
  }, 30_000)

  it('a deck from before workspaces moves into its maker’s workspace and no one else’s', async () => {
    const db = makeDb(url), k = Date.now()
    const ann = { id: `u_old_${k}`, email: `old.${k}@example.com`, name: 'Old' }
    await neon(url).query(`insert into decks (id, user_id, name, data, rev) values ($1, $2, 'Legacy', '{"items":[]}', 3)`, [`d_old_${k}`, ann.id])
    expect((await db.getDeck(ann.id, `d_old_${k}`))?.role).toBe('owner')
    expect(await db.getDeck(`u_other_${k}`, `d_old_${k}`)).toBeNull()
    const ws = await db.ensureWorkspace(ann)
    expect((await db.listDecks(ann.id, ws)).map((d) => d.id)).toEqual([`d_old_${k}`])
  }, 30_000)

  it('an old deck lands in its owner’s personal workspace; two people share it; the viewer is refused edits', async () => {
    const ann = person('Ann'), cy = person('Cy'), A = as(ann), C = as(cy), legacy = `d_legacy_${run}`
    // A deck saved before workspaces existed: no workspace_id.
    await neon(url).query(`insert into decks (id, user_id, name, data, rev) values ($1, $2, 'Q3 board', '{"items":[]}', 1)`, [legacy, ann.id])

    const mine = await json<{ id: string; name: string; personal: boolean; role: string }[]>(A.ws('GET'))
    expect(mine).toHaveLength(1)
    expect(mine[0]).toMatchObject({ name: 'Ann’s workspace', personal: true, role: 'owner' })
    const ws = mine[0].id
    expect((await json<{ id: string }[]>(A.decks('GET', `?workspace=${ws}`))).map((d) => d.id)).toEqual([legacy])

    const invited = await A.ws('POST', `?id=${ws}&invite`, { email: cy.email, role: 'viewer' })
    expect(invited.status).toBe(200)
    const token = (await json<{ link: string }>(invited)).link.split('/i/')[1]
    expect(await json(C.ws('POST', `?accept=${token}`))).toEqual({ workspaceId: ws, role: 'viewer' })

    expect((await json<{ id: string }[]>(C.decks('GET', `?workspace=${ws}`))).map((d) => d.id)).toEqual([legacy])
    expect(await json(C.decks('GET', `?id=${legacy}`))).toMatchObject({ id: legacy, role: 'viewer' })
    const put = await C.decks('PUT', '', { id: legacy, name: 'Mine now', data: { items: [] }, chat: {}, baseRev: 1 })
    expect(put.status).toBe(403)
    expect(await json(put)).toEqual({ error: 'You can view this deck, not edit it.' })
    expect((await C.decks('DELETE', `?id=${legacy}`)).status).toBe(403)
    expect(await json(A.decks('GET', `?id=${legacy}`))).toMatchObject({ name: 'Q3 board', rev: 1, role: 'owner' })
  }, 60_000)
}, 120_000)
