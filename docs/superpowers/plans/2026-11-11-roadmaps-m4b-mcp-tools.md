# Roadmap MCP Tools Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expose roadmaps to MCP, REST, and the in-app tool runner as eleven registry tools plus a roadmap guide, so an agent can list, create, read, filter, and edit issues without a new HTTP route.

**Architecture:** Tools live in the existing registry (`TOOLS` → MCP `tools/list` and `POST /api/v1/<tool>`). Handlers stay free of HTTP and Neon: they read a roadmap the service loaded, or return a `RoadmapOp` the service saves through `AccountPort`. `api/_lib/roadmap-service.ts` mirrors `doc-service.ts` and is dispatched from `runTool`. Check ids come from `runChecks` / `issueFailsCheck` with the screen's UTC date. `roadmap_timeline` and in-app roadmap chat are not in this plan.

**Tech Stack:** TypeScript (strict), Vitest, the existing tool registry, `applyOp` / `writeRoadmap`, Neon via `Db` (no new Vercel function).

**Spec:** `docs/superpowers/specs/2026-11-10-roadmaps-m4-checks-agent-design.md` (section `# M4b — Agent, MCP, roadmap to slide`, through `## Review focus (M4b)`). Parent: `docs/superpowers/specs/2026-11-09-roadmaps-design.md` (§ Agent and MCP).

**Out of this plan:** in-app roadmap chat (`ChatPanel`, `runRoadmapTurn`, `roadmaps.chat`), and `roadmap_timeline` / `timelineDraft`. A later plan builds those. This plan does not add `check_roadmap`.

## Global Constraints

