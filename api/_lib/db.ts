// Postgres on Neon over HTTP (one query per request suits serverless functions). Decks are one JSON
// document each, so the deck shape can change without a migration; owner, name and time are columns.
import { neon } from '@neondatabase/serverless'

/** `rev` counts saves; `chat` is the conversation (agent history, messages), kept apart from the slides in `data`. A deck saved before
    chats were kept apart has rev 0 and no chat; its conversation is still inside `data`. */
export interface DeckRow { id: string; name: string; updated: number; data: unknown; chat: unknown; rev: number }
/** A save is written (with the new revision), refused because the deck moved on since the revision it read, or refused as another user's. */
export type PutResult = { rev: number } | 'conflict' | 'foreign'
/** What a list shows of a deck: its first slide and look for the thumbnail, never the whole deck (chat, agent history). */
export interface DeckSummary { id: string; name: string; updated: number; slides: number; style: unknown; theme: unknown; accent: unknown; first: unknown }

/** Everything the API does with the database, so tests can swap in a fake. Every call is scoped to a user. */
export interface Db {
  listDecks(userId: string): Promise<DeckSummary[]>
  getDeck(userId: string, id: string): Promise<DeckRow | null>
  /** `baseRev` is the revision the caller read (0 for a new deck); a save from an older one is a conflict. */
  putDeck(userId: string, id: string, name: string, data: unknown, chat: object, baseRev: number): Promise<PutResult>
  deleteDeck(userId: string, id: string): Promise<boolean>
  /** Counts one model call for the user today (UTC) and returns today's total. */
  countCall(userId: string): Promise<number>
  /** The deck's share link token: made with `on` when missing, dropped with `on: false`. Undefined when the deck
      is not the user's; null when it is not shared. Without `on`, only reads it. */
  shareDeck(userId: string, id: string, on?: boolean): Promise<string | null | undefined>
  /** A shared deck by its link token, for anyone who has the link. */
  sharedDeck(token: string): Promise<{ name: string; data: unknown } | null>
}

const SCHEMA = [
  `create table if not exists decks (id text primary key, user_id text not null, name text not null, data jsonb not null, updated_at timestamptz not null default now())`,
  `create index if not exists decks_user on decks (user_id, updated_at desc)`,
  // A share link is a random token on the deck; dropping it ends the link.
  `alter table decks add column if not exists share_id text`,
  `create unique index if not exists decks_share on decks (share_id) where share_id is not null`,
  // A save carries the revision it read and is refused when the deck moved on. The chat lives apart from the slides.
  `alter table decks add column if not exists rev integer not null default 0`,
  `alter table decks add column if not exists chat jsonb`,
  // Model calls per user per day, for the daily limit.
  `create table if not exists model_usage (user_id text not null, day date not null, calls integer not null default 0, primary key (user_id, day))`,
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
  type Row = { id: string; name: string; updated: string | Date; data: unknown; chat: unknown; rev: number }
  const row = (r: Row): DeckRow => ({ id: r.id, name: r.name, updated: new Date(r.updated).getTime(), data: r.data, chat: r.chat ?? null, rev: r.rev })
  return (db = {
    // The list carries only what a card draws (the first slide and the look); a deck's chat and agent history
    // can run to megabytes, so the whole deck is read only when it is opened.
    listDecks: async (u) => (await q<Omit<DeckSummary, 'updated'> & { updated: string | Date }>(
      `select id, name, updated_at as updated, jsonb_array_length(coalesce(data->'items', '[]'::jsonb)) as slides,
         data->'style' as style, data->'theme' as theme, data->'accent' as accent, data->'items'->0->'slide' as first
       from decks where user_id = $1 order by updated_at desc limit 200`, [u])).map((r) => ({ ...r, slides: Number(r.slides), updated: new Date(r.updated).getTime() })),
    getDeck: async (u, id) => { const r = await q<Row>('select id, name, updated_at as updated, data, chat, rev from decks where user_id = $1 and id = $2', [u, id]); return r[0] ? row(r[0]) : null },
    // A deck id belongs to whoever saved it first: another user's id is never overwritten. An existing deck is
    // written only when the save carries the revision it holds.
    putDeck: async (u, id, name, data, chat, baseRev) => {
      const put = await q<{ rev: number }>(
        `insert into decks (id, user_id, name, data, chat, rev, updated_at) values ($1, $2, $3, $4, $5, 1, now())
         on conflict (id) do update set name = excluded.name, data = excluded.data, chat = excluded.chat, rev = decks.rev + 1, updated_at = now()
         where decks.user_id = excluded.user_id and decks.rev = $6
         returning rev`, [id, u, name, JSON.stringify(data), JSON.stringify(chat), baseRev])
      if (put[0]) return { rev: put[0].rev }
      // No row written: the deck is someone else's, or this save came from an older revision.
      const owner = await q<{ user_id: string }>('select user_id from decks where id = $1', [id])
      return owner[0]?.user_id === u ? 'conflict' : 'foreign'
    },
    deleteDeck: async (u, id) => (await q<{ id: string }>('delete from decks where user_id = $1 and id = $2 returning id', [u, id])).length > 0,
    countCall: async (u) => Number((await q<{ calls: number }>(
      `insert into model_usage (user_id, day, calls) values ($1, current_date, 1)
       on conflict (user_id, day) do update set calls = model_usage.calls + 1 returning calls`, [u]))[0].calls),
    shareDeck: async (u, id, on) => {
      const r = on === undefined
        ? await q<{ share: string | null }>('select share_id as share from decks where user_id = $1 and id = $2', [u, id])
        : await q<{ share: string | null }>(
            `update decks set share_id = ${on ? 'coalesce(share_id, $3)' : 'null'} where user_id = $1 and id = $2 returning share_id as share`,
            on ? [u, id, shareToken()] : [u, id])
      return r[0] ? r[0].share : undefined
    },
    sharedDeck: async (t) => (await q<{ name: string; data: unknown }>('select name, data from decks where share_id = $1', [t]))[0] ?? null,
  })
}

/** 128 random bits, URL-safe: a link nobody can guess. */
export function shareToken(): string {
  const b = crypto.getRandomValues(new Uint8Array(16))
  return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
