import { checkFieldDefs, checkFieldPatch, isIsoDate, pruneInvalidFieldValues, stripField } from './fields.js'
import type { FieldDef, FieldValue, Issue, IssueEvent, RoadmapState, Status } from './types.js'
import { MAX_TITLE, STATUSES } from './types.js'
import { canParent, issueTree, siblingKey, subtree } from './tree.js'

export type IssueProps = Partial<Pick<Issue, 'title' | 'status' | 'assignee' | 'start' | 'due'>> & {
  fields?: Record<string, FieldValue | null>
}

export type RoadmapOp =
  | { op: 'create'; issues: { id: string; parentId: string | null; title: string; after?: string; props?: IssueProps }[] }
  | { op: 'set'; ids: string[]; props: IssueProps }
  | { op: 'move'; id: string; parentId: string | null; before?: string; after?: string }
  | { op: 'delete'; ids: string[] }
  | { op: 'restore'; ids: string[] }
  | { op: 'roadmap'; name?: string; fields?: FieldDef[] }
  | { op: 'duplicate'; copies: { id: string; sourceId: string }[] }

export interface OpCtx {
  by: string
  byClient: string
  now: number
  members: string[]
}

export type OpResult = { state: RoadmapState; changed: Issue[]; events: IssueEvent[] } | { refused: string }

const clone = (s: RoadmapState): RoadmapState => ({
  roadmap: { ...s.roadmap, fields: s.roadmap.fields.map((f) => ({ ...f, options: f.options?.map((o) => ({ ...o })) })) },
  issues: s.issues.map((i) => ({ ...i, fields: { ...i.fields } })),
})

const isStatus = (v: unknown): v is Status => typeof v === 'string' && (STATUSES as readonly string[]).includes(v)

function ev(ctx: OpCtx, what: IssueEvent['what'], issueId: string | null, changes: IssueEvent['changes']): IssueEvent {
  return { issueId, by: ctx.by, byClient: ctx.byClient, at: ctx.now, what, changes }
}

function validateDate(v: string | null): 'ok' | string {
  if (v === null) return 'ok'
  if (!isIsoDate(v)) return 'Dates must be YYYY-MM-DD.'
  return 'ok'
}

function validateDates(start: string | null, due: string | null): 'ok' | string {
  const a = validateDate(start)
  if (a !== 'ok') return a
  const b = validateDate(due)
  if (b !== 'ok') return b
  if (start !== null && due !== null && start > due) return 'Start must be before due.'
  return 'ok'
}

function validateAssignee(assignee: string | null, members: string[]): 'ok' | string {
  if (assignee !== null && !members.includes(assignee)) return 'Assignee must be someone in this workspace.'
  return 'ok'
}

function applyProps(
  target: Issue,
  props: IssueProps,
  defs: FieldDef[],
  members: string[],
): { issue: Issue; changes: IssueEvent['changes'] } | { refused: string } {
  const next = { ...target, fields: { ...target.fields } }
  const changes: IssueEvent['changes'] = []

  if (props.title !== undefined) {
    if (typeof props.title !== 'string') return { refused: 'Every issue needs a title.' }
    const title = props.title.trim()
    if (!title) return { refused: 'Every issue needs a title.' }
    if (title.length > MAX_TITLE) return { refused: `Titles are ${MAX_TITLE} characters at most.` }
    if (title !== target.title) {
      changes.push({ path: 'title', from: target.title, to: title })
      next.title = title
    }
  }
  if (props.status !== undefined) {
    if (!isStatus(props.status)) return { refused: 'Unknown status.' }
    if (props.status !== target.status) {
      changes.push({ path: 'status', from: target.status, to: props.status })
      next.status = props.status
    }
  }
  if (props.assignee !== undefined) {
    const v = validateAssignee(props.assignee, members)
    if (v !== 'ok') return { refused: v }
    if (props.assignee !== target.assignee) {
      changes.push({ path: 'assignee', from: target.assignee, to: props.assignee })
      next.assignee = props.assignee
    }
  }
  const start = props.start !== undefined ? props.start : next.start
  const due = props.due !== undefined ? props.due : next.due
  if (props.start !== undefined || props.due !== undefined) {
    const v = validateDates(start, due)
    if (v !== 'ok') return { refused: v }
    if (props.start !== undefined && props.start !== target.start) {
      changes.push({ path: 'start', from: target.start, to: props.start })
      next.start = props.start
    }
    if (props.due !== undefined && props.due !== target.due) {
      changes.push({ path: 'due', from: target.due, to: props.due })
      next.due = props.due
    }
  }
  if (props.fields) {
    const check = checkFieldPatch(defs, props.fields, members)
    if (check !== 'ok') return { refused: check }
    const merged = { ...next.fields }
    for (const [k, v] of Object.entries(props.fields)) {
      if (v === null) delete merged[k]
      else merged[k] = v
    }
    if (JSON.stringify(merged) !== JSON.stringify(target.fields)) {
      changes.push({ path: 'fields', from: target.fields, to: merged })
      next.fields = merged
    }
  }
  return { issue: next, changes }
}

