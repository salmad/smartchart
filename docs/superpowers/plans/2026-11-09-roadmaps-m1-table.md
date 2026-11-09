# Roadmaps M1: roadmap page and table — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A workspace can hold roadmaps in its page tree; a roadmap holds issues nested to any depth with its own fields, shown and edited in a Linear-fast table with an issue panel and full page whose body is a doc.

**Architecture:** One pure engine (`src/engine/roadmaps/`) owns every rule: field validation, the issue tree, rollups, filtering/grouping, and `applyOp`, which turns one write into the new issues plus its events. The fake Db, the browser's local repo and the optimistic client all run `applyOp`; the SQL Db runs it on the rows it read and writes the result in one transaction. The client keeps the whole roadmap (no bodies) in memory and in `cache.ts`, applies each op at once, sends it in order, and polls "changes since seq".

**Tech Stack:** React 18 + TypeScript strict, Tailwind + shadcn/ui, lucide, Neon Postgres (`api/_lib/db.ts`), vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-09-roadmaps-design.md` (M1 = "Roadmap and table"). Mockup: `.superpowers/brainstorm/37137-1794152840/content/roadmap-views-v7.html` (table and issue panel only).

## Global Constraints

- No `any`, no inline styles, no file over ~300 lines; shadcn primitives (`npx shadcn@latest add <name>`), lucide icons, app tokens from `tailwind.config.js` (`app-bg`, `panel`, `raise`, `line`, `ink`, `ink-2`, `ink-3`, `ok`, `gold`, `bad`).
- Nothing in code or UI knows a field name (no Workstream, Country, Epic). Everything is an "issue".
- Statuses, fixed, in this order: `backlog`, `todo`, `in_progress`, `blocked`, `done`, `cancelled` (shown "Backlog", "To do", "In progress", "Blocked", "Done", "Cancelled").
- Field types: `choice` (one option: `{ id, name, emoji? }`), `text`, `number`, `date`, `person`. Values stored by field id and option id.
- Progress is never stored: over the issues with no sub-issues under a parent, Done 1, In progress 0.25, else 0, Cancelled left out; average.
- Issue depth at most 12 levels. Keys `PREFIX-n`, `n` never reused in a roadmap; the prefix is fixed after creation. URLs use ids.
- Colour means status or a problem only. Progress shows once (a bar on parents, number on hover).
- Property writes: last write wins per property. Body writes: refused when `bodyRev` moved (the doc editor's stale rule).
- Every action changes the screen at once and saves behind it; a failed save is undone on screen with a sentence. Views never call the server.
- Server routes go in `api/account.ts` (no new Vercel function). Ids: `rm_…`, `iss_…`.
- Checks warn; nothing silently rewrites data.

## Review Focus

1. **Two tabs editing the same issue.** Tab A sets status while tab B sets assignee: both land; tab A's screen shows B's assignee within one poll. Test in Task 6 (contract) and Task 9.
2. **A save that fails offline.** The status flips at once, the request fails, the status flips back and a sentence says why. Test in Task 9.
3. **Re-parenting under one's own child.** Refused with a sentence, nothing moves, also when sent straight to the API. Tests in Task 2 and Task 6.
4. **Deleting a field that issues use.** Values disappear from every issue in one write, the filter chip on that field drops, the table still renders. Tests in Task 3 and Task 5.
5. **Filtering a deep tree.** A matching grandchild shows with its parent and grandparent dimmed, never alone and never hidden by a collapsed ancestor. Test in Task 5.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/engine/roadmaps/types.ts` | `Status`, `FieldDef`, `FieldValue`, `Issue`, `Roadmap`, `IssueEvent`, `RoadmapState` |
| `src/engine/roadmaps/fields.ts` | validate field definitions and values; strip a deleted field |
| `src/engine/roadmaps/tree.ts` | issue tree: children, ancestors, subtree, depth, `canParent`, sibling keys (reuses `keyBetween`) |
| `src/engine/roadmaps/rollup.ts` | progress, date span |
| `src/engine/roadmaps/ops.ts` | `RoadmapOp` and `applyOp` |
| `src/engine/roadmaps/view.ts` | filter chips, group, sort, flatten to table rows |
| `src/engine/pages/tree.ts` | `PageKind` gains `'roadmap'` |
| `api/_lib/db-roadmaps.ts` | SQL calls; `api/_lib/db.ts` gets the schema and `Db` methods |
| `api/_lib/roadmaps.ts` | the HTTP handler |
| `tests/unit/fake-db-roadmaps.ts` | the fake's roadmap calls |
| `src/app/roadmaps.ts` | `RoadmapRepo`: remote and local |
| `src/app/roadmap-store.ts` | framework-free client store: cache paint, poll, optimistic ops |
| `src/app/components/roadmap/*` | screen, table, cells, Display, filters, fields editor, issue panel/page |

---

### Task 1: Types and fields

