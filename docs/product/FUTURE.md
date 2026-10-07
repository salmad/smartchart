# Future features

Ideas agreed but not scheduled. Each needs its own brainstorm → spec → plan before building.

## 1. Deck history (git's ideas, not git)
**First slice built (2026-10-04):** Versions panel (preview, restore) and Undo on agent turns. Slides are stored as blobs by hash and each version is a tree, grouped by writer and turn (MCP: one version per request). Spec: `docs/superpowers/specs/2026-10-04-deck-versions-design.md`. MCP agents can `list_versions` and `restore_version` (a restore is a new version). Still open from the list below: per-slide history, named versions, removing blobs no version uses, conflict checks per path.
**Decision (2026-10-02):** keep decks as JSON rows in Postgres. No `.md` storage, no git repo (Slidev's model fits one developer working locally, not a multi-user app on serverless).
Google Docs/Slides (operation log + snapshots), Confluence (a full version per save), Figma, Notion, Linear and Pitch all keep versions in a database or blob storage; none uses git.
- `deck_events` row per write, in the same transaction as the `rev` bump. It records the author kind (human, in-app agent or MCP client), the turn id, the user's request (as the "commit message"), the forward patch and the inverse patch.
- Snapshots every N revisions, at the start of each agent turn, and before a restore. Restore = write the old state as a new revision.
- "Undo this agent turn" in the chat (like Cursor's checkpoints). Warn rather than merge if a human has edited the same paths since.
- History per slide (Pitch-style timeline).
- Later: conflict checks per path; stable ids for table rows and chart series (LLM patches fail on array indexes); history retention as a pricing tier; agent edits as suggestions or branches (Ink & Switch Patchwork, Tiptap). Avoid: CRDTs and OT until there is live co-editing.

## 2. First-run tour, ending at Connect an agent
**Built (2026-10-04):** our own spotlight component (no driver.js), 7 steps (chat, slide, checks, comments, the grid, share, Connect an agent; each step opens what it describes and rings what it opened), from "Take the tour" in the account menu or a one-time nudge after the first slide is made. Spec: `docs/superpowers/specs/2026-10-04-tour-design.md`.
MCP is currently the most useful feature, and the tour exists to lead people there.
- **For:** everyone, with MCP as the finale. Because of that, it explains in plain words what an agent is.
- **Form:** a classic step-by-step tour (Next / Done).
- **Starts:** only from a "Take the tour" entry (account menu), plus one nudge for new users. Never automatic.
- **Steps:** chat → the slide (E edit, F present) → checks ("checked like a partner") → deck strip and views → Look → Share → **Connect an agent**, with Make a key inline (opens `AgentKey`).
- **Empty deck:** opens a sample deck from `starters.json` so every step has something to point at.
- **Build:** not decided. Own Popover-based component vs driver.js.

## 3. Comments in the deck that agents pick up
**Built (2026-10-04):** comments on slides, a badge on the strip, Resolve and Delete, "Ask SmartChart to address"; the in-app agent and MCP (`get_deck`, `read_slide`, `resolve_comment`) address them when asked and resolve with a reply. Spec: `docs/superpowers/specs/2026-10-04-deck-comments-design.md`. **Part-level comments built (2026-10-05):** a Comment button beside Edit (C), one panel for whole-slide and part notes, click a part of the slide to pick it (path and quote saved; a gone part degrades to the whole slide). Still open: comments from share links, @mentions, a deck-wide list, and a resolved comment linking to its version (#1).
The maker leaves notes on a slide, or on a part of it ("this number is from Q2, update it", "too wordy"). An agent (in-app or MCP) reads the open comments and acts on them, then replies and resolves.
Open questions for the brainstorm:
- What a comment anchors to: a slide, or a path inside it.
- Whether agents act on comments automatically, or only when asked ("address the comments").
- How MCP exposes them: e.g. open comments in `get_deck` / `read_slide`, plus `reply_comment` and `resolve_comment`.
- Whether other people can comment through share links.

Pairs well with #1: a resolved comment can link to the revision that fixed it.

Comments are input written by people, so agents treat them as requests to weigh, not commands. A shared viewer's comment never acts with the owner's authority.

## 4. Slide gaps found while designing richer tables (2026-10-03)
- **Images:** see #6.
- **Agenda slide:** built by code from the section titles.
- **Text slide:** 2–3 headlined paragraphs (the consulting argument slide), not forced into cards or the summary.
- **Bars in table cells:** a small bar for a share or score, so a table of figures can be scanned.

## 5. Mixed halves in the pair (built, switched off)
A pair half can be a table, a number or points (`MIXED_HALVES` in `schema.ts`), but a chart beside a table or a number reads unbalanced (2026-10-03). Before switching it on: decide how unlike halves share height and weight (a table level with the chart's plot, a number set against the chart's baseline), review at full size, then flip the flag. The renderer, editor, tests and capability text are already in place.

## 6. Images and screenshots in slides
Logos (competition), product screenshots, team photos. The biggest gap for pitch decks.
Open questions for the brainstorm:
- Which templates take an image: a new image template, an image half in the pair, logos in table cells, or all three.
- Upload and storage (Postgres row vs blob storage), size limits, and how MCP agents add one (upload tool, or a URL that SmartChart copies).
- Layout stays code's job: fixed frames and crops per template, never free placement. Screenshots get a device-free frame that fits the style.
- Alt text, required so the slide still reads in checks and to agents that cannot see the image.

## 7. Bug hunt: how MCP works in practice (2026-10-04)
Recent MCP testing turned up rough edges. Go through it on purpose: replay real sessions (Claude, Cursor, other clients) against the MCP tools, and list every wrong error, confusing result, wasted call and missing guidance. Fix at the tool or instruction level, then add each case to `tests/agent-harness` so it stays fixed.

## 8. Checks that reach the MCP agent unasked
**Built (2026-10-04):** every write returns `next`: what to fix, when to call check_slide, `check_storyline` once the deck has 2+ content slides (on new slides), and open comments. Rule checks run on every write; model checks stay on request. A chart choice code sets back to "auto" is now a warning, not silent.
Today `check_slide` and `check_storyline` run only when the agent calls them, so many agents never do. Instead, the write tools return the relevant warnings and a suggested next step: after a slide is written, its rule checks; once the deck has 2+ content slides, a hint that the storyline is worth checking, or its open warnings.
- Warnings stay advice (thin harness): the agent weighs them, nothing is rewritten.
- Open question: what runs on every write (cheap rule checks) vs what costs a model call and stays on request.

## 9. Softer checks that make a slide great, not just valid
**First slice built (2026-10-04):** S2 (a claimed change with no annotation) and S3 (judgements in words instead of marks), code-only, at most 2, in the checks popover and as MCP `suggestions`. Spec: `docs/superpowers/specs/2026-10-04-softer-checks-design.md`.
Non-blocking suggestions on top of today's checks: things a partner would say in review. For example: a capability the slide doesn't use yet (marks, icons, a highlight, notes), a title that states a topic instead of a finding, a number with no comparison, a missing source on a figure.
- Shown as suggestions, ranked below real problems, in the app and over MCP (#8).
- Open question: how many to show at once so they help rather than nag.

## 10. Linked sources, so a slide can be verified
**First slice built (2026-10-04):** `[label](https://…)` in source and footnote, clickable in the editor, present and share links, label-only in print. Spec: `docs/superpowers/specs/2026-10-04-linked-sources-design.md`. Still open: per-figure markers, the soft check, a link button in hand editing.
`source` is plain text today. Let it carry links: the source line and footnote markers point to the page, report or dataset behind a number. Optional but recommended: a soft check (#9) suggests a link when a slide shows figures without one.
- Clickable in the app, in present mode and in shared links; shown as plain text in PDF/print, or as a short URL.
- Open question: one source per slide, or one per figure (footnote markers ¹ ² tied to specific numbers).

## 11. Fix what the MCP eval found (2026-10-04)
A first pass of the MCP bug hunt: the first MCP eval run (Claude Code with Sonnet 5 making slides through `/mcp/v1`; `tests/mcp-eval/`) traced each miss to the SmartChart text or code that caused it. The list, with quotes and a proposed fix for each, is the "What confused the agent" section of `tests/mcp-eval/baselines/2026-10-04-pass1.md`. In short:
- **Checks that push agents into wrong edits:** R11 ignores a figure written with its unit in the subtitle ("18 months"); R4 forces the highlight into a pitch topic title; R13 flags comparison tables whose rows differ in unit by nature; R8's wording invites invented sources (the guide forbids them).
- **Checks that pass what they shouldn't:** J2 approves a causal title the data doesn't carry, and a "most efficient" focus row that loses in other columns; R4/J4 approve a highlight on a row when the title names a column.
- **Code overriding the agent silently:** an explicit `stacking: "stacked"` came back side by side with no warning (against "checks warn, never silently rewrite"); `auto` focus picks a row when the title highlights a column.
- **Cards:** the line chart's "values are written on the data" (only the last point is labelled).
- **J5's message** ("Takeaway restates the slide") led an agent to swap a true takeaway for a false one; offer removing the optional takeaway.
- **Wiring:** agents skip `get_guide`, edit after `check_slide`, and once asked for a deck name and style instead of creating the deck.

**Done (2026-10-04):** R8's wording no longer invites invented sources; R11 ignores spans of time ("18 months") and says how to fix; the chart card says a line labels only its last point; overridden stacking and marks warn. Also done: `auto` focus picks the item whose exact name the title highlights (FY25, a column) without asking Jev; R4's message names the subtitle for pitch; R13 reads a table the way it is most consistent, so criteria tables pass. **Still open:** R4/J4 when the highlight and the focused item disagree, J2 causal and focus-row checks, J5's message, and the wiring (agents skip get_guide, edit after check_slide).

The run's own caveat: 14 of its prompts didn't ask for a slide, so Claude Code answered in chat and those cases say nothing about SmartChart (being rewritten). Fix in small batches, then rerun `npm run eval:mcp -- --against=2026-10-04-pass1` to see the effect.

## 12. To-dos that activate a user (2026-10-05)
A short checklist for a new user (in the app, quiet and dismissable) that walks them to the things that make Occam worth keeping. Each item ticks itself when done:
- Take the tour.
- Connect an agent (make a key).
- Ask your agent to create a deck (it ticks when a deck is written over MCP; offer a sentence to paste, e.g. "Make me a 6-slide deck on …").
- Share a deck (a link made).
- Leave a comment and ask the agent to address it.
Open questions: where it lives (empty-state of the decks list, or the account menu with a progress ring); whether it shows once or until done; what counts as done (server-side events, not clicks, so an agent's actions count); no emails or nagging.

### 12a. First slice: a dismissable "Connect an agent" prompt (2026-10-07)
Before the full checklist, one item on its own: a small card in the app (decks list or editor corner) saying "Connect an agent: let Claude or Cursor build and edit your decks here", with a primary button that opens `AgentKey` (Make a key) and a close (×) that hides it.
- **Ticks itself, server-side:** it disappears for good once the account has an active key or an MCP write has happened; no manual "done".
- **Dismiss:** × hides it, remembered per account (not only in localStorage); it can be found again in the account menu (Connect an agent) and in the tour. Never comes back unprompted.
- **Shown:** after the first slide, not on a blank first run; at most one such prompt on screen (not alongside the tour nudge).
- **Later:** it becomes the first item of the #12 checklist.

## 13. Re-orient the product to MCP: the agent is how most people will use it (2026-10-05)
Today the app is a chat editor with MCP as an extra. If most work will come through a connected agent (Claude, Cursor, ChatGPT), the app's job changes. Starting thoughts, to brainstorm before building:
- **The app becomes the viewer, the reviewer and the hand-finisher**, not the main author: live view of what the agent is changing (already: presence, events), versions and Undo for what it did, comments as the way a human steers it, hand-edit for the last 5%, present and share.
- **Onboarding starts at Connect an agent**, not the chat: first screen is "connect your agent" with the paste-in config for each client, then a prompt to try ("make a deck on …"). The in-app chat stays for people with no agent, and for quick edits.
- **Design the MCP surface as the product's main UI**: tool descriptions, guides, `next` hints and error messages are the interface copy. Every write returns what to fix next (#8) and suggestions (#9); a deck link is returned with every write so the user can watch.
- **Trust and control for work done by someone else**: Undo per agent turn (built), an "agent activity" feed per deck (who changed what, from which request), and optional "suggest, don't write" mode where an agent's edits wait for approval (#1, agent edits as suggestions).
- **Hand-offs both ways**: the user's comments and hand-edits are visible to the agent (built); add "ask my agent" from the app (a comment addressed to the connected agent rather than the in-app one).
- **Measure it**: first deck made over MCP, share of decks started by an agent, time from connect to first slide.
- Open: whether the in-app chat is kept long term; a hosted remote MCP with OAuth (no keys to paste) instead of keys; which clients to support first and test against (#7, #11).

