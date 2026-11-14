/* move_issue, delete_issue, and set_fields. */
import type { FieldDef } from '../roadmaps/types.js'
import { NO_ISSUE } from '../roadmaps/tree.js'
import type { Issue } from '../roadmaps/types.js'
import { loaded, requireRequest } from './roadmap-input.js'
import { DESTRUCTIVE, IDEMPOTENT, ToolError, WRITE, tool, type JsonSchema } from './types.js'

const NULLABLE_STRING: JsonSchema = { oneOf: [{ type: 'string' }, { type: 'null' }] }

function liveById(issues: readonly Issue[], id: string): Issue | undefined {
  return issues.find((i) => i.id === id && i.deletedAt === null)
}

function assertSibling(issues: readonly Issue[], parentId: string | null, slotId: string, movingId: string): void {
  if (slotId === movingId) throw new ToolError('refused', NO_ISSUE)
  const sib = liveById(issues, slotId)
  if (!sib || sib.parentId !== parentId) throw new ToolError('refused', NO_ISSUE)
}

export const moveIssueTool = tool<{
  roadmapId: string
  issueId: string
  parentId: string | null
  request: string
  before?: string
  after?: string
}>({
  name: 'move_issue',
  title: 'Move an issue',
  group: 'roadmaps',
  scope: 'roadmap',
  annotations: IDEMPOTENT,
  description: 'Change an issue\'s parent and position among siblings. parentId is the new parent (null for a root). At most one of before or after names a sibling to order beside; with neither, the issue goes last under that parent. Pass the user\'s own words as request.',
  input: {
    type: 'object',
    additionalProperties: false,
    required: ['roadmapId', 'parentId', 'issueId', 'request'],
    properties: {
      roadmapId: { type: 'string' },
      issueId: { type: 'string' },
      parentId: NULLABLE_STRING,
      request: { type: 'string' },
      before: { type: 'string' },
      after: { type: 'string' },
    },
  },
  run: async (ctx, { issueId, parentId, before, after, request }) => {
    requireRequest(request)
    const { issues } = loaded(ctx)
    if (!liveById(issues, issueId)) throw new ToolError('refused', NO_ISSUE)
    if (before !== undefined && after !== undefined) {
      throw new ToolError('bad_input', 'before and after: give one, not both.')
    }
    if (before !== undefined) assertSibling(issues, parentId, before, issueId)
    if (after !== undefined) assertSibling(issues, parentId, after, issueId)
    if (parentId !== null && !liveById(issues, parentId)) throw new ToolError('refused', NO_ISSUE)
    return {
      result: {},
      roadmapOp: {
        op: 'move',
        id: issueId,
        parentId,
        ...(before !== undefined ? { before } : {}),
        ...(after !== undefined ? { after } : {}),
      },
    }
  },
})

export const roadmapTailWriteTools = [
  tool<{ roadmapId: string; issueId: string; request: string }>({
    name: 'delete_issue',
    title: 'Delete an issue',
    group: 'roadmaps',
    scope: 'roadmap',
    annotations: DESTRUCTIVE,
    description: 'Soft-delete an issue and its sub-issues in one step. Returns how many rows were removed. Pass the user\'s own words as request.',
    input: {
      type: 'object',
      additionalProperties: false,
      required: ['roadmapId', 'issueId', 'request'],
      properties: {
        roadmapId: { type: 'string' },
        issueId: { type: 'string' },
        request: { type: 'string' },
      },
    },
    run: async (ctx, { issueId, request }) => {
      requireRequest(request)
      const { issues } = loaded(ctx)
      if (!liveById(issues, issueId)) throw new ToolError('refused', NO_ISSUE)
      return { result: {}, roadmapOp: { op: 'delete', ids: [issueId] } }
    },
  }),

  tool<{ roadmapId: string; fields: FieldDef[]; request: string }>({
    name: 'set_fields',
    title: 'Define roadmap fields',
    group: 'roadmaps',
    scope: 'roadmap',
    annotations: WRITE,
    description: 'Replace the ordered list of custom field definitions on a roadmap. Removing a field strips its values from every issue in the same write. Pass the user\'s own words as request.',
    input: {
      type: 'object',
      additionalProperties: false,
      required: ['roadmapId', 'fields', 'request'],
      properties: {
        roadmapId: { type: 'string' },
        request: { type: 'string' },
        fields: { type: 'array', items: { type: 'object', additionalProperties: true } },
      },
    },
    run: async (ctx, { fields, request }) => {
      requireRequest(request)
      loaded(ctx)
      return { result: {}, roadmapOp: { op: 'roadmap', fields } }
    },
  }),
]