**Files:**
- Create: `src/engine/roadmaps/types.ts`, `src/engine/roadmaps/fields.ts`
- Test: `tests/unit/roadmap-fields.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export const STATUSES = ['backlog','todo','in_progress','blocked','done','cancelled'] as const
  export type Status = typeof STATUSES[number]
  export const STATUS_LABEL: Record<Status, string>
  export type FieldType = 'choice' | 'text' | 'number' | 'date' | 'person'
  export interface FieldOption { id: string; name: string; emoji?: string }
  export interface FieldDef { id: string; name: string; type: FieldType; options?: FieldOption[] }
  export type FieldValue = string | number            // option id, text, number, ISO date, user id
  export interface Issue { id: string; number: number; parentId: string | null; sortKey: string; title: string; status: Status;
    assignee: string | null; start: string | null; due: string | null; fields: Record<string, FieldValue>; bodyRev: number;
    seq: number; createdBy: string; createdAt: number; updatedAt: number; deletedAt: number | null }
  export interface Roadmap { id: string; workspaceId: string; name: string; prefix: string; fields: FieldDef[]; nextNumber: number; seq: number }
  export interface IssueEvent { issueId: string | null; by: string; byClient: string; at: number;
    what: 'created' | 'set' | 'moved' | 'commented' | 'deleted' | 'restored' | 'fields'; changes: { path: string; from: unknown; to: unknown }[] }
  export interface RoadmapState { roadmap: Roadmap; issues: Issue[] }   // issues without body or comments
  export interface IssueComment { id: string; by: string; text: string; at: number; replyTo?: string }
  export const MAX_DEPTH = 12, MAX_FIELDS = 30, MAX_OPTIONS = 100, MAX_TITLE = 300
  export const PREFIX = /^[A-Z][A-Z0-9]{1,5}$/
  // fields.ts
  export function checkFieldDefs(defs: FieldDef[]): 'ok' | string
  export function checkValue(def: FieldDef, v: unknown): 'ok' | string
  export function checkValues(defs: FieldDef[], values: Record<string, unknown>): 'ok' | string
  export function stripField(issues: Issue[], fieldId: string): Issue[]          // issues that had a value, without it
  export const keyOf: (r: Roadmap, i: Pick<Issue, 'number'>) => string        // "SME-142"
  ```

- [ ] **Step 1: Write the failing tests**

```ts
it('refuses duplicate field names, a choice without options and unknown types', () => {
  expect(checkFieldDefs([{ id: 'f1', name: 'Country', type: 'choice', options: [{ id: 'o1', name: 'UK' }] }])).toBe('ok')
  expect(checkFieldDefs([{ id: 'f1', name: 'A', type: 'text' }, { id: 'f2', name: 'a', type: 'text' }])).toMatch(/already/)
  expect(checkFieldDefs([{ id: 'f1', name: 'Country', type: 'choice', options: [] }])).toMatch(/option/)
})
it('checks a value against its field', () => {
  const country: FieldDef = { id: 'f1', name: 'Country', type: 'choice', options: [{ id: 'o1', name: 'UK' }] }
  expect(checkValue(country, 'o1')).toBe('ok')
  expect(checkValue(country, 'o9')).toMatch(/Country/)
  expect(checkValue({ id: 'f2', name: 'Size', type: 'number' }, '3')).toMatch(/number/)
  expect(checkValue({ id: 'f3', name: 'Go-live', type: 'date' }, '2026-13-01')).toMatch(/date/)
  expect(checkValues([country], { f9: 'x' })).toMatch(/No such field/)
})
it('strips a deleted field from every issue that used it', () => {
  const out = stripField([issue({ id: 'a', fields: { f1: 'o1', f2: 3 } }), issue({ id: 'b', fields: {} })], 'f1')
  expect(out.map((i) => [i.id, i.fields])).toEqual([['a', { f2: 3 }]])
})
it('makes readable keys', () => expect(keyOf(roadmap({ prefix: 'SME' }), { number: 142 })).toBe('SME-142'))
```

`issue()` and `roadmap()` are builders in `tests/unit/roadmap-builders.ts` (create it here; later tasks reuse it).

- [ ] **Step 2:** `npx vitest run tests/unit/roadmap-fields.test.ts` → FAIL (module not found).
- [ ] **Step 3:** Implement `types.ts` and `fields.ts`. Sentences name the field ("Country has no option “o9”."). Field names are compared case-insensitively and trimmed.
- [ ] **Step 4:** Re-run → PASS.
- [ ] **Step 5:** Commit `Roadmaps engine: types and field checks.`

---

### Task 2: Issue tree and rollups

**Files:**
- Create: `src/engine/roadmaps/tree.ts`, `src/engine/roadmaps/rollup.ts`
- Test: `tests/unit/roadmap-tree.test.ts`

