/* Roadmap tools: list, create, and read a roadmap. Issue writes come in later tasks. */
import { PREFIX } from '../roadmaps/types.js'
import { pageArg, pageSchema, type PageArg } from './pages.js'
import { issueView, liveTree, todayUtc } from './roadmap-view.js'
import { READ, ToolError, WRITE, tool, type LoadedRoadmap, type ToolContext } from './types.js'

const ROADMAP_ID = { type: 'string', description: 'The roadmap id from list_roadmaps or create_roadmap.' } as const
const WORKSPACE_ID = { type: 'string', description: 'A workspaceId from list_workspaces. Leave it out for the workspace the user opened most recently.' } as const
const PREFIX_BAD = 'Prefix must be 2–6 uppercase letters or digits, starting with a letter.'

export function requireRequest(request: string): string {
  const trimmed = request.trim()
  if (!trimmed) throw new ToolError('bad_input', "request: the user's own words.")
  return trimmed.slice(0, 300)
}

const loaded = (ctx: ToolContext): LoadedRoadmap => {
  if (!ctx.roadmap) throw new ToolError('bad_input', 'No roadmap.', 'Pass roadmapId.')
  return ctx.roadmap
}

export const roadmapTools = [
  tool<{ limit?: number; cursor?: number; workspaceId?: string }>({
    name: 'list_roadmaps',
    title: 'List roadmaps',
    group: 'roadmaps',
    scope: 'account',
    annotations: READ,
    description: "A workspace's roadmaps, newest first: id, name, prefix, last change and parent (the page it sits under, a doc, a deck or a roadmap, or null at the top level). Open one with get_roadmap. Without workspaceId: the workspace the user opened most recently (list_workspaces shows the others).",
    input: { type: 'object', additionalProperties: false, properties: { limit: { type: 'integer', minimum: 1, maximum: 100 }, cursor: { type: 'integer', minimum: 0 }, workspaceId: WORKSPACE_ID } },
    run: async (ctx, { limit = 25, cursor = 0, workspaceId }) => ({ result: await ctx.port.listRoadmaps(limit, cursor, workspaceId) }),
  }),

  tool<{ name: string; prefix: string; request: string; workspaceId?: string; parent?: PageArg }>({
    name: 'create_roadmap',
    title: 'Create a roadmap',
    group: 'roadmaps',
    scope: 'createRoadmap',
    annotations: WRITE,
    description: 'Start a new roadmap: a name, an issue key prefix (2–6 uppercase letters or digits, starting with a letter), and the user\'s own words for why. It goes into workspaceId, else the workspace the user opened most recently. With parent (a doc, a deck or a roadmap) it goes last under that page, in that page\'s workspace. Returns the roadmap id and editor link: give it to the user so they can watch.',
    input: { type: 'object', additionalProperties: false, required: ['name', 'prefix', 'request'], properties: { name: { type: 'string' }, prefix: { type: 'string' }, request: { type: 'string' }, workspaceId: WORKSPACE_ID, parent: pageSchema('Put the roadmap under this page.') } },
    run: async (ctx, { name, prefix, request, workspaceId, parent }) => {
      requireRequest(request)
      const trimmed = name.trim().slice(0, 200)
      if (!trimmed) throw new ToolError('bad_input', 'Every roadmap needs a name.')
      if (!PREFIX.test(prefix)) throw new ToolError('bad_input', PREFIX_BAD)
      const under = parent === undefined ? undefined : pageArg(parent, 'parent')
      const roadmapId = ctx.port.newRoadmapId()
      return {
        result: { roadmapId, name: trimmed, prefix, parent: under ?? null },
        roadmapCreate: { name: trimmed, prefix },
        workspaceId,
        ...(under ? { parent: under } : {}),
      }
    },
  }),

  tool<{ roadmapId: string }>({
    name: 'get_roadmap',
    title: 'Open a roadmap',
    group: 'roadmaps',
    scope: 'roadmap',
    annotations: READ,
    description: 'A roadmap\'s name, prefix, custom field definitions, editor link, and every live issue (id, key, title, status, assignee, dates, parent, sort order, field values and check ids). Issues are in tree order. Does not include issue bodies, comments or members.',
    input: { type: 'object', additionalProperties: false, required: ['roadmapId'], properties: { roadmapId: ROADMAP_ID } },
    run: async (ctx) => {
      const { roadmap, issues } = loaded(ctx)
      const today = todayUtc(ctx.now())
      const rows = liveTree(issues).map((i) => issueView(roadmap, issues, i, today))
      return {
        result: {
          roadmapId: roadmap.id,
          name: roadmap.name,
          prefix: roadmap.prefix,
          fields: roadmap.fields,
          links: { edit: ctx.links?.edit ?? '' },
          issues: rows,
        },
      }
    },
  }),
]