- Thin harness. New code is storage, validation, and wiring to `applyOp` / `runChecks`. No intent classifier, no PRE router, no Jev call on these tools. Wording and which issues to create stay in the model.
- No `any`. No inline styles. Split a file that would pass ~300 lines. shadcn is irrelevant here (no UI).
- No new Vercel function. `api/v1.ts` and `api/_lib/rest.ts` stay as they are: `POST /api/v1/<tool>` is the tool name. MCP `tools/list` is `TOOLS.map(mcpView)`.
- `today` is the UTC date `new Date(now).toISOString().slice(0, 10)`, the same expression as `RoadmapScreen` (`src/app/components/roadmap/RoadmapScreen.tsx`). Do not use `todayIso()` in `dates.ts` (that one is local).
- Reads (`get_roadmap`, `list_issues`, `get_issue`) include `checks: CheckId[]` from `issueFailsCheck` over `CHECK_IDS`. There is no `check_roadmap` tool.
- Writes return `checks: { issueId: string; ids: CheckId[] }[]` for issues that write touched. An ops refusal is a `refused` tool error whose message is the `ops.ts` sentence unchanged. Nothing is written. There is no `warnings` array on a partial success.
- `list_issues` chips are the `Chip` union, including `{ on: 'check'; id: CheckId }`. Chips AND. Results are matching issues in tree order, not dimmed ancestors. The predicate is `matchesChips`.
- `create_issues`: each item has a `ref` unique in the call; `parent` is an existing issue id or another item's `ref`; one `writeRoadmap` transaction; one `created` event per issue; field values are only what the item sets (`inheritFields: false`). The UI create path stays unchanged (omitted flag still copies parent fields).
- `update_issue` paths: `title`, `status`, `assignee`, `start`, `due`, `fields.<fieldId>` only. Not parent, not order, not body.
- `move_issue`: `parentId` (string or null) and at most one of `before` / `after`. Cycle sentence is `An issue can’t go inside itself or its sub-issues.` Depth sentence is `Issues nest 12 levels deep at most.` (`MAX_DEPTH`).
- `delete_issue` soft-deletes the subtree (one shared `deletedAt`, as `applyOp` already does), returns how many, requires `request`.
- `set_fields` replaces the whole ordered definition list. `checkFieldDefs` sentences are the refusals. Removing a definition strips its values in that same `writeRoadmap`.
- Every write requires `request` (the user's words). `by_client` on `issue_events` is `caller.client` (`Claude Code` from MCP when `x-client` is absent, `API` from REST, `Occam` from `app-tool.ts`).
- Viewers can call the read tools. A write they cannot do returns `NO_EDIT`: `You can view this workspace, not change it.` (`src/engine/pages/tree.ts`). Code `refused`. Fix: `Ask an owner of the workspace to make you an editor.`
- `create_roadmap` returns `roadmapId` and `links.edit` whose path is `/r/:id` (origin from the service, as decks use `/d/:id`).
- `list_roadmaps` parent is `PageRefOut | null` (`{ kind: "doc" | "deck" | "roadmap"; id: string } | null`), the same shape as `list_decks`.
- Prefix rule is `PREFIX` (`/^[A-Z][A-Z0-9]{1,5}$/`). Refusal copy, from the new-roadmap dialog: `Prefix must be 2–6 uppercase letters or digits, starting with a letter.`
- `delete_issue` only when the user asked is a prompt rule (guide + instructions), not a code classifier. The tool still requires `request`.

## Decisions

- **Port:** extend `AccountPort`. Do not add a `RoadmapPort`. Docs already hang list/load-adjacent calls off `AccountPort`, and the spec says the new queries go there. Handlers never import `Db`. `roadmapAccount()` in `roadmap-service.ts` builds the new methods; `deck-service.ts` spreads them onto the port object.
- **Save path:** handlers do not call Neon. A write handler returns `HandlerOut.roadmapOp`. `runRoadmapTool` calls `port.saveRoadmap`, which calls `db.writeRoadmap(uid, id, op, caller.client)`. Load is `port.loadRoadmap` into `ctx.roadmap` before the handler runs.
- **`request` is required and not stored.** Deck tools take optional `request`; `deck-service.ts` trims it, slices to 300 characters, and stores that string as the **version label** (`recordVersion` … `label`), not as a `deck_events` column. `issue_events` has `by_client` and no label/request column, and roadmaps have no version table (parent spec: restore is not built). This plan requires `request` on every roadmap write, rejects a blank one with `bad_input` and message `request: the user's own words.`, slices a longer one to 300 the same way, and does **not** add a column. What lands in the log is `by_client = caller.client`.
- **`inheritFields`:** `applyOp` create currently sets `fields: parent ? { ...parent.fields } : {}` (`ops.ts`), and the table/sub-issue UI depends on that. Add optional `inheritFields?: boolean` on each create item. Omitted or `true` keeps today's copy. The agent tool passes `false`, then `props.fields` are the only values.
- **Deleted-event shape:** `applyOp` writes one `deleted` event per node in the subtree, all with the same `deletedAt`. The spec's "one `deleted` event on the root" is not what shipped ops does. Do not change `applyOp`'s events. The tool's `deleted` count is `saved.changed.length`.
- **Refusals vs warnings:** ops refusals abort before `tx`. Map them to `ToolError('refused', sentence)`. Do not invent a `warnings` field. `foreign` → `not_found` with `No roadmap ${id}.` and fix `list_roadmaps shows your roadmaps.` `Busy, try again.` → `conflict` with that message and fix `Call it again.` Any other sentence → `refused`, fix `Fix it and call again; nothing was changed.`
- **`list_issues` paging** (not in the spec; 5,000 issues is the scale target): `chips` required (may be `[]`), `limit` default 100, min 1, max 200, `cursor` default 0, min 0. `next` is the next offset, omitted on the last page. Same `next` idea as `list_decks`.
- **`list_roadmaps` paging:** default `limit` 25, max 100, `cursor` min 0, `next` when more remain. Db query `order by updated_at desc limit 200`, matching `listDocs`.
- **`list_changes.since`:** `YYYY-MM-DD` is UTC midnight (`${s}T00:00:00.000Z`). A full ISO-8601 timestamp is `Date.parse`. Anything else is `bad_input`: `since: an ISO date (YYYY-MM-DD).` Rows with `at >= since` come back oldest first. No cursor.
- **Already-deleted `delete_issue` / `update_issue` / `move_issue`:** if the id is missing or `deletedAt !== null` on the loaded roadmap, throw `refused` with `No such issue.` and do not call `saveRoadmap`.
- **`before` / `after` that are not live siblings** of the destination parent: `refused` / `No such issue.` Do not rely on `siblingKey` appending.
- **Guide style enum** stays split. `get_guide`'s schema enum gains `"roadmap"`. `list_templates` and `get_template` keep `consulting | pitch | doc`, so `style: "roadmap"` is `bad_input` there.
- **Write result extras** the spec's chat seam needs and this plan includes on every successful `roadmapOp`: `seq`, `checks`, and `issues` (one view per changed row, `deletedAt` present only when set). `create_issues` also returns `created`. `delete_issue` also returns `deleted`. `set_fields` also returns `fields` from the reloaded roadmap.

## Review Focus

1. **`create_issues` with the child listed before its `ref` parent** still parents correctly in one transaction, and the child does not inherit the parent's field values.
2. **`list_issues` ANDs a status chip with a check chip** and returns only matching issues in tree order, omitting a parent that does not itself match.
3. **`update_issue` rejects `parentId` and `body`**, writes nothing, and a start after due comes back as the ops sentence `Start must be before due.`
4. **`delete_issue` on a parent counts the subtree**, both rows share one `deletedAt`, and a viewer gets `You can view this workspace, not change it.` while `get_roadmap` still works.
5. **Check ids use the UTC date** from `ctx.now()`, so an issue due the UTC yesterday is `overdue` at 00:30 UTC even when a local calendar would still say the previous day.

## File Structure

| File | Responsibility |
|---|---|
| `src/engine/tools/pages.ts` | `PageArg` / `pageSchema` / `pageArg` accept `roadmap`. |
| `src/engine/tools/types.ts` | Scope `'roadmap' \| 'createRoadmap'`, `ctx.roadmap`, `HandlerOut.roadmapOp` / `roadmapCreate`, `AccountPort` methods, `movePage` kinds. |
| `src/engine/roadmaps/ops.ts` | `inheritFields?: boolean` on create items. Default still copies. |
| `src/engine/tools/roadmap-view.ts` | Pure `todayUtc`, `IssueView`, `issueView`, `checksFor`, `liveTree`, `matchingIssues`, `checksTouched`. |
| `src/engine/tools/roadmaps.ts` | The eleven tools, input schemas, `requireRequest`. |
| `src/engine/tools/index.ts` | Register `roadmapTools` after `docProposalTools`, before `pageTools`. |
| `src/engine/tools/guide.ts`, `guide-text.ts`, `instructions.ts` | `style: "roadmap"` and the guide page. |
| `api/_lib/db.ts` | `listRoadmaps`, `roadmapEventsSince` on `Db`. |
| `api/_lib/db-roadmaps.ts`, `tests/unit/fake-db-roadmaps.ts` | Those two queries. |
| `api/_lib/roadmap-service.ts` | `roadmapAccount`, `runRoadmapTool`. |
| `api/_lib/deck-service.ts` | Spread the port methods; dispatch the two scopes. |
| `api/_lib/mcp.ts` | Resource `smartchart://guide/roadmap`. |
| Tests | `tests/unit/roadmap-tools.test.ts`, plus the ops, pages, contract, registry, and MCP cases named below. |

`api/v1.ts`, `api/_lib/rest.ts`, and `api/_lib/app-tool.ts` do not change. They already call `runTool`.

---

### Task 1: PageArg accepts a roadmap

**Files:**
- Modify: `src/engine/tools/pages.ts`
- Modify: `src/engine/tools/types.ts` (`AccountPort.movePage` and `HandlerOut.parent` only)
- Modify: `src/engine/tools/decks.ts` (description string)
- Modify: `src/engine/tools/docs.ts` (description string)
- Test: `tests/unit/pages-tool.test.ts`

**Interfaces:**
- Consumes: `db.createRoadmap`, `db.movePage` (already take `PageRef` with `kind: 'roadmap'`). `PageRefOut` is already `{ kind: "doc" | "deck" | "roadmap"; id: string }`.
- Produces: `PageArg = { kind: "doc" | "deck" | "roadmap"; id: string }`. `pageSchema` enum `["doc", "deck", "roadmap"]`. `pageArg(v, field)` returns that or throws `bad_input`. `AccountPort.movePage` and `HandlerOut.parent` use `PageRefOut` instead of the two-kind union.

- [ ] **Step 1: Write the failing test**

Add to `describe('move_page')` in `tests/unit/pages-tool.test.ts`:

```ts
it('moves a roadmap under a deck, and a deck under that roadmap', async () => {
  const { db, ok, acme, parents } = await setup()
  expect(await db.createRoadmap(ann.id, { id: 'rm_1', name: 'Plan', prefix: 'PLN', workspaceId: acme })).toBe('ok')
  const d = String((await ok('create_deck', { style: 'consulting', name: 'Pack', workspaceId: acme })).deckId)
  expect(await ok('move_page', { page: { kind: 'roadmap', id: 'rm_1' }, parent: { kind: 'deck', id: d } })).toEqual({
    moved: true, page: { kind: 'roadmap', id: 'rm_1' }, parent: { kind: 'deck', id: d },
  })
  const nested = String((await ok('create_deck', { style: 'consulting', name: 'Under', workspaceId: acme, parent: { kind: 'roadmap', id: 'rm_1' } })).deckId)
  expect(await parents()).toMatchObject({ rm_1: d, [nested]: 'rm_1' })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/unit/pages-tool.test.ts`

Expected: FAIL. `pageArg` rejects `kind: "roadmap"` (`bad_input`) before `movePage`.

- [ ] **Step 3: Widen the page argument**

In `pages.ts`: `PageArg.kind` and the `pageSchema` enum include `"roadmap"`. `pageArg` accepts it. Error message: `` `${field}: must be { kind: "doc", "deck" or "roadmap", id }.` `` Fix string stays `Use the docId or deckId from list_docs, list_decks or the create call.` — change it to `Use the id from list_docs, list_decks, list_roadmaps, or the create call.`

`move_page` description: a doc, a deck, or a roadmap; parent the same three; `list_docs, list_decks and list_roadmaps show each page's parent.` The `not_found` fix becomes `list_docs, list_decks and list_roadmaps show your pages.`

`AccountPort.movePage`'s `page` / `parent` / `before` / `after` kinds become `PageRefOut`. `HandlerOut.parent` becomes `PageRefOut`.

`create_deck` and `create_doc` descriptions: parent is a doc, a deck, or a roadmap. No other behaviour change.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/unit/pages-tool.test.ts`

Expected: PASS, including the existing bad-shape case (`kind: 'folder'` is still `bad_input`).

- [ ] **Step 5: Commit**

```bash
git add src/engine/tools/pages.ts src/engine/tools/types.ts src/engine/tools/decks.ts src/engine/tools/docs.ts tests/unit/pages-tool.test.ts
git commit -m "$(cat <<'EOF'
feat: let move_page name a roadmap

EOF
)"
```

---

### Task 2: Create can refuse inherited field values

**Files:**
- Modify: `src/engine/roadmaps/ops.ts` (the `create` member of `RoadmapOp`, and the `fields:` line in `applyOp`)
- Test: `tests/unit/roadmap-ops.test.ts`

**Interfaces:**
- Consumes: `applyOp`, `IssueProps`, fixture `country` (`id: 'f1'`, option `uk`).
- Produces: each create item may set `inheritFields?: boolean`. Omitted or `true`: `fields` start as the parent's fields (today's behaviour). `false`: `fields` start as `{}`, then `props` apply on top. The UI does not pass the flag.

- [ ] **Step 1: Write the failing test**

In `tests/unit/roadmap-ops.test.ts`, next to the test that copies parent fields:

```ts
it('inheritFields false does not copy the parent’s field values', () => {
  const base = state({ fields: [country] }, [issue({ id: 'p', fields: { f1: 'uk' } })])
  const bare = ok(applyOp(base, { op: 'create', issues: [{ id: 'n', parentId: 'p', title: 'Child', inheritFields: false }] }, ctx))
  expect(bare.state.issues.find((i) => i.id === 'n')?.fields).toEqual({})
  const named = ok(applyOp(base, { op: 'create', issues: [{ id: 'n2', parentId: 'p', title: 'Named', inheritFields: false, props: { fields: { f1: 'uk' } } }] }, ctx))
  expect(named.state.issues.find((i) => i.id === 'n2')?.fields).toEqual({ f1: 'uk' })
})
```

Leave the existing test (`fields: { f1: 'uk' }` when the flag is omitted) unchanged.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/unit/roadmap-ops.test.ts`

Expected: FAIL. The child still has `{ f1: 'uk' }` because `inheritFields` is not on the type and the copy still runs.

- [ ] **Step 3: Implement the flag**

On the create item type add `inheritFields?: boolean`. Where `applyOp` sets `fields` on a new issue:

`row.inheritFields === false ? {} : (parent ? { ...parent.fields } : {})`

`props` still run after that, unchanged.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/unit/roadmap-ops.test.ts`

Expected: PASS, including the existing copy test.

- [ ] **Step 5: Commit**

```bash
git add src/engine/roadmaps/ops.ts tests/unit/roadmap-ops.test.ts
git commit -m "$(cat <<'EOF'
feat: let issue create skip copying parent fields