**Interfaces:**
- Consumes: Task 1 types; `keyBetween` from `src/engine/pages/tree.ts`.
- Produces:
  ```ts
  export interface IssueTree { roots: Issue[]; children(id: string | null): Issue[]; get(id: string): Issue | undefined }
  export function issueTree(issues: Issue[]): IssueTree          // live issues only, siblings by sortKey then id
  export function ancestors(issues: Issue[], id: string): Issue[] // nearest first
  export function subtree(issues: Issue[], id: string): Issue[]   // the issue and everything below, live only
  export function canParent(issues: Issue[], id: string, parentId: string | null): 'ok' | string
  export function siblingKey(issues: Issue[], parentId: string | null, slot: { before?: string; after?: string }, moving?: string): string
  export function progress(issues: Issue[], id: string): number | null   // 0..1; null when everything under it is Cancelled
  export function dateSpan(issues: Issue[], id: string): { start: string | null; due: string | null } // own dates, else children's span
  ```

- [ ] **Step 1: Write the failing tests**

```ts
const t = [issue({ id: 'u', parentId: null }), issue({ id: 'f', parentId: 'u' }),
  issue({ id: 'a', parentId: 'f', status: 'done' }), issue({ id: 'b', parentId: 'f', status: 'done' }), issue({ id: 'c', parentId: 'f', status: 'in_progress' }),
  issue({ id: 'x', parentId: 'u', status: 'cancelled' })]
it('rolls progress over the issues with no sub-issues, Linear-style', () => {
  expect(progress(t, 'f')).toBeCloseTo(0.75)
  expect(progress(t, 'u')).toBeCloseTo(0.75)       // x is Cancelled: left out
  expect(progress(t, 'a')).toBe(1)
  expect(progress([issue({ id: 'z', status: 'cancelled' })], 'z')).toBeNull()
})
it('refuses a parent inside its own subtree, a missing parent, and depth over 12', () => {
  expect(canParent(t, 'u', 'a')).toMatch(/inside itself/)
  expect(canParent(t, 'a', 'nope')).toMatch(/No such issue/)
  expect(canParent(chain(12), 'leaf-extra', 'n12')).toMatch(/12 levels/)   // chain(n): n nested issues n1..n12
  expect(canParent(t, 'c', null)).toBe('ok')
})
it('takes the children’s span when a parent has no dates', () => {
  const d = [issue({ id: 'p' }), issue({ id: 'k1', parentId: 'p', start: '2026-11-02', due: '2026-12-01' }), issue({ id: 'k2', parentId: 'p', start: '2026-11-20', due: '2027-02-26' })]
  expect(dateSpan(d, 'p')).toEqual({ start: '2026-11-02', due: '2027-02-26' })
  expect(dateSpan([...d.slice(1), issue({ id: 'p', start: '2026-10-01', due: '2026-10-31' })], 'p')).toEqual({ start: '2026-10-01', due: '2026-10-31' })
})
it('ignores deleted issues everywhere', () => expect(issueTree([...t, issue({ id: 'd', parentId: 'u', deletedAt: 1 })]).children('u').map((i) => i.id)).toEqual(['f', 'x']))
```

- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement. Sentences: `'No such issue.'`, `'An issue can’t go inside itself or its sub-issues.'`, `` `Issues nest ${MAX_DEPTH} levels deep at most.` `` (export them as `NO_ISSUE`, `ISSUE_CYCLE`, `ISSUE_TOO_DEEP`).
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `Roadmaps engine: issue tree and rollups.`

---

### Task 3: Ops

**Files:**
- Create: `src/engine/roadmaps/ops.ts`
- Test: `tests/unit/roadmap-ops.test.ts`

**Interfaces:**
- Consumes: Tasks 1–2.
- Produces:
  ```ts
  export type IssueProps = Partial<Pick<Issue, 'title' | 'status' | 'assignee' | 'start' | 'due'>> & { fields?: Record<string, FieldValue | null> }
  export type RoadmapOp =
    | { op: 'create'; issues: { id: string; parentId: string | null; title: string; after?: string; props?: IssueProps }[] }
    | { op: 'set'; ids: string[]; props: IssueProps }                       // one or many (bulk)
    | { op: 'move'; id: string; parentId: string | null; before?: string; after?: string }
    | { op: 'delete'; ids: string[] }                                       // each with its subtree
    | { op: 'restore'; ids: string[] }
    | { op: 'roadmap'; name?: string; fields?: FieldDef[] }                 // rename, or replace field definitions
  export interface OpCtx { by: string; byClient: string; now: number; members: string[] }   // members: user ids allowed as assignee/person
  export type OpResult = { state: RoadmapState; changed: Issue[]; events: IssueEvent[] } | { refused: string }
  export function applyOp(s: RoadmapState, op: RoadmapOp, ctx: OpCtx): OpResult
  ```
  `changed` holds every issue whose row must be written; `state.roadmap.seq` is bumped by 1 and each changed issue gets that `seq`. Body and comments are not ops (Task 6 writes them directly).

- [ ] **Step 1: Write the failing tests**

