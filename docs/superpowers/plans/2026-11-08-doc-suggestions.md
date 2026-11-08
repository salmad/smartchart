# Doc Suggestions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Docs that read as a wall of text fail a visible check. Text blocks carry ready-made, content-preserving
suggestions (grouped tables first) that the user swaps in and out in place and then approves or cancels. MCP agents
see the same findings and can leave suggestions of their own.

**Architecture:**
- **Code checks.** Code measures readability (D4–D7) beside the existing figure checks.
- **One proposal module.** It validates a proposal, checks that it preserves content, and applies it. Both sources go
  through it: Occam's model in the app, and agents through `propose_block`.
- **Storage.** Agent proposals are stored on the doc (a `proposals` jsonb column, like comments). Occam's in-app
  proposals are made on demand in the client through `/api/glm`, which already enforces the quota, and are cached by
  revision.
- **The editor.** It shows the verdict in a Checks panel, and an Original ⇄ Suggestion switch on each block.

**Tech Stack:** TypeScript (strict), React 18, ProseMirror (doc editor), vitest, Playwright, Postgres (jsonb).

**Spec:** `docs/superpowers/specs/2026-11-08-doc-suggestions-design.md`. Its "Decided by the user" section overrides
the earlier draft sections.

## Global Constraints

- No `any`, no inline styles. Split components over ~300 lines. Use shadcn primitives (`npx shadcn@latest add <name>`).
- `doc.css` never reaches inside a figure's canvas. Previews use the existing figure renderer unchanged.
- Checks warn, never rewrite. Nothing is written until Approve, `create_block` or an agent's own write.
- Text suggestions keep every word. Figure suggestions keep every fact: every number, name and quoted phrase.
  Otherwise they are offered only as `insert`.
- Grouped tables (`rows[].style: "group"`) are preferred over flat tables wherever rows fall into categories.
- Occam's model runs only for editors, in the app, through `complete()` → `/api/glm`, so it counts toward the daily
  quota. `check_doc` and MCP make no main-model call.
- Product name in user- and agent-facing text: Occam.
- No filler labels ("key", "main"). No red or green in labels.

## Review Focus

1. **A text block is edited while a suggestion for it is pending.** Its id changes, so the suggestion must vanish, not
   apply to the wrong block. *(test in Task 2: `applyProposal` refuses unknown blockIds; Task 6 drops orphaned ones on
   rev change)*
2. **A suggestion whose figure body is invalid** (a cell over 40 characters, more than 5 steps) must never reach the
   user. *(test in Task 2)*
3. **Flipping the switch many times, then Cancel,** must leave the doc byte-identical, with no version written.
   *(Playwright in Task 7)*
4. **A doc that already reads well** (the restructured reels doc) passes D7 and gets no D4–D6 failures. *(fixture test
   in Task 1)*
5. **A reader without edit rights or a share-link viewer** never triggers a model call and never sees Approve.
   *(test in Task 6)*

---

### Task 1: Readability checks D4–D7 and quiet word tables

**Files:**
- Create: `src/engine/docs/readability.ts`
- Modify: `src/engine/docs/checks.ts` (call it from `checkDoc`; extend the `DocCheck` id comment)
- Modify: `src/engine/agent/checks.ts` (R8 and R13 skip tables where no body cell is mainly a number)
- Modify: `src/engine/tools/docs.ts` (`written()` adds failed D4–D7 to `suggestions`)
- Create: `tests/fixtures/docs/reels.md` (the restructured doc_mw6uwzssyw39, fetched with `get_doc`)
- Create: `tests/fixtures/docs/wall-of-text.md` (the same content with every figure removed and lists joined into
  paragraphs)
- Test: `tests/unit/docs-readability.test.ts`, plus additions to `tests/unit/docs-checks.test.ts`