EOF
)"
```

---

### Task 3: List roadmaps and events since a time

**Files:**
- Modify: `api/_lib/db.ts` (`Db` and a `RoadmapSummary` type)
- Modify: `api/_lib/db-roadmaps.ts` (`Calls` and the two methods)
- Modify: `tests/unit/fake-db-roadmaps.ts`
- Test: `tests/unit/db-contract.ts`

**Interfaces:**
- Consumes: `may`, `roleOf`, `readRoadmap`, `toEvent`. `parentOf` in `db-decks.ts` is not exported; do not export it.
- Produces:
  - `export interface RoadmapSummary { id: string; name: string; prefix: string; updated: number; parent: PageRef | null }`
  - `listRoadmaps(userId: string, workspaceId: string): Promise<RoadmapSummary[]>`
  - `roadmapEventsSince(userId: string, id: string, sinceMs: number): Promise<IssueEvent[] | null>`
  - `null` when the user cannot read the roadmap. `[]` when they can and nothing is in range. Events with `at >= sinceMs`, oldest first.

- [ ] **Step 1: Write the failing test**

Add a new `it` inside the contract describe that already covers roadmap storage (`tests/unit/db-contract.ts`):

```ts
it('lists a workspace’s roadmaps and events since a time', async () => {
  const db = await make(), { ann, cy, id } = people()
  const ws = await seedUser(db, ann)
  const rm = id('rm'), before = Date.now()
  expect(await db.createRoadmap(ann.id, { id: rm, name: 'Plan', prefix: 'PLN', workspaceId: ws })).toBe('ok')
  expect(await db.listRoadmaps(ann.id, ws)).toMatchObject([{ id: rm, name: 'Plan', prefix: 'PLN', parent: null }])
  await join(db, ann, ws, cy, 'viewer')
  expect(await db.listRoadmaps(cy.id, ws)).toMatchObject([{ id: rm }])
  expect(await db.listRoadmaps(ann.id, id('ws'))).toEqual([])
  const i1 = id('i')
  await db.writeRoadmap(ann.id, rm, { op: 'create', issues: [{ id: i1, parentId: null, title: 'One' }] }, 'Claude Code')
  const ev = await db.roadmapEventsSince(ann.id, rm, before)
  expect(ev?.find((e) => e.what === 'created')).toMatchObject({ issueId: i1, byClient: 'Claude Code' })
  expect(await db.roadmapEventsSince(ann.id, rm, Date.now() + 60_000)).toEqual([])
  expect(await db.roadmapEventsSince(id('u'), rm, 0)).toBeNull()
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/unit/db-fake.test.ts -t "lists a workspace"`

Expected: FAIL. `listRoadmaps` is not on `Db`.

- [ ] **Step 3: Add the two queries**

`listRoadmaps`: `select id, name, prefix, updated_at, parent_kind, parent_id from roadmaps where workspace_id = $2 and ${may('roadmaps', '$1', '$3')} order by updated_at desc limit 200`. Map `updated` with the existing `ms` helper. `parent` is `{ kind, id }` when both columns are set, else `null`.

`roadmapEventsSince`: if `readRoadmap(u, id, R('read'))` is missing, return `null`. Else `select` the event columns `where roadmap_id = $2 and at >= to_timestamp($3::float8 / 1000.0) … order by at`. Map with `toEvent`.

Fake: filter the `roadmaps` map by workspace and read role, sort by `updated` descending; filter `issueEvents` by `roadmapId` and `at >= sinceMs`, sort by `at`. Add both names to the fake `Calls` union.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/unit/db-fake.test.ts -t "lists a workspace"`

Expected: PASS. Do not require a live Neon run; `db-sql.test.ts` picks up the same contract when `DATABASE_URL` is set.

- [ ] **Step 5: Commit**

```bash
git add api/_lib/db.ts api/_lib/db-roadmaps.ts tests/unit/fake-db-roadmaps.ts tests/unit/db-contract.ts
git commit -m "$(cat <<'EOF'
feat: list roadmaps and read events since a time

EOF
)"
```

---

### Task 4: Service, list, create, and get

**Files:**
- Create: `src/engine/tools/roadmap-view.ts`
- Create: `src/engine/tools/roadmaps.ts` (the three read/create tools; later tasks add the rest to this file)
- Create: `api/_lib/roadmap-service.ts`
- Modify: `src/engine/tools/types.ts`
- Modify: `src/engine/tools/index.ts`
- Modify: `api/_lib/deck-service.ts`
- Test: `tests/unit/roadmap-view.test.ts`
- Test: `tests/unit/roadmap-tools.test.ts`
- Test: `tests/unit/tools-registry.test.ts` (name list + snapshot)

**Interfaces:**
- Consumes: `listRoadmaps`, `createRoadmap`, `getRoadmap`, `keyOf`, `issueFailsCheck`, `CHECK_IDS`, `buildIndex`, `PREFIX`, `NO_EDIT`, `PageArg` from Task 1.
- Produces:
  - `todayUtc(now: number): string` → `new Date(now).toISOString().slice(0, 10)`
  - `IssueView`: `id`, `number`, `key`, `title`, `status`, `assignee`, `start`, `due`, `parentId`, `sortKey`, `fields`, `checks: CheckId[]`, and `deletedAt` only when it is a number.
  - `issueView(roadmap: Roadmap, issues: readonly Issue[], issue: Issue, today: string): IssueView`
  - `checksFor(issues: readonly Issue[], issueId: string, today: string): CheckId[]` — live index only; a missing or deleted id returns `[]`. Order is `CHECK_IDS` order.
  - `liveTree(issues: readonly Issue[]): Issue[]` — `deletedAt === null`, preorder, siblings by `buildIndex` (sortKey, then id).
  - `Scope` gains `'roadmap' | 'createRoadmap'`.
  - `ToolContext.roadmap: LoadedRoadmap | null`
  - `HandlerOut.roadmapOp?: RoadmapOp` and `HandlerOut.roadmapCreate?: { name: string; prefix: string }`
  - `AccountPort` methods, all implemented in `roadmapAccount(db, uid, workspaces)`:
    - `listRoadmaps(limit: number, cursor: number, workspaceId?: string): Promise<{ workspaceId: string; roadmaps: { roadmapId: string; name: string; prefix: string; updated: number; parent: PageRefOut | null }[]; next?: number }>`
    - `newRoadmapId(): string` → `` `rm_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}` ``
    - `loadRoadmap(id: string): Promise<LoadedRoadmap | null>`
    - `saveRoadmap(id: string, op: RoadmapOp): Promise<{ seq: number; changed: Issue[] } | string>` — passes `caller.client` only from `runRoadmapTool`, so this method's `byClient` is an argument: `saveRoadmap(id, op, byClient)`
    - `createRoadmap(r: { id: string; name: string; prefix: string; workspaceId?: string; parent?: PageRefOut }): Promise<'ok' | string>`
  - `requireRequest(request: string): string` — trim; empty throws `ToolError('bad_input', 'request: the user\'s own words.')`; return `trim().slice(0, 300)`.
  - `export async function runRoadmapTool(e: RoadmapEnv): Promise<ToolReply>` with the same env fields as `DocEnv`.
  - Tool names registered now: `list_roadmaps`, `create_roadmap`, `get_roadmap`.

`list_roadmaps` is scope `account`, annotations `READ`, group `roadmaps`. Input properties `limit` (integer 1–100), `cursor` (integer ≥ 0), `workspaceId` (same description as `list_decks`). Defaults 25 and 0. Unknown workspace: `not_found` `No workspace ${id}.` (the port throws the same `noWorkspace` error `listDecks` throws).

`create_roadmap` is scope `createRoadmap`, annotations `WRITE`. Required `name`, `prefix`, `request`. Optional `workspaceId`, `parent` (`pageSchema`). Handler calls `requireRequest`, trims the name and slices to 200, rejects an empty name with `bad_input` / `Every roadmap needs a name.`, rejects a prefix that fails `PREFIX` with `bad_input` and `Prefix must be 2–6 uppercase letters or digits, starting with a letter.` Id is `ctx.port.newRoadmapId()`. Return `{ result: { roadmapId, name, prefix, parent: under ?? null }, roadmapCreate: { name, prefix }, workspaceId, parent }`.

`get_roadmap` is scope `roadmap`, annotations `READ`. Required `roadmapId`. Result: `{ roadmapId, name, prefix, fields, links: { edit }, issues }` where `issues` is `liveTree` mapped through `issueView`. No `body`, no `comments`, no `members`, no `seq`.

Service, scope `roadmap`: id must match `/^[\w-]{1,64}$/` or `loadRoadmap` is skipped. `null` → `not_found` / `No roadmap ${id}.` / fix `list_roadmaps shows your roadmaps.` Else `ctx.roadmap` is the load and `ctx.links = { edit: \`${origin}/r/${id}\`, share: null }`. Scope `createRoadmap`: `ctx.links = { edit: '', share: null }`. After the handler, if `roadmapCreate` is set, call `port.createRoadmap`. `'ok'` → set `result.links = { edit: \`${origin}/r/${roadmapId}\` }` and `db.markAgentConnectDone(uid)`. `'foreign'` with a parent → `refused` / `NO_EDIT` / fix `Create it in a workspace you can edit.` `'foreign'` without a parent: viewer of that workspace → `refused` / `You can view this workspace, not add to it.` / fix `Pick a workspace where you are an editor (list_workspaces).` Otherwise `not_found` / `No workspace ${id}.` Any other string → `refused` with that sentence. Do not handle `roadmapOp` yet (Task 6). If a handler sets it, ignore it — no Task 4 tool sets it.

`deck-service.ts` `try` block, beside the doc dispatch: if scope is `roadmap` or `createRoadmap`, return `runRoadmapTool(...)`.

- [ ] **Step 1: Write the failing tests**

`tests/unit/roadmap-view.test.ts`:

```ts
it('todayUtc is the UTC date, and a due date the day before is overdue', () => {
  const now = Date.parse('2026-01-02T00:30:00.000Z')
  expect(todayUtc(now)).toBe('2026-01-02')
  const issues = [issue({ id: 'late', start: '2026-01-01', due: '2026-01-01', status: 'todo' }), issue({ id: 'today', start: '2026-01-02', due: '2026-01-02', status: 'todo' })]
  expect(checksFor(issues, 'late', todayUtc(now))).toContain('overdue')
  expect(checksFor(issues, 'today', todayUtc(now))).not.toContain('overdue')
})
```

Use the existing `issue()` fixture. `late` is an open leaf with both dates, so `no_dates` is absent and `no_assignee` is present. Assert that too: `expect(checksFor(...'late'...)).toEqual(expect.arrayContaining(['no_assignee', 'overdue']))` and that `no_dates` is not in the list.

`tests/unit/roadmap-tools.test.ts` harness, copied from `doc-tools.test.ts`: `caller` client `'Claude Code'`, `fakeDb()`, `origin: 'https://app.test'`, `now: () => Date.parse('2026-01-02T00:30:00.000Z')`. Seed Ann, an Acme workspace, Bob as viewer (the `pages-tool.test.ts` invite pattern).

```ts
it('creates a roadmap, lists it under a deck, and get omits the body', async () => {
  const { ok, db, acme } = await world()
  const deckId = String((await ok('create_deck', { style: 'consulting', name: 'Pack', workspaceId: acme })).deckId)
  const made = await ok('create_roadmap', { name: 'SME launch', prefix: 'SME', request: 'Start the SME roadmap', workspaceId: acme, parent: { kind: 'deck', id: deckId } })
  const roadmapId = String(made.roadmapId)
  expect(made.links).toEqual({ edit: `https://app.test/r/${roadmapId}` })
  expect(made.parent).toEqual({ kind: 'deck', id: deckId })
  const listed = await ok('list_roadmaps', { workspaceId: acme })
  expect(listed.roadmaps).toEqual([expect.objectContaining({ roadmapId, name: 'SME launch', prefix: 'SME', parent: { kind: 'deck', id: deckId } })])
  await db.writeRoadmap(ann.id, roadmapId, { op: 'create', issues: [{ id: 'i_late', parentId: null, title: 'Late' }] }, 'app')
  await db.writeRoadmap(ann.id, roadmapId, { op: 'set', ids: ['i_late'], props: { start: '2026-01-01', due: '2026-01-01' } }, 'app')
  await db.putIssueBody(ann.id, roadmapId, 'i_late', '# Secret', 0)
  const got = await ok('get_roadmap', { roadmapId })
  expect(got.fields).toEqual([])
  expect(got.links).toEqual({ edit: `https://app.test/r/${roadmapId}` })
  const row = (got.issues as { id: string; key: string; checks: string[] }[])[0]
  expect(row.key).toBe('SME-1')
  expect(row.checks).toContain('overdue')
  expect(row).not.toHaveProperty('body')
  expect(got).not.toHaveProperty('comments')
})