```ts
it('numbers new issues and copies the parent’s field values once', () => {
  const s = state({ prefix: 'SME', nextNumber: 142, fields: [country] }, [issue({ id: 'p', fields: { f1: 'uk' } })])
  const r = ok(applyOp(s, { op: 'create', issues: [{ id: 'n', parentId: 'p', title: 'Send RFP' }] }, ctx))
  expect(r.state.issues.find((i) => i.id === 'n')).toMatchObject({ number: 142, fields: { f1: 'uk' }, status: 'todo' })
  expect(r.state.roadmap.nextNumber).toBe(143)
  expect(r.events[0]).toMatchObject({ issueId: 'n', what: 'created' })
})
it('sets properties on many issues in one op, one event each, logging from and to', () => {
  const r = ok(applyOp(twoIssues, { op: 'set', ids: ['a', 'b'], props: { status: 'done' } }, ctx))
  expect(r.events.map((e) => e.changes)).toEqual([[{ path: 'status', from: 'todo', to: 'done' }], [{ path: 'status', from: 'todo', to: 'done' }]])
})
it('refuses what the rules refuse, changing nothing', () => {
  expect(applyOp(s, { op: 'set', ids: ['a'], props: { fields: { f1: 'nope' } } }, ctx)).toEqual({ refused: expect.stringMatching(/Country/) })
  expect(applyOp(s, { op: 'set', ids: ['a'], props: { assignee: 'stranger' } }, ctx)).toEqual({ refused: expect.stringMatching(/workspace/) })
  expect(applyOp(s, { op: 'move', id: 'u', parentId: 'a' }, ctx)).toEqual({ refused: ISSUE_CYCLE })
  expect(applyOp(s, { op: 'set', ids: ['a'], props: { start: '2026-12-01', due: '2026-11-01' } }, ctx)).toEqual({ refused: expect.stringMatching(/before/) })
})
it('deletes a subtree and restores it', () => {
  const d = ok(applyOp(tree3, { op: 'delete', ids: ['f'] }, ctx))
  expect(d.changed.map((i) => i.id).sort()).toEqual(['a', 'b', 'c', 'f'])
  expect(ok(applyOp(d.state, { op: 'restore', ids: ['f'] }, ctx)).state.issues.every((i) => i.deletedAt === null)).toBe(true)
})
it('deleting a field definition strips its values in the same op', () => {
  const r = ok(applyOp(s, { op: 'roadmap', fields: [] }, ctx))
  expect(r.state.issues.every((i) => !('f1' in i.fields))).toBe(true)
  expect(r.events[0]).toMatchObject({ issueId: null, what: 'fields' })
})
```

- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement. Creating many issues at once may name parents created earlier in the same op. `set` with `fields: { f1: null }` removes a value. Restore brings back the subtree deleted at the same `deletedAt`. A set that changes nothing returns no event and no changed issue.
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `Roadmaps engine: ops.`

---

### Task 4: Roadmap as a page kind, and the schema

**Files:**
- Modify: `src/engine/pages/tree.ts` (`PageKind`), `api/_lib/pages.ts` (`pageRef` accepts `'roadmap'`), `api/_lib/db-decks.ts` (every place that unions `decks` and `docs`: `listPages`, `movePage` (incl. cross-workspace and the recursive cycle check), `nodesIn`, `deleteTree`, `countSubpages`, `TABLE`), `api/_lib/db.ts` (`SCHEMA`), `src/app/components/sidebar/pageTree.ts` (valid kinds), `tests/unit/fake-db.ts`, `tests/unit/db-sql.test.ts` (`TABLES` += `roadmaps`, `issues`, `issue_events`)
- Test: `tests/unit/db-contract.ts`

**Interfaces:**
- Produces: `Db.createRoadmap` and `Db.deleteRoadmap` (signatures under Task 6); `PageKind = 'deck' | 'doc' | 'roadmap'`; `PageSummary.slides` is null for a roadmap. One helper in `db-decks.ts`, `PAGES_SQL` (the union of the three tables as `kind, id, workspace_id, parent_kind, parent_id, sort_key, name, updated_at`), used by every query above, so a fourth kind later is one line.
- Schema (append to `SCHEMA`):
  ```sql
  create table if not exists roadmaps (id text primary key, workspace_id text not null, user_id text not null, name text not null,
    prefix text not null, fields jsonb not null default '[]', next_number integer not null default 1, seq bigint not null default 0,
    parent_kind text, parent_id text, sort_key text, share_id text, updated_at timestamptz not null default now())
  create table if not exists issues (id text primary key, roadmap_id text not null, number integer not null, parent_id text, sort_key text not null,
    title text not null, status text not null, assignee text, start_date date, due_date date, body text not null default '', body_rev integer not null default 0,
    fields jsonb not null default '{}', comments jsonb not null default '[]', seq bigint not null, created_by text not null,
    created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz)
  create unique index if not exists issues_number on issues (roadmap_id, number)
  create index if not exists issues_parent on issues (roadmap_id, parent_id)
  create index if not exists issues_seq on issues (roadmap_id, seq)
  create index if not exists issues_fields on issues using gin (fields)
  create table if not exists issue_events (roadmap_id text not null, issue_id text, user_id text not null, by_client text not null,
    seq bigint not null, at timestamptz not null default now(), what text not null, changes jsonb not null default '[]')
  create index if not exists issue_events_seq on issue_events (roadmap_id, seq)
  ```