**Interfaces:**
- Produces:
  - `readabilityChecks(doc: Doc): DocCheck[]`
  - Exported constants `LONG_PARAGRAPH = 90`, `PROSE_RUN = 250`, `SECTION_WORDS = 150`, `PROSE_SHARE = 0.7`.
  - Check ids: `D4` (paragraph id), `D5` (first paragraph of the run), `D6` (heading id), `D7` (blockId `"doc"`).
  - Definitions:
    - prose = paragraph words only.
    - exhibit = any figure except `callout`.
    - lists, callouts, quotes and figures break a D5 run.
    - D7 fails when `proseWords / allWords > PROSE_SHARE` and `exhibits < ceil(h2Count / 2)`.
  - D7 message: `"${words} words, ${exhibits} exhibits, ${bare} of ${sections} sections have none"`.

- [ ] **Step 1: Write the failing tests** in `docs-readability.test.ts`:
  - `'the wall-of-text fixture fails D7 and flags long paragraphs'`: `get(cs,'D7')?.ok === false`, and at least one
    `D4` and one `D6` fail.
  - `'the restructured reels doc passes'`: D7 ok, and no D5 or D6 fails.
  - `'a 91-word paragraph fails D4, a 90-word one passes'`
  - `'a list between two paragraphs breaks a prose run'`
  - In `docs-checks.test.ts`: `'R8 and R13 stay quiet on a table of words'`, a table with cells
    `['1. The 3-second test','2 a.m.','5 s']` returns R8 and R13 as ok.
- [ ] **Step 2:** Run `npx vitest run tests/unit/docs-readability.test.ts tests/unit/docs-checks.test.ts`. Expected:
  FAIL.
- [ ] **Step 3:** Implement `readabilityChecks`. Count words with the existing `plain()` text of each block. Add the R8
  and R13 guard: a cell is "mainly a number" when stripping it to `[\d.,%£$€]` leaves at least half its characters.
- [ ] **Step 4:** Tune the constants only if the reels fixture fails. Record the final values in the spec's "Left to
  the builder" section.
- [ ] **Step 5:** Run the tests and `npm run build`. Expected: PASS.
- [ ] **Step 6: Commit** "Fail docs that read as a wall of text".

### Task 2: The proposal module (validate, preserve, apply)

**Files:**
- Create: `src/engine/docs/proposals.ts`
- Test: `tests/unit/docs-proposals.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type ProposalMode = 'replace' | 'insert'
  export interface DocProposal {
    id: string; blockIds: string[]; mode: ProposalMode
    figure?: { kind: FigureKind; body: FigureBody }; markdown?: string   // exactly one
    label: string /* ≤40 */; why: string /* ≤160 */; by: string /* 'Occam' or the agent's client name */; at: number; rev: number
  }
  export interface Keeps { keeps: 'all' | 'facts' | 'drops'; dropped: string[] }
  export function keepCheck(original: string, proposal: Pick<DocProposal,'figure'|'markdown'>): Keeps
  export function checkProposal(doc: Doc, p: DocProposal): { ok: true; keeps: Keeps; mode: ProposalMode } | { ok: false; error: string }
  export function applyProposal(doc: Doc, p: DocProposal): Doc   // throws ToolError('not_found') for unknown blockIds
  ```
- `checkProposal` rules:
  - The blockIds exist and are adjacent.
  - A figure body passes the same validation `create_block` uses; markdown parses.
  - `markdown` with `keeps !== 'all'` is an error ("A text suggestion keeps every word").
  - A figure `replace` with `keeps === 'drops'` comes back with `mode: 'insert'`.
  - `label` and `why` are within their limits.
- `keepCheck`:
  - "words" are lower-cased content words, with markup and stop words removed. "Facts" are numbers (with units),
    capitalised names and `"quoted"` phrases.
  - Returns `all` when every word is present, `facts` when every fact is present, otherwise `drops` with the missing
    facts.
- `applyProposal`:
  - `replace`: insert the new block or blocks at the first id, then delete the rest.
  - `insert`: insert before the first id.
  - Built from the existing ops in `ops.ts`, so ids are assigned as for any write.

