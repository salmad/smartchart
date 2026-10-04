// Runs one tool for one caller: check input, load the deck (scoped to the user), run the handler, save with rev
// (a conflict reloads and runs again once), record events. Hosts (REST, MCP) only translate in and out.
import { checkInput } from '../../src/engine/tools/input.js'
import { dataFromDoc, docFromData } from '../../src/engine/tools/doc.js'
import { toolByName } from '../../src/engine/tools/index.js'
import { ToolError, type AccountPort, type ErrorCode, type ToolContext } from '../../src/engine/tools/types.js'
import type { JevFn } from '../../src/engine/agent/llm.js'
import type { Db } from './db.js'
import { serverJev } from './models.js'
import { DAILY_CALLS } from './quota.js'
import { overRate } from './rate.js'
import { recordVersion } from './versions.js'

export interface Caller { user: { id: string; email: string }; client: string; key: string }
export type ToolReply = { ok: true; result: Record<string, unknown> } | { ok: false; error: { code: ErrorCode; message: string; fix?: string } }

const fail = (code: ErrorCode, message: string, fix?: string): ToolReply => ({ ok: false, error: { code, message, ...(fix ? { fix } : {}) } })
const newDeckId = () => `d_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

export async function runTool(name: string, input: unknown, caller: Caller, deps: { db: Db; origin: string; jev?: JevFn; now?: () => number }): Promise<ToolReply> {
  const { db, origin } = deps, now = deps.now ?? Date.now, uid = caller.user.id
  const t = toolByName(name)
  if (!t) return fail('bad_input', `Unknown tool ${name}.`, 'tools/list shows the tools.')
  const problems = checkInput(t.input, input ?? {})
  if (problems.length) return fail('bad_input', problems.join(' | '))
  if (await overRate(db, caller.key, now())) return fail('rate', 'Too many calls this minute.', 'Wait a minute, then continue.')

  const port: AccountPort = {
    email: caller.user.email,
    callsLeftToday: async () => Math.max(0, DAILY_CALLS - await db.callsToday(uid)),
    listDecks: async (limit, cursor) => {
      const all = await db.listDecks(uid), page = all.slice(cursor, cursor + limit)
      return { decks: page.map((d) => ({ deckId: d.id, name: d.name, style: d.style === 'pitch' ? 'pitch' : 'consulting', slides: d.slides, updated: d.updated, shared: !!d.shared })),
        ...(cursor + limit < all.length ? { next: cursor + limit } : {}) }
    },
    share: async (deckId, on) => {
      const tok = await db.shareDeck(uid, deckId, on)
      if (tok === undefined) throw new ToolError('not_found', `No deck ${deckId}.`, 'list_decks shows your decks.')
      return tok ? `${origin}/s/${tok}` : null
    },
    newDeckId,
    versions: (deckId) => db.listVersions(uid, deckId),
    blobs: (deckId, hashes) => db.blobs(uid, deckId, hashes),
  }
  const jev = deps.jev ?? serverJev({ userId: uid, db })
  const deckId = (input as { deckId?: string }).deckId

  try {
    for (let attempt = 0; ; attempt++) {
      let ctx: ToolContext = { deck: null, rev: 0, links: null, presence: {}, port, jev, now, client: caller.client }
      let row: Awaited<ReturnType<Db['getDeck']>> = null
      if (t.scope === 'deck') {
        row = deckId ? await db.getDeck(uid, deckId) : null
        if (!row) return fail('not_found', `No deck ${deckId}.`, 'list_decks shows your decks.')
        const meta = await db.getDeckMeta(uid, row.id)
        ctx = { ...ctx, deck: docFromData(row.id, row.name, row.data), rev: row.rev, presence: meta?.presence ?? {},
          links: { edit: `${origin}/d/${row.id}`, share: meta?.share ? `${origin}/s/${meta.share}` : null } }
      }
      if (t.scope === 'create') ctx = { ...ctx, links: { edit: '', share: null } }
      const out = await t.run(ctx, input)
      if (!out.deck) return { ok: true, result: out.result }
      const base = row?.rev ?? 0, chat = (row?.chat as object | null) ?? { history: [], messages: [], working: [] }
      const data = dataFromDoc(out.deck, row?.data)
      const put = await db.putDeck(uid, out.deck.id, out.deck.name, data, chat, base, { named: !!out.named })
      if (put === 'foreign') return fail('not_found', `No deck ${out.deck.id}.`)
      if (put === 'conflict') { if (attempt === 0) continue; return fail('conflict', 'The deck changed while this ran.', 'Call it again.') }
      // One version per request: an agent's writes for the same words, close together, group into one.
      const request = (input as { request?: unknown }).request, label = out.label ?? (typeof request === 'string' && request.trim() ? request.trim().slice(0, 300) : null)
      await recordVersion(db, uid, out.deck.id, data, { by: caller.client, turn: `mcp:${label ?? ''}`, label }, put.rev, now())
      if (out.events?.length) await db.addEvents(uid, out.deck.id, out.events.map((e) => ({ ...e, rev: put.rev, by: caller.client })))
      const result = { ...out.result }
      if ('rev' in result) result.rev = put.rev
      if (t.scope === 'create') result.links = { edit: `${origin}/d/${out.deck.id}` }
      return { ok: true, result }
    }
  } catch (e) {
    if (e instanceof ToolError) return fail(e.code, e.message, e.fix)
    console.error('tool failed', name, e)
    return fail('upstream', 'Something went wrong on SmartChart’s side.', 'Try again; if it repeats, tell the user.')
  }
}