- [ ] **Step 1: Write the failing contract tests** (in `dbContract`, so the fake and SQL both run them): a roadmap created in ann's workspace appears in `listPages` with `kind: 'roadmap'`; a doc moves under it; `countSubpages(roadmap)` is 1; `canMove` refuses the roadmap under that doc (cycle); `deleteRoadmap` removes the doc too. (`createRoadmap` and `deleteRoadmap` are built in this task, fake and SQL, with the signatures listed under Task 6.)
- [ ] **Step 2:** `npx vitest run tests/unit/db-fake.test.ts` → FAIL.
- [ ] **Step 3:** Make the changes above. Sidebar and app code that switches on kind stays compiling by treating unknown kinds as before (TypeScript will list every switch; handle `'roadmap'` in each, routing to `/r/:id`).
- [ ] **Step 4:** Run the fake suite → PASS; `npm run build` → no type errors. With `TEST_DATABASE_URL` set, `npx vitest run tests/unit/db-sql.test.ts` → PASS.
- [ ] **Step 5:** Commit `Roadmaps: a page kind in the one tree, and the schema.`

---

### Task 5: Table view model

**Files:**
- Create: `src/engine/roadmaps/view.ts`
- Test: `tests/unit/roadmap-view.test.ts`

**Interfaces:**
- Consumes: Tasks 1–2.
- Produces:
  ```ts
  export type Chip =
    | { on: 'status'; is: boolean; values: Status[] }
    | { on: 'assignee'; is: boolean; values: (string | null)[] }
    | { on: 'field'; field: string; is: boolean; values: (string | null)[] }    // null = empty
    | { on: 'dates'; when: 'overdue' | 'before' | 'after'; date?: string }
  export interface ViewSettings { chips: Chip[]; groupBy: { on: 'status' | 'assignee' } | { on: 'field'; field: string } | null;
    sort: 'order' | 'due' | 'start' | 'status' | 'updated'; columns: string[]; collapsed: string[] }
  export interface TableRow { kind: 'group'; key: string; label: string; count: number; progress: number | null }
    | { kind: 'issue'; issue: Issue; depth: number; dim: boolean; hasChildren: boolean; open: boolean }
  export function tableRows(s: RoadmapState, v: ViewSettings, today: string): TableRow[]
  export function liveChips(defs: FieldDef[], chips: Chip[]): Chip[]   // drops chips on fields or options that no longer exist
  export const DEFAULT_VIEW: ViewSettings
  ```
  AND between chips. Grouping applies to the top-most issue shown in each tree; its children follow it whatever their own value. A collapsed issue hides its children unless a child matches the filter.

- [ ] **Step 1: Write the failing tests** for: a matching grandchild returns grandparent and parent with `dim: true` and itself `dim: false`; grouping by a field puts a child under its parent's group; `is: false` with `[null]` means "is not empty"; `overdue` excludes Done and Cancelled; `liveChips` drops a chip whose field was deleted; sort `due` orders siblings only, never breaking the tree; group rows carry count and `progress`.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `Roadmaps engine: filters, grouping and table rows.`

---

### Task 6: Db calls

**Files:**
- Create: `api/_lib/db-roadmaps.ts`, `tests/unit/fake-db-roadmaps.ts`
- Modify: `api/_lib/db.ts` (add calls to `Db`, spread `roadmapCalls(q, tx)` into `makeDb`), `tests/unit/fake-db.ts`
- Test: `tests/unit/db-contract.ts`

**Interfaces:**
- Consumes: Tasks 1–4.
- Produces (on `Db`):
  ```ts
  createRoadmap(userId: string, r: { id: string; name: string; prefix: string; workspaceId: string; parent?: PageRef }): Promise<'ok' | 'foreign' | string>
  getRoadmap(userId: string, id: string): Promise<(RoadmapState & { role: Role; members: MemberLite[] }) | null>
  roadmapChanges(userId: string, id: string, since: number): Promise<{ seq: number; roadmap: Roadmap | null; issues: Issue[]; events: IssueEvent[] } | null>
  writeRoadmap(userId: string, id: string, op: RoadmapOp, byClient: string): Promise<{ seq: number; changed: Issue[] } | 'foreign' | string>
  getIssueDetail(userId: string, id: string, issueId: string): Promise<{ body: string; bodyRev: number; comments: IssueComment[]; events: IssueEvent[] } | null>
  putIssueBody(userId: string, id: string, issueId: string, body: string, baseRev: number): Promise<{ bodyRev: number; seq: number } | 'conflict' | 'foreign' | string>
  addIssueComment(userId: string, id: string, issueId: string, c: IssueComment): Promise<IssueComment[] | 'foreign' | string>
  deleteRoadmap(userId: string, id: string): Promise<boolean>
  ```
  `MemberLite = { id: string; name: string; email: string }` (in `src/engine/roadmaps/types.ts`). Name the three return shapes there too: `LoadedRoadmap = RoadmapState & { role: Role; members: MemberLite[] }`, `Changes = { seq: number; roadmap: Roadmap | null; issues: Issue[]; events: IssueEvent[] }`, `IssueDetail = { body: string; bodyRev: number; comments: IssueComment[]; events: IssueEvent[] }` (`Role` is a string union in the engine, `'owner' | 'editor' | 'viewer'`, matching `api/_lib/access.ts`). `roadmapChanges` returns issues with `seq > since` (deleted ones included, so clients drop them), and the roadmap row when its own `seq` moved by a `roadmap` op.

