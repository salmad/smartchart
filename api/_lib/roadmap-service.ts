import { keyOf } from '../../src/engine/roadmaps/fields.js'
import { NO_EDIT } from '../../src/engine/pages/tree.js'
import { buildIndex } from '../../src/engine/roadmaps/index.js'
import type { RoadmapOp } from '../../src/engine/roadmaps/ops.js'
import { checksTouched, issueView, todayUtc } from '../../src/engine/tools/roadmap-view.js'
import { ToolError, type AccountPort, type AnyTool, type ToolContext } from '../../src/engine/tools/types.js'
import type { UserLook } from '../../src/engine/look.js'
import type { JevFn } from '../../src/engine/agent/llm.js'
import type { Db, WorkspaceRow } from './db.js'
import type { ToolReply } from './deck-service.js'

const ID = /^[\w-]{1,64}$/
const VIEW_WORKSPACE = new ToolError('refused', 'You can view this workspace, not add to it.', 'Pick a workspace where you are an editor (list_workspaces).')
const noRoadmap = (id: unknown) => new ToolError('not_found', `No roadmap ${String(id)}.`, 'list_roadmaps shows your roadmaps.')
const noWorkspace = (id: string) => new ToolError('not_found', `No workspace ${id}.`, 'list_workspaces shows your workspaces.')
const BUSY = 'Busy, try again.'
const saveRefusal = (id: string, said: string) => {
  if (said === 'foreign') return noRoadmap(id)
  if (said === BUSY) return new ToolError('conflict', BUSY, 'Call it again.')
  if (said === NO_EDIT) return new ToolError('refused', NO_EDIT, 'Ask an owner of the workspace to make you an editor.')
  return new ToolError('refused', said, 'Fix it and call again; nothing was changed.')
}

export interface RoadmapEnv {
  tool: AnyTool; input: unknown; uid: string; client: string; db: Db; origin: string
  now: () => number; port: AccountPort; jev: JevFn; userLook: UserLook
  workspaces: () => Promise<WorkspaceRow[]>
}

export function roadmapAccount(db: Db, uid: string, workspaces: () => Promise<WorkspaceRow[]>): Pick<AccountPort,
  'listRoadmaps' | 'newRoadmapId' | 'loadRoadmap' | 'saveRoadmap' | 'createRoadmap' | 'issueDetail' | 'roadmapEventsSince'> {
  return {
    listRoadmaps: async (limit, cursor, workspaceId) => {
      const mine = await workspaces(), ws = workspaceId ?? mine[0]?.id ?? ''
      if (!mine.some((w) => w.id === ws)) throw noWorkspace(ws)
      const all = await db.listRoadmaps(uid, ws), page = all.slice(cursor, cursor + limit)
      return {
        workspaceId: ws,
        roadmaps: page.map((r) => ({ roadmapId: r.id, name: r.name, prefix: r.prefix, updated: r.updated, parent: r.parent })),
        ...(cursor + limit < all.length ? { next: cursor + limit } : {}),
      }
    },
    newRoadmapId: () => `rm_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    loadRoadmap: (id) => db.getRoadmap(uid, id),
    saveRoadmap: (id, op, byClient) => db.writeRoadmap(uid, id, op, byClient),
    createRoadmap: (r) => db.createRoadmap(uid, { id: r.id, name: r.name, prefix: r.prefix, workspaceId: r.workspaceId ?? '', parent: r.parent }),
    issueDetail: (id, issueId) => db.getIssueDetail(uid, id, issueId),
    roadmapEventsSince: (id, sinceMs) => db.roadmapEventsSince(uid, id, sinceMs),
  }
}

export async function runRoadmapTool(e: RoadmapEnv): Promise<ToolReply> {
  try { return await run(e) } catch (err) {
    if (err instanceof ToolError) return { ok: false, error: { code: err.code, message: err.message, ...(err.fix ? { fix: err.fix } : {}) } }
    throw err
  }
}

async function run(e: RoadmapEnv): Promise<ToolReply> {
  const { tool: t, uid, db, origin } = e
  const roadmapId = (e.input as { roadmapId?: unknown }).roadmapId
  let ctx: ToolContext = { deck: null, rev: 0, roadmap: null, userLook: e.userLook, links: null, presence: {}, file: null, docPresence: {}, port: e.port, jev: e.jev, now: e.now, client: e.client }
  if (t.scope === 'roadmap') {
    const loaded = typeof roadmapId === 'string' && ID.test(roadmapId) ? await e.port.loadRoadmap(roadmapId) : null
    if (!loaded) throw noRoadmap(roadmapId)
    ctx = { ...ctx, roadmap: loaded, links: { edit: `${origin}/r/${roadmapId}`, share: null } }
  } else if (t.scope === 'createRoadmap') ctx = { ...ctx, links: { edit: '', share: null } }

  const out = await t.run(ctx, e.input)
  if (out.roadmapCreate) {
    const id = String((out.result as { roadmapId?: string }).roadmapId ?? '')
    const workspaceId = out.workspaceId ?? (out.parent ? undefined : (await e.workspaces())[0]?.id)
    const said = await e.port.createRoadmap({
      id,
      name: out.roadmapCreate.name,
      prefix: out.roadmapCreate.prefix,
      workspaceId,
      parent: out.parent,
    })
    if (said === 'ok') {
      const result = { ...out.result, links: { edit: `${origin}/r/${id}` } }
      await db.markAgentConnectDone(uid)
      return { ok: true, result }
    }
    if (said === 'foreign') {
      if (out.parent) throw new ToolError('refused', NO_EDIT, 'Create it in a workspace you can edit.')
      const role = (await e.workspaces()).find((w) => w.id === workspaceId)?.role
      throw role === 'viewer' ? VIEW_WORKSPACE : noWorkspace(workspaceId ?? '')
    }
    throw new ToolError('refused', said, 'Fix it and call again; nothing was changed.')
  }
  if (out.roadmapOp) {
    const id = typeof roadmapId === 'string' ? roadmapId : ''
    const said = await e.port.saveRoadmap(id, out.roadmapOp as RoadmapOp, e.client)
    if (typeof said === 'string') throw saveRefusal(id, said)
    const fresh = await e.port.loadRoadmap(id)
    if (!fresh) throw noRoadmap(id)
    const today = todayUtc(e.now())
    const changedIds = said.changed.map((i) => i.id)
    const checks = checksTouched(fresh.issues, changedIds, today)
    const idx = buildIndex([...fresh.issues])
    const issueRows = changedIds.flatMap((cid) => {
      const row = fresh.issues.find((i) => i.id === cid)
      return row ? [issueView(fresh.roadmap, fresh.issues, row, today, idx)] : []
    })
    const result: Record<string, unknown> = { ...out.result, seq: fresh.roadmap.seq, checks, issues: issueRows }
    if (t.name === 'create_issues' && Array.isArray((out.result as { created?: unknown }).created)) {
      const pre = (out.result as { created: { ref: string; issueId: string; key: string }[] }).created
      const byId = new Map(fresh.issues.map((row) => [row.id, row]))
      result.created = pre.map((c) => {
        const row = byId.get(c.issueId)
        return row ? { ...c, key: keyOf(fresh.roadmap, row) } : c
      })
    }
    if (t.name === 'delete_issue') result.deleted = said.changed.length
    if (t.name === 'set_fields') result.fields = fresh.roadmap.fields
    if (t.name === 'set_sprints') result.sprints = fresh.roadmap.sprints
    await db.markAgentConnectDone(uid)
    return { ok: true, result }
  }
  return { ok: true, result: out.result }
}