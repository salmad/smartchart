# Roadmaps: a system of record for a project's work

> Status: draft 2026-11-09, from a brainstorm with the owner. Mockups: `.superpowers/brainstorm/37137-1794152840/content/roadmap-views-v7.html` (gitignored; open through the brainstorm server or as a file). Calls marked **(my call)** were made by the writer, not the owner; check them.

## Why

The owner runs launches like "SME credit in UK, France and Singapore": hundreds of pieces of work across workstreams, countries and products, owned by a team. Today that lives in Jira plus a custom dashboard on top of it (matrix, Gantt, quality checks, CSV import). The dashboard was built only because Jira could not show the work the way he thinks about it, and the screenshots he shared are inspiration only: nothing from Jira is imported or kept.

Two gaps drive this:

1. **No single place where the work lives.** Slides carry a Gantt chart (`chart.kind: "timeline"`), but that is a snapshot for an audience, not the record. The record should be in Occam, next to the decks and docs about the same project.
2. **Linear's structure is right, its Gantt is not.** Linear's model (issues, any issue can be a parent) and its UX are the bar. But in Linear only projects get Gantt bars; issues and sub-issues can't be broken down on the timeline. Here every level gets a bar.

The bar for quality is the rest of Occam: restrained, precise, Linear/Revolut-level polish, the app's own dark tokens (`tailwind.config.js`), not the purple glow of the inspiration screenshots.

## Goals