- [ ] **Step 1: Write the failing contract tests**: create → get returns empty issues and ann as member; a viewer's `writeRoadmap` answers `'You can view this workspace, not change it.'`; bob (non-member) gets `'foreign'`; `create` then `set` by two users on different props of one issue both land; `roadmapChanges(since)` returns only issues written after `since`; a move into its own subtree is refused with `ISSUE_CYCLE`; deleting a field def strips values for all issues; `putIssueBody` with a stale `baseRev` answers `'conflict'`; `deleteRoadmap` removes issues and events.
- [ ] **Step 2:** Run the fake suite → FAIL.
- [ ] **Step 3:** Implement the fake with `applyOp` over in-memory rows. SQL: read the roadmap row and its live issues (no body/comments) with the role check in the query, run `applyOp`, then one `tx`: update the roadmap row `where seq = $read` (bump `seq`, `next_number`, `fields`, `name`), upsert `changed` issues, insert events. If the roadmap update touched no row (someone wrote in between), read again and retry, at most 3 times; then answer `'Busy, try again.'`. Writes to different properties of one issue both land because each retry re-applies the op to fresh rows.
- [ ] **Step 4:** Fake suite → PASS; SQL suite with `TEST_DATABASE_URL` → PASS.
- [ ] **Step 5:** Commit `Roadmaps: storage.`

---

### Task 7: HTTP route

**Files:**
- Create: `api/_lib/roadmaps.ts`
- Modify: `api/account.ts` (`roadmaps: roadmapsHandler(deps)`), `vercel.json` (`/api/roadmaps` → `/api/account?route=roadmaps`)
- Test: `tests/unit/roadmaps-api.test.ts`

**Interfaces:**
- Consumes: Task 6.
- Produces (all JSON; errors `{ error: sentence }`):
  - `GET /api/roadmaps?id=` → `RoadmapState & { role, members }` · `&since=<seq>` → changes · `&issue=<id>` → detail · `&subpages=1` → `{ count }`
  - `POST /api/roadmaps` `{ id, name, prefix, workspaceId, parent? }` → `{ ok: true }`
  - `POST /api/roadmaps?id=` `{ op: RoadmapOp }` → `{ seq, changed }` · `{ body: { issueId, text, baseRev } }` → `{ bodyRev, seq }` or 409 `{ error: DOC_STALE-like sentence }` · `{ comment: { issueId, text, replyTo? } }` → `{ comments }` · `{ move: ... }` → `movePage` from `pages.ts`
  - `DELETE /api/roadmaps?id=`
  Status codes as `docs.ts`: 401 signed out, 404 not readable, 403 viewer, 409 refused or stale, 400 malformed. The body text is validated with `parseDoc` and capped at 1,000,000 bytes like docs.

- [ ] **Step 1: Write the failing tests** with the fake Db, one per line above plus: a malformed op is 400 with a sentence; an op on a roadmap in another workspace is 404.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement; parse ops with a small guard per op kind (no `any`). **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `Roadmaps: API.`

---

### Task 8: App repo and local copy

**Files:**
- Create: `src/app/roadmaps.ts`
- Test: `tests/unit/roadmap-repo.test.ts`

**Interfaces:**
- Consumes: Task 7 wire format; `cache.ts`; `local-pages.ts` (`placeNew`, `removeBranch`) for the dev account.
- Produces:
  ```ts
  export interface RoadmapRepo {
    get(id: string): Promise<LoadedRoadmap | null>
    changes(id: string, since: number): Promise<Changes | null>
    write(id: string, op: RoadmapOp): Promise<{ seq: number } | string>   // string: why not
    detail(id: string, issueId: string): Promise<IssueDetail | null>
    putBody(id: string, issueId: string, text: string, baseRev: number): Promise<{ bodyRev: number } | 'stale' | string>
    comment(id: string, issueId: string, text: string, replyTo?: string): Promise<IssueComment[] | string>
    create(r: { id: string; name: string; prefix: string; workspaceId: string; parent?: PageRef | null }): Promise<string | null>
    remove(id: string): Promise<boolean>
    kept(id: string): Promise<LoadedRoadmap | null>               // the copy in this browser
    keep(id: string, r: LoadedRoadmap): void
  }
  export function remoteRoadmapRepo(o?: { fetcher?: typeof fetch; onSignedOut?: () => void; account?: string }): RoadmapRepo
  export function localRoadmapRepo(storage?: Pick<Storage, 'getItem' | 'setItem'>): RoadmapRepo   // dev account: applyOp over localStorage
  ```
  The remote repo keeps `roadmap:<id>` in `cache.ts` (as `cached-decks.ts` does) and drops it on `remove`. Offline, `write` answers the existing `OFFLINE` sentence from `workspaces.ts`.

