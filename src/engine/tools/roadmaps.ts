/* Roadmap tools: list, create, read, and write issues on a roadmap. */
import { CHECK_IDS } from '../roadmaps/checks.js'
import { buildIndex } from '../roadmaps/index.js'
import { currentSprint } from '../roadmaps/sprints.js'
import { PREFIX, STATUSES, type IssueEvent } from '../roadmaps/types.js'
import type { Chip } from '../roadmaps/view.js'
import { pageArg, pageSchema, type PageArg } from './pages.js'
import { issueView, matchingIssues, todayUtc } from './roadmap-view.js'
import { loaded, requireRequest } from './roadmap-input.js'
import { moveIssueTool, roadmapTailWriteTools } from './roadmap-tree-writes.js'
import { roadmapWriteTools } from './roadmap-writes.js'
import { READ, ToolError, WRITE, tool, type JsonSchema } from './types.js'

const ROADMAP_ID = { type: 'string', description: 'The roadmap id from list_roadmaps or create_roadmap.' } as const
const WORKSPACE_ID = { type: 'string', description: 'A workspaceId from list_workspaces. Leave it out for the workspace the user opened most recently.' } as const
const PREFIX_BAD = 'Prefix must be 2–6 uppercase letters or digits, starting with a letter.'
const ISSUE_ID = { type: 'string', description: 'An issue id from get_roadmap or list_issues.' } as const
const NULLABLE_STRING: JsonSchema = { oneOf: [{ type: 'string' }, { type: 'null' }] }
const CHIP_SCHEMA: JsonSchema = {
  oneOf: [
    { type: 'object', additionalProperties: false, required: ['on', 'is', 'values'], properties: { on: { type: 'string', enum: ['status'] }, is: { type: 'boolean' }, values: { type: 'array', items: { type: 'string', enum: STATUSES } } } },
    { type: 'object', additionalProperties: false, required: ['on', 'is', 'values'], properties: { on: { type: 'string', enum: ['assignee'] }, is: { type: 'boolean' }, values: { type: 'array', items: NULLABLE_STRING } } },
    { type: 'object', additionalProperties: false, required: ['on', 'field', 'is', 'values'], properties: { on: { type: 'string', enum: ['field'] }, field: { type: 'string' }, is: { type: 'boolean' }, values: { type: 'array', items: NULLABLE_STRING } } },
    { type: 'object', additionalProperties: false, required: ['on', 'when'], properties: { on: { type: 'string', enum: ['dates'] }, when: { type: 'string', enum: ['overdue', 'before', 'after'] }, date: { type: 'string' } } },
    { type: 'object', additionalProperties: false, required: ['on', 'id'], properties: { on: { type: 'string', enum: ['check'] }, id: { type: 'string', enum: CHECK_IDS } } },
  ],
}

function parseSince(s: string): number {
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return Date.parse(`${s}T00:00:00.000Z`)
  const ms = Date.parse(s)
  if (Number.isFinite(ms)) return ms
  throw new ToolError('bad_input', 'since: an ISO date (YYYY-MM-DD).')
}

function eventOut(e: IssueEvent) {
  return { issueId: e.issueId, what: e.what, changes: e.changes, by: e.by, byClient: e.byClient, at: new Date(e.at).toISOString() }
}

