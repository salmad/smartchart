// Postgres on Neon over HTTP (one query per request suits serverless functions). Decks are one JSON
// document each, so the deck shape can change without a migration; owner, name and time are columns.
import { neon } from '@neondatabase/serverless'

export interface DeckRow { id: string; name: string; updated: number; data: unknown }
/** What a list shows of a deck: its first slide and look for the thumbnail, never the whole deck (chat, agent history). */
export interface DeckSummary { id: string; name: string; updated: number; slides: number; style: unknown; theme: unknown; accent: unknown; first: unknown }

/** Everything the API does with the database, so tests can swap in a fake. Every call is scoped to a user. */
export interface Db {
  listDecks(userId: string): Promise<DeckSummary[]>
  getDeck(userId: string, id: string): Promise<DeckRow | null>
  putDeck(userId: string, id: string, name: string, data: unknown): Promise<boolean>
  deleteDeck(userId: string, id: string): Promise<boolean>
}

const SCHEMA = [
  `create table if not exists decks (id text primary key, user_id text not null, name text not null, data jsonb not null, updated_at timestamptz not null default now())`,
  `create index if not exists decks_user on decks (user_id, updated_at desc)`,
]

let db: Db | null | undefined

/** Null when no DATABASE_URL is set. The schema is created on first use, once per cold start. */
export function getDb(): Db | null {
  if (db !== undefined) return db
  const url = process.env.DATABASE_URL
  if (!url) return (db = null)
  const sql = neon(url)
  let ready: Promise<unknown> | null = null
  const q = async <T>(text: string, params: unknown[] = []): Promise<T[]> => {
    // A failed setup is not kept: the next query tries again instead of failing until the next cold start.
    ready ??= SCHEMA.reduce<Promise<unknown>>((p, s) => p.then(() => sql.query(s)), Promise.resolve()).catch((e: unknown) => { ready = null; throw e })
    await ready
    return (await sql.query(text, params)) as T[]
  }
  type Row = { id: string; name: string; updated: string | Date; data: unknown }
  const row = (r: Row) => ({ id: r.id, name: r.name, updated: new Date(r.updated).getTime(), data: r.data })
  return (db = {
    // The list carries only what a card draws (the first slide and the look); a deck's chat and agent history
    // can run to megabytes, so the whole deck is read only when it is opened.
    listDecks: async (u) => (await q<Omit<DeckSummary, 'updated'> & { updated: string | Date }>(
      `select id, name, updated_at as updated, jsonb_array_length(coalesce(data->'items', '[]'::jsonb)) as slides,
         data->'style' as style, data->'theme' as theme, data->'accent' as accent, data->'items'->0->'slide' as first
       from decks where user_id = $1 order by updated_at desc limit 200`, [u])).map((r) => ({ ...r, slides: Number(r.slides), updated: new Date(r.updated).getTime() })),
    getDeck: async (u, id) => { const r = await q<Row>('select id, name, updated_at as updated, data from decks where user_id = $1 and id = $2', [u, id]); return r[0] ? row(r[0]) : null },
    // A deck id belongs to whoever saved it first: another user's id is never overwritten.
    putDeck: async (u, id, name, data) => (await q<{ id: string }>(
      `insert into decks (id, user_id, name, data, updated_at) values ($1, $2, $3, $4, now())
       on conflict (id) do update set name = excluded.name, data = excluded.data, updated_at = now() where decks.user_id = excluded.user_id
       returning id`, [id, u, name, JSON.stringify(data)])).length > 0,
    deleteDeck: async (u, id) => (await q<{ id: string }>('delete from decks where user_id = $1 and id = $2 returning id', [u, id])).length > 0,
  })
}