it('rejects a bad prefix, a blank request, a viewer create, and a stranger read', async () => {
  const { call, ok, acme } = await world()
  expect(await call('create_roadmap', { name: 'X', prefix: 'pln', request: 'add' })).toMatchObject({ ok: false, error: { code: 'bad_input', message: 'Prefix must be 2–6 uppercase letters or digits, starting with a letter.' } })
  expect(await call('create_roadmap', { name: 'X', prefix: 'PLN', request: '   ' })).toMatchObject({ ok: false, error: { code: 'bad_input', message: 'request: the user\'s own words.' } })
  expect(await call('create_roadmap', { name: 'X', prefix: 'XX', request: 'add', workspaceId: acme }, bob)).toMatchObject({ ok: false, error: { code: 'refused', message: 'You can view this workspace, not add to it.' } })
  const roadmapId = String((await ok('create_roadmap', { name: 'P', prefix: 'PLN', request: 'add', workspaceId: acme })).roadmapId)
  expect(await call('get_roadmap', { roadmapId }, cy)).toMatchObject({ ok: false, error: { code: 'not_found', message: `No roadmap ${roadmapId}.` } })
  expect(await ok('get_roadmap', { roadmapId }, bob)).toMatchObject({ roadmapId, prefix: 'PLN' })
})
```

`cy` is a user with no membership. Bob is the viewer. `world()`'s `call` / `ok` take an optional user the way `pages-tool.test.ts` does.

Update `tests/unit/tools-registry.test.ts` so the name array inserts `'list_roadmaps', 'create_roadmap', 'get_roadmap'` immediately before `'move_page'`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/unit/roadmap-view.test.ts tests/unit/roadmap-tools.test.ts tests/unit/tools-registry.test.ts`

Expected: FAIL. `todayUtc` and `create_roadmap` are not defined. The registry list does not include the three names.

- [ ] **Step 3: Implement the view, the three tools, and the service**

Signatures above. `issueView` uses `keyOf(roadmap, issue)` and `checksFor`. `get_roadmap` reads `ctx.roadmap` and throws `bad_input` / `No roadmap.` / `Pass roadmapId.` when it is null (the service normally loads it).

`list_roadmaps` is a one-line port call, same shape as `list_decks`.

Register `roadmapTools` in `TOOLS` between `docProposalTools` and `pageTools`.

`roadmapAccount` uses `workspaces()` the same way `listDecks` picks the default workspace. `saveRoadmap` is on the port now even though no tool calls it yet: `db.writeRoadmap(uid, id, op, byClient)`.

Keep `roadmaps.ts` and `roadmap-service.ts` under ~300 lines. The view helpers are the split that makes that true.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/unit/roadmap-view.test.ts tests/unit/roadmap-tools.test.ts tests/unit/tools-registry.test.ts -u`

Expected: PASS. `-u` rewrites the registry snapshot. Read the snapshot diff and confirm the only new tools are the three, each with `additionalProperties: false` at the top.

- [ ] **Step 5: Commit**

```bash
git add src/engine/tools/roadmap-view.ts src/engine/tools/roadmaps.ts src/engine/tools/types.ts src/engine/tools/index.ts api/_lib/roadmap-service.ts api/_lib/deck-service.ts tests/unit/roadmap-view.test.ts tests/unit/roadmap-tools.test.ts tests/unit/tools-registry.test.ts tests/unit/__snapshots__/tools-registry.test.ts.snap
git commit -m "$(cat <<'EOF'
feat: list, create, and open a roadmap over the tool registry

