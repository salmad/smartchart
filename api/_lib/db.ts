// Postgres on Neon over HTTP (one query per request suits serverless functions). Decks are one JSON
// document each, so the deck shape can change without a migration; owner, name and time are columns.
import { neon } from '@neondatabase/serverless'
import { type Tree, type Version, type VersionHead, type VersionMeta } from '../../src/engine/versions.js'
import type { Slide } from '../../src/engine/types.js'
import type { Block } from '../../src/engine/docs/types.js'
import type { DocTree } from '../../src/engine/docs/versions.js'
import type { CommentOp, DocComment } from '../../src/engine/comments.js'
import type { Role } from './access.js'
import { deckCalls } from './db-decks.js'
import { docCalls } from './db-docs.js'
import { workspaceCalls } from './db-workspaces.js'

/** `rev` counts saves; `chat` is the conversation (agent history, messages), kept apart from the slides in `data`. A deck saved before
    chats were kept apart has rev 0 and no chat; its conversation is still inside `data`. */
export interface DeckRow { id: string; name: string; updated: number; data: unknown; chat: unknown; rev: number; named: boolean }
/** A save is written (with the new revision), refused because the deck moved on since the revision it read, or refused because
    the writer may not edit it (not a member, a viewer, or another user's id). */
export type PutResult = { rev: number } | 'conflict' | 'foreign'
/** What a list shows of a deck: its first slide and look for the thumbnail, never the whole deck (chat, agent history). */
export interface DeckSummary { id: string; name: string; updated: number; slides: number; style: unknown; theme: unknown; accent: unknown; first: unknown; shared: boolean }
/** Who is working on a deck right now (an agent turn, or a person editing a slide); each entry expires at `until` (ms). */
export interface Presence { busy?: { by: string; until: number }; editing?: { slideId: string; until: number } }
/** One change an outside writer made, so the open app can tell the user what happened. */
export interface DeckEventRow { rev: number; by: string; slideId: string | null; what: string; paths: string[]; at: number }
export interface KeyRow { userId: string; email: string; prefix: string }
export interface KeyInfo { id: string; prefix: string; created: number; lastUsed: number | null }
/* Workspaces (api/_lib/access.ts has the rule): decks and docs live in one, and its members' roles decide who may do what. */
/** `personal`: the user's own workspace, made on their first request; it can't be left. `usedAt`: when they last opened it here. */
export interface WorkspaceRow { id: string; name: string; role: Role; personal: boolean; members: number; usedAt: number | null }
/** `personal`: this workspace is the member's own, so their role there can't change. */
export interface MemberRow { userId: string; email: string; name: string; role: Role; personal: boolean }
export interface InviteRow { token: string; email: string; role: Role; expires: number }
/** An accepted invite gives the role the person now holds there; `gone`: expired, revoked or never made; `wrongEmail`:
    the email it was made for, when someone else holds the link. */
export type InviteResult = { workspaceId: string; role: Role } | 'gone' | { wrongEmail: string }
export interface DocSummary { id: string; name: string; updated: number; workspaceId: string }
/** A doc is its Markdown text. */
export interface DocRow extends DocSummary { text: string; rev: number }
/** Who is editing a doc right now; it expires at `until` (ms). */
export interface DocPresence { editing?: { by: string; until: number } }
/** A doc version as a list shows it: the tree (front matter and block hashes), newest first. */
export interface DocVersion { n: number; rev: number; by: string; label: string | null; at: number; tree: DocTree }
/** A doc comment that can't be made, resolved or removed is answered with a sentence; this one means it isn't there. */
export const NO_COMMENT = 'No such comment.'
export type DbUser = { id: string; email: string; name: string }
export const MAX_KEYS = 5
export const keyId = (hash: string) => hash.slice(0, 12)

/** Everything the API does with the database, so tests can swap in a fake. Every call is scoped to a user, and a deck or
    doc call checks the user's role in its workspace: a call they may not make answers as if the deck did not exist. A deck
    from before workspaces (no workspace yet) is its maker's alone until `ensureWorkspace` moves it. */
