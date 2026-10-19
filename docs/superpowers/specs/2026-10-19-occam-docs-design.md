# Occam Docs: design

> Status: approved 2026-10-19. Build order and milestones are at the end; each milestone gets its own plan when it starts.


## Context

Occam makes slides you build by chatting, held to the Apple bar. The thinking behind a deck usually sits in a long document, and today those documents are walls of text in Confluence or Google Docs. Three kinds come first:

- **Research**: regulation state by country for the Finbridge credit cards, and competitor research per competitor (revenue-growth charts, strengths and weaknesses, comparison tables). The co-founding team reads it.
- **PRDs**: engineers read them to build from.
- **Legal research**: the co-founders read it.

**Occam Docs** makes those documents with the same components and the same beauty as the slides. Every doc has a title and a table of contents. Its sections fold and unfold. The evidence is live components: charts, tables, scorecards, cards and numbers, each with a caption, notes and a source. When a number changes, it's an edit, not a new screenshot. Docs and decks live together in a team workspace with a Notion-like sidebar. People edit by hand, and agents edit over MCP.

### Decisions the user made (2026-10-19)

1. **Workspace:** a team workspace with members and roles (owner, editor, viewer). Docs **and** decks live in it. Existing decks move into their owner's workspace.
2. **Editing:** one writer at a time, as decks work today: presence shows who is editing, each save carries a revision, and a save from a stale revision is refused. No live multiplayer.
3. **AI:** v1 has MCP and hand editing only. An in-app chat agent for docs comes next (to be added to `docs/product/FUTURE.md`).
4. **Disclosure:** a doc opens fully readable. The table of contents sits on the side, and any section can be folded.

### Hard constraints (from the request and CLAUDE.md)

- Charts, editing and styling are **one implementation** shared by decks and docs. Only the layout differs.
- Content is separate from how it looks. A doc is a plain text file that a person or an AI can edit, and Occam draws it.
- Deck checks that look at **content** carry over to docs. They warn and never rewrite. Checks that measure layout stay with slides.
- The thin harness rule, the one starters file (`src/engine/starters/starters.json`), shadcn primitives, no `any` and no inline styles all still apply. Fixes happen at engine level.

### Anti-goals

- A Notion clone with free-form styling (colours, fonts and sizes picked by hand). The writer configures and Occam designs.
- Charts as pictures, or a second chart or table implementation that drifts from the slides.
- Checks that change the text.

---

## Design

### 1. The doc file (content)

A doc is **one Markdown file** with front matter. Components are fenced blocks whose body is the **same JSON schema the slides use**, so validation, the edit grid, the colour allocator and the checks all reuse what already exists.

````md
---
title: Finbridge competitor research
subtitle: Five issuers, revenue and position, October 2026
---

## Revenue growth {#growth}

