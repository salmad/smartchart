# Docs M5: MCP and the Checks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task, inline. Steps use checkbox (`- [ ]`) syntax for tracking. Stop at the end of each task and report.

**Goal:** An agent reads and writes docs over MCP and REST with the same tool path as decks, and every figure in a doc gets the slide checks that are about content, shown as a badge on the figure and returned by `check_doc`. Checks warn; they never change the text.

**Done when** (spec M5): a Claude Code session builds the competitor teardown over MCP end to end, and `check_doc` returns only warnings, with no rewrites. Proven by the unit tests in Tasks 3 and 4 (the whole tool path against the fake `Db`, with the round trip and a `check_doc` that leaves the doc's `rev` and text alone) and by the live run in Task 6.

**Spec:** `docs/superpowers/specs/2026-10-19-occam-docs-design.md` (§6 MCP and the agent tools, §7 Checks for docs, M5).

**Architecture:**
- **Blocks are addressed by id.** Headings and figures have their ids in the file. A text block gets a read-time id, `t_` plus the hash of its JSON (`identify`), numbered `-2`, `-3` when two are equal. These ids are not stored: they change when the text does, so every write returns the doc's `blocks` list again, and a stale id is refused with the sentence "read the doc again".
- **Tools are pure functions of a `Doc`** (`src/engine/docs/ops.ts`), returning the new `Doc` or a sentence saying why not. The tool layer (`src/engine/tools/docs.ts`) turns that into results and `ToolError`s. The service saves `serializeDoc(doc)` with the revision it read, retries once on a conflict, and records a version, as it does for decks.
- **The registry gains two scopes**, `doc` (a doc is loaded) and `createDoc`, beside `deck` and `create`. `HandlerOut.doc` carries the new doc back, as `HandlerOut.deck` does.
- **Checks reuse the slide code.** A figure becomes `asSlide(figure)` with its caption as the title, and runs the carried rule checks (R5, R8, R9, R11, R13, R14, R15), `softChecks` (S2, S3) and, in `check_doc` only, the judgment checks J9 and J10. R4 is recomputed ("at most one focus element"). Two structural checks are new: a figure with no caption, and an empty section.
- **The badge is pure HTML.** `docHTML` draws a native `<details>` beside a figure's caption when its code checks fail, so the read view, the editor and print need no new script. Judgment checks (a model call) stay in `check_doc`.

**Tech Stack:** TypeScript strict, vitest, the MCP SDK client already used by `tests/unit/mcp*.test.ts`.

## Global Constraints

- **Checks warn, never rewrite.** No check, no tool and no autofix changes text the caller did not name. `check_doc` writes nothing: the doc's `rev` is the same after it.
- **The file is the source of truth.** Every write ends in `serializeDoc`, and `parseDoc(serializeDoc(doc))` gives back the same doc. Never write ids onto text blocks.
- **Viewers never write the doc.** A viewer's write is refused with `You can view this doc, not edit it.`; a non-member hears `No doc <id>.`
- **One tool path.** Docs use `runTool`, `checkInput`, the registry and the same error codes as decks. `tools/list` gives the same tool list to MCP, REST and the in-app agent.
- **Thin harness.** Code only where it is really hard (parsing, validation, checks); the guide and the tool descriptions do the rest. The agent configures, never designs: no tool sets colours, fonts or sizes beyond the doc's `theme` and `accent`.
- Usual rules: no `any`, no inline styles, files under ~300 lines, engine code framework-free, user-facing text says Occam, scratch notes in `docs/temp/`.
- Every commit message ends with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## My calls (for the user to check)

1. **No `deck_events` for docs.** The editor already polls the revision every 15 s and says "Ann saved a newer version" while editing, and reloads when reading. A second event log would say the same thing. Cost if wrong: the editor can't say which block an agent changed.
2. **Text blocks are addressed by content hash, not position.** The spec says `write_doc_text` replaces "a section's or a paragraph's Markdown by id", and paragraphs have no ids in the file. A read-time id keeps the file clean.
3. **`write_doc_text` replaces one block with the blocks its Markdown parses to** (a paragraph can become a paragraph and a list). Markdown that contains a figure, a raw block or front matter is refused: figures go through `create_block`.
4. **Figures through the tools are checked as the editor checks them:** all errors refuse the write (nothing applied), warnings come back.
5. **`get_guide` and `get_template` take `style: "doc"`** for the doc guide and the figure cards (with the doc's limits, such as 20 table rows), so no new tool names are added to learn.
6. **The badge shows code checks only.** The judgment checks need a model call, so they are in `check_doc`, not on every page view.
7. **Comments and versions of docs are not in M5's tools.** `list_versions`, `restore_version` and comment tools stay deck-only until asked for.

## Review Focus

1. **Markdown that looks like syntax** in `write_doc_text` or `create_block` (a paragraph starting `## `, `- `, `> `, a fence): it is parsed as what it looks like, and the result still round-trips. Pinned in Task 1.
2. **A stale block id** (the text changed since `get_doc`, or two paragraphs read the same): refused with the sentence that says to read again; the doc is unchanged. Pinned in Task 1.
3. **An agent writing while a person edits the doc by hand:** the write lands, the result says so (`notice`), and the person's next Save is refused as stale by the existing rev check. Pinned in Task 3.
4. **A viewer's write and a non-member's write:** the first is 403-worded, the second reads as missing; neither changes the doc. Pinned in Task 3.
5. **`check_doc` on a doc with a broken figure** (parse errors, a figure with no body): it reports and does not throw; the doc is untouched. Pinned in Task 2.

---

### Task 1: Block ids and the edit operations (Sonnet)  — done

**Files:**
- Create: `src/engine/docs/ops.ts`
- Test: `tests/unit/docs-ops.test.ts`

**Interfaces:**
- Produces (framework-free, pure):
  - `identify(doc: Doc): { id: string; block: Block }[]`: heading and figure blocks give their `id`; every other block gives `t_${hash(JSON.stringify(block))}` from `src/engine/versions.ts`, with `-2`, `-3` for repeats, in doc order.
  - `parseText(markdown: string): Block[] | string`: the blocks a Markdown fragment is (paragraphs, headings, lists, quotes, dividers, code); a sentence on figures, raw blocks or front matter. Uses `parseDoc` on a wrapped fragment; new headings get ids from `giveIds`.
  - `type Edit = { doc: Doc; ids: string[] } | string`: the new doc and the ids of the blocks the edit made or kept in place, or why not (a sentence naming the id and the fix).
  - `writeText(doc: Doc, blockId: string, markdown: string): Edit`
  - `createText(doc: Doc, after: string, markdown: string): Edit`; `createFigure(doc: Doc, after: string, kind: FigureKind, body: FigureBody, id?: string): Edit`. `after` is a block id, `"start"` or `"end"`. A figure id is made from its caption with `giveIds` when not given.
  - `updateFigure(doc: Doc, blockId: string, set: Record<string, unknown>): Edit`: `applyPatch` from `src/engine/agent/patch.ts` on the figure's body, then `validateDoc` on the result; any error refuses the whole edit.
  - `moveBlock(doc: Doc, blockId: string, after: string): Edit`; `deleteBlock(doc: Doc, blockId: string): Edit`.
  - `setLook(doc: Doc, look: { title?: string; subtitle?: string | null; theme?: Theme; accent?: string | null }): Edit`.

- [ ] **Step 1:** Write the failing tests in `tests/unit/docs-ops.test.ts`, over a small doc built with `parseDoc`:
  - `identify`: headings and figures keep their ids; two equal paragraphs get `t_x` and `t_x-2`; ids are the same on a second call.
  - `writeText` by a text id replaces that block and nothing else; a paragraph `"## Not a heading"` passed as Markdown becomes a heading block with an id; `parseDoc(serializeDoc(result.doc))` equals `result.doc` for every operation below (Review Focus 1).
  - `writeText` with a figure fence in the Markdown returns a sentence containing `create_block`; with an id that is not in the doc returns a sentence containing `read the doc again` and the doc is not changed (Review Focus 2); with an id that two blocks share (before disambiguation) is impossible because `identify` numbers them.
  - `createText` after `"start"`, `"end"` and a heading id puts the block in the right place; `createFigure` with a `chart` body missing `chart` returns the validator's sentence naming `#<id>.chart`.
  - `updateFigure` with `{ "cards[1].title": "New" }` changes only that path; with a path that does not exist returns the path error; with a value that fails the schema returns the error and the doc is unchanged.
  - `moveBlock` moves a figure after a heading; `deleteBlock` removes a block and returns the ids after; moving a block after itself returns a sentence.
  - `setLook` renames the title, clears a subtitle with `null`, rejects an accent that reads as red or green (the sentence from `validateDoc`).
- [ ] **Step 2:** Run `npx vitest run tests/unit/docs-ops.test.ts`. Expected: FAIL (module not found).
- [ ] **Step 3:** Implement `src/engine/docs/ops.ts`. Wrap `parseText`'s fragment in `---\ntitle: x\n---\n\n` and reject results that contain `figure`/`raw` blocks or errors; every op validates the new doc with `validateDoc` and returns its first error as the sentence; never mutate the input doc.
- [ ] **Step 4:** Run the tests. Expected: PASS. Run `npm run lint`.
- [ ] **Step 5:** Commit: "Docs M5: block ids and edit operations".

### Task 2: The doc checks and the badge (main model)  — done

**Files:**
- Create: `src/engine/docs/checks.ts`
- Modify: `src/engine/agent/checks.ts` (export `focusCount`), `src/engine/docs/render.ts` (the badge), `src/engine/docs/doc.css` (its styles)
- Test: `tests/unit/docs-checks.test.ts`, `tests/unit/docs-render.test.ts`, `tests/browser/docs.spec.ts`

**Interfaces:**
- Consumes: `identify` (Task 1); `ruleChecks`, `softChecks`, `judgmentChecks`, `Check` from `src/engine/agent/`; `asSlide` from `figure.ts`.
- Produces:
  - `interface DocCheck { blockId: string; id: string; ok: boolean; msg: string }` where `id` is one of `R4 R5 R8 R9 R11 R13 R14 R15 S2 S3 J9 J10 D1 D2` (D1: a figure has no caption; D2: a section is empty).
  - `figureChecks(f: FigureBlock): DocCheck[]`: code only, the carried rules and soft checks for one figure. Always returns `[]` for `callout` and `code`.
  - `checkDoc(doc: Doc, jev?: JevFn): Promise<DocCheck[]>`: every figure's `figureChecks`, D1 and D2, and J9, J10 for table figures through `judgmentChecks` (skipped without `jev`). Never throws: a figure that cannot be read gives one `ok: false` check saying so.
  - `export const focusCount` in `agent/checks.ts` (the existing function, exported).

- [ ] **Step 1:** Write the failing tests:
  - `figureChecks`: a chart figure with a caption and no source gives `R8` `ok: false`; the same with `source` gives `R8` `ok: true`; two `color: "focus"` series give `R4` `ok: false` and one gives `ok: true` with no title needed (the doc's R4 is "at most one"); a table with mixed units in a column gives `R13` false; a sorted-wrong single-series bar chart gives `R14` false; a caption that claims `"revenue grew 40%"` with no 40 anywhere in the data gives `R11` false. None of `R1 R2 R3 R6 R7 R10 R12 J1 J5 J6 J7 J8` ever appears.
  - `checkDoc`: a figure with no `caption` gives `D1`; a `##` heading with nothing under it before the next `##` gives `D2` for that heading's id; with a stub `jev` that fails J9, a table figure gives `J9` false; without `jev`, none. A doc with a figure whose body is `{}` returns a check with `ok: false` and does not throw (Review Focus 5). `checkDoc` returns the same doc text it was given: assert `serializeDoc(doc)` is unchanged.
  - `docHTML`: a figure with failing code checks has a `<details class="fig-checks">` whose summary says the count (`2 checks`) and lists each message; a clean figure has none; the badge is absent from `blockHTML` for callout and code.
  - Browser (`docs.spec.ts`): on the doc review page (`/src/dev/docs.html?doc=<id>`), every doc starter has no `.fig-checks`; a seeded doc with a source-less chart shows one, and its `<details>` opens on click and closes on Esc.
- [ ] **Step 2:** Run `npx vitest run tests/unit/docs-checks.test.ts tests/unit/docs-render.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement. `figureChecks` calls `ruleChecks(asSlide(f) with title = caption, 'consulting', 0)` and keeps only the carried ids; R4 is computed from `focusCount`. Render the badge in `figureHTML` (`figure.ts`) from `figureChecks`, so every reader of `blockHTML` gets it. Style it in `doc.css` as a quiet chip in the page's colours (`--muted`, `--line-2`), hidden in `@media print`, never reaching inside `.fig`.
- [ ] **Step 4:** Run the unit and browser tests, then every doc starter through the review page: if a starter shows a badge, fix the starter's content in `starters.json` (a missing caption or source), never the check. Expected: PASS, no starter with a badge. Log a look at the badge in both themes in `docs/temp/apple-bar-review.md`.
- [ ] **Step 5:** Commit: "Docs M5: figure checks, check_doc's engine, and the badge".

### Task 3: Docs through the tool service (main model)  — done

**Files:**
- Modify: `src/engine/tools/types.ts`, `api/_lib/deck-service.ts` (split the doc path into `api/_lib/doc-service.ts` if the file passes 300 lines), `api/_lib/db.ts` is not changed
- Create: `api/_lib/doc-service.ts`
- Test: `tests/unit/doc-service.test.ts`

**Interfaces:**
- Consumes: `Db.getDoc`, `putDoc`, `getDocMeta` (Task 7 of M4), `recordDocVersion` (`api/_lib/versions.ts`), `parseDoc`, `serializeDoc`.
- Produces, in `src/engine/tools/types.ts`:
  - `Scope = "account" | "deck" | "create" | "doc" | "createDoc"`.
  - `interface DocFile { id: string; name: string; doc: Doc }`; `ToolContext.file: DocFile | null` and `ToolContext.docPresence: { editing?: { by: string; until: number } }`.
  - `HandlerOut.file?: DocFile` (the doc to save) and `HandlerOut.what?: string` (the version's label when the write is not a user request).
  - `AccountPort.newDocId(): string` and `AccountPort.listDocs(limit: number, cursor: number, workspaceId?: string): Promise<{ workspaceId: string; docs: { docId: string; name: string; updated: number }[]; next?: number }>`.
- Produces, in `doc-service.ts`: `runDocTool(t: AnyTool, input, ctx: ToolContext-without-file, deps)`: loads the doc by the user's role (`db.getDoc` → `parseDoc`), runs the handler, saves `serializeDoc(out.file.doc)` with `putDoc(uid, id, name, text, baseRev, workspaceId)`, retries once on `conflict`, then `recordDocVersion`. A viewer's refusal is `You can view this doc, not edit it.`, a non-member's is `not_found` `No doc <id>.`. `runTool` hands scopes `doc` and `createDoc` to it. `name` is the doc's title as plain text.

- [ ] **Step 1:** Write the failing tests in `tests/unit/doc-service.test.ts` with a stub tool registered for the test (a `doc`-scope tool that appends a paragraph, a `createDoc`-scope one that makes a doc) over `fakeDb`:
  - the write lands, `rev` goes from 1 to 2, `listDocVersions` has a version by the caller's client name, and `parseDoc(getDoc.text)` has the new paragraph;
  - a person editing (`setDocPresence(ann, id, { editing: { by: 'Ann', until: now + 60_000 } })`) makes the result carry `notice` containing `Ann is editing`, and the write still lands (Review Focus 3);
  - a viewer's call returns `refused` with the exact sentence and the text is unchanged; a non-member's returns `not_found` (Review Focus 4);
  - a conflict on the first save (another writer saved between load and save, simulated by a handler that calls `db.putDoc` itself once) retries once and lands; a second conflict returns `conflict` `The doc changed while this ran.`;
  - a `createDoc` tool puts the doc in the workspace named, else the most recently used one; a viewer in that workspace gets `You can view this workspace, not add to it.`
- [ ] **Step 2:** Run `npx vitest run tests/unit/doc-service.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement the types, `runDocTool` and the two `AccountPort` methods in `runTool`'s port (`listDocs` mirrors `listDecks`, over `db.listDocs`).
- [ ] **Step 4:** Run `npm test` and `npm run lint`. Expected: PASS; every deck tool test unchanged.
- [ ] **Step 5:** Commit: "Docs M5: docs run through the tool service".

### Task 4: The doc tools (Sonnet)  — done

**Files:**
- Create: `src/engine/tools/docs.ts`
- Modify: `src/engine/tools/index.ts` (register `docTools`), `src/engine/tools/guide.ts` and `src/engine/tools/guide-text.ts` (the `doc` style), `src/engine/tools/instructions.ts` (a docs paragraph), `api/_lib/mcp.ts` (resources for the doc guide)
- Test: `tests/unit/doc-tools.test.ts`, `tests/unit/mcp*.test.ts` (the existing MCP conformance file gains a docs case)

**Interfaces:**
- Consumes: Tasks 1 to 3.
- Produces (names are final; every input has `additionalProperties: false`; ids are `docId`, `blockId`):
  - `list_docs { limit?, cursor?, workspaceId? }` (scope `account`) → `{ workspaceId, docs, next? }`.
  - `create_doc { title, subtitle?, theme?, accent?, workspaceId? }` (scope `createDoc`) → the doc view (below) with `links.edit` as `${origin}/doc/<id>`.
  - `get_doc { docId }` (scope `doc`, read) → `{ docId, title, subtitle?, theme, accent?, rev, links, presence?, outline: { blockId, level, text }[], blocks: { blockId, type, kind?, preview }[], markdown }`. `preview` is the first 80 plain characters; `markdown` is `serializeDoc`.
  - `update_doc { docId, title?, subtitle?, theme?, accent? }` (idempotent).
  - `write_doc_text { docId, blockId, markdown, request? }`, `create_block { docId, after, markdown? , figure?: { kind, body, id? }, request? }` (exactly one of `markdown` and `figure`), `update_block { docId, blockId, set, request? }` (figures only; a text block gets a sentence pointing at `write_doc_text`), `move_block { docId, blockId, after }`, `delete_block { docId, blockId }` (destructive).
  - `check_doc { docId }` (scope `doc`, read) → `{ checks: { blockId, id, ok, msg }[], suggestions?: string[] }` with failed checks first; calls `checkDoc(doc, ctx.jev)`; writes nothing.
  - Every write returns `{ applied: true, rev, blocks, changed: string[], warnings, notice?, next }`, where `blocks` is the same list `get_doc` gives and `warnings` come from `validateDoc` (errors refuse the write instead).
  - `get_guide { style: "consulting" | "pitch" | "doc" }` and `get_template { style: "doc", template: FigureKind }`: the doc guide text (`docGuideText()`), and for a figure kind its card (`describe(kind, 'consulting')` with `DOC_LIMITS`) and the matching `BLOCK_STARTERS` body as the example.

- [ ] **Step 1:** Write the failing tests:
  - `doc-tools.test.ts`, through `runTool` and `fakeDb`: `create_doc` then `get_doc` shows the title and `links.edit`; `create_block` with a heading and a figure, then `update_block` on the figure's `table.rows[0].cells[1]`, then `write_doc_text` on a paragraph, `move_block`, `delete_block`: after each, `get_doc.markdown` parses back to the same doc; an unknown `blockId` returns `not_found` with `get_doc shows the blocks`; `create_block` with both `markdown` and `figure` is `bad_input`; a figure with an error is refused and `rev` is unchanged; `check_doc` returns checks and `rev` and `markdown` are unchanged after it; `update_doc` with a red accent is refused with the colour sentence.
  - The registry: `tools/list` over the SDK client includes the ten new tools with their annotations (reads `readOnlyHint`, `delete_block` `destructiveHint`); `get_guide { style: "doc" }` contains `caption` and the doc's table-row limit; `get_template { style: "doc", template: "chart" }` has a `card` and an `example` that passes `validateDoc` when put in a figure; `resources/read` of `smartchart://guide/doc` returns the guide.
  - **The done-when, in the test:** a scripted sequence that builds the competitor teardown through the tools (create, a section heading, a paragraph, the revenue chart and the scorecard table from `BLOCK_STARTERS`, a callout), then `check_doc`: every returned check is a warning (the call succeeds, no tool throws), and the doc's text is the same before and after `check_doc`.
- [ ] **Step 2:** Run `npx vitest run tests/unit/doc-tools.test.ts tests/unit/mcp`. Expected: FAIL.
- [ ] **Step 3:** Implement `docTools` and register it; add `docGuideText()` to `guide-text.ts` from the doc format's own words: the file's shape, ids, how to write a caption, source and takeaway, the figure kinds and their limits, "never invent a source or a figure", "ask the user before removing a block they did not name". Add the docs paragraph to `INSTRUCTIONS`: start with `list_docs`/`create_doc`, `get_guide` and `get_template` with `style: "doc"`, read `get_doc`, write by `blockId`, run `check_doc` when done, give the user `links.edit`. Keep tool descriptions plain and specific, in the style of the deck tools.
- [ ] **Step 4:** Run `npm test` and `npm run lint` and `npm run build`. Expected: PASS.
- [ ] **Step 5:** Commit: "Docs M5: the doc tools, the guide and check_doc".

### Task 5: The checks in the app (main model)  — done

**Files:**
- Modify: `src/app/components/docs/docs-edit.css` (the badge inside an editor figure), `src/app/components/docs/DocEditor.tsx` only if the badge needs a redraw hook
- Test: `tests/browser/doc-edit.spec.ts`

**Interfaces:**
- Consumes: the badge from Task 2.
- Produces: nothing new in the API. What the user sees: the badge appears beside a figure's caption in the read view and in edit mode, updates when a figure is closed with Done, and does not appear in a figure while it is open for editing (its own edit surface shows the slide's checks as it does on slides).

- [ ] **Step 1:** Write the failing browser tests: a chart inserted from `/chart` has a badge saying it needs a source, and adding a source in place and pressing Done removes it; the read view after Save shows the same badge state; a badge's `<details>` opens by keyboard (Enter) and is not present in print (`page.emulateMedia({ media: 'print' })`).
- [ ] **Step 2:** Run the new tests. Expected: FAIL.
- [ ] **Step 3:** Make the editor redraw a figure's badge when its block changes (the figure's HTML already comes from `editorHTML`; confirm the badge is in it and fix the redraw path if a changed figure keeps its old element).
- [ ] **Step 4:** Run `npm run test:browser`. Expected: PASS. Look at the badge on a Paper and an Ink doc at full size and log the critique in `docs/temp/apple-bar-review.md`.
- [ ] **Step 5:** Commit: "Docs M5: figure badges in the editor".

### Task 6: The live run, the harness and the spec (main model; the run goes to Sonnet)  — done (run in-process)

**Files:**
- Create: `tests/agent-harness/docs.json` (three tasks: competitor research, a PRD, a legal memo, each with a prompt and what the doc must contain), `tests/agent-harness/docs-mcp.mjs`
- Modify: `tests/agent-harness/README.md`, the spec's M5 line, `docs/product/FUTURE.md`

**Interfaces:**
- Consumes: the running app (`npm run dev`) with its `/api/mcp` and a dev agent key; the models.
- Produces: `docs-mcp.mjs [--only=<id>]`: for each task in `docs.json`, a model gets the MCP tools (the registry's `openAiView`, executed by posting `tools/call` to `/api/mcp`), is given the task's prompt and runs until it stops; the script then reads the doc back and writes `results-docs.json` (tool calls made, `check_doc` result, whether any check failed, `rev` before and after `check_doc`).

- [ ] **Step 1:** Write `docs.json` and `docs-mcp.mjs`. Keep the loop thin: the system prompt is `INSTRUCTIONS` and nothing else; no retries, no hand-holding.
- [ ] **Step 2:** Run the three tasks (`node docs-mcp.mjs`). This needs the models and the dev key, so it is a Sonnet task in the background. Expected: each finishes with a doc that parses, `check_doc` returns no thrown error, and the doc's text is unchanged by `check_doc`. Read each resulting doc at full size in the app, section by section (the review-individually rule), and log the critique.
- [ ] **Step 3:** Fix what the runs show, at the right level: a tool description that misled the agent goes in `tools/docs.ts`; a rule the agent missed goes in `docGuideText()`; a check that cried wolf is fixed in `figureChecks`. Re-run only the tasks that failed.
- [ ] **Step 4:** Update the spec's M5 line (status, commits, the calls above) and add to `docs/product/FUTURE.md` what was left out (comments and versions tools for docs, `deck_events` for docs, a badge for judgment checks).
- [ ] **Step 5:** Run `npm run lint`, `npm run build`, `npm test`, `npm run test:browser`. Commit: "Docs M5 done: MCP tools and checks for docs".