export const roadmapTools = [
  tool<{ limit?: number; cursor?: number; workspaceId?: string }>({
    name: 'list_roadmaps',
    title: 'List roadmaps',
    group: 'roadmaps',
    scope: 'account',
    annotations: READ,
    description: "A workspace's roadmaps, newest first: id, name, prefix, last change and parent (the page it sits under, a doc, a deck or a roadmap, or null at the top level). Open one with get_roadmap. Before your first roadmap write, read get_guide with style \"roadmap\". Without workspaceId: the workspace the user opened most recently (list_workspaces shows the others).",
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
    description: 'A roadmap\'s name, prefix, custom field definitions, sprint rhythm (sprints: first day and weeks, or null) and the current sprint (number, first and last day), editor link, and every live issue (id, key, title, status, assignee, dates, sprint, parent, sort order, field values and check ids). Issues are in tree order. Does not include issue bodies, comments or members. Before your first roadmap write, read get_guide with style "roadmap".',
    input: { type: 'object', additionalProperties: false, required: ['roadmapId'], properties: { roadmapId: ROADMAP_ID } },
    run: async (ctx) => {
      const { roadmap, issues } = loaded(ctx)
      const today = todayUtc(ctx.now())
      const idx = buildIndex([...issues])
      const rows = matchingIssues(issues, [], today, idx).map((i) => issueView(roadmap, issues, i, today, idx))
      return {
        result: {
          roadmapId: roadmap.id,
          name: roadmap.name,
          prefix: roadmap.prefix,
          fields: roadmap.fields,
          sprints: roadmap.sprints ? { start: roadmap.sprints.start, weeks: roadmap.sprints.weeks } : null,
          currentSprint: roadmap.sprints ? currentSprint(roadmap.sprints, today) : null,
          links: { edit: ctx.links?.edit ?? '' },
          issues: rows,
        },
      }
    },
  }),

  tool<{ roadmapId: string; chips: Chip[]; limit?: number; cursor?: number }>({
    name: 'list_issues',
    title: 'List issues',
    group: 'roadmaps',
    scope: 'roadmap',
    annotations: READ,
    description: 'Live issues that match every chip, in tree order (not dimmed ancestors). Chips AND. Pass an empty chips array for all live issues. Optional limit (default 100, max 200) and cursor (default 0) page the matches.',
    input: {
      type: 'object',
      additionalProperties: false,
      required: ['roadmapId', 'chips'],
      properties: {
        roadmapId: ROADMAP_ID,
        chips: { type: 'array', items: CHIP_SCHEMA },
        limit: { type: 'integer', minimum: 1, maximum: 200 },
        cursor: { type: 'integer', minimum: 0 },
      },
    },
    run: async (ctx, { limit = 100, cursor = 0, chips }) => {
      const { roadmap, issues } = loaded(ctx)
      const today = todayUtc(ctx.now())
      const idx = buildIndex([...issues])
      const matched = matchingIssues(issues, chips, today, idx)
      const page = matched.slice(cursor, cursor + limit)
      return {
        result: {
          issues: page.map((i) => issueView(roadmap, issues, i, today, idx)),
          ...(cursor + limit < matched.length ? { next: cursor + limit } : {}),
        },
      }
    },
  }),

  tool<{ roadmapId: string; issueId: string }>({
    name: 'get_issue',
    title: 'Open an issue',
    group: 'roadmaps',
    scope: 'roadmap',
    annotations: READ,
    description: 'One issue: the same fields as get_roadmap, plus body, comments, and its activity (events oldest first). Soft-deleted issues still open when they exist; checks is empty and deletedAt is set.',
    input: { type: 'object', additionalProperties: false, required: ['roadmapId', 'issueId'], properties: { roadmapId: ROADMAP_ID, issueId: ISSUE_ID } },
    run: async (ctx, { roadmapId, issueId }) => {
      const { roadmap, issues } = loaded(ctx)
      const row = issues.find((i) => i.id === issueId)
      const detail = await ctx.port.issueDetail(roadmapId, issueId)
      if (!detail || !row) throw new ToolError('not_found', 'No such issue.')
      const today = todayUtc(ctx.now())
      const idx = buildIndex([...issues])
      const view = issueView(roadmap, issues, row, today, idx)
      return {
        result: {
          ...view,
          body: detail.body,
          comments: detail.comments,
          events: detail.events.map(eventOut),
        },
      }
    },
  }),

  ...roadmapWriteTools,

  moveIssueTool,

  tool<{ roadmapId: string; since: string }>({
    name: 'list_changes',
    title: 'List changes',
    group: 'roadmaps',
    scope: 'roadmap',
    annotations: READ,
    description: 'Roadmap activity since a date: every issue event at or after since, oldest first. since is YYYY-MM-DD (UTC midnight) or a full ISO-8601 timestamp.',
    input: { type: 'object', additionalProperties: false, required: ['roadmapId', 'since'], properties: { roadmapId: ROADMAP_ID, since: { type: 'string' } } },
    run: async (ctx, { roadmapId, since }) => {
      loaded(ctx)
      const sinceMs = parseSince(since)
      const evs = await ctx.port.roadmapEventsSince(roadmapId, sinceMs)
      if (evs === null) throw new ToolError('not_found', `No roadmap ${roadmapId}.`, 'list_roadmaps shows your roadmaps.')
      return { result: { events: evs.map(eventOut) } }
    },
  }),

  ...roadmapTailWriteTools,
]