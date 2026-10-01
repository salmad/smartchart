// Postgres on Neon over HTTP (one query per request suits serverless functions). Decks are one JSON
// document each, so the deck shape can change without a migration; owner, name and time are columns.
import { neon } from '@neondatabase/serverless'

/** `rev` counts saves; `chat` is the conversation (agent history, messages), kept apart from the slides in `data`. A deck saved before
    chats were kept apart has rev 0 and no chat; its conversation is still inside `data`. */
export interface DeckRow { id: string; name: string; updated: number; data: unknown; chat: unknown; rev: number }
/** A save is written (with the new revision), refused because the deck moved on since the revision it read, or refused as another user's. */
export type PutResult = { rev: number } | 'conflict' | 'foreign'
/** What a list shows of a deck: its first slide and look for the thumbnail, never the whole deck (chat, agent history). */
export interface DeckSummary { id: string; name: string; updated: number; slides: number; style: unknown; theme: unknown; accent: unknown; first: unknown; shared: boolean }
/** Who is working on a deck right now (an agent turn, or a person editing a slide); each entry expires at `until` (ms). */
export interface Presence { busy?: { by: string; until: number }; editing?: { slideId: string; until: number } }
/** One change an outside writer made, so the open app can tell the user what happened. */
export interface DeckEventRow { rev: number; by: string; slideId: string | null; what: string; paths: string[]; at: number }
export interface KeyRow { userId: string; email: string; prefix: string }