export interface Db {
  /** The user's personal workspace, made on first call with their membership as owner; their decks with no workspace move in. */
  ensureWorkspace(user: DbUser): Promise<string>
  /** Most recently used first. */
  listWorkspaces(userId: string): Promise<WorkspaceRow[]>
  createWorkspace(userId: string, name: string): Promise<string>
  renameWorkspace(userId: string, id: string, name: string): Promise<boolean>
  /** Marks the workspace as the user's most recently used. */
  touchWorkspace(userId: string, id: string): Promise<void>
  /** Null when the user is not a member. */
  listMembers(userId: string, id: string): Promise<MemberRow[] | null>
  /** Changes a member's role, or removes them with null. An owner may change anyone; any member may remove themselves.
      A workspace keeps at least one owner, and no one's role in their personal workspace changes. */
  setRole(userId: string, id: string, member: string, role: Role | null): Promise<'ok' | 'last_owner' | 'denied'>
  /** `member`: that email is in the workspace already; their role changes in the members list, not by invite. */
  addInvite(userId: string, id: string, email: string, role: Role, token: string, expires: number): Promise<'ok' | 'denied' | 'member'>
  /** The open invites: not expired, for an email that isn't a member yet. Null when the user may not manage the workspace. */
  listInvites(userId: string, id: string): Promise<InviteRow[] | null>
  revokeInvite(userId: string, id: string, token: string): Promise<boolean>
  /** Only for the invite's email, and only once: accepting uses up every invite to that email there. Never lowers a role. */
  acceptInvite(user: DbUser, token: string, now: number): Promise<InviteResult>
  deckRole(userId: string, deckId: string): Promise<Role | null>
  /** Without a workspace: every deck the user can read. */
  listDecks(userId: string, workspaceId?: string): Promise<DeckSummary[]>
  getDeck(userId: string, id: string): Promise<(DeckRow & { role: Role }) | null>
  /** `baseRev` is the revision the caller read (0 for a new deck); a save from an older one is a conflict. A new deck goes
      into `workspaceId` (else the writer's personal workspace) only if they may edit there; a save never moves a deck. */
  putDeck(userId: string, id: string, name: string, data: unknown, chat: object, baseRev: number, opts?: { named?: boolean; workspaceId?: string }): Promise<PutResult>
  /** The stored name is kept when the deck was named on purpose (named = true). */
  getDeckMeta(userId: string, id: string): Promise<{ rev: number; share: string | null; presence: Presence; named: boolean; role: Role } | null>
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
      is not the user's to share (not a member, or a viewer); null when it is not shared. Without `on`, only reads it. */
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
  /* Docs mirror decks. */
  listDocs(userId: string, workspaceId: string): Promise<DocSummary[]>
  getDoc(userId: string, id: string): Promise<DocRow | null>
  putDoc(userId: string, id: string, name: string, text: string, baseRev: number, workspaceId?: string): Promise<PutResult>
  deleteDoc(userId: string, id: string): Promise<boolean>
  getDocMeta(userId: string, id: string): Promise<{ rev: number; presence: DocPresence; role: Role } | null>
  /** Editor and up. */
  setDocPresence(userId: string, id: string, p: DocPresence): Promise<boolean>
  /* Doc versions (src/engine/docs/versions.ts): a tree per save, each block's JSON stored once per hash. Readers read; editors write. */
  docVersionHead(userId: string, id: string): Promise<VersionHead | null>
  writeDocVersion(userId: string, id: string, v: { replace: number | null; rev: number; meta: VersionMeta; tree: DocTree; key: string; blobs: Map<string, Block>; at: number }): Promise<void>
  /** Newest first. */
  listDocVersions(userId: string, id: string): Promise<DocVersion[]>
  docBlobs(userId: string, id: string, hashes: string[]): Promise<{ hash: string; block: Block }[]>
  /** Null when the user may not read the doc. */
  docComments(userId: string, id: string): Promise<DocComment[] | null>
  /** One operation on the doc's comments, as one statement. Add: any member. Resolve: an editor or the author. Remove: the
      author. `ctx` is who is asking, when, and the id a new comment takes. Answers the doc's comments, 'foreign' when the
      user may not read the doc, or a sentence saying why not. */
  docComment(userId: string, id: string, op: CommentOp, ctx: { id: string; by: string; now: number }): Promise<DocComment[] | 'foreign' | string>
}

/* First tree keys: per workspace, decks and docs numbered together newest first, as the sidebar shows them today. The number is
   three base 62 digits and a trailing V (a key never ends in the lowest digit, so there is room between any two). Only rows
   without a key are written, so running it again changes nothing. */
