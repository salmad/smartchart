// The Db contract against real Postgres: runs only with TEST_DATABASE_URL (a throwaway Neon branch), and empties its tables first.
import { beforeAll, describe, expect, it } from 'vitest'
import { neon } from '@neondatabase/serverless'
import { makeDb } from '../../api/_lib/db'
import { dbContract } from './db-contract'

const url = process.env.TEST_DATABASE_URL ?? ''
const TABLES = ['decks', 'deck_events', 'deck_versions', 'deck_blobs', 'workspaces', 'members', 'invites', 'docs']

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
}, 120_000)