EOF
)"
```

---

### Task 5: list_issues, get_issue, list_changes

**Files:**
- Modify: `src/engine/tools/roadmap-view.ts`
- Modify: `src/engine/tools/roadmaps.ts`
- Modify: `src/engine/tools/types.ts` (`issueDetail`, `roadmapEventsSince` on `AccountPort`)
- Modify: `api/_lib/roadmap-service.ts` (`roadmapAccount`)
- Test: `tests/unit/roadmap-view.test.ts`
- Test: `tests/unit/roadmap-tools.test.ts`
- Test: `tests/unit/tools-registry.test.ts`

**Interfaces:**
- Consumes: `matchesChips`, `checksFor`, `issueView`, `liveTree`, `getIssueDetail`, `roadmapEventsSince`, `ctx.roadmap`.
- Produces:
  - `matchingIssues(issues: readonly Issue[], chips: readonly Chip[], today: string): Issue[]` — live issues only, preorder, push a node only when `matchesChips` is true, still walk its children when it is not.
  - `AccountPort.issueDetail(roadmapId: string, issueId: string): Promise<IssueDetail | null>` → `db.getIssueDetail`.
  - `AccountPort.roadmapEventsSince(roadmapId: string, sinceMs: number): Promise<IssueEvent[] | null>` → `db.roadmapEventsSince`.
  - Tools, scope `roadmap`, group `roadmaps`, annotations `READ`:
    - `list_issues` required `roadmapId`, `chips`. Optional `limit` (1–200, default 100), `cursor` (≥ 0, default 0). Result `{ issues: IssueView[], next?: number }`.
    - `get_issue` required `roadmapId`, `issueId`. Result is the `IssueView` plus `body: string`, `comments` (the stored `IssueComment[]`), `events`. Each event is `{ issueId, what, changes, by, byClient, at }` with `at` an ISO string (`new Date(e.at).toISOString()`). `by` is the user id. Missing issue, or `deletedAt` set: still returned when `getIssueDetail` finds the row (soft-deleted is readable); `checks` is `[]` and `deletedAt` is set. No row at all: `not_found` / `No such issue.`
    - `list_changes` required `roadmapId`, `since`. Result `{ events }` in the same event shape, oldest first. `null` from the port (should not happen after the service loaded the roadmap) → `not_found` / `No roadmap ${id}.`

Chip input schema is `oneOf` these objects, `additionalProperties: false` on each:

- `{ on: 'status', is: boolean, values: Status[] }` and `Status` is `backlog | todo | in_progress | blocked | done | cancelled`
- `{ on: 'assignee', is: boolean, values: (string | null)[] }`
- `{ on: 'field', field: string, is: boolean, values: (string | null)[] }`
- `{ on: 'dates', when: 'overdue' | 'before' | 'after', date?: string }`
- `{ on: 'check', id: CheckId }` and `CheckId` is the seven `CHECK_IDS`

Insert the three names in the registry array after `get_roadmap` and before `move_page`, in the order `list_issues`, `get_issue`, `list_changes`. Later tasks insert the write tools between `get_issue` and `list_changes`.

- [ ] **Step 1: Write the failing tests**

`roadmap-view.test.ts` — this is Review Focus item 2 at the pure layer, and the tool test below is the one that counts:

```ts
it('matchingIssues ANDs chips and skips a parent that does not match', () => {
  const today = '2026-01-02'
  const issues = [
    issue({ id: 'd', title: 'D', status: 'todo' }),
    issue({ id: 'p', title: 'P', status: 'todo', start: '2026-01-01', due: '2026-01-03' }),
    issue({ id: 'a', parentId: 'p', title: 'A', status: 'todo' }),
    issue({ id: 'c', parentId: 'a', title: 'C', status: 'todo' }),
    issue({ id: 'b', parentId: 'p', title: 'B', status: 'done' }),
  ]
  const chips = [{ on: 'status' as const, is: true, values: ['todo' as const] }, { on: 'check' as const, id: 'no_dates' as const }]
  expect(matchingIssues(issues, chips, today).map((i) => i.id)).toEqual(['d', 'a', 'c'])
})
```

`d` is created first so its sort key is before `p`. `a` and `c` have no dates, so they are open leaves failing `no_dates`. `p` is `todo` but not a leaf. `b` is `done`.

`roadmap-tools.test.ts`:

```ts
it('lists the same matches the table would, and get_issue returns body, comments, and events', async () => {
  const { ok, db, acme } = await world()
  const roadmapId = String((await ok('create_roadmap', { name: 'P', prefix: 'PLN', request: 'add', workspaceId: acme })).roadmapId)
  await db.writeRoadmap(ann.id, roadmapId, { op: 'create', issues: [
    { id: 'd', parentId: null, title: 'D' },
    { id: 'p', parentId: null, title: 'P' },
    { id: 'a', parentId: 'p', title: 'A' },
    { id: 'c', parentId: 'a', title: 'C' },
    { id: 'b', parentId: 'p', title: 'B' },
  ] }, 'app')
  await db.writeRoadmap(ann.id, roadmapId, { op: 'set', ids: ['p'], props: { start: '2026-01-01', due: '2026-01-03' } }, 'app')
  await db.writeRoadmap(ann.id, roadmapId, { op: 'set', ids: ['b'], props: { status: 'done' } }, 'app')
  await db.putIssueBody(ann.id, roadmapId, 'a', '# Brief', 0)
  const chips = [{ on: 'status', is: true, values: ['todo'] }, { on: 'check', id: 'no_dates' }]
  const page = await ok('list_issues', { roadmapId, chips, limit: 2 })
  expect((page.issues as { id: string }[]).map((i) => i.id)).toEqual(['d', 'a'])
  expect(page.next).toBe(2)
  const rest = await ok('list_issues', { roadmapId, chips, cursor: 2 })
  expect((rest.issues as { id: string }[]).map((i) => i.id)).toEqual(['c'])
  expect(rest.next).toBeUndefined()
  const one = await ok('get_issue', { roadmapId, issueId: 'a' })
  expect(one).toMatchObject({ id: 'a', key: 'PLN-3', body: '# Brief', checks: expect.arrayContaining(['no_dates']) })
  expect(one).not.toHaveProperty('deletedAt')
  expect(one.events.length).toBeGreaterThan(0)
  expect(one.events[0].at).toMatch(/^\d{4}-\d{2}-\d{2}T/)
})

it('list_changes returns rows since the date and rejects a bad since', async () => {
  const { ok, call, db, acme } = await world()
  const roadmapId = String((await ok('create_roadmap', { name: 'P', prefix: 'PLN', request: 'add', workspaceId: acme })).roadmapId)
  await db.writeRoadmap(ann.id, roadmapId, { op: 'create', issues: [{ id: 'i1', parentId: null, title: 'One' }] }, 'app')
  const rows = await ok('list_changes', { roadmapId, since: '2020-01-01' })
  expect(rows.events).toEqual([expect.objectContaining({ what: 'created', byClient: 'app' })])
  expect(await ok('list_changes', { roadmapId, since: '2099-01-01' })).toEqual({ events: [] })
  expect(await call('list_issues', { roadmapId, chips: [{ on: 'nope' }] })).toMatchObject({ ok: false, error: { code: 'bad_input' } })
  expect(await call('list_changes', { roadmapId, since: 'tomorrow' })).toMatchObject({ ok: false, error: { code: 'bad_input', message: 'since: an ISO date (YYYY-MM-DD).' } })
})
```

`key` for `a` is `PLN-3` only if create assigns numbers in array order (`d` = 1, `p` = 2, `a` = 3). That is what `applyOp` does. Assert `PLN-3`.

A viewer (`bob`) `list_issues` and `get_issue` succeed. Add that expect to the first test.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/unit/roadmap-view.test.ts tests/unit/roadmap-tools.test.ts`

Expected: FAIL. `matchingIssues` / `list_issues` are not defined.

- [ ] **Step 3: Implement the three tools**

`matchingIssues` walks `buildIndex(live).children` from `null`. `list_issues` slices the array `[cursor, cursor + limit)` and sets `next` to `cursor + limit` when that is `< length`.

`get_issue` loads the issue from `ctx.roadmap.issues` (including soft-deleted) and `port.issueDetail` for body, comments, and events. If the detail is `null`, `not_found` / `No such issue.`

`list_changes` parses `since` as in Decisions, then `port.roadmapEventsSince`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/unit/roadmap-view.test.ts tests/unit/roadmap-tools.test.ts tests/unit/tools-registry.test.ts -u`

Expected: PASS. Snapshot gains only these three tools.

- [ ] **Step 5: Commit**

```bash
git add src/engine/tools/roadmap-view.ts src/engine/tools/roadmaps.ts src/engine/tools/types.ts api/_lib/roadmap-service.ts tests/unit/roadmap-view.test.ts tests/unit/roadmap-tools.test.ts tests/unit/tools-registry.test.ts tests/unit/__snapshots__/tools-registry.test.ts.snap
git commit -m "$(cat <<'EOF'
feat: filter issues and read roadmap history over the registry

