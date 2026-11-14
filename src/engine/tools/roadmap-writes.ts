/* Roadmap issue writes: create_issues and update_issue. */
import type { IssueProps } from '../roadmaps/ops.js'
import { keyOf } from '../roadmaps/fields.js'
import { ISSUE_CYCLE, NO_ISSUE } from '../roadmaps/tree.js'
import { STATUSES, type FieldValue, type Issue, type Status } from '../roadmaps/types.js'
import { loaded, requireRequest } from './roadmap-input.js'
import { DESTRUCTIVE, ToolError, WRITE, tool, type JsonSchema, type ToolContext } from './types.js'

const REF = /^[\w-]{1,64}$/
const FIELD_ID = /^[\w-]+$/
const NULLABLE_STRING: JsonSchema = { oneOf: [{ type: 'string' }, { type: 'null' }] }
const newIssueId = () => `iss_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`

type CreateItem = {
  ref: string
  title: string
  status?: Status
  assignee?: string | null
  start?: string | null
  due?: string | null
  fields?: Record<string, unknown>
  parent?: string | null
}

const CREATE_ITEM: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['ref', 'title'],
  properties: {
    ref: { type: 'string' },
    title: { type: 'string' },
    status: { type: 'string', enum: STATUSES },
    assignee: NULLABLE_STRING,
    start: NULLABLE_STRING,
    due: NULLABLE_STRING,
    fields: { type: 'object', additionalProperties: true },
    parent: NULLABLE_STRING,
  },
}

function liveById(issues: readonly Issue[], id: string): Issue | undefined {
  return issues.find((i) => i.id === id && i.deletedAt === null)
}

function orderCreates(items: CreateItem[], refs: Set<string>): CreateItem[] {
  const byRef = new Map(items.map((i) => [i.ref, i]))
  const ordered: CreateItem[] = []
  const done = new Set<string>()
  const stack = new Set<string>()
  const visit = (ref: string) => {
    if (done.has(ref)) return
    if (stack.has(ref)) throw new ToolError('refused', ISSUE_CYCLE)
    stack.add(ref)
    const item = byRef.get(ref)
    if (!item) return
    const p = item.parent
    if (typeof p === 'string' && refs.has(p)) visit(p)
    stack.delete(ref)
    done.add(ref)
    ordered.push(item)
  }
  for (const item of items) visit(item.ref)
  return ordered
}

function propsFromCreate(item: CreateItem): IssueProps | undefined {
  const props: IssueProps = {}
  let any = false
  if (item.status !== undefined) { props.status = item.status; any = true }
  if (item.assignee !== undefined) { props.assignee = item.assignee; any = true }
  if (item.start !== undefined) { props.start = item.start; any = true }
  if (item.due !== undefined) { props.due = item.due; any = true }
  if (item.fields !== undefined) {
    const patch: Record<string, FieldValue | null> = {}
    for (const [k, v] of Object.entries(item.fields)) {
      if (v === null) patch[k] = null
      else if (typeof v === 'string' || typeof v === 'number') patch[k] = v
      else throw new ToolError('bad_input', `issues.${item.ref}.fields.${k}: must be a string, a number, or null.`)
    }
    props.fields = patch
    any = true
  }
  return any ? props : undefined
}

function resolveParent(parent: string | null | undefined, refToId: Map<string, string>, refs: Set<string>, issues: readonly Issue[]): string | null {
  if (parent === undefined || parent === null) return null
  if (refs.has(parent)) {
    const id = refToId.get(parent)
    if (id) return id
  }
  if (liveById(issues, parent)) return parent
  throw new ToolError('refused', NO_ISSUE)
}

function parseSet(set: Record<string, unknown>): IssueProps {
  const keys = Object.keys(set)
  if (!keys.length) throw new ToolError('bad_input', 'set: at least one path.')
  const props: IssueProps = {}
  const fields: Record<string, FieldValue | null> = {}
  for (const k of keys) {
    if (k === 'title') {
      if (typeof set[k] !== 'string') throw new ToolError('bad_input', 'title: must be a string.')
      props.title = set[k]
      continue
    }
    if (k === 'status') {
      const v = set[k]
      if (typeof v !== 'string' || !(STATUSES as readonly string[]).includes(v)) throw new ToolError('bad_input', 'status: must be a known status.')
      props.status = v as Status
      continue
    }
    if (k === 'assignee' || k === 'start' || k === 'due') {
      const v = set[k]
      if (v !== null && typeof v !== 'string') throw new ToolError('bad_input', `${k}: must be a string or null.`)
      props[k] = v
      continue
    }
    if (k.startsWith('fields.')) {
      const fieldId = k.slice('fields.'.length)
      if (!FIELD_ID.test(fieldId)) throw new ToolError('bad_input', 'set: only title, status, assignee, start, due, and fields.<fieldId>.')
      const v = set[k]
      if (v !== null && typeof v !== 'string' && typeof v !== 'number') throw new ToolError('bad_input', `${k}: must be a string, a number, or null.`)
      fields[fieldId] = v as FieldValue | null
      continue
    }
    throw new ToolError('bad_input', 'set: only title, status, assignee, start, due, and fields.<fieldId>.')
  }
  if (Object.keys(fields).length) props.fields = fields
  return props
}

