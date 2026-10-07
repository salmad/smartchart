// Postgres on Neon over HTTP (one query per request suits serverless functions). Decks are one JSON
// document each, so the deck shape can change without a migration; owner, name and time are columns.
import { neon } from '@neondatabase/serverless'
import { KEEP, type Tree, type Version, type VersionHead, type VersionMeta } from '../../src/engine/versions.js'
import type { Slide } from '../../src/engine/types.js'

/** `rev` counts saves; `chat` is the conversation (agent history, messages), kept apart from the slides in `data`. A deck saved before
    chats were kept apart has rev 0 and no chat; its conversation is still inside `data`. */
export interface DeckRow { id: string; name: string; updated: number; data: unknown; chat: unknown; rev: number; named: boolean }
/** A save is written (with the new revision), refused because the deck moved on since the revision it read, or refused as another user's. */
export type PutResult = { rev: number } | 'conflict' | 'foreign'
/** What a list shows of a deck: its first slide and look for the thumbnail, never the whole deck (chat, agent history). */
export interface DeckSummary { id: string; name: string; updated: number; slides: number; style: unknown; theme: unknown; accent: unknown; first: unknown; shared: boolean }
/** Who is working on a deck right now (an agent turn, or a person editing a slide); each entry expires at `until` (ms). */
export interface Presence { busy?: { by: string; until: number }; editing?: { slideId: string; until: number } }
/** One change an outside writer made, so the open app can tell the user what happened. */
export interface DeckEventRow { rev: number; by: string; slideId: string | null; what: string; paths: string[]; at: number }
export interface KeyRow { userId: string; email: string; prefix: string }
export interface KeyInfo { id: string; prefix: string; created: number; lastUsed: number | null }
export const MAX_KEYS = 5
export const keyId = (hash: string) => hash.slice(0, 12)

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
  /** Up to MAX_KEYS agent keys per user. Only the hash is stored. False when the user already has them all. */
  addKey(userId: string, email: string, hash: string, prefix: string): Promise<boolean>
  keyUser(hash: string): Promise<KeyRow | null>
  listKeys(userId: string): Promise<KeyInfo[]>
  deleteKey(userId: string, id: string): Promise<boolean>
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
  /* Versions (src/engine/versions.ts): trees per save, slide blobs stored once per hash. */
  versionHead(userId: string, id: string): Promise<VersionHead | null>
  /** Stores the blobs, then adds a version (or replaces version `replace`) and keeps the newest KEEP. */
  writeVersion(userId: string, id: string, v: { replace: number | null; rev: number; meta: VersionMeta; tree: Tree; key: string; blobs: Map<string, Slide>; at: number }): Promise<void>
  /** Newest first. */
  listVersions(userId: string, id: string): Promise<Version[]>
  blobs(userId: string, id: string, hashes: string[]): Promise<{ hash: string; slide: Slide }[]>
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
  `create table if not exists api_keys (hash text primary key, user_id text not null, email text not null, prefix text not null, created timestamptz not null default now(), last_used timestamptz)`,
  `alter table api_keys drop constraint if exists api_keys_user_id_key`,
  `create index if not exists api_keys_user on api_keys (user_id)`,
  `create table if not exists api_rate (key text not null, minute bigint not null, calls integer not null default 0, primary key (key, minute))`,
  // Versions: a tree per version (look + slide ids and hashes); each slide's JSON once per hash, per deck.
  `create table if not exists deck_versions (deck_id text not null, user_id text not null, n integer not null, rev integer not null, by_client text not null, turn text, label text, key text not null, tree jsonb not null, at timestamptz not null default now(), primary key (deck_id, n))`,
  `create table if not exists deck_blobs (deck_id text not null, hash text not null, slide jsonb not null, primary key (deck_id, hash))`,
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
  type Row = { id: string; name: string; updated: string | Date; data: unknown; chat: unknown; rev: number; named: boolean }
  const row = (r: Row): DeckRow => ({ id: r.id, name: r.name, updated: new Date(r.updated).getTime(), data: r.data, chat: r.chat ?? null, rev: r.rev, named: !!r.named })
  return (db = {
    // The list carries only what a card draws (the first slide and the look); a deck's chat and agent history
    // can run to megabytes, so the whole deck is read only when it is opened.
    listDecks: async (u) => (await q<Omit<DeckSummary, 'updated'> & { updated: string | Date }>(
      `select id, name, updated_at as updated, jsonb_array_length(coalesce(data->'items', '[]'::jsonb)) as slides,
         share_id is not null as shared, data->'style' as style, data->'theme' as theme, data->'accent' as accent, data->'items'->0->'slide' as first
       from decks where user_id = $1 order by updated_at desc limit 200`, [u])).map((r) => ({ ...r, slides: Number(r.slides), updated: new Date(r.updated).getTime() })),
    getDeck: async (u, id) => { const r = await q<Row>('select id, name, named, updated_at as updated, data, chat, rev from decks where user_id = $1 and id = $2', [u, id]); return r[0] ? row(r[0]) : null },
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
    deleteDeck: async (u, id) => {
      const gone = (await q<{ id: string }>('delete from decks where user_id = $1 and id = $2 returning id', [u, id])).length > 0
      if (gone) { await q('delete from deck_versions where deck_id = $1 and user_id = $2', [id, u]); await q('delete from deck_blobs where deck_id = $1', [id]) }
      return gone
    },
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
    addKey: async (u, email, hash, prefix) => (await q('insert into api_keys (hash, user_id, email, prefix) select $1::text, $2::text, $3::text, $4::text where (select count(*) from api_keys where user_id = $2::text) < $5 returning hash', [hash, u, email, prefix, MAX_KEYS])).length > 0,
    keyUser: async (hash) => { const r = await q<KeyRow>(`update api_keys set last_used = now() where hash = $1 returning user_id as "userId", email, prefix`, [hash]); return r[0] ?? null },
    listKeys: async (u) => (await q<{ id: string; prefix: string; created: Date; lastUsed: Date | null }>(`select left(hash, 12) as id, prefix, created, last_used as "lastUsed" from api_keys where user_id = $1 order by created`, [u]))
      .map((r) => ({ id: r.id, prefix: r.prefix, created: +new Date(r.created), lastUsed: r.lastUsed ? +new Date(r.lastUsed) : null })),
    deleteKey: async (u, id) => (await q('delete from api_keys where user_id = $1 and left(hash, 12) = $2 returning hash', [u, id])).length > 0,
    versionHead: async (u, id) => {
      const r = await q<{ n: number; by: string; turn: string | null; at: string | Date; key: string; tree: Tree }>(
        'select n, by_client as by, turn, at, key, tree from deck_versions where deck_id = $1 and user_id = $2 order by n desc limit 1', [id, u])
      return r[0] ? { n: r[0].n, by: r[0].by, turn: r[0].turn, key: r[0].key, at: new Date(r[0].at).getTime(), hashes: r[0].tree.slides.map(([, h]) => h) } : null
    },
    writeVersion: async (u, id, v) => {
      const hashes = [...v.blobs.keys()]
      if (hashes.length) await q(
        `insert into deck_blobs (deck_id, hash, slide) select $1, h, s from jsonb_each($2::jsonb) as b(h, s) on conflict do nothing`,
        [id, JSON.stringify(Object.fromEntries(v.blobs))])
      const at = new Date(v.at).toISOString()
      if (v.replace !== null) {
        await q('update deck_versions set rev = $4, key = $5, tree = $6, at = $7, label = coalesce(label, $8) where deck_id = $1 and user_id = $2 and n = $3',
          [id, u, v.replace, v.rev, v.key, JSON.stringify(v.tree), at, v.meta.label])
        return
      }
      await q(`insert into deck_versions (deck_id, user_id, n, rev, by_client, turn, label, key, tree, at)
        select $1, $2, coalesce(max(n), 0) + 1, $3, $4, $5, $6, $7, $8, $9 from deck_versions where deck_id = $1`,
        [id, u, v.rev, v.meta.by, v.meta.turn, v.meta.label, v.key, JSON.stringify(v.tree), at])
      await q('delete from deck_versions where deck_id = $1 and n <= (select max(n) from deck_versions where deck_id = $1) - $2', [id, KEEP])
    },
    listVersions: async (u, id) => (await q<{ n: number; rev: number; by: string; turn: string | null; label: string | null; at: string | Date; tree: Tree }>(
      'select n, rev, by_client as by, turn, label, at, tree from deck_versions where deck_id = $1 and user_id = $2 order by n desc limit $3', [id, u, KEEP]))
      .map((r) => ({ ...r, at: new Date(r.at).getTime() })),
    // The deck's owner is checked on the versions table: blobs carry no user of their own.
    blobs: async (u, id, hashes) => hashes.length ? q<{ hash: string; slide: Slide }>(
      `select hash, slide from deck_blobs where deck_id = $1 and hash = any($2::text[]) and exists (select 1 from deck_versions where deck_id = $1 and user_id = $3)`, [id, hashes, u]) : [],
    bumpRate: async (key, minute) => Number((await q<{ calls: number }>(
      `insert into api_rate (key, minute, calls) values ($1, $2, 1) on conflict (key, minute) do update set calls = api_rate.calls + 1 returning calls`, [key, minute]))[0].calls),
  })
}

/** 128 random bits, URL-safe: a link nobody can guess. */
export function shareToken(): string {
  const b = crypto.getRandomValues(new Uint8Array(16))
  return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