EOF
)"
```

---

### Task 6: create_issues and update_issue

**Files:**
- Modify: `src/engine/tools/roadmap-view.ts` (`checksTouched`)
- Modify: `src/engine/tools/roadmaps.ts`
- Modify: `api/_lib/roadmap-service.ts` (save path)
- Test: `tests/unit/roadmap-tools.test.ts`
- Test: `tests/unit/tools-registry.test.ts`

**Interfaces:**
- Consumes: `requireRequest`, `ctx.roadmap`, `saveRoadmap`, `inheritFields`, `NO_ISSUE` (`No such issue.`), `ISSUE_CYCLE`, `STATUSES`, `checkFieldPatch` sentences (`No such field.`, `“Country” has no option “zz”.`).
- Produces:
  - `checksTouched(issues: readonly Issue[], ids: readonly string[], today: string): { issueId: string; ids: CheckId[] }[]` — one entry per id, in that order, `ids` from `checksFor`.
  - `create_issues`: scope `roadmap`, annotations `WRITE`. Required `roadmapId`, `issues`, `request`. Each item `additionalProperties: false`, required `ref`, `title`. Optional `status`, `assignee` (string or null), `start` (string or null), `due` (string or null), `fields` (object), `parent` (string or null).
  - `update_issue`: scope `roadmap`, annotations `DESTRUCTIVE`. Required `roadmapId`, `issueId`, `set`, `request`. `set` is an object, `additionalProperties: true`.
  - On a successful `roadmapOp`, `runRoadmapTool` sets `result.seq`, `result.checks = checksTouched(fresh.issues, changed ids, todayUtc(now()))`, `result.issues` = those changed rows through `issueView` using the reloaded issue list. Then `markAgentConnectDone`. Mapping of save strings is the Decisions list. Reload with `loadRoadmap` after a successful save so checks see the new tree.

`create_issues` algorithm (the tests do not determine the order):

1. `requireRequest`. `issues` length at least 1, else `bad_input` / `issues: at least one.`
2. Each `ref` matches `/^[\w-]{1,64}$/` and is unique, else `bad_input` / `ref: each ref is used once.` A `ref` that equals an existing issue id is `bad_input` / `ref: already an issue id.`
3. Mint ids with `` `iss_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}` `` (the app's `newIssueId` shape). Build `ref → id`.
4. Resolve `parent`: `null`/omitted → `null`; a `ref` in this call → that item's minted id; a live issue id on the roadmap → that id; anything else → `refused` / `No such issue.` A parent that is a `ref` wins over an existing id of the same string (step 2 already forbids that clash).
5. Order items so a `ref` parent is earlier than its child. If a cycle remains, `refused` / `An issue can’t go inside itself or its sub-issues.` and do not save.
6. One op: `{ op: 'create', issues: ordered.map(...) }`. Every item `inheritFields: false`. `props` only for fields the item sent (`status`, `assignee`, `start`, `due`, `fields`). `parentId` is the resolved id. No `after` (append in resolved order).
7. `result.created` is in **input** order: `{ ref, issueId, key }`. `key` is `` `${prefix}-${number}` ``. Numbers are `nextNumber` plus the item's index in the resolved order. Compute that in the handler so the reply does not depend on a second read; the service does not overwrite `created`.

`update_issue`:

- Live issue only, else `refused` / `No such issue.`
- `set` keys must each be `title`, `status`, `assignee`, `start`, `due`, or `fields.<fieldId>` where `fieldId` matches `/^[\w-]+$/`. Otherwise `bad_input` / `set: only title, status, assignee, start, due, and fields.<fieldId>.` Do not save.
- Empty `set` → `bad_input` / `set: at least one path.`
- `title` is a string. `status` is a `Status`. `assignee`, `start`, `due` are a string or `null`. `fields.<id>` is a string, a number, or `null` (null clears). A bad JSON type is `bad_input` before `applyOp`.
- One op `{ op: 'set', ids: [issueId], props }`. Field patches are one `props.fields` object. One `set` event is `applyOp`'s job.

- [ ] **Step 1: Write the failing tests**

Review Focus items 1 and 3:

```ts
it('create_issues parents a child listed first and does not copy fields', async () => {
  const { ok, db, acme } = await world()
  const roadmapId = String((await ok('create_roadmap', { name: 'P', prefix: 'PLN', request: 'add', workspaceId: acme })).roadmapId)
  const country = { id: 'f1', name: 'Country', type: 'choice' as const, options: [{ id: 'uk', name: 'UK' }] }
  await db.writeRoadmap(ann.id, roadmapId, { op: 'roadmap', fields: [country] }, 'app')
  await db.writeRoadmap(ann.id, roadmapId, { op: 'create', issues: [{ id: 'p', parentId: null, title: 'Parent', props: { fields: { f1: 'uk' } } }] }, 'app')
  const before = (await db.getRoadmap(ann.id, roadmapId))!.roadmap.seq
  const made = await ok('create_issues', {
    roadmapId, request: 'Add the UK task under a new group',
    issues: [
      { ref: 'child', title: 'UK task', parent: 'group' },
      { ref: 'group', title: 'Underwriting', parent: 'p', fields: { f1: 'uk' } },
    ],
  })
  const created = made.created as { ref: string; issueId: string; key: string }[]
  expect(created.map((c) => c.ref)).toEqual(['child', 'group'])
  const fresh = await db.getRoadmap(ann.id, roadmapId)
  expect(fresh!.roadmap.seq).toBe(before + 1)
  const group = fresh!.issues.find((i) => i.id === created[1].issueId)!
  const child = fresh!.issues.find((i) => i.id === created[0].issueId)!
  expect(group.parentId).toBe('p')
  expect(group.fields).toEqual({ f1: 'uk' })
  expect(child.parentId).toBe(group.id)
  expect(child.fields).toEqual({})
  const detail = await db.getIssueDetail(ann.id, roadmapId, child.id)
  expect(detail!.events.filter((e) => e.what === 'created')).toEqual([expect.objectContaining({ byClient: 'Claude Code' })])
  expect(made.checks).toEqual(expect.arrayContaining([expect.objectContaining({ issueId: child.id, ids: expect.arrayContaining(['no_dates']) })]))
})

it('update_issue refuses a parent path and a start after due, and writes nothing', async () => {
  const { ok, call, db, acme } = await world()
  const roadmapId = String((await ok('create_roadmap', { name: 'P', prefix: 'PLN', request: 'add', workspaceId: acme })).roadmapId)
  await db.writeRoadmap(ann.id, roadmapId, { op: 'create', issues: [{ id: 'i1', parentId: null, title: 'One' }] }, 'app')
  const seq = (await db.getRoadmap(ann.id, roadmapId))!.roadmap.seq
  expect(await call('update_issue', { roadmapId, issueId: 'i1', set: { parentId: null }, request: 'move it' })).toMatchObject({ ok: false, error: { code: 'bad_input', message: 'set: only title, status, assignee, start, due, and fields.<fieldId>.' } })
  expect(await call('update_issue', { roadmapId, issueId: 'i1', set: { body: 'x' }, request: 'edit the body' })).toMatchObject({ ok: false, error: { code: 'bad_input' } })
  expect(await call('update_issue', { roadmapId, issueId: 'i1', set: { start: '2026-05-02', due: '2026-05-01' }, request: 'fix the dates' })).toMatchObject({ ok: false, error: { code: 'refused', message: 'Start must be before due.' } })
  expect((await db.getRoadmap(ann.id, roadmapId))!.roadmap.seq).toBe(seq)
  expect((await db.getRoadmap(ann.id, roadmapId))!.issues.find((i) => i.id === 'i1')!.title).toBe('One')
})

it('update_issue sets two paths as one event and refuses an unknown option', async () => {
  const { ok, call, db, acme } = await world()
  const roadmapId = String((await ok('create_roadmap', { name: 'P', prefix: 'PLN', request: 'add', workspaceId: acme })).roadmapId)
  await db.writeRoadmap(ann.id, roadmapId, { op: 'roadmap', fields: [{ id: 'f1', name: 'Country', type: 'choice', options: [{ id: 'uk', name: 'UK' }] }] }, 'app')
  await db.writeRoadmap(ann.id, roadmapId, { op: 'create', issues: [{ id: 'i1', parentId: null, title: 'One' }] }, 'app')
  const upd = await ok('update_issue', { roadmapId, issueId: 'i1', request: 'Call it Send RFP and set the country', set: { title: 'Send RFP', 'fields.f1': 'uk' } })
  expect(upd.issues).toEqual([expect.objectContaining({ id: 'i1', title: 'Send RFP', fields: { f1: 'uk' } })])
  const ev = await db.getIssueDetail(ann.id, roadmapId, 'i1')
  expect(ev!.events.filter((e) => e.what === 'set').at(-1)?.changes.map((c) => c.path).sort()).toEqual(['fields', 'title'])
  expect(await call('update_issue', { roadmapId, issueId: 'i1', request: 'bad country', set: { 'fields.f1': 'zz' } })).toMatchObject({ ok: false, error: { code: 'refused', message: '“Country” has no option “zz”.' } })
})
```

Registry: insert `'create_issues', 'update_issue'` after `'get_issue'` and before `'list_changes'`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/unit/roadmap-tools.test.ts -t "create_issues|update_issue"`

Expected: FAIL. Unknown tool.

- [ ] **Step 3: Implement the save path and the two tools**

`runRoadmapTool`: when `out.roadmapOp` is set, `port.saveRoadmap(id, op, e.client)`. On a string, throw as in Decisions. On success, `loadRoadmap` again, fill `seq`, `checks`, `issues`, `markAgentConnectDone`. `today` is `todayUtc(e.now())`.

A viewer hits `NO_EDIT` from `writeRoadmap` without a special case.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/unit/roadmap-tools.test.ts tests/unit/roadmap-ops.test.ts tests/unit/tools-registry.test.ts -u`

Expected: PASS. The ops copy test from Task 2 still passes.

- [ ] **Step 5: Commit**

```bash
git add src/engine/tools/roadmap-view.ts src/engine/tools/roadmaps.ts api/_lib/roadmap-service.ts tests/unit/roadmap-tools.test.ts tests/unit/tools-registry.test.ts tests/unit/__snapshots__/tools-registry.test.ts.snap
git commit -m "$(cat <<'EOF'
feat: create and update roadmap issues from the agent