1. A **roadmap** is a new kind of page. A workspace can have any number of them, anywhere in the page tree, with decks and docs nested under them if the user wants.
2. A roadmap holds **issues**. An issue can be the parent of any other issue in the same roadmap, to any depth (Linear's model). There are no epics, initiatives or other types: "a big piece of work" is an issue with children.
3. A few properties are **built in** and stored as SQL columns because every roadmap needs them and the views filter, sort, roll up and check them: title, status, assignee, start, due, parent and order. Progress is worked out, never stored (see Rollups).
4. Everything else is a **field the roadmap defines and names**: Workstream, Country, Product for the SME launch; something else for the next roadmap. Nothing in code knows these names. Field values are stored as JSON on the issue.
5. **Views over the same issues**, all driven by fields: Table (first), Gantt, Matrix, Checks. Filters and grouping work on any built-in property or field.
6. **The inside of an issue looks and edits like a doc**: the same page, type, slash menu, block handle and figures (`DocEditor`, `useDocEdit`).
7. **Everyone in the workspace who can edit can edit the whole roadmap**; assignees are workspace members who log in and update their own work.
8. Every change is **logged** (who, what, when), because this is a record.
9. Agents can read and write roadmaps over MCP and in the app, and can turn a filtered view into a timeline slide (last milestone).

## Non-goals

- **Importing Jira** or any existing data. A roadmap starts empty and fills up by hand and through the agent. (A CSV import may be useful later; not in this spec.)
- **Codes, keys in titles, epics, issue types.** Grouping is by fields, never by parsing names.
- **Matching issues by title.** The matrix lines up work by fields and by the parent/child tree only.
- **Per-issue permissions.** Access is the workspace's roles, as for every page.
- **Views across roadmaps** ("everything assigned to me everywhere"), notifications and email, dependencies ("blocks / blocked by" arrows), cycles/sprints, estimates, time tracking. Later, each its own spec.
- **Custom statuses.** One fixed set (below) **(my call)**: checks and rollups depend on what a status means.
- **Restoring a roadmap to an earlier version** (decks and docs have versions). The event log records history; restore is not built.

## Anti-goals (would make it a failure even if it works)

- A Jira clone: issue types, workflow editors, a settings maze. Fields are the only configuration.
- Hard-coded vocabulary (Function, Country, Epic) anywhere in code or UI.
- The agent silently rewriting the plan. Checks warn; they never change data (CLAUDE.md: "checks warn, they never silently rewrite").
- Progress shown twice, or colour used as decoration. Colour means status or a problem, nothing else.

## Concepts

- **Roadmap**: a page (`PageKind` gains `'roadmap'`). It has a name, a short **prefix** for readable keys (e.g. `SME`, chosen at creation and fixed: URLs use the issue's id, keys are for reading), its **field definitions**, and its issues.
- **Issue**: one row. Readable key `SME-142` (prefix + a number that never repeats inside the roadmap). Title, status, assignee, start, due, parent issue (or none), order among siblings, body (a doc), field values, comments.
- **Field definition**: `{ id, name, type, options? }`. Types in v1: **choice** (one option; each option has a name and an optional emoji, e.g. 🇬🇧), **text**, **number**, **date**, **person** (a workspace member). Values are stored by field id and option id, so renaming a field or an option changes nothing stored. Multi-choice is left out of v1 **(my call)**: it makes an issue sit in several matrix cells and several groups at once; add it when someone needs it.
- **Status** (fixed): Backlog, To do, In progress, Blocked, Done, Cancelled. Glyphs as in the mockup (Linear-style outline, half, filled with a tick; red for Blocked).

## Data

Same pattern as decks and docs (`api/_lib/db.ts`): real columns for what the server queries, JSON for the rest, schema statements appended to `SCHEMA` in the same idempotent style.

`roadmaps`: `id`, `workspace_id`, `user_id` (who made it), `name`, `prefix`, `fields jsonb` (definitions, ordered), `next_number int`, `seq bigint` (bumped on every write, see Live), `parent_kind`, `parent_id`, `sort_key` (page tree), `share_id` (unused in v1, reserved for symmetry), `updated_at`.

`issues`: `id`, `roadmap_id`, `number int` (unique per roadmap), `parent_id` (an issue id or null), `sort_key` (fractional order among siblings, `keyBetween` from `src/engine/pages/tree.ts`), `title`, `status`, `assignee` (user id or null), `start_date date`, `due_date date`, `body text` (the doc file format, as `docs.text`), `body_rev int` (the body's own revision, see Live), `fields jsonb` (`{ fieldId: value }`), `comments jsonb`, `seq bigint`, `created_by`, `created_at`, `updated_at`, `deleted_at` (soft delete).

Indexes: `(roadmap_id, parent_id)`, `(roadmap_id, seq)`, `(roadmap_id, number)` unique, GIN on `fields`.

`issue_events`: `roadmap_id`, `issue_id`, `user_id`, `by_client` (person or agent, as `deck_events.by_client`), `at`, `what` (`created`, `set`, `moved`, `commented`, `deleted`, `restored`), `changes jsonb` (`[{ path, from, to }]`).

Rules, all in the writing statement as the other writes are:

- Parent must be in the same roadmap; no cycles (walk up, as page moves do); no depth cap beyond a sanity limit **(my call: 12 levels)**.
- Field values are validated against the roadmap's definitions on write (unknown field id, wrong type, unknown option: refused with a sentence). Deleting a field definition removes its values from every issue in the same transaction, and logs it.
- Deleting an issue soft-deletes it and its whole subtree (`deleted_at`), after the UI says how many sub-issues go with it. Undo (a toast) restores them. No trash view and no retention rule in v1.
- Permission: the workspace roles (`api/_lib/access.ts`). Viewers read; editors and owners do everything inside the roadmap. That is the owner's "anyone in the project can edit".

Scale target: **up to 5,000 issues per roadmap**. The client loads every issue of a roadmap without bodies or comments in one call (a few hundred KB), and loads an issue's body and comments when it opens. Views compute on the client.

## Rollups and dates **(my call throughout)**

- **Progress** comes from status only, nothing is typed by hand, and counts like Linear's: every issue with no sub-issues below a parent counts once, Done as 100%, In progress as 25%, anything else 0%; Cancelled ones are left out. A parent's progress is the average over those issues (e.g. 2 Done and 1 In progress = 75%).
- **Dates.** Any issue can have its own start and due. A parent without dates takes the span of its children for display (Gantt bracket, matrix quarter); it is not written back. A check warns when a child runs outside its parent's own dates.
- **Milestone.** An issue whose start equals its due is drawn as a diamond on the Gantt. No separate type.
- **New sub-issue** starts with its parent's field values (copied once, not linked), so a task under "Underwriting, UK" is already Country UK, Workstream Vendors.

## The issue (inside of a ticket)

Opens two ways: a **side panel** over the current view (default when clicking a row, bar or cell) and a **full page** with its own URL (by issue id) (from "Open full page" or a pasted link).

- **Main column**: title; body in the doc editor (`DocEditor` + `useDocEdit`, same CSS from `doc.css` and `components.css`, slash menu, figures). Body editing follows the doc editor's edit-and-Save flow in v1 (it is how the editor works; autosave is a later change to the editor itself). Then **sub-issues** (inline add, drag to reorder, each with its status glyph), then **activity** (the event log and comments in one stream, newest last; a comment box at the bottom).
- **Properties** (rail on the full page, a block above the body in the side panel): status, assignee, dates, parent (and progress, read-only, on a parent); then "Fields" with the roadmap's own fields in their defined order. Properties save the moment they change, one event each.
- Comments in v1 are plain threaded text on the issue (not anchored to blocks like doc comments). Reusing parts of `Comments.tsx` is the builder's call.

## Views

All views share the top bar (roadmap name in the breadcrumb, view tabs, "New issue") and the filter row (chips: `field is / is not / is empty`, `status`, `assignee`, `dates before / after / overdue`; AND between chips; "+ Filter" adds one). Filters and display settings live in the URL and are remembered per user per roadmap in the browser **(my call)**; shared saved views come later.

### 1. Table (first milestone)

- Columns: status glyph, key, title, assignee, the roadmap's fields, start, due, progress (a bar on parents; the number on hover). The user picks visible columns and their order in Display.
- **Nesting**: issues show under their parent, collapsible, at any depth. **Group by** any choice or person field or status; grouping applies to the top-most issue shown in each tree, and its children stay under it whatever their own value **(my call, as Linear)**. Group headers show count and rolled-up progress.
- **Filtering with a tree**: an issue that matches shows with its ancestors as dimmed context, so it is never orphaned **(my call)**.
- **Selecting many**: click, shift-click, ⌘A. With rows selected: set a property for all of them, or Delete (Duplicate comes with the Matrix).
- **Editing in place**: click a status, assignee, date or field cell to change it; Enter on a row opens the panel; inline "add sub-issue"; drag a row to reorder or to re-parent. Keyboard: arrows to move, Enter to open, `c` to create, as in Linear.
- Sort: by order (default, the tree's own order), due, start, status, updated.

### 2. Gantt

- Scale Week / Month / Quarter; "Today" line and button; same rows, nesting, grouping and filters as the table.
- **Every issue with dates is a bar.** A parent is a thin bracket spanning its children (or its own dates); a leaf is a plain bar. No percentage labels. Labels appear only for what needs attention (overdue, blocked) and for milestones.
- Drag a bar to move it, drag its ends to change dates; drag an issue with no dates from the left onto the timeline to give it dates. Each drag is one event.
- Colour: neutral bars; Done fills green (`ok`); Blocked or overdue outlined red (`bad`). Nothing else is coloured.

### 3. Matrix

A pivot over fields and the issue tree; nothing reads titles.

**The shape it expects** (agreed with the owner): the same work across places is one parent issue with no place of its own, and children that each carry the place. "Underwriting" (Workstream Vendors, no Country) has children "Underwriting" with Country UK, France, Singapore, each with its own tasks below. Nothing forces this shape; a roadmap shaped otherwise still pivots, just with fewer lines that run across columns.

- **Rows**: an optional field to group by (e.g. Workstream), then the issues in that group at the top of their tree. A row expands into its children as sub-rows, as deep as the user opens.
- **Columns**: one or two fields (e.g. Country × Product); each column is one combination of option values. Options with no issues are hidden unless the user pins them.
- **A cell** holds the **top-most** issues under the row (the row issue itself included) whose values match the column; everything below a matching issue is rolled into it, not counted again **(my call)**. One top-most issue (the usual case: "Underwriting, UK"): its status, due quarter and progress. Several: their rolled-up progress, a count, and the worst state (Blocked or overdue outline). None: a dash ("not planned here").
- A value that spans places (a group-wide contract) is an option of its own, as "Global" was in the owner's old dashboard, not a multi-choice value.
- Group rows show rolled-up progress per column.
- Clicking a cell with one issue opens it; with several, opens a small list to pick from.
- "Cell shows" toggles: status, progress, dates, assignee.
- "Add Singapore" is done in the table: select the UK sub-issues, Duplicate, set Country. Duplicate (copy issues with their subtrees and fields, new keys, no comments or events) is a table action **(my call)**; the matrix shows the result.

### 4. Checks

Same philosophy as slide and doc checks: they point, the person or the agent decides. A tab with a count; each check is a card with its number and a click that opens the table filtered to the issues it found. v1 set **(my call; thresholds in one constant)**:

- No dates (open issues without start or due)
- Overdue (due passed, not Done or Cancelled)
- Blocked
- No assignee (open leaves)
- Long (a leaf longer than 3 months)
- Outside its parent (a child's dates outside its parent's own dates)
- Done with open children (a parent marked Done while children are open)

## Instant, like Linear

Linear is the direction for how this feels. Every action shows its result at once; the server catches up behind it. This is a requirement, not polish: it is what makes Linear feel unlike Jira. Most of it already exists in the app; reuse it rather than build a second way.

- **Local copy.** A roadmap is kept in this browser the way an open deck is (`src/app/cache.ts`, as `cached-decks.ts` does): its issues with the `seq` they were read at, and the bodies already opened. Opening a roadmap paints from that copy at once, then asks the server for changes since `seq` (the same call as Live editing below).
- **The body is a doc.** Editing an issue's body is the doc editor's own behaviour (`DocEditor`, `useDocEdit`): nothing new is built for it here.
- **Optimistic writes.** Status, assignee, dates, fields, title, create, reorder, re-parent, duplicate and delete change the screen the moment the user acts, then save in the background. If a save fails, the change is undone on screen and a toast says why. No spinners, and no button that waits for the server.
- **Nothing to load between views.** All issues are already on the client (see Data), so switching Table, Gantt and Matrix, filtering, grouping and sorting never call the server.
- **Opening an issue is instant.** The panel shows the title and properties straight away from what is loaded, and a body opened before from the local copy; the rest follows. Fetching them when the pointer rests on a row is the builder's call.
- **Keyboard first.** Every common action has a key and none waits for a response.

## Live editing

Several people edit one roadmap at once. Every write bumps `roadmaps.seq` and stamps the issue's `seq`; an open roadmap polls "changes since seq" (issues changed, events) and merges them, the way the open deck follows `deck_events`. Property writes are last-write-wins per property; the event log shows who changed what, and the open view picks up the change on its next poll. The body has its own `body_rev` and uses the doc editor's conflict rule (refuse on a moved `body_rev`), so a teammate changing the status never costs someone their body edit. Poll interval and the transport are the builder's call.

## Agent and MCP (last milestone)

Thin harness, as the rest of Occam: give the models tools, keep logic in rendering, validation and storage.

- MCP tools beside the deck and doc ones: `list_roadmaps`, `create_roadmap`, `get_roadmap` (fields and the issue tree without bodies), `list_issues` (filters as the UI's), `get_issue`, `create_issues` (many at once, with parents), `update_issue` (paths, like `update_slide`), `move_issue`, `list_changes` (the event log since a date, so the agent can write a status update), `delete_issue` (only when the user asked), `set_fields` (definitions). Every write passes the user's own words as `request`, as deck writes do, and lands in the event log as the agent.
- In the app: the chat panel works on a roadmap as it does on a deck or doc.
- **Roadmap to slide**: the agent reads a filtered view and writes a `chart.kind: "timeline"` slide (groups as `level: 1` rows, milestones), within the timeline's existing limits (16 periods, its row and label limits). The slide stays a snapshot; it does not update itself.

## Where the code goes (follows CLAUDE.md)

- `src/engine/roadmaps/`: framework-free and tested: types, field definitions and value validation, rollups, the filter model, grouping, the matrix pivot, checks.
- `api/_lib/db-roadmaps.ts` (calls added to `Db`, a fake for tests as for decks and docs), the roadmap routes inside an existing function file (the project uses 11 of the 12 functions the Vercel Hobby plan allows; don't spend the last one on this), page-tree changes in `src/engine/pages/tree.ts` and `api/_lib/pages.ts` (`'roadmap'` kind; delete removes subpages like the other kinds).
- `src/app/components/roadmap/`: the screen, the views, the issue panel and page; shadcn primitives; no file over ~300 lines; no inline styles.
- The sidebar shows a roadmap with its own icon in the one page tree; "New roadmap" sits with "New deck" and "New doc".

## Milestones

1. **Roadmap and table.** Page kind, data, fields editor (add, rename, reorder, delete fields and options), issues, the table with nesting, grouping, filters, editing in place, the issue panel and full page with the doc body, comments, the event log, live updates, the local copy and optimistic writes.
2. **Gantt.**
3. **Matrix**, and Duplicate.
4. **Checks, agent and MCP, roadmap to slide.**

Each milestone gets its own plan. Unit tests for everything in `src/engine/roadmaps/`; a browser test per view (create a roadmap, add issues, see them in the view).

## Left to the builder

- Exact schema details beyond the columns named above, ids format (`rm_…`, `iss_…` like the existing ones), indexes beyond those named.
- Virtualising long tables and Gantts; the poll interval and transport for live updates.
- Keyboard shortcuts beyond the ones named; the field editor's exact UI.
- How much of the doc comments component to reuse.
- The empty states and first-run copy (one sentence each, in the app's voice).
