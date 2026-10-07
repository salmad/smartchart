# Comments that agents pick up: Implementation Plan

> Execute inline, task by task. **Spec:** `docs/superpowers/specs/2026-10-04-deck-comments-design.md`

**Constraints:** follow the `CLAUDE.md` rules (no `any`, no inline styles, shadcn primitives, components under ~300 lines). Comments never act on their own. Run `npm test` and `npm run build` before each commit.

## Task 1: Model and merge (engine, framework-free)
- [x] `src/engine/comments.ts`: `DeckComment`, `newCommentId`, `openOn(comments, slideId)`, `mergeComments(local, server)`, `resolve(comments, id, by, reply, now)` → comments or an error message, `commentLines(comments, slides)` for agent text
- [x] Unit tests

## Task 2: MCP tools
- [x] `DeckDoc.comments`; `docFromData` / `dataFromDoc` carry them
- [x] `get_deck` returns open `comments`; `read_slide` returns that slide's open comments
- [x] `resolve_comment` tool (event `comment`); MCP instructions and `get_guide` line
- [x] Tests (tools-decks / tools-slides style)

## Task 3: In-app agent
- [x] `AgentDeck.comments`; `stateBlock` lists open ones; `resolve_comment` tool in `agent.ts`; a prompt section
- [x] `turn.ts` syncs comments back to the state
- [x] Tests with the fake agent step

## Task 4: App state and saving
- [x] `AppState.comments`, `SavedDeck.comments`; `open` / `toSaved` / `editKey`; actions `addComment`, `resolveComment`, `deleteComment`; `mergeDecks` merges comments
- [x] Tests (state, merge)

## Task 5: UI
- [x] `Comments.tsx` popover in the row under the slide; a strip badge; "Ask SmartChart to address these"
- [x] Browser check, then a Playwright spec

## Task 6: Docs and commit
- [x] FUTURE.md #3 marked built, with what's left; commit

## Verification (2026-10-04)
- vitest: all passing apart from the failure that was already on the base commit (`mcp-eval s05`). Playwright `comments.spec.ts` and `versions.spec.ts` pass.
- Live in the dev app with GLM: "Ask SmartChart" on "Source is missing: our CRM export, Q1–Q3 2026" added the source line, then resolved the comment with a reply; 13/13 checks pass. On a comment the slide already satisfied, the agent resolved it with a reply and changed nothing.
- A bug this found: a sure single edit ended the turn by code before the agent could resolve. Code no longer ends the turn early while a slide written this turn has open comments.