Revolut grew fastest, **[[3.1× in four years]]**; see [the scorecard](#scorecard).

```occam:chart {#rev}
{ "caption": "Revenue, £m, 2021–2025", "source": "Company filings",
  "chart": { "kind": "bars", "categories": ["2021","2022","2023","2024","2025"],
             "series": [{ "name": "Revolut", "values": [261,636,1100,1800,2500], "color": "focus" }] },
  "notes": [{ "title": "Fastest growth", "text": "…" }] }
```

- Bullets and 1. numbered lists are plain Markdown.
````

- **The title** is required (front matter). The **table of contents** is generated from the `##` and `###` headings. It is never written in the file.
- **Sections** are `##` headings and subsections are `###`. A heading can carry an id (`{#growth}`) so links can point at it. Code gives a heading an id when it has none.
- **Text** uses Markdown plus the slide markup Occam already has: `**bold**`, `[[focus]]`, `[-loss-]`, `[+gain+]`, and `[words](https://…)` or `[words](#id)` (`src/engine/slides/markup.ts`, `schema.ts` `LINK_RE`).
- **Components** are written as `occam:<kind> {#id}`. Each one has a stable id, so an agent can address it the way it addresses `slideId`, and update it at exact paths (`update_block` with `set`, like `update_slide`).
- The parser and serializer round-trip: `parse(serialize(doc))` gives back the same doc. Editing by hand writes the Markdown back, so the file stays the source of truth, as the markup string is for slides today.

### 2. Components: one library, two layouts

The doc's block kinds:

| Group | Blocks | Source |
|---|---|---|
| Text | paragraph, `##` and `###` headings, bullets, numbered list, quote, divider | Markdown |
| Figures (shared with slides) | `chart` (bars, lines, waterfall, timeline/Gantt, ranked, matrix), `table` (marks, Harvey balls, focus, groups), `number` (key figure), `cards` (incl. framed contrast, e.g. strengths and weaknesses), `steps`, `summary` points, `pair` (two side by side), `image`, `team`, `logos`, `quote` | the slide schema in `src/engine/slides/schema.ts` and `types.ts` |
| New, docs need them | `callout` (note / decision / risk: one line of label and text, for PRDs and legal), `code` (fenced code for PRDs) | added to the shared library, so slides could use them later |

**The figure frame.** A figure is a component plus the furniture slides already have: `caption`, `notes` (beside it when wide, below it when narrow), `source`, `footnote` and `takeaway`. It is the same fields and the same markup.

**Sharing, concretely** (an engine-level refactor; slides must render pixel-identical before and after):
- `src/engine/components/`: the body renderers move here out of `render.ts`: `tableHTML`, `cardHTML`, `notesHTML`, marks, logos and pictures, plus `drawChart` and `charts/`. Each takes its data, a `room` (its width class) and a base path for `data-path`. `render.ts` keeps the slide frame (head, rail, footer, template layout) and calls the components.
- `components.css`: the component styles come out of `slides.css` with their tokens. `slides.css` imports it and keeps the frame. `doc.css` lays out the doc page: column width, the type scale, the TOC, folding, and figure spacing. Neither the app chrome nor `doc.css` styles inside a component, except through tokens the component exposes (the type scale and the room width).
- **The figure canvas (decided 2026-10-19).** Each figure is laid out on a canvas as wide as a slide's body (1664 px, with its own height; charts, pairs and images 640 px tall) using `components.css` unchanged, and the canvas is scaled to its frame, as a slide is scaled to its frame. Figures run wider than the 720 px text, up to 1040 px, so they read at the body text's size (scale .625), and notes sit beside a figure through the slide's own split. Under a 600 px frame (phones) the notes leave the canvas and follow it as a numbered list, and the figure opens full size in a dialog that scrolls sideways. Callouts and code are words, so their canvas takes whatever width keeps that scale and they sit in the text column. Charts draw into the canvas as into any host (`drawCharts`, `components/charts/hosts.ts`).
- Colour: `colours.ts` (the allocator) runs per figure. Theme and accent are set per doc, as on a deck (`update_doc`), and default to the workspace's brand colours (`api/_lib/brand.ts`).

### 3. The doc page (layout)

- **Workspace shell (Notion-like):** a left sidebar with the workspace switcher and the docs and decks, newest first, with create, rename, delete and reorder (pattern: `use-established-ui-patterns`). The sidebar can be hidden (button and ⌘\\). The current `Decks.tsx` list becomes this sidebar.
- **The doc:** a centred reading column with the title, subtitle and byline at the top. A sticky TOC sits on the right on wide screens and in a dropdown on narrow ones; it highlights the section you're reading. Each `##` section has a fold chevron, and all sections are open on load. A link to a `#id` unfolds that section and scrolls to it. Fold state stays per viewer in localStorage.
- **Read mode is the default view.** Edit mode puts the same page into editing. Share links and print and PDF use the read view (print unfolds everything). Sharing reuses `api/_lib/share.ts`.

### 4. Editing by hand

- **Text:** a block editor over the Markdown. Type in a paragraph, press Enter for a new block, and use `/` to insert a block (the slash menu lists the component kinds, select then confirm). Bold, Focus and Link work as they do on slides (`markup.ts` `toggle`, `applyText`). A block can be dragged to reorder it or deleted.
- **Components:** clicking a figure opens **the same editing UI decks use**: the data grid (`src/engine/slides/sheet.ts`), list add and remove (`edit.ts` `listOps`, made schema-generic rather than slide-generic), and the focus, marks and score menus. The edit ops become patch sets on the block, through the same `applyPatch` path agents use (`src/engine/agent/patch.ts`).
- **Inserting** a component starts it from a starter. Doc starters live in the same `starters.json`, under a doc section (a rule: one gallery source).
- **Comments, versions and undo** reuse `src/engine/comments.ts` and `src/engine/versions.ts`. In docs, a blob is a block rather than a slide, and the tree is the ordered block ids.

### 5. Workspaces and access

- **Tables:** `workspaces (id, name, brand)` and `members (workspace_id, user_id, role: owner|editor|viewer)`. Invites go by email link: a token row that turns into membership on sign-in through Neon Auth. `decks` and the new `docs` table get a `workspace_id`.
- **Access** moves from checking `user_id` to "is the user a member with a role that allows this". Viewers read and comment. Editors create, edit and delete. Owners also manage members. Every `Db` call takes the user and checks membership in SQL, as it checks `user_id` today (`api/_lib/db.ts`).
- **Migration:** each existing user gets a personal workspace named after them, and their decks move into it. Agent keys act as their user across that user's workspaces. MCP tools take an optional `workspaceId`, defaulting to the one most recently used.
- **Storage:** a `docs` table mirrors `decks`: `id`, `workspace_id`, `name`, `data` (the Markdown source plus parsed metadata), `rev`, `presence` and `share_id`, with `doc_versions` and `doc_blobs`. A doc is stored as its Markdown text, which is the "file" in constraint 2.

### 6. MCP and the agent tools

New tools join the same registry (`src/engine/tools/`) and the same `runTool` and `deck-service` path:
- `list_workspaces`, `list_docs`, `create_doc`, `get_doc` (returns the Markdown with block ids, the outline and `links.edit`), `update_doc` (title, look).
- `write_doc_text` (replace a section's or a paragraph's Markdown by id), `create_block` (after an id), `update_block` (`set` at exact paths, like `update_slide`), `move_block`, `delete_block`, `check_doc`.
- `get_guide` gains a `docs` guide, and `get_template` covers block kinds (the same cards, with doc limits).
- `INSTRUCTIONS` (`src/engine/tools/instructions.ts`) gets a docs paragraph. The editor watches the doc live, as it does for decks (`deck_events`).

### 7. Checks for docs (content only; they warn and never rewrite)

The checks run per figure and reuse the code in `src/engine/agent/checks.ts` and `soft.ts`. A figure's caption plays the role of a slide title.

| Carries over | Why |
|---|---|
| R4 at most one focus element per figure | content |
| R5, R9, R13 units present, at most 2 units, no mixed units or decimals | data |
| R8 figures have a source or footnote | content |
| R11, R12 numbers claimed in the caption or nearby text exist in the data | content |
| R14 bars sorted largest first | data |
| R15 alt text says what the picture shows | content |
| S2 a claimed change has an annotation; S3 judgements as marks | soft |
| J9, J10 table cell and icon judgments (Jev, as now) | content |
| C1 chart labels, R15 colours (`chartLabelLints`, `colourLints`, per chart host) | per component, not page layout |

**They don't carry over:** R1–R3, J1 (titles in 1920 px), R6 and J5 (takeaway against title), R7, R10 and J8 (density for one slide), J6 and J7, and every fit and layout lint in `lints.ts`.

**One new doc-level check, structure only:** a figure with no caption, and an empty section. Nothing else is added.

The checks show on the figure, as a badge with a popover, as they do on slides. `check_doc` returns them by block id.

---

## Build order

There are five milestones. Each one gets its own detailed plan (`superpowers:writing-plans`) when it starts, and work stops at each milestone boundary (memory: inline execution).

**M0. Write the spec.** Commit this design as `docs/superpowers/specs/2026-10-19-occam-docs-design.md`, and add "in-app doc chat agent" and "live multiplayer" to `docs/product/FUTURE.md`.

**M1. Extract the shared components (no change users can see).** *Built 2026-10-19, commits `015dd4a..` (see the M1 plan); the look lock showed 344 of 344 slides pixel-identical.* Move the component renderers and their CSS into `src/engine/components/` and `components.css`. `render.ts` and `slides.css` keep only the frame.
- *Done when:* the review page (`/src/dev/review.html`, including `?stress=1` and `?theme=paper`) shows zero diffs from a baseline taken before the move, and `npm test` and `npm run test:browser` pass.

**M2. The doc format and the read view.** *Built 2026-10-19 (plan `docs/superpowers/plans/2026-10-19-docs-m2-format-and-read-view.md`): every doc starter reads clean (no C1 or R15) at 343, 720 and 1040 px in both themes; dev page `/src/dev/docs.html`. Calls made there: ids on headings and figures only; no `occam:quote` (a quote is Markdown `>`); doc figures use the consulting style and docs default to paper; doc tables take 20 rows and no row budget; `starters.json` is `{ slides, docs }`.* Build `src/engine/docs/`: the parser and serializer (round-trip tests), validation (block bodies validated by the slide schema, plus the doc rules), the doc renderer (`doc.css`, TOC, folding, figure frame), and the `callout` and `code` blocks. Add a dev review page, `src/dev/docs.html`, that renders the doc starters (a competitor teardown, a PRD and a legal memo) in both themes.
- *Done when:* every starter renders with no C1 or R15 issues at three column widths, and the user reviews the page.

**M3. Workspaces.** *Built 2026-10-19, commits `7008fe7..` (plan `docs/superpowers/plans/2026-10-19-occam-docs-m3-workspaces.md`): the done-when runs through the real API on a Neon branch (`tests/unit/db-sql.test.ts`), and the browser tests cover the sidebar, members, invites and the viewer's view. Calls made there: viewers read and present, and commenting waits for M4 (a comment is still written inside the deck); invites are links the owner copies and sends, good for that email for 7 days, and no email is sent; a refused write by a member says why (403), a non-member's reads as missing (404); the last owner can't leave or be demoted; each user's personal workspace is made on their first request and takes every deck they made before; agent keys list and choose workspaces but don't manage members; `list_decks` and `create_deck` without a `workspaceId` use the most recently used workspace; a save never moves a deck between workspaces (Move to… is FUTURE #23); the sidebar hides below 900 px.* Add the tables and the migration, membership checks in `db.ts`, invites, and the workspace sidebar shell (docs and decks, which can be hidden). Decks keep working inside it.
- *Done when:* two test users share a workspace, a viewer can't edit, and existing decks show up in their owner's personal workspace.

**M4. The doc editor.** Add the block editor, the slash menu, reordering, and the component editing UI reused from decks (`sheet.ts`, `edit.ts` generalised), plus presence, rev conflicts, versions and comments.
- *Done when:* in the running app you can create a doc, write a section, insert and edit a chart and a table, reload, and the Markdown matches what you see.

**M5. MCP and the checks.** Add the doc tools, the guide, `check_doc` and the checks badges. Extend `tests/agent-harness` with doc tasks.
- *Done when:* a Claude Code session builds the competitor teardown over MCP end to end, and `check_doc` returns only warnings, with no rewrites.

## Critical files

- Reused as they are: `src/engine/components/charts/*`, `colours.ts`, `marks.ts`, `markup.ts`, `sheet.ts`, `src/engine/agent/patch.ts`, `checks.ts`, `soft.ts`, `src/engine/comments.ts`, `versions.ts`, `api/_lib/share.ts`, `api/_lib/brand.ts`, `api/_lib/mcp.ts`, `src/engine/tools/index.ts`
- Split: `src/engine/slides/render.ts` → `src/engine/components/*`; `slides.css` → `components.css` + frame
- Generalised: `src/engine/slides/edit.ts` (any schema root), `api/_lib/db.ts` (workspace membership), `src/app/components/Decks.tsx` → workspace sidebar
- New: `src/engine/docs/` (format, validate, render, checks), `src/app/components/docs/`, `api/docs.ts`, `src/engine/tools/docs.ts`, `src/dev/docs.html`

## Verification

- **Each milestone's "done when"** is listed above. Before and after M1, run the slide review page and Playwright to prove slides didn't change.
- **Unit:** the parser and serializer round-trip, validation and the checks mapping in `tests/unit`. Workspace access in the fake `Db`.
- **Browser:** `npm run test:browser` gets a docs smoke test: open the doc, fold a section, follow a TOC link, edit a chart value and see it redraw.
- **Look:** render every doc starter at full width and read it section by section (memory: review slides individually), and log a critique in `docs/temp/apple-bar-review.md`.
- **MCP:** run the live agent harness on three doc tasks (competitor research, PRD, legal memo).

## My calls (to check while reading)

- The format is Markdown with JSON component blocks, not YAML, so the slide schema and validation are reused unchanged.
- `callout` and `code` are the only new components.
- Doc theme and accent default to the workspace's brand colours.
- Docs are stored as Markdown text in Postgres, with no git and no files on disk.
- Fold state is per viewer, and print unfolds everything.
- Agent keys span all of a user's workspaces, and tools take an optional `workspaceId`.
- The doc's text has its own type scale. Figures are drawn on a slide-body-wide canvas (1664 px) with the slide CSS and scaled to a frame up to 1040 px wide, wider than the text; notes beside, below on phones, where figures also expand (the user chose this on 2026-10-19, revising "never scaled-down slides" and the first 1200 px canvas).
