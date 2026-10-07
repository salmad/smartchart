# Deck versions: Implementation Plan

> Execute inline, task by task (superpowers:executing-plans). Steps use checkboxes.

**Goal:** Versions panel with preview and restore, and Undo on agent turns, backed by content-addressed slide blobs and per-version trees.

**Spec:** `docs/superpowers/specs/2026-10-04-deck-versions-design.md`

## Global constraints

- `CLAUDE.md` rules: no `any`, no inline styles, shadcn primitives, components under ~300 lines; app chrome never styles slide internals.
- Recording a version never fails a save. Restore and Undo always add a version; nothing is ever overwritten.
- Run `npm test` and `npm run build` before each commit.

## Task 1: Engine and server ✅ (done before this plan)

- [x] `src/engine/versions.ts`: `hash`, `treeOf`, `nextStep`, `diffTrees`, `describeDiff`, `slidesOf`, `record`
- [x] `api/_lib/db.ts`: tables `deck_versions` and `deck_blobs`; `versionHead`, `writeVersion` (keeps KEEP), `listVersions`, `blobs`; delete cascades
- [x] `api/_lib/versions.ts`: `recordVersion` (logs, never throws), `appMeta`
- [x] `api/_lib/decks.ts`: `?versions`, `?blobs=`; PUT records with `version` meta
- [x] `api/_lib/deck-service.ts`: MCP writes record `{ by: client, turn: mcp:<request>, label: request }`
- [x] `tests/unit/fake-db.ts` and `tests/unit/versions.test.ts` (9 passing)

## Task 2: Repos

- [x] `store.ts`: `DeckRepo.save(deck, meta?)`, optional `versions(id)`, `blobs(id, hashes)`; `SaveMeta = { by: 'you' | 'agent'; turn?: string; label?: string }`
- [x] `remote.ts`: send `version` with the PUT; `versions` and `blobs` call the API
- [x] `localDeckRepo`: versions under their own localStorage key, using `record()`, capped at 30 per deck; removed with the deck
- [x] Tests: remote sends meta; the local repo groups, skips and lists like the server

## Task 3: Restore and Undo logic (pure, in `src/app/versions.ts`)

- [x] `loadVersion(repo, deckId, version)` → `Item[]` (fetches missing blobs, caches per deck)
- [x] `undoTarget(list, turn)` → `{ before: Tree | null, later: number }`: the version before the turn's first version; `null` means the deck had nothing before (restore to empty)
- [x] Tests for both, including the first turn and later edits

## Task 4: App wiring

- [x] `Message.turn?: string`; `sendTurn` makes a turn id, sets it on the bot message when slides were written, and returns it
- [x] `App.tsx`: a ref holding the next save's meta (the agent after a turn, a restore); `persist` passes it to `repo.save`
- [x] `restoreTo(items, look, label)`: dispatches items and look, adds changed ids to `edited`, says it in the chat, saves now
- [x] `undoTurn(turn)`: flush the save, list the versions, pick the target, restore, and say what was undone
- [x] Locked while busy or editing

## Task 5: UI

- [x] `DeckMenu`: a "Versions" item (lucide `History`), shown when supported
- [x] `VersionsPanel.tsx` (right inspector like `LookPanel`): grouped by day; who, request, diff words, time; Current on top
- [x] `VersionPreview.tsx` (the stage): a read-only grid of the version's slides with changed ones marked; a bar with Restore and Back to current
- [x] `Chat.tsx`: a quiet "Undo" under bot messages that carry `turn`, disabled while locked
- [x] Verify in the browser (dev account): edits → Versions → preview → restore; Undo on a turn (the dev account has a model if the keys are set; otherwise test with a hand edit and restore)

## Task 6: Browser test, docs, commit

- [x] Playwright: `tests/browser/versions.spec.ts`, using the dev account
- [x] FUTURE.md #1: mark the first slice as built and list what's left
- [x] Commit

## Verification (2026-10-04)

- vitest: 872 passed. The one failure (`mcp-eval s05 is honest`) also fails on the base commit b5fb347.
- Playwright: `versions.spec.ts` passes (2). Four other specs (example-lines, starters ×2, share) also fail on the base commit.
- `db.ts` SQL checked against a throwaway Postgres 17 (grouping, skipping, blobs stored once, another account blocked, KEEP, delete cascade).
- End to end in the dev app with real models: two turns gave two labelled versions; preview, restore and Undo all worked.