export const roadmapWriteTools = [
  tool<{ roadmapId: string; request: string; issues: CreateItem[] }>({
    name: 'create_issues',
    title: 'Create issues',
    group: 'roadmaps',
    scope: 'roadmap',
    annotations: WRITE,
    description: 'Add one or more issues in a single transaction. Each item needs a unique ref (your key for this call), a title, and optionally status, assignee, start, due, field values, and parent (an existing issue id or another item\'s ref). Sub-issues do not inherit field values unless you set them. Returns created refs with issue ids and keys.',
    input: {
      type: 'object',
      additionalProperties: false,
      required: ['roadmapId', 'issues', 'request'],
      properties: {
        roadmapId: { type: 'string' },
        request: { type: 'string' },
        issues: { type: 'array', items: CREATE_ITEM },
      },
    },
    run: async (ctx: ToolContext, { issues, request }) => {
      requireRequest(request)
      if (issues.length < 1) throw new ToolError('bad_input', 'issues: at least one.')
      const { roadmap, issues: live } = loaded(ctx)
      const refs = new Set<string>()
      for (const item of issues) {
        if (!REF.test(item.ref) || refs.has(item.ref)) throw new ToolError('bad_input', 'ref: each ref is used once.')
        if (liveById(live, item.ref)) throw new ToolError('bad_input', 'ref: already an issue id.')
        refs.add(item.ref)
      }
      const refToId = new Map(issues.map((item) => [item.ref, newIssueId()]))
      const ordered = orderCreates(issues, refs)
      const base = roadmap.nextNumber
      const orderIndex = new Map(ordered.map((item, i) => [item.ref, i]))
      const idForRef = (ref: string) => {
        const id = refToId.get(ref)
        if (!id) throw new ToolError('bad_input', 'ref: each ref is used once.')
        return id
      }
      const createOp = {
        op: 'create' as const,
        issues: ordered.map((item) => {
          const p = propsFromCreate(item)
          return {
            id: idForRef(item.ref),
            parentId: resolveParent(item.parent, refToId, refs, live),
            title: item.title,
            inheritFields: false as const,
            ...(p ? { props: p } : {}),
          }
        }),
      }
      const created = issues.map((item) => {
        const id = idForRef(item.ref)
        const n = base + (orderIndex.get(item.ref) ?? 0)
        return { ref: item.ref, issueId: id, key: keyOf(roadmap, { number: n }) }
      })
      return { result: { created }, roadmapOp: createOp }
    },
  }),

  tool<{ roadmapId: string; issueId: string; set: Record<string, unknown>; request: string }>({
    name: 'update_issue',
    title: 'Update an issue',
    group: 'roadmaps',
    scope: 'roadmap',
    annotations: DESTRUCTIVE,
    description: 'Change paths on one live issue: title, status, assignee, start, due, or fields.<fieldId>. Body is not a path on this tool. Parent and order go through move_issue. Pass the user\'s own words as request. Refused paths return the same sentences as the editor.',
    input: {
      type: 'object',
      additionalProperties: false,
      required: ['roadmapId', 'issueId', 'set', 'request'],
      properties: {
        roadmapId: { type: 'string' },
        issueId: { type: 'string' },
        set: { type: 'object', additionalProperties: true },
        request: { type: 'string' },
      },
    },
    run: async (ctx, { issueId, set, request }) => {
      requireRequest(request)
      const { issues } = loaded(ctx)
      if (!liveById(issues, issueId)) throw new ToolError('refused', NO_ISSUE)
      const props = parseSet(set as Record<string, unknown>)
      return { result: {}, roadmapOp: { op: 'set', ids: [issueId], props } }
    },
  }),
]