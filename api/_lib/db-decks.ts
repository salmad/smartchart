// Decks, their versions, events and share links, and docs, in Postgres. Every call checks the caller's role in the
// row's workspace inside the query itself (`may`), so a refused call reads exactly like a row that isn't there.
import { KEEP, type Tree } from '../../src/engine/versions.js'
import type { Slide } from '../../src/engine/types.js'
import { rolesFor, type Action, type Role } from './access.js'
import { appendKey, canAdd, NO_PAGE, type PageNode, type PageRef } from '../../src/engine/pages/tree.js'
import { MAX_PAGES, shareToken, type Db, type DeckRow, type DeckSummary, type DocSummary, type PageSummary, type Presence, type PutResult, type Q } from './db.js'

/** The caller `u` may take `action` on a row of `t` (decks or docs): a member with a role allowed it, or, on a deck
    from before workspaces (no workspace yet), its maker. `roles` is a text[] parameter holding `rolesFor(action)`. */
export const may = (t: string, u: string, roles: string) => `(${t}.workspace_id is null and ${t}.user_id = ${u}
  or exists (select 1 from members m where m.workspace_id = ${t}.workspace_id and m.user_id = ${u} and m.role = any(${roles}::text[])))`
/** The caller's role on a row of `t`, or null. */
export const roleOf = (t: string, u: string) => `coalesce((select m.role from members m where m.workspace_id = ${t}.workspace_id and m.user_id = ${u}),
  case when ${t}.workspace_id is null and ${t}.user_id = ${u} then 'owner' end)`
/** Where a new deck or doc goes: the workspace asked for, else the writer's personal one. */
const home = (ws: string, u: string) => `(select coalesce(${ws}::text, (select id from workspaces where personal_of = ${u})) as ws)`
const editorIn = (ws: string, u: string, roles: string) => `exists (select 1 from members m where m.workspace_id = ${ws} and m.user_id = ${u} and m.role = any(${roles}::text[]))`
const R = (a: Action) => rolesFor(a)
const ms = (t: string | Date) => new Date(t).getTime()

type Calls = 'deckRole' | 'listDecks' | 'getDeck' | 'putDeck' | 'deleteDeck' | 'shareDeck' | 'sharedDeck' | 'getDeckMeta' | 'sharedRev'
  | 'setPresence' | 'addEvents' | 'eventsSince' | 'versionHead' | 'writeVersion' | 'listVersions' | 'blobs' | 'listDocs' | 'getDoc' | 'putDoc' | 'deleteDoc' | 'listPages'

type PageCols = { parent_kind: 'deck' | 'doc' | null; parent_id: string | null; sort_key: string | null }
const parentOf = (r: PageCols): PageRef | null => (r.parent_kind && r.parent_id ? { kind: r.parent_kind, id: r.parent_id } : null)
const TABLE = { deck: 'decks', doc: 'docs' } as const