function markedSubtree(issues: Issue[], rootId: string, mark: number): Issue[] {
  const marked = issues.filter((i) => i.deletedAt === mark)
  const out: Issue[] = []
  const walk = (id: string) => {
    const node = marked.find((i) => i.id === id)
    if (!node) return
    out.push(node)
    for (const c of marked.filter((i) => i.parentId === id)) walk(c.id)
  }
  walk(rootId)
  return out
}

function liveSubtree(issues: Issue[], rootId: string): Issue[] {
  const tree = issueTree(issues)
  const root = tree.get(rootId)
  if (!root || root.deletedAt !== null) return []
  const out: Issue[] = []
  const walk = (node: Issue) => {
    if (node.deletedAt !== null) return
    out.push(node)
    for (const c of tree.children(node.id)) walk(c)
  }
  walk(root)
  return out
}

function selectionRoots(copies: { sourceId: string }[], issues: Issue[]): string[] {
  const sourceIds = new Set(copies.map((c) => c.sourceId))
  const tree = issueTree(issues)
  const roots: string[] = []
  for (const sourceId of sourceIds) {
    const src = tree.get(sourceId)
    if (!src) continue
    if (src.parentId === null || !sourceIds.has(src.parentId)) roots.push(sourceId)
  }
  return roots
}

/** Mint ids for every live node under the selection roots before a duplicate op. */
export function buildDuplicateCopies(
  selected: Iterable<string>,
  issues: Issue[],
  mint: () => string,
): { id: string; sourceId: string }[] {
  const sourceIds = [...selected]
  if (!sourceIds.length) return []
  const stubs = sourceIds.map((sourceId) => ({ sourceId, id: '' }))
  const roots = selectionRoots(stubs, issues)
  const copies: { id: string; sourceId: string }[] = []
  for (const rootId of roots) {
    for (const node of liveSubtree(issues, rootId)) {
      copies.push({ id: mint(), sourceId: node.id })
    }
  }
  return copies
}

function issuesToRestore(all: Issue[], startId: string): Issue[] {
  const byId = new Map(all.map((i) => [i.id, i]))
  let cur = byId.get(startId)
  if (!cur?.deletedAt) return []
  const seen = new Set<string>()
  const out: Issue[] = []
  while (cur) {
    if (cur.deletedAt) {
      for (const n of markedSubtree(all, cur.id, cur.deletedAt)) {
        if (seen.has(n.id)) continue
        seen.add(n.id)
        out.push(n)
      }
    }
    cur = cur.parentId ? byId.get(cur.parentId) : undefined
  }
  return out
}