- [ ] **Step 1: Write the failing tests**: remote `get` stores the copy and `kept` returns it; `write` maps 409 to its sentence; the local repo creates a roadmap, places it in the page tree (visible to `localPageRepo().list`), applies ops and survives a new repo over the same storage.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `Roadmaps: app repo and local copy.`

---

### Task 9: Client store (instant writes, live updates)

**Files:**
- Create: `src/app/roadmap-store.ts`, `src/app/components/roadmap/useRoadmap.ts` (thin `useSyncExternalStore` wrapper)
- Test: `tests/unit/roadmap-store.test.ts`

**Interfaces:**
- Consumes: Tasks 3, 8; `ordered()` from `src/app/optimistic.ts`.
- Produces:
  ```ts
  export interface RoadmapView { state: RoadmapState | null; role: Role | null; members: MemberLite[]; error: string | null; said: string | null }
  export function roadmapStore(repo: RoadmapRepo, id: string, ctx: { by: string; now: () => number }): {
    get(): RoadmapView; subscribe(fn: () => void): () => void
    open(): Promise<void>            // paint from kept copy, then changes since its seq (or get when none)
    act(op: RoadmapOp): 'ok' | string // applies at once; a refusal from applyOp is returned and nothing changes
    poll(): Promise<void>
    close(): void
  }
  export const POLL_MS = 5000
  ```
  Shown state = server state with every pending op re-applied on top (the `overlay` idea from `optimistic.ts`). When a send fails, its op is dropped, the state re-derives (so the screen undoes it) and `said` is the sentence. Server changes merge by issue id and `seq`; pending ops stay on top. The hook polls every `POLL_MS` while `document.visibilityState === 'visible'` and polls once on becoming visible.

- [ ] **Step 1: Write the failing tests** (fake repo with controllable promises): `act` changes `get().state` before the send resolves; a failed send restores the old status and sets `said`; a poll result with another user's assignee change keeps our pending status on top and shows their assignee; `open` with a kept copy shows it before `changes` resolves; two acts on one issue send in order.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `Roadmaps: instant writes and live updates.`

---

### Task 10: Route, sidebar and the empty roadmap screen

**Files:**
- Modify: `src/app/route.ts` (`{ name: 'roadmap'; id: string; issue?: string }` for `/r/:id` and `/r/:id/:issue`), `src/app/App.tsx` (screen pick, `openPage` for `'roadmap'`), `src/app/components/sidebar/{PageRow.tsx,PageTree.tsx,MovePicker.tsx,useRowActions.ts,Sidebar.tsx}` (glyph `GanttChart` from lucide; "Roadmap" in the add menus; delete via the repo)
- Create: `src/app/components/roadmap/{RoadmapScreen.tsx,NewRoadmap.tsx,TopBar.tsx}`
- Test: `tests/browser/roadmap.spec.ts`

