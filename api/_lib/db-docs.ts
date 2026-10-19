// What a doc keeps beside its text: presence, versions (a tree per save, each block once per hash) and comments.
// Like every call, each checks the caller's role in the doc's workspace inside the query itself.
import { KEEP } from '../../src/engine/versions.js'
import type { DocTree } from '../../src/engine/docs/versions.js'
import type { Block } from '../../src/engine/docs/types.js'
import { MAX_DOC_COMMENTS, type DocComment } from '../../src/engine/comments.js'
import { rolesFor, type Action, type Role } from './access.js'
import { may, roleOf } from './db-decks.js'
import { NO_COMMENT, type Db, type DocPresence, type DocVersion, type Q } from './db.js'

const R = (a: Action) => rolesFor(a)
const ms = (t: string | Date) => new Date(t).getTime()
const docRead = (u: string, id: string, roles: string) => `exists (select 1 from docs where docs.id = ${id} and ${may('docs', u, roles)})`

type Calls = 'getDocMeta' | 'setDocPresence' | 'docVersionHead' | 'writeDocVersion' | 'listDocVersions' | 'docBlobs' | 'docComments' | 'docComment'

export function docCalls(q: Q): Pick<Db, Calls> {
  const comments = async (u: string, id: string) =>
    (await q<{ comments: DocComment[] }>(`select comments from docs where id = $2 and ${may('docs', '$1', '$3')}`, [u, id, R('read')]))[0]?.comments ?? null
  /** After a comment change touched nothing: why not. */
  const why = async (u: string, id: string, cid: string, verb: string): Promise<'foreign' | string> => {
    const all = await comments(u, id)
    if (!all) return 'foreign'
    const c = all.find((x) => x.id === cid)
    if (!c) return NO_COMMENT
    if (verb === 'resolve' && c.done) return 'That comment is already resolved.'
    return verb === 'remove' ? 'Only the author can delete a comment.' : 'Only an editor or the author can resolve a comment.'
  }
  return {
    getDocMeta: async (u, id) => (await q<{ rev: number; presence: DocPresence; role: Role }>(
      `select rev, presence, ${roleOf('docs', '$1')} as role from docs where id = $2 and ${may('docs', '$1', '$3')}`, [u, id, R('read')]))[0] ?? null,
    setDocPresence: async (u, id, p) => (await q(`update docs set presence = $3 where id = $2 and ${may('docs', '$1', '$4')} returning id`, [u, id, JSON.stringify(p), R('write')])).length > 0,
    docVersionHead: async (u, id) => {
      const r = await q<{ n: number; by: string; at: string | Date; key: string; tree: DocTree }>(
        `select n, by_client as by, at, key, tree from doc_versions where doc_id = $2 and ${docRead('$1', '$2', '$3')} order by n desc limit 1`, [u, id, R('read')])
      return r[0] ? { n: r[0].n, by: r[0].by, turn: null, key: r[0].key, at: ms(r[0].at), hashes: r[0].tree.blocks } : null
    },
    writeDocVersion: async (u, id, v) => {
      const can = await q(`select 1 from docs where id = $2 and ${may('docs', '$1', '$3')}`, [u, id, R('write')])
      if (!can.length) return
      if (v.blobs.size) await q(
        `insert into doc_blobs (doc_id, hash, block) select $1, h, b from jsonb_each($2::jsonb) as e(h, b) on conflict do nothing`,
        [id, JSON.stringify(Object.fromEntries(v.blobs))])
      const at = new Date(v.at).toISOString()
      if (v.replace !== null) {
        await q('update doc_versions set rev = $3, key = $4, tree = $5, at = $6, label = coalesce(label, $7) where doc_id = $1 and n = $2',
          [id, v.replace, v.rev, v.key, JSON.stringify(v.tree), at, v.meta.label])
        return
      }
      await q(`insert into doc_versions (doc_id, user_id, n, rev, by_client, label, key, tree, at)
        select $1, $2, coalesce(max(n), 0) + 1, $3, $4, $5, $6, $7, $8 from doc_versions where doc_id = $1`,
        [id, u, v.rev, v.meta.by, v.meta.label, v.key, JSON.stringify(v.tree), at])
      await q('delete from doc_versions where doc_id = $1 and n <= (select max(n) from doc_versions where doc_id = $1) - $2', [id, KEEP])
    },
    listDocVersions: async (u, id) => (await q<{ n: number; rev: number; by: string; label: string | null; at: string | Date; tree: DocTree }>(
      `select n, rev, by_client as by, label, at, tree from doc_versions where doc_id = $2 and ${docRead('$1', '$2', '$4')} order by n desc limit $3`, [u, id, KEEP, R('read')]))
      .map((r): DocVersion => ({ ...r, at: ms(r.at) })),
    docBlobs: async (u, id, hashes) => hashes.length ? q<{ hash: string; block: Block }>(
      `select hash, block from doc_blobs where doc_id = $2 and hash = any($3::text[]) and ${docRead('$1', '$2', '$4')}
         and exists (select 1 from doc_versions where doc_id = $2)`, [u, id, hashes, R('read')]) : [],
    docComments: comments,
    // Each change is one UPDATE on the comments column, so two people commenting at once never overwrite each other.
    docComment: async (u, id, op, ctx) => {
      if ('add' in op) {
        const c: DocComment = { id: ctx.id, anchor: op.add.anchor, text: op.add.text, by: ctx.by, at: ctx.now, userId: u, ...(op.add.quote ? { quote: op.add.quote } : {}) }
        const r = await q<{ comments: DocComment[] }>(
          `update docs set comments = comments || jsonb_build_array($3::jsonb) where id = $2 and ${may('docs', '$1', '$4')}
             and jsonb_array_length(comments) < $5 returning comments`, [u, id, JSON.stringify(c), R('read'), MAX_DOC_COMMENTS])
        if (r[0]) return r[0].comments
        return await comments(u, id) ? 'This doc has too many comments.' : 'foreign'
      }
      const resolve = 'resolve' in op, cid = resolve ? op.resolve.id : (op as { remove: { id: string } }).remove.id
      const done = JSON.stringify({ by: ctx.by, at: ctx.now, ...(resolve && op.resolve.reply?.trim() ? { reply: op.resolve.reply.trim() } : {}) })
      const target = `c->>'id' = $3`
      // Resolve: still open, and the asker is an editor or its author. Remove: the asker is its author.
      const allowed = resolve
        ? `${target} and c->'done' is null and (c->>'userId' = $1 or ${may('docs', '$1', '$5')})`
        : `${target} and c->>'userId' = $1`
      const next = resolve
        ? `(select coalesce(jsonb_agg(case when ${target} then c || jsonb_build_object('done', $4::jsonb) else c end order by ord), '[]'::jsonb) from jsonb_array_elements(comments) with ordinality as e(c, ord))`
        : `(select coalesce(jsonb_agg(c order by ord), '[]'::jsonb) from jsonb_array_elements(comments) with ordinality as e(c, ord) where not (${target}))`
      const params = resolve ? [u, id, cid, done, R('write')] : [u, id, cid, R('read')]
      const r = await q<{ comments: DocComment[] }>(
        `update docs set comments = ${next} where id = $2 and ${may('docs', '$1', resolve ? '$6' : '$4')}
           and exists (select 1 from jsonb_array_elements(comments) c where ${allowed}) returning comments`,
        resolve ? [...params, R('read')] : params)
      return r[0] ? r[0].comments : why(u, id, cid, resolve ? 'resolve' : 'remove')
    },
  }
}