/** Everything the API does with the database, so tests can swap in a fake. Every call is scoped to a user. */
export interface Db {
  listDecks(userId: string): Promise<DeckSummary[]>
  getDeck(userId: string, id: string): Promise<DeckRow | null>
  /** `baseRev` is the revision the caller read (0 for a new deck); a save from an older one is a conflict. */
  putDeck(userId: string, id: string, name: string, data: unknown, chat: object, baseRev: number, opts?: { named?: boolean }): Promise<PutResult>
  /** The stored name is kept when the deck was named on purpose (named = true). */
  getDeckMeta(userId: string, id: string): Promise<{ rev: number; share: string | null; presence: Presence; named: boolean } | null>
  sharedRev(token: string): Promise<{ rev: number } | null>
  setPresence(userId: string, id: string, presence: Presence): Promise<boolean>
  addEvents(userId: string, id: string, events: Omit<DeckEventRow, 'at'>[]): Promise<void>
  eventsSince(userId: string, id: string, rev: number): Promise<DeckEventRow[]>
  /** Model calls counted for the user today (UTC). */
  callsToday(userId: string): Promise<number>
  /** One agent key per user: a new key replaces the old one. Only the hash is stored. */
  putKey(userId: string, email: string, hash: string, prefix: string): Promise<void>
  keyUser(hash: string): Promise<KeyRow | null>
  keyPrefix(userId: string): Promise<string | null>
  deleteKey(userId: string): Promise<boolean>
  /** Counts a call in a one-minute bucket and returns the bucket's total. */
  bumpRate(key: string, minute: number): Promise<number>
  deleteDeck(userId: string, id: string): Promise<boolean>
  /** Counts one model call for the user today (UTC) and returns today's total. */
  countCall(userId: string): Promise<number>
  /** The deck's share link token: made with `on` when missing, dropped with `on: false`. Undefined when the deck
      is not the user's; null when it is not shared. Without `on`, only reads it. */
  shareDeck(userId: string, id: string, on?: boolean): Promise<string | null | undefined>
  /** A shared deck by its link token, for anyone who has the link. */
  sharedDeck(token: string): Promise<{ name: string; data: unknown; rev: number } | null>
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
  `alter table decks add column if not exists named boolean not null default false`,
  `alter table decks add column if not exists presence jsonb not null default '{}'::jsonb`,
  `create table if not exists deck_events (deck_id text not null, user_id text not null, rev integer not null, by_client text not null, slide_id text, what text not null, paths jsonb not null default '[]'::jsonb, at timestamptz not null default now())`,
  `create index if not exists deck_events_deck on deck_events (deck_id, rev)`,
  `create table if not exists api_keys (hash text primary key, user_id text not null unique, email text not null, prefix text not null, created timestamptz not null default now(), last_used timestamptz)`,
  `create table if not exists api_rate (key text not null, minute bigint not null, calls integer not null default 0, primary key (key, minute))`,
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
         share_id is not null as shared, data->'style' as style, data->'theme' as theme, data->'accent' as accent, data->'items'->0->'slide' as first
       from decks where user_id = $1 order by updated_at desc limit 200`, [u])).map((r) => ({ ...r, slides: Number(r.slides), updated: new Date(r.updated).getTime() })),
    getDeck: async (u, id) => { const r = await q<Row>('select id, name, updated_at as updated, data, chat, rev from decks where user_id = $1 and id = $2', [u, id]); return r[0] ? row(r[0]) : null },
    // A deck id belongs to whoever saved it first: another user's id is never overwritten. An existing deck is
    // written only when the save carries the revision it holds.
    putDeck: async (u, id, name, data, chat, baseRev, opts = {}) => {
      const put = await q<{ rev: number }>(
        `insert into decks (id, user_id, name, named, data, chat, rev, updated_at) values ($1, $2, $3, $7, $4, $5, 1, now())
         on conflict (id) do update set
           name = case when $7 then excluded.name when decks.named then decks.name else excluded.name end,
           named = decks.named or $7,
           data = excluded.data, chat = excluded.chat, rev = decks.rev + 1, updated_at = now()
         where decks.user_id = excluded.user_id and decks.rev = $6
         returning rev`, [id, u, name, JSON.stringify(data), JSON.stringify(chat), baseRev, !!opts.named])
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
    sharedDeck: async (t) => (await q<{ name: string; data: unknown; rev: number }>('select name, data, rev from decks where share_id = $1', [t]))[0] ?? null,
    getDeckMeta: async (u, id) => (await q<{ rev: number; share: string | null; presence: Presence; named: boolean }>(
      'select rev, share_id as share, presence, named from decks where user_id = $1 and id = $2', [u, id]))[0] ?? null,
    sharedRev: async (t) => (await q<{ rev: number }>('select rev from decks where share_id = $1', [t]))[0] ?? null,
    setPresence: async (u, id, p) => (await q<{ id: string }>('update decks set presence = $3 where user_id = $1 and id = $2 returning id', [u, id, JSON.stringify(p)])).length > 0,
    addEvents: async (u, id, evs) => { for (const e of evs) await q('insert into deck_events (deck_id, user_id, rev, by_client, slide_id, what, paths) values ($1, $2, $3, $4, $5, $6, $7)', [id, u, e.rev, e.by, e.slideId, e.what, JSON.stringify(e.paths)]) },
    eventsSince: async (u, id, rev) => (await q<{ rev: number; by: string; slideId: string | null; what: string; paths: string[]; at: string | Date }>(
      `select rev, by_client as by, slide_id as "slideId", what, paths, at from deck_events where user_id = $1 and deck_id = $2 and rev > $3 order by rev limit 200`, [u, id, rev]))
      .map((e) => ({ ...e, at: new Date(e.at).getTime() })),
    callsToday: async (u) => Number((await q<{ calls: number }>('select calls from model_usage where user_id = $1 and day = current_date', [u]))[0]?.calls ?? 0),
    putKey: async (u, email, hash, prefix) => { await q('delete from api_keys where user_id = $1', [u]); await q('insert into api_keys (hash, user_id, email, prefix) values ($1, $2, $3, $4)', [hash, u, email, prefix]) },
    keyUser: async (hash) => { const r = await q<KeyRow>(`update api_keys set last_used = now() where hash = $1 returning user_id as "userId", email, prefix`, [hash]); return r[0] ?? null },
    keyPrefix: async (u) => (await q<{ prefix: string }>('select prefix from api_keys where user_id = $1', [u]))[0]?.prefix ?? null,
    deleteKey: async (u) => (await q<{ hash: string }>('delete from api_keys where user_id = $1 returning hash', [u])).length > 0,
    bumpRate: async (key, minute) => Number((await q<{ calls: number }>(
      `insert into api_rate (key, minute, calls) values ($1, $2, 1) on conflict (key, minute) do update set calls = api_rate.calls + 1 returning calls`, [key, minute]))[0].calls),
  })
}

/** 128 random bits, URL-safe: a link nobody can guess. */
export function shareToken(): string {
  const b = crypto.getRandomValues(new Uint8Array(16))
  return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
