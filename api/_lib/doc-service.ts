// Runs one doc tool for one caller, as deck-service does for decks: load the doc by the user's role in its workspace, run the
// handler, save its Markdown with the revision read (a conflict reloads and runs again once), and record a version. A person
// editing by hand is told, and their next Save is refused as stale by the same revision check.
import { parseDoc } from '../../src/engine/docs/parse.js'
import { serializeDoc } from '../../src/engine/docs/serialize.js'
import { plainOf } from '../../src/engine/slides/markup.js'
import { NO_EDIT } from '../../src/engine/pages/tree.js'
import { ToolError, type AccountPort, type AnyTool, type ToolContext } from '../../src/engine/tools/types.js'
import type { JevFn } from '../../src/engine/agent/llm.js'
import type { Db, WorkspaceRow } from './db.js'
import type { ToolReply } from './deck-service.js'
import { recordDocVersion } from './versions.js'

const ID = /^[\w-]{1,64}$/
const VIEW_DOC = new ToolError('refused', 'You can view this doc, not edit it.', 'Ask an owner of its workspace to make you an editor.')
const VIEW_WORKSPACE = new ToolError('refused', 'You can view this workspace, not add to it.', 'Pick a workspace where you are an editor (list_workspaces).')
const noDoc = (id: unknown) => new ToolError('not_found', `No doc ${String(id)}.`, 'list_docs shows your docs.')
const noWorkspace = (id: string) => new ToolError('not_found', `No workspace ${id}.`, 'list_workspaces shows your workspaces.')

export interface DocEnv {
  tool: AnyTool; input: unknown; uid: string; client: string; db: Db; origin: string
  now: () => number; port: AccountPort; jev: JevFn
  /** Most recently used first: the first is the default. */
  workspaces: () => Promise<WorkspaceRow[]>
}

/** A refusal a tool or the service raised becomes a failed reply; anything else is the caller's to handle. */
export async function runDocTool(e: DocEnv): Promise<ToolReply> {
  try { return await run(e) } catch (err) {
    if (err instanceof ToolError) return { ok: false, error: { code: err.code, message: err.message, ...(err.fix ? { fix: err.fix } : {}) } }
    throw err
  }
}

async function run(e: DocEnv): Promise<ToolReply> {
  const { tool: t, uid, db, origin } = e, docId = (e.input as { docId?: unknown }).docId
  for (let attempt = 0; ; attempt++) {
    let ctx: ToolContext = { deck: null, rev: 0, links: null, presence: {}, file: null, docPresence: {}, port: e.port, jev: e.jev, now: e.now, client: e.client }
    let baseRev = 0
    if (t.scope === 'doc') {
      const row = typeof docId === 'string' && ID.test(docId) ? await db.getDoc(uid, docId) : null
      if (!row) throw noDoc(docId)
      const meta = await db.getDocMeta(uid, row.id)
      baseRev = row.rev
      ctx = { ...ctx, rev: row.rev, file: { id: row.id, name: row.name, doc: parseDoc(row.text).doc }, docPresence: meta?.presence ?? {}, links: { edit: `${origin}/doc/${row.id}`, share: null } }
    } else ctx = { ...ctx, links: { edit: '', share: null } }

    const out = await t.run(ctx, e.input)
    if (!out.file) return { ok: true, result: out.result }
    const file = out.file, text = serializeDoc(file.doc), name = plainOf(file.doc.title).trim() || file.name
    // Under a parent, the page is in the parent's workspace (the save finds it), not the most recently opened one.
    const workspaceId = t.scope === 'createDoc' ? out.workspaceId ?? (out.parent ? undefined : (await e.workspaces())[0]?.id) : undefined
    const put = await db.putDoc(uid, file.id, name, text, baseRev, workspaceId, out.parent)
    if (put === 'foreign') {
      if (t.scope === 'doc') throw await db.getDoc(uid, file.id) ? VIEW_DOC : noDoc(file.id)
      if (out.parent) throw new ToolError('refused', NO_EDIT, 'Create it in a workspace you can edit.') // the parent is readable (else the save says no such page), so this is a viewer
      const role = (await e.workspaces()).find((w) => w.id === workspaceId)?.role
      throw role === 'viewer' ? VIEW_WORKSPACE : noWorkspace(workspaceId ?? '')
    }
    if (typeof put === 'object' && 'refused' in put) return { ok: false, error: { code: 'refused', message: put.refused, fix: 'Choose another parent.' } }
    if (put === 'conflict') {
      if (attempt === 0) continue
      return { ok: false, error: { code: 'conflict', message: 'The doc changed while this ran.', fix: 'Call it again.' } }
    }
    await recordDocVersion(db, uid, file.id, text, e.client, put.rev, out.what ?? null, e.now())
    const result = { ...out.result }
    if ('rev' in result) result.rev = put.rev
    if (t.scope === 'createDoc') result.links = { edit: `${origin}/doc/${file.id}` }
    const editing = ctx.docPresence.editing
    if (editing && editing.until > e.now()) result.notice = `${editing.by} is editing this doc by hand right now. Your change is saved; their editor will say a newer version exists, and their next Save is refused until they reload.`
    return { ok: true, result }
  }
}