**Interfaces:**
- Consumes: Tasks 8–9.
- Produces: `RoadmapScreen({ id, issue, repo, account, workspace })`. `NewRoadmap` asks for a name and a prefix (suggested from the name's initials, uppercase, 2–6 chars, checked with `PREFIX`). Top bar: crumbs as docs have them, tab "Table" only (other tabs arrive with their milestones), Display, New issue. Empty roadmap copy, one sentence: "No issues yet. Press C or New issue to add the first." Add fields from the header's "Fields" button (Task 11).

- [ ] **Step 1: Write the failing browser test**: dev account → sidebar "New" → Roadmap → name "SME credit launch" → prefix shows `SCL` → create → URL `/r/rm_…`, sidebar row with the roadmap icon, empty sentence visible; reload shows the same.
- [ ] **Step 2:** `npx playwright test tests/browser/roadmap.spec.ts` → FAIL. **Step 3:** Implement. **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `Roadmaps: page in the sidebar and an empty screen.`

---

### Task 11: Fields editor

**Files:**
- Create: `src/app/components/roadmap/FieldsEditor.tsx` (shadcn `dialog`), `FieldOptions.tsx`
- Test: `tests/browser/roadmap.spec.ts`

**Interfaces:**
- Consumes: `act({ op: 'roadmap', fields })`, `checkFieldDefs`.
- Produces: add, rename, reorder (drag handle and ↑/↓ keys), delete fields; for a choice field add, rename, reorder, delete options and an optional emoji. Deleting a field or option that issues use says how many issues lose the value before it applies. Changes apply one at a time (each an op), no Save button.

- [ ] **Step 1: Write the failing browser test**: add choice field "Country" with options 🇬🇧 UK and 🇫🇷 France; a "Country" column appears in the table header; delete "France" after a confirm naming 0 issues.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `Roadmaps: fields editor.`

---

### Task 12: Table — reading, filters, Display

**Files:**
- Create: `src/app/components/roadmap/{IssueTable.tsx,IssueRow.tsx,StatusGlyph.tsx,ProgressBar.tsx,FilterBar.tsx,FilterChip.tsx,DisplayMenu.tsx,useViewSettings.ts}`
- Test: `tests/browser/roadmap.spec.ts`

**Interfaces:**
- Consumes: `tableRows`, `liveChips`, `DEFAULT_VIEW`, `progress`, `keyOf`.
- Produces: `useViewSettings(roadmapId): [ViewSettings, (v: ViewSettings) => void]`, kept in the URL query (`?v=` base64url JSON) and in `localStorage` under `roadmap-view:<id>`, URL first. Row height 34px, glyphs as the v7 mockup (outline, half, filled tick, red Blocked). Progress column: bar on parents only, number in a tooltip. Group headers: name, count, bar. Virtualise rows beyond 200 (builder's choice of method, no new dependency).

- [ ] **Step 1: Write the failing browser test**: seed 6 issues through the repo (helper in the spec file) in two trees; nested rows show; collapsing a parent hides its children; chip "Status is not Done" hides Done rows; a deep match shows its ancestors dimmed; group by Country shows group headers with counts; reload keeps chips and grouping.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `Roadmaps: the table, filters and Display.`

---

### Task 13: Table — editing, selection, keyboard, drag

**Files:**
- Create: `src/app/components/roadmap/{cells/StatusCell.tsx,cells/PersonCell.tsx,cells/DateCell.tsx,cells/FieldCell.tsx,useTableKeys.ts,useSelection.ts,useRowDrag.ts,BulkBar.tsx,UndoToast.tsx}`
- Test: `tests/browser/roadmap.spec.ts`

**Interfaces:**
- Consumes: `act`, `siblingKey`, `canParent`.
- Produces: every cell edits in place through shadcn `popover` + `command` (status, person, choice) or a date input; Enter on a row opens the panel; `c` creates an issue under the focused row's parent (`⇧C`: as its child); ↑/↓ move focus; `x`/click/shift-click/⌘A select; with a selection, `BulkBar` sets status, assignee or any choice field for all, or deletes. Delete says how many sub-issues go with it, applies at once, and `UndoToast` (shadcn `sonner`, added with `npx shadcn@latest add sonner`) offers Undo for 8 s (sends `restore`). Drag a row to reorder; drop on a row's middle third to re-parent; a refused drop snaps back with the sentence.

- [ ] **Step 1: Write the failing browser test**: change a status from the cell and see the glyph change before the network settles (route the API through `page.route` with a 1 s delay); press `c`, type a title, Enter → new row `SCL-1`; select two rows, set status Done in the bulk bar; delete a parent with 2 sub-issues, see "and 2 sub-issues", Undo brings all three back; with the API failing (`page.route` → 500), a status change flips back and the sentence shows.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `Roadmaps: edit in place, select many, keyboard, drag.`

---

### Task 14: Issue panel and full page

**Files:**
- Create: `src/app/components/roadmap/{IssuePanel.tsx,IssuePage.tsx,IssueProperties.tsx,IssueBody.tsx,SubIssues.tsx,IssueActivity.tsx}`
- Test: `tests/browser/roadmap.spec.ts`

**Interfaces:**
- Consumes: `repo.detail`, `repo.putBody`, `repo.comment`, `act`, `DocEditing` (`src/app/components/docs/DocEditing.tsx`) and the doc read view, `parseDoc`/`serializeDoc`.
- Produces: the panel (≈560px, right of the table, `Esc` closes) and the full page at `/r/:id/:issue` share `IssueProperties` (status, assignee, dates, parent, progress read-only on parents; then "Fields" in their defined order), title editable inline, `IssueBody` (read view; Edit opens `DocEditing` with `save` → `putBody`; `'stale'` shows the doc editor's stale bar), `SubIssues` (inline add, drag to reorder, glyphs), `IssueActivity` (events and comments in one stream, newest last, a comment box). Title and properties paint from the store at once; body and activity load after (from the kept copy when opened before).

- [ ] **Step 1: Write the failing browser test**: click a row → panel shows key, title and properties at once; set assignee in the panel → the table cell changes; Edit body, type a paragraph, Save → reload → paragraph shown; add a comment → it appears in Activity after "created"; "Open full page" → URL `/r/:id/:issue`, same content; sub-issue added in the panel appears nested in the table.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `Roadmaps: issue panel and page.`

---

### Task 15: Whole check

- [ ] `npm run build`, `npm run lint`, `npm test`, `npm run test:browser` → all pass.
- [ ] Open a roadmap with 2,000 seeded issues (dev account; seed helper from Task 12): opening paints in under 1 s from the kept copy, scrolling stays smooth, a status change shows in the next frame.
- [ ] Screenshot table + panel at 1440 and compare with the v7 mockup; note differences in `docs/temp/apple-bar-review.md`.
- [ ] Commit any fixes `Roadmaps M1: checked end to end.`