EOF
)"
```

---

### Task 7: move_issue, delete_issue, set_fields

**Files:**
- Modify: `src/engine/tools/roadmaps.ts`
- Modify: `api/_lib/roadmap-service.ts` (`deleted` count, `fields` echo)
- Test: `tests/unit/roadmap-tools.test.ts`
- Test: `tests/unit/tools-registry.test.ts`

**Interfaces:**
- Consumes: the save path from Task 6, `ISSUE_CYCLE`, `ISSUE_TOO_DEEP`, `NO_EDIT`, `checkFieldDefs`.
- Produces:
  - `move_issue`: scope `roadmap`, annotations `IDEMPOTENT`. Required `roadmapId`, `parentId` (string or null), `issueId`, `request`. Optional `before`, `after` (strings). Both set → `bad_input` / `before and after: give one, not both.` Op `{ op: 'move', id, parentId, before?, after? }`.
  - `delete_issue`: scope `roadmap`, annotations `DESTRUCTIVE`. Required `roadmapId`, `issueId`, `request`. Op `{ op: 'delete', ids: [issueId] }`. Service sets `result.deleted = saved.changed.length` (do not let the handler guess).
  - `set_fields`: scope `roadmap`, annotations `WRITE`. Required `roadmapId`, `fields`, `request`. `fields` is an array of objects (`additionalProperties: true`; `checkFieldDefs` is the validator, inside `applyOp`). Op `{ op: 'roadmap', fields }`. Service sets `result.fields` from the reloaded roadmap's `fields`.

Registry order, the full roadmap block before `move_page`:

`list_roadmaps`, `create_roadmap`, `get_roadmap`, `list_issues`, `get_issue`, `create_issues`, `update_issue`, `move_issue`, `list_changes`, `delete_issue`, `set_fields`

- [ ] **Step 1: Write the failing tests**

Review Focus item 4, plus move and set_fields:

```ts
it('delete_issue removes the subtree, counts it, and tells a viewer no', async () => {
  const { ok, call, db, acme } = await world()
  const roadmapId = String((await ok('create_roadmap', { name: 'P', prefix: 'PLN', request: 'add', workspaceId: acme })).roadmapId)
  await db.writeRoadmap(ann.id, roadmapId, { op: 'create', issues: [
    { id: 'p', parentId: null, title: 'Parent' },
    { id: 'c', parentId: 'p', title: 'Child' },
  ] }, 'app')
  expect(await call('delete_issue', { roadmapId, issueId: 'p' }, bob)).toMatchObject({ ok: false, error: { code: 'refused', message: 'You can view this workspace, not change it.' } })
  expect((await ok('get_roadmap', { roadmapId }, bob)).issues).toHaveLength(2)
  const gone = await ok('delete_issue', { roadmapId, issueId: 'p', request: 'Remove this branch' })
  expect(gone.deleted).toBe(2)
  const left = await db.getRoadmap(ann.id, roadmapId)
  const rows = left!.issues.filter((i) => i.id === 'p' || i.id === 'c')
  expect(rows.every((i) => i.deletedAt !== null && i.deletedAt === rows[0].deletedAt)).toBe(true)
  expect((await ok('get_roadmap', { roadmapId })).issues).toEqual([])
  expect(await call('delete_issue', { roadmapId, issueId: 'p', request: 'again' })).toMatchObject({ ok: false, error: { code: 'refused', message: 'No such issue.' } })
})

it('move_issue refuses a cycle and a slot that is not a sibling', async () => {
  const { ok, call, db, acme } = await world()
  const roadmapId = String((await ok('create_roadmap', { name: 'P', prefix: 'PLN', request: 'add', workspaceId: acme })).roadmapId)
  await db.writeRoadmap(ann.id, roadmapId, { op: 'create', issues: [
    { id: 'p', parentId: null, title: 'Parent' },
    { id: 'c', parentId: 'p', title: 'Child' },
    { id: 's', parentId: null, title: 'Sib' },
  ] }, 'app')
  expect(await call('move_issue', { roadmapId, issueId: 'p', parentId: 'c', request: 'nest it' })).toMatchObject({ ok: false, error: { code: 'refused', message: 'An issue can’t go inside itself or its sub-issues.' } })
  expect(await call('move_issue', { roadmapId, issueId: 'c', parentId: null, before: 'p', after: 's', request: 'both' })).toMatchObject({ ok: false, error: { code: 'bad_input', message: 'before and after: give one, not both.' } })
  const moved = await ok('move_issue', { roadmapId, issueId: 'c', parentId: null, before: 's', request: 'put the child just before S' })
  expect(moved.issues[0]).toMatchObject({ id: 'c', parentId: null })
  const roots = (await ok('get_roadmap', { roadmapId })).issues as { id: string }[]
  expect(roots.map((i) => i.id)).toEqual(['p', 'c', 's'])
})