export function applyOp(s: RoadmapState, op: RoadmapOp, ctx: OpCtx): OpResult {
  const draft = clone(s)
  const changed = new Map<string, Issue>()
  const events: IssueEvent[] = []
  const seq = draft.roadmap.seq + 1

  const write = (row: Issue) => {
    const next = { ...row, seq, updatedAt: ctx.now }
    const idx = draft.issues.findIndex((i) => i.id === row.id)
    if (idx >= 0) draft.issues[idx] = next
    else draft.issues.push(next)
    changed.set(next.id, next)
    return next
  }

  const get = (id: string) => draft.issues.find((i) => i.id === id)

  if (op.op === 'create') {
    for (const row of op.issues) {
      const parentCheck = canParent(draft.issues, row.id, row.parentId)
      if (parentCheck !== 'ok') return { refused: parentCheck }
      if (get(row.id)) return { refused: 'That issue already exists.' }
      if (typeof row.title !== 'string') return { refused: 'Every issue needs a title.' }
      const title = row.title.trim()
      if (!title) return { refused: 'Every issue needs a title.' }
      if (title.length > MAX_TITLE) return { refused: `Titles are ${MAX_TITLE} characters at most.` }
      const parent = row.parentId ? get(row.parentId) : undefined
      if (row.parentId && !parent) return { refused: 'No such issue.' }
      let next: Issue = {
        id: row.id,
        number: draft.roadmap.nextNumber,
        parentId: row.parentId,
        sortKey: siblingKey(draft.issues, row.parentId, { after: row.after }),
        title,
        status: 'todo',
        assignee: null,
        start: null,
        due: null,
        fields: parent ? { ...parent.fields } : {},
        bodyRev: 0,
        seq,
        createdBy: ctx.by,
        createdAt: ctx.now,
        updatedAt: ctx.now,
        deletedAt: null,
      }
      if (row.props) {
        const applied = applyProps(next, row.props, draft.roadmap.fields, ctx.members)
        if ('refused' in applied) return applied
        next = applied.issue
      }
      write(next)
      draft.roadmap.nextNumber += 1
      events.push(ev(ctx, 'created', next.id, [{ path: 'title', from: null, to: next.title }]))
    }
  } else if (op.op === 'set') {
    for (const id of op.ids) {
      const target = get(id)
      if (!target || target.deletedAt !== null) return { refused: 'No such issue.' }
      const applied = applyProps(target, op.props, draft.roadmap.fields, ctx.members)
      if ('refused' in applied) return applied
      if (!applied.changes.length) continue
      write(applied.issue)
      events.push(ev(ctx, 'set', id, applied.changes))
    }
  } else if (op.op === 'move') {
    const target = get(op.id)
    if (!target || target.deletedAt !== null) return { refused: 'No such issue.' }
    const parentCheck = canParent(draft.issues, op.id, op.parentId)
    if (parentCheck !== 'ok') return { refused: parentCheck }
    const sortKey = siblingKey(draft.issues, op.parentId, { before: op.before, after: op.after }, op.id)
    write({ ...target, parentId: op.parentId, sortKey })
    events.push(
      ev(ctx, 'moved', op.id, [
        { path: 'parentId', from: target.parentId, to: op.parentId },
        { path: 'sortKey', from: target.sortKey, to: sortKey },
      ]),
    )
  } else if (op.op === 'delete') {
    const at = ctx.now
    const gone = new Set<string>()
    for (const id of op.ids) {
      const root = get(id)
      if (!root) return { refused: 'No such issue.' }
      if (root.deletedAt !== null || gone.has(id)) continue
      for (const node of subtree(draft.issues, id)) {
        if (gone.has(node.id)) continue
        gone.add(node.id)
        write({ ...node, deletedAt: at })
        events.push(ev(ctx, 'deleted', node.id, [{ path: 'deletedAt', from: null, to: at }]))
      }
    }
  } else if (op.op === 'restore') {
    const back = new Set<string>()
    for (const id of op.ids) {
      if (back.has(id)) continue
      const nodes = issuesToRestore(draft.issues, id)
      if (!nodes.length) return { refused: 'No such issue.' }
      for (const node of nodes) {
        if (back.has(node.id)) continue
        back.add(node.id)
        const live = get(node.id)
        if (live?.deletedAt === null) continue
        write({ ...node, deletedAt: null })
        events.push(ev(ctx, 'restored', node.id, [{ path: 'deletedAt', from: node.deletedAt, to: null }]))
      }
    }
  } else if (op.op === 'duplicate') {
    if (!op.copies.length) return { refused: 'Select an issue to duplicate.' }

    const bySource = new Map<string, string>()
    for (const { id, sourceId } of op.copies) {
      if (bySource.has(sourceId)) return { refused: 'Each copy needs its own id.' }
      bySource.set(sourceId, id)
    }

    const newIds = op.copies.map((c) => c.id)
    if (new Set(newIds).size !== newIds.length) return { refused: 'Each copy needs its own id.' }
    for (const id of newIds) {
      if (get(id)) return { refused: 'That issue already exists.' }
    }

    const sourceIds = new Set(bySource.keys())
    for (const sourceId of sourceIds) {
      const src = get(sourceId)
      const isRoot = !src?.parentId || !sourceIds.has(src.parentId)
      if (isRoot && (!src || src.deletedAt !== null)) return { refused: 'No such issue.' }
    }

    const roots = selectionRoots(op.copies, draft.issues).sort((a, b) => {
      const ia = get(a)!
      const ib = get(b)!
      if (ia.parentId !== ib.parentId) return ia.sortKey.localeCompare(ib.sortKey)
      return ia.sortKey.localeCompare(ib.sortKey)
    })

    for (const rootId of roots) {
      for (const node of liveSubtree(draft.issues, rootId)) {
        if (!bySource.has(node.id)) return { refused: 'Duplicate needs a new id for each issue.' }
      }
    }

    const tree = issueTree(draft.issues)
    const toCreate: Issue[] = []
    for (const rootId of roots) {
      toCreate.push(...liveSubtree(draft.issues, rootId))
    }

    let nextNum = draft.roadmap.nextNumber
    const dupRoots = new Set(roots)

    for (const source of toCreate) {
      const newId = bySource.get(source.id)!
      let parentId: string | null
      let sortKey: string

      if (dupRoots.has(source.id)) {
        parentId = source.parentId
        sortKey = siblingKey(draft.issues, parentId, { after: source.id })
      } else {
        const mappedParent = source.parentId ? bySource.get(source.parentId) : null
        if (!source.parentId || !mappedParent) {
          return { refused: 'Duplicate needs a new id for each issue.' }
        }
        parentId = mappedParent
        const srcSiblings = tree.children(source.parentId).filter((i) => i.deletedAt === null)
        const idx = srcSiblings.findIndex((s) => s.id === source.id)
        let after: string | undefined
        for (let j = idx - 1; j >= 0; j--) {
          const prevNew = bySource.get(srcSiblings[j].id)
          if (prevNew && draft.issues.some((i) => i.id === prevNew)) {
            after = prevNew
            break
          }
        }
        sortKey = siblingKey(draft.issues, parentId, after ? { after } : {})
      }

      const parentCheck = canParent(draft.issues, newId, parentId)
      if (parentCheck !== 'ok') return { refused: parentCheck }

      const next: Issue = {
        id: newId,
        number: nextNum,
        parentId,
        sortKey,
        title: source.title,
        status: source.status,
        assignee: source.assignee,
        start: source.start,
        due: source.due,
        fields: { ...source.fields },
        bodyRev: 0,
        seq,
        createdBy: ctx.by,
        createdAt: ctx.now,
        updatedAt: ctx.now,
        deletedAt: null,
      }
      nextNum += 1
      write(next)
      events.push(
        ev(ctx, 'created', newId, [
          { path: 'title', from: null, to: next.title },
          { path: 'duplicatedFrom', from: null, to: source.id },
        ]),
      )
    }
    draft.roadmap.nextNumber = nextNum
  } else if (op.op === 'roadmap') {
    if (op.fields !== undefined) {
      const check = checkFieldDefs(op.fields)
      if (check !== 'ok') return { refused: check }
      const oldIds = new Set(draft.roadmap.fields.map((f) => f.id))
      const newIds = new Set(op.fields.map((f) => f.id))
      for (const fieldId of oldIds) {
        if (newIds.has(fieldId)) continue
        for (const row of stripField(draft.issues, fieldId)) write(row)
      }
      draft.roadmap.fields = op.fields
      for (const row of pruneInvalidFieldValues(draft.issues, op.fields, ctx.members)) {
        const before = get(row.id)
        if (!before) continue
        write(row)
        events.push(ev(ctx, 'set', row.id, [{ path: 'fields', from: before.fields, to: row.fields }]))
      }
      events.push(ev(ctx, 'fields', null, [{ path: 'fields', from: s.roadmap.fields, to: op.fields }]))
    }
    if (op.name !== undefined) {
      if (typeof op.name !== 'string') return { refused: 'Every roadmap needs a name.' }
      const name = op.name.trim()
      if (!name) return { refused: 'Every roadmap needs a name.' }
      if (name !== draft.roadmap.name) {
        events.push(ev(ctx, 'set', null, [{ path: 'name', from: draft.roadmap.name, to: name }]))
        draft.roadmap.name = name
      }
    }
  }

  draft.roadmap.seq = seq
  return { state: draft, changed: [...changed.values()], events }
}