export function deckCalls(q: Q): Pick<Db, Calls> {
  /** Every page of a workspace as the tree sees it (no access check: callers pass a workspace they may edit in, or get an empty list). */
  const nodesIn = async (u: string, ws: string): Promise<PageNode[]> => (await q<PageCols & { kind: 'deck' | 'doc'; id: string }>(
    `select kind, id, parent_kind, parent_id, sort_key from (
       select 'deck' as kind, id, parent_kind, parent_id, sort_key from decks where workspace_id = $2 and ${may('decks', '$1', '$3')}
       union all select 'doc', id, parent_kind, parent_id, sort_key from docs where workspace_id = $2 and ${may('docs', '$1', '$3')}) p limit ${MAX_PAGES}`,
    [u, ws, R('read')])).map((r) => ({ kind: r.kind, id: r.id, parent: parentOf(r), sortKey: r.sort_key }))
  /** Where a new page goes: the workspace it lands in, its parent columns and its key (last among its siblings), or the sentence
      saying why it can't go there. Only the first save of an id calls this. */
  const place = async (u: string, wanted: string | undefined, parent: PageRef | undefined): Promise<{ ws: string | undefined; parent: PageRef | null; key: string | null } | { refused: string }> => {
    let ws = wanted
    if (parent) {
      const at = (await q<{ ws: string | null }>(`select workspace_id as ws from ${TABLE[parent.kind]} where id = $2 and ${may(TABLE[parent.kind], '$1', '$3')}`, [u, parent.id, R('read')]))[0]?.ws
      if (!at || (wanted && wanted !== at)) return { refused: NO_PAGE }
      ws = at
    } else if (!ws) ws = (await q<{ id: string }>('select id from workspaces where personal_of = $1', [u]))[0]?.id
    if (!ws) return { ws: undefined, parent: null, key: null } // a deck from before workspaces
    const nodes = await nodesIn(u, ws), ok = canAdd(nodes, parent ?? null)
    return ok === 'ok' ? { ws, parent: parent ?? null, key: appendKey(nodes, parent ?? null) } : { refused: ok }
  }
  type Row = { id: string; name: string; updated: string | Date; data: unknown; chat: unknown; rev: number; named: boolean; role: Role }
  const row = (r: Row): DeckRow & { role: Role } => ({ id: r.id, name: r.name, updated: ms(r.updated), data: r.data, chat: r.chat ?? null, rev: r.rev, named: !!r.named, role: r.role })
  /** After a save wrote nothing: the row is there and the writer may edit it (an older revision), or it isn't theirs. */
  const refused = async (t: 'decks' | 'docs', u: string, id: string): Promise<'conflict' | 'foreign'> =>
    (await q(`select 1 from ${t} where id = $2 and ${may(t, '$1', '$3')}`, [u, id, R('write')])).length ? 'conflict' : 'foreign'
  const canWrite = async (u: string, id: string) => (await q(`select 1 from decks where id = $2 and ${may('decks', '$1', '$3')}`, [u, id, R('write')])).length > 0
  const deckRead = (u: string, id: string, roles: string) => `exists (select 1 from decks where decks.id = ${id} and ${may('decks', u, roles)})`
  return {
    deckRole: async (u, id) => (await q<{ role: Role | null }>(`select ${roleOf('decks', '$1')} as role from decks where id = $2`, [u, id]))[0]?.role ?? null,
    // The list carries only what a card draws (the first slide and the look); a deck's chat and agent history
    // can run to megabytes, so the whole deck is read only when it is opened.
    listDecks: async (u, ws) => (await q<Omit<DeckSummary, 'updated' | 'parent' | 'sortKey'> & PageCols & { updated: string | Date }>(
      `select id, name, updated_at as updated, jsonb_array_length(coalesce(data->'items', '[]'::jsonb)) as slides,
         share_id is not null as shared, data->'style' as style, data->'theme' as theme, data->'accent' as accent, data->'items'->0->'slide' as first,
         parent_kind, parent_id, sort_key
       from decks where ${may('decks', '$1', '$2')} and ($3::text is null or workspace_id = $3) order by updated_at desc limit 200`, [u, R('read'), ws ?? null]))
      .map(({ parent_kind, parent_id, sort_key, ...r }) => ({ ...r, slides: Number(r.slides), updated: ms(r.updated), parent: parentOf({ parent_kind, parent_id, sort_key }), sortKey: sort_key })),
    getDeck: async (u, id) => {
      const r = await q<Row>(`select id, name, named, updated_at as updated, data, chat, rev, ${roleOf('decks', '$1')} as role from decks where id = $2 and ${may('decks', '$1', '$3')}`, [u, id, R('read')])
      return r[0] ? row(r[0]) : null
    },
    // An existing deck is written only by someone who may edit it, from the revision it holds, and stays in its workspace.
    // A new id goes in only where the writer may edit; an id someone else holds is never overwritten.
    putDeck: async (u, id, name, data, chat, baseRev, opts = {}) => {
      const p = [id, u, name, JSON.stringify(data), JSON.stringify(chat), baseRev, !!opts.named, R('write')]
      const upd = await q<{ rev: number }>(
        `update decks set name = case when $7 then $3 when decks.named then decks.name else $3 end, named = decks.named or $7,
           data = $4, chat = $5, rev = decks.rev + 1, updated_at = now()
         where id = $1 and rev = $6 and ${may('decks', '$2', '$8')} returning rev`, p)
      if (upd[0]) return { rev: upd[0].rev }
      const at = await place(u, opts.workspaceId, opts.parent)
      if ('refused' in at) return at
      const ins = await q<{ rev: number }>(
        `insert into decks (id, user_id, workspace_id, name, named, data, chat, rev, updated_at, parent_kind, parent_id, sort_key)
         select $1, $2, h.ws, $3, $6, $4, $5, 1, now(), $9, $10, $11 from ${home('$8', '$2')} h
         where (h.ws is null and $8::text is null) or ${editorIn('h.ws', '$2', '$7')}
         on conflict (id) do nothing returning rev`, [id, u, name, p[3], p[4], !!opts.named, R('write'), at.ws ?? null, at.parent?.kind ?? null, at.parent?.id ?? null, at.key])
      return ins[0] ? { rev: ins[0].rev } : refused('decks', u, id)
    },
    deleteDeck: async (u, id) => {
      const gone = (await q(`delete from decks where id = $2 and ${may('decks', '$1', '$3')} returning id`, [u, id, R('write')])).length > 0
      if (gone) { await q('delete from deck_versions where deck_id = $1', [id]); await q('delete from deck_blobs where deck_id = $1', [id]) }
      return gone
    },
    shareDeck: async (u, id, on) => {
      const r = on === undefined
        ? await q<{ share: string | null }>(`select share_id as share from decks where id = $2 and ${may('decks', '$1', '$3')}`, [u, id, R('write')])
        : await q<{ share: string | null }>(
            `update decks set share_id = ${on ? 'coalesce(share_id, $4)' : 'null'} where id = $2 and ${may('decks', '$1', '$3')} returning share_id as share`,
            on ? [u, id, R('write'), shareToken()] : [u, id, R('write')])
      return r[0] ? r[0].share : undefined
    },
    sharedDeck: async (t) => (await q<{ name: string; data: unknown; rev: number }>('select name, data, rev from decks where share_id = $1', [t]))[0] ?? null,
    getDeckMeta: async (u, id) => (await q<{ rev: number; share: string | null; presence: Presence; named: boolean; role: Role }>(
      `select rev, share_id as share, presence, named, ${roleOf('decks', '$1')} as role from decks where id = $2 and ${may('decks', '$1', '$3')}`, [u, id, R('read')]))[0] ?? null,
    sharedRev: async (t) => (await q<{ rev: number }>('select rev from decks where share_id = $1', [t]))[0] ?? null,
    setPresence: async (u, id, p) => (await q(`update decks set presence = $3 where id = $2 and ${may('decks', '$1', '$4')} returning id`, [u, id, JSON.stringify(p), R('write')])).length > 0,
    addEvents: async (u, id, evs) => {
      for (const e of evs) await q(`insert into deck_events (deck_id, user_id, rev, by_client, slide_id, what, paths) select $1, $2, $3, $4, $5, $6, $7 where ${deckRead('$2', '$1', '$8')}`,
        [id, u, e.rev, e.by, e.slideId, e.what, JSON.stringify(e.paths), R('write')])
    },
    eventsSince: async (u, id, rev) => (await q<{ rev: number; by: string; slideId: string | null; what: string; paths: string[]; at: string | Date }>(
      `select rev, by_client as by, slide_id as "slideId", what, paths, at from deck_events where deck_id = $2 and rev > $3 and ${deckRead('$1', '$2', '$4')} order by rev limit 200`, [u, id, rev, R('read')]))
      .map((e) => ({ ...e, at: ms(e.at) })),
    // Versions and blobs follow the deck: whoever may read it sees them all, whoever wrote them.
    versionHead: async (u, id) => {
      const r = await q<{ n: number; by: string; turn: string | null; at: string | Date; key: string; tree: Tree }>(
        `select n, by_client as by, turn, at, key, tree from deck_versions where deck_id = $2 and ${deckRead('$1', '$2', '$3')} order by n desc limit 1`, [u, id, R('read')])
      return r[0] ? { n: r[0].n, by: r[0].by, turn: r[0].turn, key: r[0].key, at: ms(r[0].at), hashes: r[0].tree.slides.map(([, h]) => h) } : null
    },
    writeVersion: async (u, id, v) => {
      if (!await canWrite(u, id)) return
      const hashes = [...v.blobs.keys()]
      if (hashes.length) await q(
        `insert into deck_blobs (deck_id, hash, slide) select $1, h, s from jsonb_each($2::jsonb) as b(h, s) on conflict do nothing`,
        [id, JSON.stringify(Object.fromEntries(v.blobs))])
      const at = new Date(v.at).toISOString()
      if (v.replace !== null) {
        await q('update deck_versions set rev = $3, key = $4, tree = $5, at = $6, label = coalesce(label, $7) where deck_id = $1 and n = $2',
          [id, v.replace, v.rev, v.key, JSON.stringify(v.tree), at, v.meta.label])
        return
      }
      await q(`insert into deck_versions (deck_id, user_id, n, rev, by_client, turn, label, key, tree, at)
        select $1, $2, coalesce(max(n), 0) + 1, $3, $4, $5, $6, $7, $8, $9 from deck_versions where deck_id = $1`,
        [id, u, v.rev, v.meta.by, v.meta.turn, v.meta.label, v.key, JSON.stringify(v.tree), at])
      await q('delete from deck_versions where deck_id = $1 and n <= (select max(n) from deck_versions where deck_id = $1) - $2', [id, KEEP])
    },
    listVersions: async (u, id) => (await q<{ n: number; rev: number; by: string; turn: string | null; label: string | null; at: string | Date; tree: Tree }>(
      `select n, rev, by_client as by, turn, label, at, tree from deck_versions where deck_id = $2 and ${deckRead('$1', '$2', '$4')} order by n desc limit $3`, [u, id, KEEP, R('read')]))
      .map((r) => ({ ...r, at: ms(r.at) })),
    blobs: async (u, id, hashes) => hashes.length ? q<{ hash: string; slide: Slide }>(
      `select hash, slide from deck_blobs where deck_id = $2 and hash = any($3::text[]) and ${deckRead('$1', '$2', '$4')}
         and exists (select 1 from deck_versions where deck_id = $2)`, [u, id, hashes, R('read')]) : [],
    // Docs mirror decks; a doc is always in a workspace.
    listDocs: async (u, ws) => (await q<Omit<DocSummary, 'updated' | 'parent' | 'sortKey'> & PageCols & { updated: string | Date }>(
      `select id, name, updated_at as updated, workspace_id as "workspaceId", parent_kind, parent_id, sort_key from docs where workspace_id = $2 and ${may('docs', '$1', '$3')} order by updated_at desc limit 200`,
      [u, ws, R('read')])).map(({ parent_kind, parent_id, sort_key, ...d }) => ({ ...d, updated: ms(d.updated), parent: parentOf({ parent_kind, parent_id, sort_key }), sortKey: sort_key })),
    // The tree call: decks and docs together, with no per-kind cap of 200 (the tree needs every page or it shows holes).
    listPages: async (u, ws) => (await q<PageCols & { kind: 'deck' | 'doc'; id: string; name: string; updated: string | Date; slides: number | null }>(
      `select kind, id, name, updated, slides, parent_kind, parent_id, sort_key from (
         select 'deck' as kind, id, name, updated_at as updated, jsonb_array_length(coalesce(data->'items', '[]'::jsonb)) as slides, parent_kind, parent_id, sort_key
           from decks where workspace_id = $2 and ${may('decks', '$1', '$3')}
         union all select 'doc', id, name, updated_at, null, parent_kind, parent_id, sort_key from docs where workspace_id = $2 and ${may('docs', '$1', '$3')}) p
       order by updated desc limit ${MAX_PAGES}`, [u, ws, R('read')]))
      .map((r): PageSummary => ({ kind: r.kind, id: r.id, name: r.name, updated: ms(r.updated), slides: r.slides === null ? null : Number(r.slides), parent: parentOf(r), sortKey: r.sort_key })),
    getDoc: async (u, id) => {
      const r = await q<{ id: string; name: string; updated: string | Date; workspaceId: string; text: string; rev: number }>(
        `select id, name, updated_at as updated, workspace_id as "workspaceId", text, rev from docs where id = $2 and ${may('docs', '$1', '$3')}`, [u, id, R('read')])
      return r[0] ? { ...r[0], updated: ms(r[0].updated) } : null
    },
    putDoc: async (u, id, name, text, baseRev, ws, parent): Promise<PutResult> => {
      const upd = await q<{ rev: number }>(`update docs set name = $3, text = $4, rev = rev + 1, updated_at = now() where id = $1 and rev = $5 and ${may('docs', '$2', '$6')} returning rev`,
        [id, u, name, text, baseRev, R('write')])
      if (upd[0]) return { rev: upd[0].rev }
      const at = await place(u, ws, parent)
      if ('refused' in at) return at
      const ins = await q<{ rev: number }>(
        `insert into docs (id, workspace_id, user_id, name, text, rev, parent_kind, parent_id, sort_key) select $1, h.ws, $2, $3, $4, 1, $7, $8, $9 from ${home('$5', '$2')} h
         where h.ws is not null and ${editorIn('h.ws', '$2', '$6')} on conflict (id) do nothing returning rev`,
        [id, u, name, text, at.ws ?? null, R('write'), at.parent?.kind ?? null, at.parent?.id ?? null, at.key])
      return ins[0] ? { rev: ins[0].rev } : refused('docs', u, id)
    },
    deleteDoc: async (u, id) => {
      const gone = (await q(`delete from docs where id = $2 and ${may('docs', '$1', '$3')} returning id`, [u, id, R('write')])).length > 0
      if (gone) { await q('delete from doc_versions where doc_id = $1', [id]); await q('delete from doc_blobs where doc_id = $1', [id]) }
      return gone
    },
  }
}