const D62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
const BACKFILL = (table: 'decks' | 'docs', kind: 'deck' | 'doc') => `
  with every as (
    select 'deck' as kind, id, workspace_id, updated_at from decks where workspace_id is not null
    union all select 'doc', id, workspace_id, updated_at from docs
  ), ranked as (
    select kind, id, (row_number() over (partition by workspace_id order by updated_at desc, kind, id) - 1)::int as n from every
  )
  update ${table} t set sort_key =
    substr('${D62}', (r.n / 3844) % 62 + 1, 1) || substr('${D62}', (r.n / 62) % 62 + 1, 1) || substr('${D62}', r.n % 62 + 1, 1) || 'V'
  from ranked r where r.kind = '${kind}' and r.id = t.id and t.sort_key is null`

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
  // Workspaces: decks and docs live in one; members' roles decide who may do what (access.ts). A personal workspace
  // is made on its owner's first request, and their decks from before move in (decks.user_id now means who made it).
  `create table if not exists workspaces (id text primary key, name text not null, brand jsonb, personal_of text unique, created timestamptz not null default now())`,
  `create table if not exists members (workspace_id text not null, user_id text not null, email text not null, name text not null default '', role text not null check (role in ('owner','editor','viewer')), used_at timestamptz, joined timestamptz not null default now(), primary key (workspace_id, user_id))`,
  `create index if not exists members_user on members (user_id, used_at desc nulls last)`,
  `create table if not exists invites (token text primary key, workspace_id text not null, email text not null, role text not null, by_user text not null, expires timestamptz not null)`,
  `alter table decks add column if not exists workspace_id text`,
  `create index if not exists decks_ws on decks (workspace_id, updated_at desc)`,
  `create table if not exists docs (id text primary key, workspace_id text not null, user_id text not null, name text not null, text text not null, rev integer not null default 1, presence jsonb not null default '{}'::jsonb, share_id text, updated_at timestamptz not null default now())`,
  `create index if not exists docs_ws on docs (workspace_id, updated_at desc)`,
  // Doc versions and comments: as a deck's, with blocks for slides; comments are written by their own route.
  `create table if not exists doc_versions (doc_id text not null, user_id text not null, n integer not null, rev integer not null, by_client text not null, label text, key text not null, tree jsonb not null, at timestamptz not null default now(), primary key (doc_id, n))`,
  `create table if not exists doc_blobs (doc_id text not null, hash text not null, block jsonb not null, primary key (doc_id, hash))`,
  `alter table docs add column if not exists comments jsonb not null default '[]'::jsonb`,
  // The page tree: a parent (named by kind and id, as decks and docs may share an id) and a fractional order key, on both tables.
  // sort_key stays nullable: a page made by an old server before the backfill below must not fail, and null reads as before all.
  `alter table decks add column if not exists parent_kind text`,
  `alter table decks add column if not exists parent_id text`,
  `alter table decks add column if not exists sort_key text`,
  `alter table docs add column if not exists parent_kind text`,
  `alter table docs add column if not exists parent_id text`,
  `alter table docs add column if not exists sort_key text`,
  `create index if not exists decks_parent on decks (workspace_id, parent_id)`,
  `create index if not exists docs_parent on docs (workspace_id, parent_id)`,
  BACKFILL('decks', 'deck'),
  BACKFILL('docs', 'doc'),
]

/** One query; the schema is ready before the first. */
export type Q = <T>(text: string, params?: unknown[]) => Promise<T[]>
/** Statements run in order in one transaction; each statement sees what the ones before it committed. */
export type Tx = (statements: [string, unknown[]][]) => Promise<unknown[][]>

let db: Db | null | undefined

/** Null when no DATABASE_URL is set. The schema is created on first use, once per cold start. */
export function getDb(): Db | null {
  if (db !== undefined) return db
  const url = process.env.DATABASE_URL
  return (db = url ? makeDb(url) : null)
}

/** A Db on one database; the schema is created on its first query. */
export function makeDb(url: string): Db {
  const sql = neon(url)
  let ready: Promise<unknown> | null = null
  // A failed setup is not kept: the next query tries again instead of failing until the next cold start.
  const setup = () => (ready ??= SCHEMA.reduce<Promise<unknown>>((p, s) => p.then(() => sql.query(s)), Promise.resolve()).catch((e: unknown) => { ready = null; throw e }))
  const q = async <T>(text: string, params: unknown[] = []): Promise<T[]> => {
    await setup()
    return (await sql.query(text, params)) as T[]
  }
  const tx: Tx = async (statements) => {
    await setup()
    return (await sql.transaction(statements.map(([text, params]) => sql.query(text, params)))) as unknown[][]
  }
  return {
    ...deckCalls(q),
    ...docCalls(q),
    ...workspaceCalls(q, tx),
    countCall: async (u) => Number((await q<{ calls: number }>(
      `insert into model_usage (user_id, day, calls) values ($1, current_date, 1)
       on conflict (user_id, day) do update set calls = model_usage.calls + 1 returning calls`, [u]))[0].calls),
    callsToday: async (u) => Number((await q<{ calls: number }>('select calls from model_usage where user_id = $1 and day = current_date', [u]))[0]?.calls ?? 0),
    addKey: async (u, email, hash, prefix) => (await q('insert into api_keys (hash, user_id, email, prefix) select $1::text, $2::text, $3::text, $4::text where (select count(*) from api_keys where user_id = $2::text) < $5 returning hash', [hash, u, email, prefix, MAX_KEYS])).length > 0,
    keyUser: async (hash) => { const r = await q<KeyRow>(`update api_keys set last_used = now() where hash = $1 returning user_id as "userId", email, prefix`, [hash]); return r[0] ?? null },
    listKeys: async (u) => (await q<{ id: string; prefix: string; created: Date; lastUsed: Date | null }>(`select left(hash, 12) as id, prefix, created, last_used as "lastUsed" from api_keys where user_id = $1 order by created`, [u]))
      .map((r) => ({ id: r.id, prefix: r.prefix, created: +new Date(r.created), lastUsed: r.lastUsed ? +new Date(r.lastUsed) : null })),
    deleteKey: async (u, id) => (await q('delete from api_keys where user_id = $1 and left(hash, 12) = $2 returning hash', [u, id])).length > 0,
    bumpRate: async (key, minute) => Number((await q<{ calls: number }>(
      `insert into api_rate (key, minute, calls) values ($1, $2, 1) on conflict (key, minute) do update set calls = api_rate.calls + 1 returning calls`, [key, minute]))[0].calls),
  }
}

/** 128 random bits, URL-safe: a link nobody can guess. */
export function shareToken(): string {
  const b = crypto.getRandomValues(new Uint8Array(16))
  return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