- [ ] **Step 1: Write the failing tests:**
  - `'text that keeps every word is all'`
  - `'a grouped table that keeps every number and quote is facts'`
  - `'a table that loses "774" is drops and lists it'`
  - `'a text suggestion that drops words is refused'`
  - `'a figure replace that drops facts becomes insert'`
  - `'an invalid cell (41 characters) is refused with the path'`
  - `'applyProposal replace swaps the blocks, insert keeps them'`
  - `'applyProposal with a stale blockId throws not_found'`
- [ ] **Step 2:** Run `npx vitest run tests/unit/docs-proposals.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement the module in `proposals.ts`.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5: Commit** "Check and apply doc proposals".

### Task 3: Stored proposals, `propose_block`, and `check_doc` for agents

**Files:**
- Modify: `api/_lib/db.ts`
  - Migration: `alter table docs add column if not exists proposals jsonb not null default '[]'::jsonb`.
  - Port methods: `docProposals(userId, id): Promise<DocProposal[] | null>` and
    `docProposal(userId, id, op: ProposalOp): Promise<DocProposal[] | 'foreign' | string>`.
  - Editors only. At most 20 pending per doc.
- Modify: `api/_lib/db-docs.ts` and the fake db used by `tests/unit/db-contract.ts`
- Modify: `api/_lib/docs.ts`
  - `GET ?proposals`
  - `PUT ?proposal` with `{ dismiss: id }`, called by the editor's Cancel.
  - Approval itself is a normal save followed by `{ dismiss: id }`.
- Modify: `src/engine/tools/types.ts`: port `docProposals(docId)` and `docProposal(docId, op)`, where
  `ProposalOp = { add: DocProposal } | { dismiss: string }`
- Create: `src/engine/tools/doc-proposals.ts` with the `propose_block` tool, registered beside `docCommentTools`
- Modify: `src/engine/tools/docs.ts`: `check_doc` ranks the D4–D7 failures first and adds a `next` line. The tool
  description says it makes no model call.
- Modify: `src/engine/tools/guide-text.ts`: three guide lines
- Test: `tests/unit/doc-tools.test.ts`, `tests/unit/db-contract.ts`

**Interfaces:**
- Consumes: `checkProposal` and `DocProposal` from Task 2.
- Produces: `propose_block` input
  `{ docId, blockIds: string[], mode: 'replace'|'insert', figure?: {kind, body}, markdown?: string, label: string, why: string }`.
  The result is `{ proposed: id, keeps, mode }`, or a `bad_input` ToolError carrying `checkProposal`'s error.
- **Exact copy:**
  - `check_doc` `next`:
    > "Walls of text first: for each D4–D6 block, restructure it (grouped tables where rows fall into categories, steps
    > for sequences, value cards for figures in sentences, bold-label bullets for long paragraphs). Write it yourself,
    > or leave it for the user with propose_block when it replaces their own words."
  - Guide lines:
    > "A doc should read through its exhibits; a wall of text fails check_doc (D7)."
    > "Prefer grouped tables (group rows) to flat ones whenever rows fall into categories."
    > "propose_block leaves a suggestion on a block for the user to approve in place; use it when the change replaces
    > the user's own words."

- [ ] **Step 1: Write the failing tests:**
  - db contract: `'proposals: an editor adds and dismisses; a viewer cannot add'` and `'a 21st pending proposal is
    refused'`.
  - doc tools:
    - `'propose_block stores a checked proposal'`
    - `'propose_block refuses a text proposal that drops words'`
    - `'check_doc lists D7 first on the wall-of-text fixture and makes no jev call when the doc has no tables'`
- [ ] **Step 2:** Run `npx vitest run tests/unit/doc-tools.test.ts tests/unit/db-fake.test.ts tests/unit/db-sql.test.ts`.
  Expected: FAIL.
- [ ] **Step 3:** Implement the migration, port, route, tool, `check_doc` change and guide lines.
- [ ] **Step 4:** Run the tests, `npm run build` and `npm run lint`. Expected: PASS.
- [ ] **Step 5: Commit** "Let agents propose doc changes for the user to approve".