it('set_fields replaces the list and strips a removed field’s values', async () => {
  const { ok, call, db, acme } = await world()
  const roadmapId = String((await ok('create_roadmap', { name: 'P', prefix: 'PLN', request: 'add', workspaceId: acme })).roadmapId)
  const country = { id: 'f1', name: 'Country', type: 'choice', options: [{ id: 'uk', name: 'UK' }] }
  await ok('set_fields', { roadmapId, request: 'Add country', fields: [country] })
  await db.writeRoadmap(ann.id, roadmapId, { op: 'create', issues: [{ id: 'i1', parentId: null, title: 'One', props: { fields: { f1: 'uk' } } }] }, 'app')
  const cleared = await ok('set_fields', { roadmapId, request: 'Drop country', fields: [] })
  expect(cleared.fields).toEqual([])
  expect((await db.getRoadmap(ann.id, roadmapId))!.issues.find((i) => i.id === 'i1')!.fields).toEqual({})
  expect(await call('set_fields', { roadmapId, request: 'empty name', fields: [{ id: 'f2', name: '  ', type: 'text' }] })).toMatchObject({ ok: false, error: { code: 'refused', message: 'Every field needs a name.' } })
  expect((await ok('get_roadmap', { roadmapId })).fields).toEqual([])
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/unit/roadmap-tools.test.ts -t "delete_issue|move_issue|set_fields"`

Expected: FAIL. Unknown tools.

- [ ] **Step 3: Implement the three tools**

Sibling check before `saveRoadmap`: a `before` or `after` id must be a live issue whose `parentId` equals the destination `parentId`, and must not be the moved id. Else `refused` / `No such issue.`

`delete_issue` and `move_issue` and `set_fields` all call `requireRequest`. Service overwrite: if `t.name === 'delete_issue'`, `result.deleted = saved.changed.length`. If `t.name === 'set_fields'`, `result.fields = fresh.roadmap.fields`.

Do not reimplement `MAX_DEPTH`. Add this test beside the cycle one. `canParent` fails when `parentDepth + height > 12`. A root is depth 1, so `i12` is depth 12 and a new issue under it (height 1) refuses. One `db.writeRoadmap` create: `i1` parent null, `i2` parent `i1`, … `i12` parent `i11`, plus `extra` parent null. Then:

```ts
expect(await call('move_issue', { roadmapId, issueId: 'extra', parentId: 'i12', request: 'nest it deeper' })).toMatchObject({ ok: false, error: { code: 'refused', message: 'Issues nest 12 levels deep at most.' } })
expect((await db.getRoadmap(ann.id, roadmapId))!.issues.find((i) => i.id === 'extra')!.parentId).toBeNull()
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/unit/roadmap-tools.test.ts tests/unit/tools-registry.test.ts -u`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/tools/roadmaps.ts api/_lib/roadmap-service.ts tests/unit/roadmap-tools.test.ts tests/unit/tools-registry.test.ts tests/unit/__snapshots__/tools-registry.test.ts.snap
git commit -m "$(cat <<'EOF'
feat: move, delete, and define fields on a roadmap from the agent

EOF
)"
```

---

### Task 8: Guide, instructions, MCP resource, REST

**Files:**
- Modify: `src/engine/tools/guide-text.ts`
- Modify: `src/engine/tools/guide.ts`
- Modify: `src/engine/tools/instructions.ts`
- Modify: `api/_lib/mcp.ts`
- Test: `tests/unit/roadmap-tools.test.ts`
- Test: `tests/unit/mcp.test.ts` (resource list) or the new file's MCP describe — put it in `roadmap-tools.test.ts` so `mcp.test.ts` stays the host smoke test. Add one `expect(resources.map(r => r.uri)).toContain('smartchart://guide/roadmap')` in `tests/unit/mcp.test.ts` only if that test already lists resources; it does (`resources: the guide and template cards`). Add the uri there.

**Interfaces:**
- Consumes: `docGuideText` / `guideText` pattern, `resources()` / `readResource` in `mcp.ts`, `INSTRUCTIONS`, `restHandler`.
- Produces: `export function roadmapGuideText(): string`. `get_guide` with `style: "roadmap"` returns `{ style: "roadmap", guide: roadmapGuideText() }`. Resource `smartchart://guide/roadmap`, name `Writing guide (roadmaps)`, mimeType `text/markdown`.

`get_guide` input enum becomes `consulting | pitch | doc | roadmap`. Description: `The deck's style (get_deck shows it), "doc" for writing docs, or "roadmap" for a roadmap.` `list_templates` and `get_template` keep the old enum.

Guide text, exact:

```ts
export function roadmapGuideText(): string {
  return [`# Roadmaps
A roadmap is a page of issues. An issue's key is the roadmap's prefix plus its number. You write titles, status, dates, assignees, and the fields that roadmap defined. You do not set colours, layout, or page numbers.

# Tools
list_roadmaps, create_roadmap (give the user links.edit), get_roadmap, list_issues, get_issue, create_issues, update_issue, move_issue, list_changes, delete_issue, set_fields. Nest a page with move_page and kind "roadmap". get_roadmap, list_issues, get_issue, and every write already include check ids.

# Checks
Checks warn. They never authorise a silent edit. Change an issue only when the user's words ask for that change.

# Writes
Pass request: the user's own words, on every write. delete_issue only when the user asked. Field names come from the roadmap (get_roadmap lists them). Do not invent Workstream, Country, Function, or Epic.

# Timeline
A timeline slide is a snapshot. Write it with create_slide and chart.kind "timeline". The slide does not subscribe to the roadmap. Periods: 3–16, each label at most 8 characters. Rows: at most 12 lines, at most 8 level-0 workstreams. A level-0 row with level-1 rows under it is a group and omits its own start and end. Milestones: at most 6, label at most 16.`].join("\n\n");
}
```

Append to `INSTRUCTIONS`, after the docs paragraph:

```ts
Roadmaps (same workspaces): list_roadmaps or create_roadmap; get_guide with style "roadmap"; get_roadmap; then list_issues and get_issue. create_issues, update_issue, move_issue, and set_fields change the plan; delete_issue only when the user asked. Pass request on every write. Check ids on the result warn and never authorise a silent edit. move_page takes kind "roadmap".
```

- [ ] **Step 1: Write the failing tests**

```ts
it('get_guide roadmap names the rules, and list_templates rejects that style', async () => {
  const { ok, call } = await world()
  const g = String((await ok('get_guide', { style: 'roadmap' })).guide)
  expect(g).toContain('Checks warn. They never authorise a silent edit.')
  expect(g).toContain('Pass request: the user\'s own words, on every write.')
  expect(g).toContain('Do not invent Workstream, Country, Function, or Epic.')
  expect(g).toContain('Periods: 3–16')
  expect(g).not.toContain('check_roadmap')
  expect(await call('list_templates', { style: 'roadmap' })).toMatchObject({ ok: false, error: { code: 'bad_input' } })
  expect(await call('get_template', { template: 'chart', style: 'roadmap' })).toMatchObject({ ok: false, error: { code: 'bad_input' } })
})

Imports for that second test, at the top of `roadmap-tools.test.ts`: `Client` and `StreamableHTTPClientTransport` (same paths as `tests/unit/doc-tools.test.ts`), `mcpHandler` from `api/_lib/mcp`, `restHandler` from `api/_lib/rest`, `fakeJev` from `./fakes`.

```ts
it('serves the roadmap guide as an MCP resource and over REST', async () => {
  const db = fakeDb()
  const handle = mcpHandler({ userFrom: async () => ({ id: 'u1', email: 'a@b.c', name: '', via: 'key' }), db: () => db, jev: fakeJev() })
  const fetcher: typeof fetch = async (input, init) => handle(new Request(input instanceof Request ? input : String(input), init))
  const c = new Client({ name: 'test', version: '1' })
  await c.connect(new StreamableHTTPClientTransport(new URL('https://app.test/mcp/v1'), { fetch: fetcher }))
  expect((await c.listResources()).resources.map((r) => r.uri)).toContain('smartchart://guide/roadmap')
  const res = await c.readResource({ uri: 'smartchart://guide/roadmap' })
  expect(String((res.contents[0] as { text: string }).text)).toContain('Checks warn.')
  const rest = restHandler({ userFrom: async () => ({ id: 'u1', email: 'a@b.c', name: '', via: 'key' }), db: () => db, jev: fakeJev() })
  const created = await rest(new Request('https://app.test/api/v1/create_roadmap', { method: 'POST', body: JSON.stringify({ name: 'P', prefix: 'PLN', request: 'add' }) }))
  expect(created.status).toBe(200)
  expect((await created.json()).links.edit).toMatch(/\/r\/rm_/)
  const missing = await rest(new Request('https://app.test/api/v1/check_roadmap', { method: 'POST', body: '{}' }))
  expect(missing.status).toBe(400)
  expect(await missing.json()).toMatchObject({ error: { code: 'bad_input', message: 'Unknown tool check_roadmap.' } })
})
```

`check_roadmap` is unknown, so `runTool` returns `bad_input` / `Unknown tool check_roadmap.` and REST status 400 (`STATUS.bad_input`). Assert that message. Also assert `TOOLS` names do not include `check_roadmap` or `roadmap_timeline` (the registry test's exact array already does this once Task 7's order is in; repeat it here so the guide task cannot register either by mistake):

```ts
expect(TOOLS.map((t) => t.name)).not.toContain('check_roadmap')
expect(TOOLS.map((t) => t.name)).not.toContain('roadmap_timeline')
```

And `expect(INSTRUCTIONS).toContain('get_guide with style "roadmap"')`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/unit/roadmap-tools.test.ts tests/unit/mcp.test.ts -t "roadmap|guide and template"`

Expected: FAIL. `get_guide` rejects `style: "roadmap"` (`must be one of consulting, pitch, doc`). The resource uri is unknown.

- [ ] **Step 3: Add the guide page and the resource**

`guide.ts` `get_guide` handler: `style === "roadmap" ? roadmapGuideText() : style === "doc" ? docGuideText() : guideText(style)`. Widen only that tool's schema enum and its TypeScript input type to `Style | "doc" | "roadmap"`.

`mcp.ts` `resources()` adds the uri next to the doc guide. `readResource` returns `roadmapGuideText()` for that uri.

- [ ] **Step 4: Run the tests and the gates**

Run: `npx vitest run tests/unit/roadmap-tools.test.ts tests/unit/mcp.test.ts tests/unit/tools-registry.test.ts tests/unit/pages-tool.test.ts tests/unit/roadmap-ops.test.ts tests/unit/db-fake.test.ts`

Expected: PASS.

Run: `npm run build` and `npm run lint`

Expected: both exit 0. `build` is the typecheck. No `any`, and `roadmaps.ts` / `roadmap-service.ts` / `roadmap-view.ts` each stay under ~300 lines. If `roadmaps.ts` is over, move the chip schema constants into `src/engine/tools/roadmap-input.ts` and re-run build.

- [ ] **Step 5: Commit**

```bash
git add src/engine/tools/guide-text.ts src/engine/tools/guide.ts src/engine/tools/instructions.ts api/_lib/mcp.ts tests/unit/roadmap-tools.test.ts tests/unit/mcp.test.ts
git commit -m "$(cat <<'EOF'
feat: add the roadmap writing guide to MCP

EOF
)"
```

---

## Spec coverage

| Spec requirement | Task |
|---|---|
| Eleven tools except `roadmap_timeline` | 4, 5, 6, 7 |
| Scope `roadmap`, port methods, no new Vercel function | 4 |
| Check ids on reads, no `check_roadmap` | 4, 5, 8 |
| `checks` on writes for touched issues | 6 |
| `list_issues` chips, AND, tree order, no dimmed ancestors | 5 |
| `create_issues` refs, one transaction, no field copy | 2, 6 |
| `update_issue` paths and ops sentences | 6 |
| `move_issue` parent / before / after, cycle, depth | 7 |
| `list_changes` since a date, log rows, not a paragraph | 3, 5 |
| `delete_issue` subtree count, `request` | 7 |
| `set_fields` whole list, strip values | 7 |
| `move_page` kind `roadmap` | 1 |
| `get_guide` style `roadmap` | 8 |
| Viewer reads, writes return the not-allowed sentence | 4, 7 |
| `by_client` is the agent client | 6 |
| `links.edit` is `/r/:id`, parent shape matches `list_decks` | 4 |
| Registry snapshot | 4–7 |
| In-app chat, `roadmap_timeline`, `timelineDraft` | Out. Not tasked. |

## Spec disagreements

These are followed as written in Decisions, not "fixed" back toward the spec sentence:

- **One `deleted` event on the root.** Shipped `applyOp` emits one `deleted` event per node, same `deletedAt`. The count the tool returns is the subtree size. Event rows stay as ops writes them.
- **`issues` / `warnings` when validation refuses.** A refusal does not apply, so the agent gets `error.message` equal to the ops sentence, not a `warnings` array beside a partial write.
- **`request` "as deck writes do".** Decks store it as the version label. Roadmaps have nowhere to store it without a new column. The plan requires the argument and stores `by_client` only.
- **Viewer copy.** `writeRoadmap` returns `NO_EDIT` (`You can view this workspace, not change it.`). The app's delete helper sometimes says `You can view this roadmap, not edit it.` MCP returns `NO_EDIT`, which is what the database method already returns.
- **`todayIso()` vs the screen.** The screen's `runChecks` date is `toISOString().slice(0, 10)`. `dates.ts` `todayIso()` is local. Tools use the screen expression.
- **The guide points at timeline limits** while `roadmap_timeline` is out of this plan. The guide states the limits and `create_slide` / `chart.kind: "timeline"`. It does not name `roadmap_timeline` or `check_roadmap`, so an agent is not told to call a tool that does not exist.
- **`get_issue` "the latest events".** `getIssueDetail` returns every event for that issue, oldest first. This plan returns all of them (with `at` as an ISO string). It does not truncate to a page.
- **Viewer `create_roadmap`.** `createRoadmap` returns `'foreign'` when `home()` is not a writable workspace (the fake and the SQL insert both do). The service maps that the way `runDocTool` maps a foreign create: `You can view this workspace, not add to it.` A write on an existing roadmap the viewer can read still returns `NO_EDIT` from `writeRoadmap`.
- **`list_issues` has no `limit` in the spec.** Paging is in Decisions so a 5,000-issue roadmap is not one payload.
