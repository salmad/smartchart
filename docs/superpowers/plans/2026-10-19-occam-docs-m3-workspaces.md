# Docs M3: Workspaces Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task, inline. Steps use checkbox (`- [ ]`) syntax for tracking. Stop at the end of each task and report.

**Goal:** Decks and docs live in a workspace that has members with roles. An owner invites people by link. Editors can create, edit and delete. Viewers can only read. Every user starts with a personal workspace that holds the decks they already have. A Notion-like sidebar replaces the decks list: it has a workspace switcher, and below it the workspace's docs and decks.

**Done when** (spec M3): two test users share a workspace, a viewer can't edit, and existing decks show up in their owner's personal workspace. This is proven three ways:
- the API scenario test (Task 4) against the fake Db;
- the same Db contract suite run against a real Postgres branch (Task 3);
- a browser test of the shell (Task 9).

**Architecture:**
- **Access is membership.** `members (workspace_id, user_id, role)` decides who can do what. Every `Db` call keeps its `(userId, …)` signature but checks membership in SQL instead of `decks.user_id = $1`. Owner checks happen in the query itself, never in a separate read first. `decks.user_id` stays, and now means *the person who made it*.
- **The rule lives in one place.** `api/_lib/access.ts` maps each action to the lowest role that may take it. The SQL builds its `role in (…)` list from that same map, and so does the fake Db. A viewer's write gets the same answer as a deck that doesn't exist.
- **The migration is lazy and idempotent.** On a user's first request after deploy, `ensureWorkspace(user)` creates their personal workspace and owner membership, then moves their decks that have no workspace yet into it. We can't enumerate Neon Auth's users from our database, and a lazy step needs no one-off script. It runs once per user per cold start (memoised), and is a no-op after the first time.
- **Docs get their table now, and their editor in M4.** A `docs` table mirrors `decks` (the spec's §5 Storage). The sidebar lists docs, and opening one shows the M2 read view (`mountDoc`).
- **App:** `Sidebar.tsx` (and its parts) replaces `Decks.tsx`. A deck opened as a viewer renders through the read-only path `Shared.tsx` already uses, inside the shell.

**Tech Stack:** TypeScript (strict), Neon Postgres over HTTP (`@neondatabase/serverless`), Neon Auth, React 18 + shadcn/ui (Dropdown Menu, Dialog, Select, Input), vitest, Playwright. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-19-occam-docs-design.md` (§3 workspace shell, §5 Workspaces and access, M3).

## Global Constraints

- **Slides don't change.** M3 touches no slide rendering and no CSS inside slides. If a task does touch them, run the render lock and `LOOK=1` look lock before committing.
- **Nothing gets more open.** Each deck route keeps its tests for another user's deck (`api-accounts.test.ts`, `never shows, overwrites or deletes another user's deck`). They must still pass, now because the other user is not a member.
- **A refused write is never silent.** A viewer's save is answered `403 { error: 'You can view this deck, not edit it.' }`. The app shows that sentence, and never quietly drops the save.
- **Share links work as before.** Sharing is per deck, any editor can turn a deck's link on or off, and `/s/:token` doesn't change.
- **Dev account:** it has one local personal workspace, so the browser tests and `npm run dev` without accounts keep working. Its decks stay in localStorage.
- The usual rules apply:
  - No `any` and no inline styles.
  - Files stay under about 300 lines.
  - shadcn primitives (`npx shadcn@latest add select input` if they're missing).
  - Engine code is framework-free.
  - User-facing text says Occam.
  - Scratch notes go in `docs/temp/`.
- Every commit message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## My calls (for the user to check)

1. **Lazy migration, not a script.** A user's personal workspace and the move of their decks happen on their first request after deploy (see Architecture). The decks are untouched until their owner next signs in. That is invisible to anyone else, because nobody else could see those decks anyway.
2. **A personal workspace is a workspace like any other.** It is named after its owner, "Ann's workspace", using their Neon Auth name, else the part of their email before the @. It can be renamed and can take members. `personal_of` marks it, only so the migration is idempotent and the workspace can't be left or deleted.
3. **Invites are links, with no email sent.** The stack has no mail service. An owner enters an email and a role, and gets a link (`/i/<token>`) to send however they like. The link works only for that email once signed in, and expires after 7 days. The owner can revoke it. "Send the invite by email" goes to `docs/product/FUTURE.md`.
4. **Viewers read; commenting waits for M4.** Today a comment is written inside the deck's data, so a viewer's comment needs a narrow comment-only write. M4 builds comments for docs anyway, and does both there. **This departs from the spec's "viewers read and comment" for one milestone.**
5. **No reorder in M3.** The spec says "newest first, with … reorder", but a hand order and newest-first fight each other. The sidebar stays newest first, and reorder comes with M4's doc tree if you still want it.
6. **Docs in the sidebar.** In M3 the sidebar lists a workspace's docs and opens them in the read view. "New doc" makes one from a doc starter (the one gallery), and a doc can be renamed and deleted. Writing in a doc is M4.
7. **Agent keys span all of a user's workspaces.** `list_decks` and `create_deck` take an optional `workspaceId`, and a new `list_workspaces` tool lists them. The default workspace is the one the user opened most recently in the app (`members.used_at`).
8. **Roles:**
   - **Owner** manages members, invites and the workspace's name.
   - **Editor** creates, edits, shares and deletes decks and docs.
   - **Viewer** reads only.
   - A workspace always keeps at least one owner. The last owner can't leave or be demoted.
   - Deleting a whole workspace is not in M3.
9. **`brand` is a column now, with no UI yet.** `workspaces.brand jsonb` holds the accent hex. M4 uses it as a new doc's default look.
10. **The SQL gets a real test.** The Db contract suite (Task 2) also runs against a throwaway Neon branch when `TEST_DATABASE_URL` is set. I'd make the branch with the Neon tools, and **will ask before creating it**.

## Review Focus

1. **Every query that used `user_id = $1` now checks membership:**
   - decks: list, get, meta, put, delete, share, presence;
   - events;
   - versions: head, write, list;
   - blobs;
   - docs.
   The contract suite has one test per call: as a non-member it gets nothing, and as a viewer each write is refused (Task 2).
2. **A new deck lands in a workspace the writer can edit.** `putDeck` for a new id takes a `workspaceId` and refuses it unless the writer is an editor or owner there. An existing id ignores any `workspaceId` passed in: a save can't move a deck. Task 2 tests both.
3. **The migration runs twice safely.** Calling `ensureWorkspace` twice, or from two requests at once, gives one personal workspace (a unique index on `personal_of`, `on conflict do nothing`). Task 3 tests this against SQL.
4. **Invites can't be used by someone else.**
   - A token accepted by another email is refused.
   - An expired or revoked token is refused.
   - Accepting twice is a no-op.
   - Accepting never lowers a role the person already has.
   Task 4 tests all four.
5. **The last owner.** Demoting, removing or the leaving of a workspace's only owner is refused (409). Task 4 tests this.
6. **A viewer in the app.** A viewer opens a deck read-only, with no chat, no editing and no delete in its menu, and sees a "View only" mark. If they reach the editor anyway, by URL or a stale tab, the server's 403 is shown. Task 8 tests this.

---

### Task 1: The access rule (done, `37b6b6d`)

**Files:**
- Create: `api/_lib/access.ts`
- Test: `tests/unit/access.test.ts`

**Interfaces (Produces):**
```ts
export type Role = 'owner' | 'editor' | 'viewer'
export type Action = 'read' | 'write' | 'manage'   // read: open, list; write: create, save, delete, share, presence; manage: members, invites, rename the workspace
export const ROLES: readonly Role[]                 // ['owner', 'editor', 'viewer'], strongest first
export function can(role: Role | null, action: Action): boolean
/** The roles allowed an action, for SQL: `role = any($n)`. */
export function rolesFor(action: Action): Role[]
export const isRole: (v: unknown) => v is Role
```

- [x] **Step 1: Write the failing test.** It checks the 3 × 3 table: a viewer can only read, an editor can read and write, an owner can do all three, and `null` can do nothing. It also checks that `rolesFor('write')` is `['owner', 'editor']`.
- [x] **Step 2: Run it** (`npx vitest run tests/unit/access.test.ts`). Expected: FAIL, because the module is missing.
- [x] **Step 3: Implement it.**
- [x] **Step 4: Run it.** Expected: PASS.
- [x] **Step 5: Commit.** Message: "Workspaces: one access rule, owner, editor and viewer".

### Task 2: The Db contract: workspaces, members, invites, docs; deck calls by membership (fake Db) (done)

**Files:**
- Modify: `api/_lib/db.ts` (the interface and row types only; the SQL comes in Task 3), `tests/unit/fake-db.ts`
- Create: `tests/unit/db-contract.ts` (a suite of contract tests, `dbContract(make: () => Promise<Db>)`)
- Modify: `tests/unit/db-fake.test.ts` (runs `dbContract(fakeDb)` next to its own tests)

**Interfaces (Produces, in `db.ts`):**
```ts
export interface WorkspaceRow { id: string; name: string; role: Role; personal: boolean; members: number; usedAt: number | null }
export interface MemberRow { userId: string; email: string; name: string; role: Role }
export interface InviteRow { token: string; email: string; role: Role; expires: number }
export type InviteResult = { workspaceId: string; role: Role } | 'gone' | 'wrong_email'
export interface DocSummary { id: string; name: string; updated: number; workspaceId: string }
export interface DocRow extends DocSummary { text: string; rev: number }
// added to Db:
ensureWorkspace(user: { id: string; email: string; name: string }): Promise<string>   // the personal workspace id
listWorkspaces(userId: string): Promise<WorkspaceRow[]>                               // most recently used first
createWorkspace(userId: string, name: string): Promise<string>
renameWorkspace(userId: string, id: string, name: string): Promise<boolean>            // manage
touchWorkspace(userId: string, id: string): Promise<void>                              // sets members.used_at
listMembers(userId: string, id: string): Promise<MemberRow[] | null>                   // read; null: not a member
setRole(userId: string, id: string, member: string, role: Role | null): Promise<'ok' | 'last_owner' | 'denied'>  // null removes; a user may remove themselves
addInvite(userId: string, id: string, email: string, role: Role, token: string, expires: number): Promise<boolean>   // manage
listInvites(userId: string, id: string): Promise<InviteRow[] | null>
revokeInvite(userId: string, id: string, token: string): Promise<boolean>
acceptInvite(user: { id: string; email: string; name: string }, token: string, now: number): Promise<InviteResult>
deckRole(userId: string, deckId: string): Promise<Role | null>
// changed: listDecks(userId, workspaceId); putDeck(…, opts?: { named?: boolean; workspaceId?: string }) → PutResult, where 'foreign' also covers "not an editor here"
// docs mirror decks: listDocs(userId, workspaceId), getDoc(userId, id), putDoc(userId, id, name, text, baseRev, workspaceId?), deleteDoc(userId, id)
```

Contract tests (`db-contract.ts`). Each test makes its own users `ann`, `bob` and `cy`.
- [x] **Step 1: Write the failing tests:**
  - `'a user's first workspace is personal and holds their decks'`:
    - put two decks for ann the old way, without a workspace (the fake allows a null `workspaceId`, as old rows have);
    - call `ensureWorkspace(ann)` twice: it returns the same id both times;
    - `listWorkspaces(ann)` gives one row, `{ personal: true, role: 'owner', name: "Ann's workspace" }`;
    - `listDecks(ann, ws)` lists both decks.
  - `'a member sees the workspace's decks; a non-member sees nothing'`:
    - make bob an editor through invite and accept;
    - bob can list, get and save ann's deck;
    - cy gets `[]` and `null` everywhere, and `putDeck` answers `'foreign'`.
  - `'a viewer reads and cannot write'`: cy as a viewer can `getDeck` and `listDecks`, but gets `'foreign'` from `putDeck`, and `false` from `deleteDeck`, `setPresence`, `shareDeck` (`undefined`), `writeVersion` (no rows added) and `addEvents` (no rows added).
  - `'versions, blobs and events follow the deck, not the writer'`: bob's save records a version, and ann sees it in `listVersions` and `blobs`.
  - `'a new deck lands only where the writer can edit'`:
    - `putDeck` of a new id into a workspace where cy is a viewer gives `'foreign'`;
    - an existing deck saved with another `workspaceId` stays in its own workspace.
  - `'invites'`:
    - an invite for the wrong email gives `'wrong_email'`;
    - an expired or revoked one gives `'gone'`;
    - accepting twice is fine;
    - accepting as a viewer when the person is already an editor keeps editor;
    - only an owner can `addInvite`.
  - `'the last owner stays'`: `setRole(ann, ws, ann, 'editor')` and removing ann both give `'last_owner'`. Once bob is an owner, both work.
  - `'docs follow the same rules'`: a short version of the member, viewer and non-member tests, run on `putDoc`, `getDoc` and `deleteDoc`.
- [x] **Step 2: Run them** (`npx vitest run tests/unit/db-fake.test.ts`). Expected: FAIL.
- [x] **Step 3: Implement the fake.**
  - `fakeDb()` gains `workspaces`, `members`, `invites` and `docs` maps.
  - Every deck call goes through one `role(u, wsOfDeck)` helper that uses `can()` from Task 1.
  - Fix the existing fake-db callers (`api-*.test.ts`, `deck-service.test.ts`, `mcp*.test.ts`) by giving their users a workspace through `ensureWorkspace`. Do this in one helper, `seedUser(db, user)` in `tests/unit/fakes.ts`, so the tests don't each grow setup.
- [x] **Step 4: Run** `npm test`. Expected: PASS, with every existing test still green.
- [x] **Step 5: Commit.** Message: "Workspaces: the Db contract (members, invites, docs) and a fake that keeps it".

### Task 3: The SQL Db (done; Neon branch `m3-contract-tests`, schema only, expires 2026-10-26)

**Files:**
- Modify: `api/_lib/db.ts` (split into `api/_lib/db.ts` with the interface, `getDb` and the schema, `db-decks.ts`, and `db-workspaces.ts`, if it grows past about 300 lines)
- Create: `tests/unit/db-sql.test.ts` (`describe.skipIf(!process.env.TEST_DATABASE_URL)`, runs `dbContract` against `getDb()`, and truncates its tables first)

Schema added to `SCHEMA` (still run on cold start, idempotent):
```sql
create table if not exists workspaces (id text primary key, name text not null, brand jsonb, personal_of text unique, created timestamptz not null default now())
create table if not exists members (workspace_id text not null, user_id text not null, email text not null, name text not null default '', role text not null check (role in ('owner','editor','viewer')), used_at timestamptz, primary key (workspace_id, user_id))
create index if not exists members_user on members (user_id, used_at desc nulls last)
create table if not exists invites (token text primary key, workspace_id text not null, email text not null, role text not null, by_user text not null, expires timestamptz not null)
alter table decks add column if not exists workspace_id text
create index if not exists decks_ws on decks (workspace_id, updated_at desc)
create table if not exists docs (id text primary key, workspace_id text not null, user_id text not null, name text not null, text text not null, rev integer not null default 1, presence jsonb not null default '{}'::jsonb, share_id text, updated_at timestamptz not null default now())
create index if not exists docs_ws on docs (workspace_id, updated_at desc)
```
`doc_versions` and `doc_blobs` come in M4, which writes them.

The access pattern is one SQL fragment, built from `rolesFor`:
```sql
exists (select 1 from members m where m.workspace_id = decks.workspace_id and m.user_id = $1 and m.role = any($2))
```

- `ensureWorkspace` runs in three statements:
  1. insert the workspace, `on conflict (personal_of) do nothing`;
  2. insert the owner membership, `on conflict do nothing`;
  3. `update decks set workspace_id = $ws where user_id = $u and workspace_id is null`.
  The result is memoised per user in the module.

- [x] **Step 1: Ask the user** before creating a Neon branch for `TEST_DATABASE_URL` (call 10). If they say no, this task ships with the fake contract only, and the SQL is reviewed by reading it against the contract. Say so in the report.
- [x] **Step 2: Run** `TEST_DATABASE_URL=… npx vitest run tests/unit/db-sql.test.ts`. Expected: FAIL, because the queries still check `user_id`.
- [x] **Step 3: Implement it.**
  - Convert each query. `getDeck` and `getDeckMeta` also return the caller's `role`.
  - `putDeck`'s insert path becomes an `insert … select … where exists (editor membership on $workspace)`. Its update path checks membership on the row's own workspace.
  - `deleteDeck` removes versions by `deck_id` only, now that versions carry the writer and not the owner.
- [x] **Step 4: Run** the SQL suite, then `npm test` and `npm run build`. Expected: PASS.
- [x] **Step 5: Commit.** Message: "Workspaces in Postgres: membership checked in every query; existing decks move to their owner's personal workspace".

### Task 4: The workspaces API, and the decks and docs APIs by workspace

**Files:**
- Create: `api/_lib/workspaces.ts` (`workspacesHandler`), `api/workspaces.ts`, `api/_lib/docs.ts` (`docsHandler`), `api/docs.ts`
- Modify:
  - `api/_lib/auth.ts`: `User` gains `name`, `sessionUser` reads it, and an agent key's user gets the name stored on its key row, or `''`.
  - `api/_lib/decks.ts`: `GET ?workspace=` lists, `GET ?id=` returns `role`, `PUT` takes `workspaceId` for a new deck, and a viewer's write gets 403.
  - `api/_lib/share.ts`: a viewer gets 403.
  - `vercel.json`: no change, because `/i/:token` is an app route served by the existing catch-all.
- Test: `tests/unit/api-workspaces.test.ts`; extend `api-accounts.test.ts`.

Routes (`/api/workspaces`). Every route calls `ensureWorkspace(user)` first.

| Method | Query | Does | Role |
|---|---|---|---|
| GET | none | my workspaces | any |
| POST | none | `{ name }` → new workspace (owner) | signed in, session only |
| PUT | `?id=` | `{ name }` rename; `{ used: true }` touch | manage / read |
| GET | `?id=&members` | members and open invites | read (invites: manage) |
| PUT | `?id=&member=` | `{ role }` or `{ role: null }` | manage, or self-removal |
| POST | `?id=&invite` | `{ email, role }` → `{ link }` | manage |
| DELETE | `?id=&invite=` | revoke | manage |
| POST | `?accept=<token>` | → `{ workspaceId, role }` | the invited email |

Answers:
- A forbidden call gets 403 when the caller is a member, and 404 when they aren't (a non-member can't learn that a workspace exists).
- `last_owner` gets 409: "A workspace needs an owner. Make someone else owner first."
- `wrong_email` gets 403: "This invite is for another email. Sign in as {email} to accept it."
- `gone` gets 410: "This invite expired or was taken back."

- [ ] **Step 1: Write the failing tests** (`api-workspaces.test.ts`). The headline test, `'two people share a workspace; the viewer can't edit'`:
  1. Ann saves a deck, and it lists under her personal workspace.
  2. She invites bob as an editor and cy as a viewer. Both accept by token.
  3. Bob lists, opens and saves the deck (200).
  4. Cy opens it (200, `role: 'viewer'`). Cy's PUT gets 403 with the sentence above, and her DELETE and share POST get 403.
  5. A fourth user, dee, gets 404 on all of it.

  Then one test per row of the table: refused cases, the last owner, invite edge cases, and agent keys (`via: 'key'`) refused on POST, members and invite routes, because keys act on decks, not on who's in a workspace.
- [ ] **Step 2: Run them.** Expected: FAIL.
- [ ] **Step 3: Implement the handlers.** The invite token is `shareToken()`. `docsHandler` mirrors `decksHandler`'s list, get, put (rev, 409) and delete, and nothing more.
- [ ] **Step 4: Run** `npm test`. Expected: PASS, including the old `never shows, overwrites or deletes another user's deck` test.
- [ ] **Step 5: Commit.** Message: "Workspaces API: members, roles and invite links; decks and docs listed by workspace; viewers refused writes".

### Task 5: Agent tools across workspaces

**Files:**
- Modify:
  - `src/engine/tools/types.ts`: `AccountPort` gains `workspaces()`, and `listDecks` and `newDeck` take an optional `workspaceId`.
  - `src/engine/tools/account.ts` and `decks.ts`: `list_workspaces`, and an optional `workspaceId` on `list_decks` and `create_deck`.
  - `api/_lib/deck-service.ts`: resolves the default workspace (most recently used), and passes `workspaceId` into `putDeck` for scope `create`.
  - `src/engine/tools/instructions.ts`: one sentence on workspaces.
- Test: extend `tests/unit/deck-service.test.ts` and `mcp.test.ts`.

- [ ] **Step 1: Write the failing tests:**
  - `list_workspaces` returns `[{ workspaceId, name, role }]`, most recently used first;
  - `create_deck` without `workspaceId` lands in the most recently used workspace, and with one lands there;
  - `create_deck` into a workspace where the key's user is a viewer gives `refused` with the fix "Pick a workspace where you are an editor (list_workspaces).";
  - `update_slide` on a deck where the user is a viewer gives `refused`.
- [ ] **Step 2: Run them.** Expected: FAIL.
- [ ] **Step 3: Implement.** Map `'foreign'` to `not_found` when the user has no role, and to `refused` when the user is a viewer, using `deckRole`.
- [ ] **Step 4: Run** `npm test`. Expected: PASS. The MCP tool listing snapshot changes by the one new tool, and nothing else.
- [ ] **Step 5: Commit.** Message: "Agent keys act across a user's workspaces: list_workspaces, and a workspaceId on list and create".

### Task 6: The app's workspace client and the dev account's workspace

**Files:**
- Create: `src/app/workspaces.ts`. It holds `WorkspaceRepo` (list, create, rename, use, members, setRole, invite, revoke, accept), `remoteWorkspaceRepo`, and `localWorkspaceRepo` (one personal workspace, "Dev's workspace", owner, no members, in this browser).
- Modify:
  - `src/app/store.ts`: `DeckRepo.list(workspaceId)`.
  - `src/app/remote.ts`: `?workspace=`; a save's 403 becomes the viewer sentence, not `STALE`.
  - `src/app/state.ts` and `useAppState.ts`: hold `workspaceId` and `role`.
  - `src/app/route.ts`: adds `{ name: 'invite'; token }` for `/i/:token`, and `{ name: 'doc'; id }` for `/doc/:id`.
- Create, for docs: `src/app/docs.ts` (`DocRepo`: remote and local, the same shape as `DeckRepo`'s list, get, save and remove).
- Test: `tests/unit/workspaces-client.test.ts` (the remote repo against a stub fetcher), and `route.test.ts`.

- [ ] **Step 1: Write the failing tests:**
  - the remote repo's calls and error sentences;
  - `parseRoute('/i/abc')` and `parseRoute('/doc/x_1')`;
  - the local repo lists the dev account's existing localStorage decks under its one workspace.
- [ ] **Step 2: Run them.** Expected: FAIL.
- [ ] **Step 3: Implement.** The current workspace is the first entry in the list (the most recently used); switching calls `use`.
- [ ] **Step 4: Run** `npm test && npm run build`. Expected: PASS.
- [ ] **Step 5: Commit.** Message: "The app knows its workspace: workspace and doc clients, invite and doc routes".

### Task 7: The sidebar shell

**Files:**
- Create in `src/app/components/sidebar/`:
  - `Sidebar.tsx`: the frame; it hides with the existing button and ⌘\ (`usePanel`, `DECKS_OPEN`).
  - `WorkspaceSwitcher.tsx`: a shadcn Dropdown Menu listing the workspaces with their role, "New workspace…", and "Members…" for owners.
  - `ItemList.tsx`: one list used twice, Docs and Decks, newest first. Each row has create, rename and delete in its "…" menu. Editors and owners see the writes; viewers see none.
  - `RenameItem.tsx`.
- Modify:
  - `App.tsx`: passes the workspace in, replaces `<Decks>`, and adds "New doc" (starts a doc from the doc starter the user picks in a small dialog, using `starters.json` `docs`).
- Move: `ago()` from `Decks.tsx` into `src/app/components/sidebar/ago.ts`, then delete `Decks.tsx`, since the sidebar replaces it (the spec's §3: "The current Decks.tsx list becomes this sidebar").
- Test: `tests/browser/decks.spec.ts` (updated selectors), and a new `tests/browser/workspace.spec.ts`.

The design follows the existing sidebar's tokens and type: 248 px wide, mono section labels, 13 px rows. The switcher sits at the top as Linear's and Notion's do: the name, a chevron, the role in muted text for non-owners. There is no new colour, and design calls stay with the main model.

- [ ] **Step 1: Write the failing browser tests** (`workspace.spec.ts`, dev account):
  - the sidebar shows "Dev's workspace", with a Docs section and a Decks section;
  - a deck seeded in localStorage lists under Decks;
  - "New doc" from a starter lists it under Docs and opens the read view (`.doc` visible);
  - renaming a deck changes its row;
  - ⌘\ hides and shows the sidebar.
- [ ] **Step 2: Run them** (`npx playwright test -c tests/browser/playwright.config.ts tests/browser/workspace.spec.ts`). Expected: FAIL.
- [ ] **Step 3: Implement.** Keep every file under 300 lines.
- [ ] **Step 4: Run** `npm run lint && npm run build && npm test && npm run test:browser`. Expected: PASS. If `edit.spec.ts` fails on hover, re-run it once before calling it flaky.
- [ ] **Step 5: Look at it** at 1440 px and 900 px, in ink and paper app themes. Write a short critique in `docs/temp/apple-bar-review.md`, and fix anything below the bar before committing.
- [ ] **Step 6: Commit.** Message: "A workspace sidebar: switch workspaces, docs and decks newest first, hide it with ⌘\\".

### Task 8: Members, invites and the viewer's view

**Files:**
- Create:
  - `src/app/components/sidebar/Members.tsx`: a shadcn Dialog listing members (name, email, role Select) and open invites (revoke). "Invite" takes an email and a role, then shows the link with Copy.
  - `src/app/components/Invite.tsx`: the `/i/:token` screen. Signed out, it shows sign-in, then returns here. Signed in, it accepts, switches to that workspace and goes to `/`. When accepting fails, it shows the sentence from the API.
  - `src/app/components/ViewDeck.tsx`: a deck opened as a viewer, reusing the read-only slide path `Shared.tsx` uses, inside the shell, with a quiet "View only" mark in the bar.
- Modify: `App.tsx` and `Root.tsx`, to pick `ViewDeck` when `role === 'viewer'`, and to route `invite`.
- Test: `tests/browser/workspace.spec.ts` (with the API mocked through `page.route`, since the browser tests run without a database).

- [ ] **Step 1: Write the failing tests:**
  - with `/api/workspaces` and `/api/decks` mocked as a viewer, opening `/d/d_1` shows the slides and "View only", with no composer, no edit affordances on hover, and no "Delete deck…";
  - with the members API mocked, the owner's Members dialog lists two members, and inviting shows a copyable `/i/…` link;
  - `/i/tok` with a mocked accept goes to `/` and selects the workspace;
  - a mocked 403 on save shows the viewer sentence.
- [ ] **Step 2: Run them.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm run lint && npm run build && npm test && npm run test:browser`. Expected: PASS.
- [ ] **Step 5: Look at it.** Check the Members dialog and the view-only deck in both app themes. Critique, then fix.
- [ ] **Step 6: Commit.** Message: "Members and invite links; a viewer reads a deck and cannot edit it".

### Task 9: Done-when, docs and the spec

**Files:**
- Modify:
  - `docs/superpowers/specs/2026-10-19-occam-docs-design.md`: an M3 status line naming the calls made here.
  - `docs/product/FUTURE.md`: email invites; viewer comments, if they move past M4.

- [ ] **Step 1: Run the full suite:** `npm run lint`, `npm run build`, `npm test`, `npm run test:browser`, and `db-sql.test.ts` if a branch exists.
- [ ] **Step 2: Walk through done-when by hand** in `npm run dev` against the Neon test branch, if the user allows it:
  1. sign in as two test users;
  2. share a workspace;
  3. the viewer tries to edit and is refused;
  4. an existing deck shows in its owner's personal workspace.

  Record what was seen in the report, and say plainly anything that could not be run.
- [ ] **Step 3: Commit** the spec and FUTURE updates. Message: "Docs M3 done: workspaces with members and roles; decks moved into their owner's workspace". Then stop for the user's review.