### Task 4: `proposeDoc`, Occam's in-app proposals

**Files:**
- Create: `src/engine/agent/propose.ts`
- Test: `tests/unit/propose.test.ts`

**Model and attribution (not MCP):**
- `proposeDoc` is for the in-app checks panel only. It calls injectable `complete`, defaulting to `complete()` in
  `src/engine/agent/llm.ts` (the same path as `suggestDoc`: `/api/glm`, OpenRouter Haiku when
  `LLM_PROVIDER=openrouter`, quota via `modelGate`). Proposals are attributed `by: 'Occam'`.
- MCP and REST agents never call `proposeDoc`; they use the outside model and `propose_block` (`by: ctx.client`).
  Agent proposals persist on the doc; Occam's are cached client-side per revision.

**Interfaces:**
- Consumes: `checkProposal`, `DocProposal` and `readabilityChecks`.
- Produces:
  `proposeDoc(doc: Doc, opts: { rev: number; complete?: typeof complete; signal?: AbortSignal }): Promise<DocProposal[]>`.
  It returns at most 5, best first, with `by: 'Occam'`.
  - Returns `[]` without a call when D7 passes and no D4–D6 fails.
  - One `complete()` call (`max_tokens` 4000), then one repair call for the invalid proposals with their errors.
    Proposals that are still invalid are dropped.
- **Prompt:**
  - The doc as Markdown with `{#blockId}` on every block.
  - The failed D4–D6 checks.
  - The figure catalogue, built from the doc cards (`MENU` / `get_template` style "doc"): each kind with its
    capabilities and limits.
  - The rules from the spec's prompt list, with grouped tables first.
  - Output as JSON `{ proposals: [...] }` in the `DocProposal` shape, without id, by or at.

- [ ] **Step 1: Write the failing tests**, with a fake `complete`:
  - `'a doc that reads well makes no call'`
  - `'proposals come back checked, best first, at most 5'`
  - `'an invalid proposal is repaired once, then dropped'`
  - `'the prompt asks for grouped tables and carries the catalogue limits'`: a snapshot of the system message contains
    `group` and `40`.
- [ ] **Step 2:** Run `npx vitest run tests/unit/propose.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement `proposeDoc`.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [x] **Step 5: Commit** "Occam proposes readable structure for a doc".

### Task 5: Checks panel in the doc bar

**Files:**
- Create: `src/app/components/docs/DocChecks.tsx` (the button and panel; shadcn `Popover` or `Sheet`, matching
  `DocComments`)
- Create: `src/app/components/docs/useDocProposals.ts`
- Modify: `src/app/components/docs/DocBar.tsx` and `src/app/components/DocScreen.tsx` (wire it in; editors and
  readers)
- Test: `tests/unit/doc-proposals-hook.test.ts`

**Interfaces:**
- Consumes: `readabilityChecks`, `checkDoc` (code checks only, no jev), `proposeDoc`, and `GET ?proposals`.
- Produces: `useDocProposals({ docId, doc, rev, canEdit })` returns
  `{ verdict: DocCheck | null; checks: DocCheck[]; proposals: DocProposal[]; loading: boolean; open(): void; dismiss(id): Promise<void> }`.
  - `open()` runs `proposeDoc` once per rev, and only when `canEdit`.
  - It merges in the stored agent proposals.
  - It drops proposals whose blockIds are no longer in the doc.
- **Panel:**
  - The verdict line: "Reads as a wall of text" in gold, or "Reads well" with a quiet tick, plus the D7 numbers.
  - The suggestions: label, why, and who made them ("Occam" or the agent's name).
  - The figure checks, folded.
  - Clicking a suggestion scrolls to its block and switches it to Suggestion (Task 6).
- **Button:** a gold dot and count when D4–D7 fail or proposals exist, and a tick when everything passes.

- [ ] **Step 1: Write the failing tests:**
  - `'a reader never calls proposeDoc'`
  - `'open() calls proposeDoc once per rev'`
  - `'proposals whose blocks are gone are dropped'`
- [ ] **Step 2:** Run `npx vitest run tests/unit/doc-proposals-hook.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement the hook and panel.
- [ ] **Step 4:** Run the tests and `npm run build`. Expected: PASS.
- [ ] **Step 5: Commit** "Show a doc's checks and suggestions in a panel".

