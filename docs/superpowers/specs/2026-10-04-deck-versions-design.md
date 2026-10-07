# Deck versions: history, preview, restore, and Undo on agent turns

FUTURE.md #1, first slice. Status: design, 2026-10-04.

## Why

Agents now write decks from three places: the maker by hand, SmartChart's own agent, and outside agents over MCP (Claude, Cursor). Today a bad agent turn can't be taken back except slide by slide (the strip's Undo covers one deleted slide for six seconds). People let an agent touch their work only when they know they can get it back. Versions are that safety net. They also make MCP visibly safe: "Claude changed 3 slides: *Add a market slide*" sits in the list, one click from Restore.

## What the user gets

1. **Versions panel** (deck menu → Versions). A right-hand inspector like Look, listing versions newest first, grouped by day. Each row shows who (You, SmartChart, or the agent's client name), the request in the user's words when there was one, what changed ("Added 1 slide, changed 2"), and the time. The top row is marked Current.
2. **Preview.** Clicking a row shows that version's slides in the stage as a grid, read-only, with changed slides marked, plus a bar: "Version from 14:32 · Restore this version · Back to current". Nothing is written until Restore is pressed.
3. **Restore.** Writes the old slides and look as a new version on top ("Restored the version from 14:32"). Nothing is lost: the state before the restore stays in the list.
4. **Undo on agent turns.** An agent reply that wrote slides gets a quiet "Undo" under it, the way Cursor shows a restore button on earlier requests. It restores the version before that turn. If changes were made after the turn, the chat says that they were undone too, and that Versions still has them. The conversation is left alone, as in Cursor. The agent hears which slides changed through the existing `edited` list.

## Research, and what we take from it

- Figma: autosave checkpoints after 30 minutes without edits; a restore first saves the current state, then adds the restored one. → Restore and Undo always write a new version; the latest version always equals the deck.
- Google Docs: edits grouped by time and author, with "Restore this version" from a preview. → Group by writer and turn; preview before restore.
- Cursor checkpoints: one per agent request, a restore button on earlier requests, preview first, the conversation untouched. They are local and lost on restart. → Undo per turn; ours persist in Postgres.
- Left out on purpose (not needed yet): named versions, live-sync journals, CRDTs, branches.

## Storage: git's object model, not git

- **Blob:** a slide's JSON, stored once per deck under its hash (`deck_blobs (deck_id, hash, slide)`). An unchanged slide is never stored again.
- **Tree:** a version is `{ style, theme, accent, slides: [id, hash][] }` (`deck_versions (deck_id, user_id, n, rev, by_client, turn, label, key, tree, at)`). That's a few hundred bytes per version.
- **Key:** the tree's hash. A save whose key equals the latest version's key changed nothing a version shows (a selection, the chat, re-run checks), so it is skipped.
- **Diff:** compare two trees by id and hash → added, removed, changed, moved, look. No JSON diffing.
- **Restore** reads a tree and its blobs. There is no patch chain to replay, so nothing breaks if one write fails.
- Hash: cyrb53 (53-bit) plus the length, scoped to one deck. Fast and synchronous, and the same in the browser and on the server.

## When a save becomes a version (one rule, in `src/engine/versions.ts`)

- Same key as the latest version → skip.
- Same writer and same turn as the latest, within 1 minute → fold into it (replace its tree).
- Otherwise → a new version.
- Turn ids: the in-app agent uses one per turn; hand edits use none (grouped by time); MCP uses `mcp:<request>`, so one request's writes become one version; a restore uses `restore:<n>:<time>`, so it always stands alone.
- The newest 100 versions per deck are kept.
- Recording a version never fails a save: errors are logged.

## Who wrote it

- App saves send `version: { by: 'agent' | 'you', turn, label }`; the server maps this to "SmartChart" or "You". The app sends `agent` on the save right after a turn (the app saves once, after the turn ends).
- MCP writes use the caller's client name and the tool's `request`.

## API (all scoped to the signed-in user)

- `GET /api/decks?id=…&versions`: versions with trees, newest first, so the client can diff with no further calls.
- `GET /api/decks?id=…&blobs=h1,h2`: the slides for those hashes, only if the deck's versions are the caller's.
- Deleting a deck deletes its versions and blobs.

## App

- `DeckRepo` gains optional `versions(id)` and `blobs(id, hashes)`, and `save(deck, meta?)`. The remote repo calls the API. The local repo (the dev account) keeps versions in localStorage with the same rule (capped at 30), so the feature works in dev and in the browser tests.
- A Versions entry in the deck menu, shown when the repo supports versions.
- Undo appears on a bot message that carries `turn` (set by `sendTurn` when the turn wrote slides).
- Locked while a turn runs or a slide is being edited, like every other write.

## Not in this slice

MCP tools (`list_versions`, `restore_version`), named versions, per-slide history, removing blobs no version uses, conflict checks per path.

## Tests

- Unit (vitest): trees, diff and words, the version rule, the API (grouping, KEEP, access by another account), MCP grouping by request, the local repo, Undo choosing the right version (including the deck's first turn → an empty deck).
- Browser (Playwright, dev account): make edits, open Versions, preview, restore, and see the slide come back.