### Task 6: Original ⇄ Suggestion switch, Approve and Cancel

**Files:**
- Create: `src/app/components/docs/editor/proposal.ts` (a ProseMirror plugin: decorations that hide the original
  blocks and render a widget in their place while "Suggestion" is on, plus the gold margin rule and chip)
- Create: `src/app/components/docs/ProposalBar.tsx` (the switch, Approve, Cancel, "‹ 1 of 2 ›", and the keeps label:
  "every word kept", "condensed" with dropped facts on hover, or "adds above")
- Modify: `src/app/components/docs/editor/index.ts` and `useDocEdit.ts` (register the plugin; Approve =
  `applyProposal` → save with `{ by: 'agent', label: 'Suggestion: ' + label }` → dismiss)
- Modify: `src/engine/docs/doc.css` (the margin rule, the dashed outline and the chip; never inside the canvas)
- Test: `tests/unit/docs-proposal-plugin.test.ts`

**Interfaces:**
- Consumes: `applyProposal` and `useDocProposals`.
- Produces: `setProposalView(view, { proposalId, showing: 'original' | 'suggestion' })`.
  - The view switches in place and the doc state is untouched until Approve.
  - The widget renders the proposal through the same renderer as a figure node view (`editor/figure.ts`), or the
    Markdown through the prose renderer.
- Only editors see the chip and switch. Readers see the margin rule and can read the suggestion in the panel.

- [ ] **Step 1: Write the failing tests:**
  - `'switching to suggestion and back leaves the doc JSON unchanged'`
  - `'approve applies the proposal and saves one labelled version'`
  - `'cancel dismisses and leaves the doc unchanged'`
  - `'a reader gets no switch'`
- [ ] **Step 2:** Run `npx vitest run tests/unit/docs-proposal-plugin.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement the plugin, the bar and the wiring.
- [ ] **Step 4:** Run the tests, `npm run build` and `npm run lint`. Expected: PASS.
- [ ] **Step 5: Commit** "Swap a suggestion in and out of its block, then approve or cancel".

### Task 7: End to end and live check

**Files:**
- Create: `tests/browser/doc-suggestions.spec.ts`
- Modify: `tests/agent-harness/` (add a doc-suggestions run over 2–3 prose docs, including `wall-of-text.md`)

- [ ] **Step 1: Write the Playwright test:**
  - Seed a doc with the wall-of-text fixture and one stored proposal (a grouped table). Open the Checks panel and
    expect "Reads as a wall of text".
  - Click the suggestion; it shows in place.
  - Flip Original ⇄ Suggestion three times, then Cancel. The doc text is unchanged and the version count is the same.
  - Repeat, then Approve. The table is in place and there is exactly one new version labelled `Suggestion: …`.
- [ ] **Step 2:** Run `npx playwright test tests/browser/doc-suggestions.spec.ts`. Expected: PASS.
- [ ] **Step 3:** Run `npm test`, `npm run test:browser` and `npm run build`. Expected: all green.
- [ ] **Step 4:** Run the live harness on the prose docs. Expected:
  - at least 80% of proposals validate on the first or repair pass;
  - tables whose rows fall into categories use group rows;
  - the reels doc gets none or only minor ones.

  Record the results in `docs/temp/doc-suggestions-run.md`.
- [ ] **Step 5:** Review real slides and docs at full size in the dev docs page and the app, per the review rule.
  Screenshot the panel and the switch.
- [ ] **Step 6: Commit** "Test doc suggestions end to end".
