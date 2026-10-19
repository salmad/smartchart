# Doc editor on Tiptap: writing that feels like Linear

> Status: draft 2026-10-19, for the user's approval. Part of Occam Docs (`2026-10-19-occam-docs-design.md`). The nested page tree is a separate spec and comes after this one.

## Why

The user writes documents the way Linear's issues work: click in, type, and the page behaves. Our doc editor (M4) is a hand-rolled set of contenteditable fields, one per block, with its own caret, undo and redraw code (`src/app/components/docs/`, about 1,300 lines). It is rougher than Linear's. The user wants Edit and Save kept, but the editing inside to be good.

## What we found (2026-10-19, the running app, dev account)

Reproduced with real keystrokes:

- **Cross-block selection does not work.** Dragging from one paragraph into the next stays inside the first field; ⌘A selects nothing; so copy, cut and delete across blocks are impossible. This is the shape of the design (one editable field per block), not a bug to patch.
- **Undo does not undo typing.** Type into a paragraph, press ⌘Z: the text stays. Undo does work for structural changes (a paste). After an undo the caret is lost (focus returns to the page).
- **No Markdown shortcuts.** `## `, `- ` and `/` : only `/` works (it opens the slash menu). `## Heading` stays as typed text.
- Works: Enter, Backspace, ArrowUp across blocks, multi-paragraph paste (becomes blocks), the slash menu, the drag handle.

Not probed (to check in the plan's first task): pasting rich text from Google Docs, caret after Enter inside bold or Focus text, arrow keys into and out of a figure.

## Goals

1. Selecting, copying, cutting, deleting and pasting across blocks behaves as in any good editor.
2. Undo and redo follow what a writer expects: typing groups by pause or word, structure is its own step, and the caret returns where it was.
3. Markdown shortcuts as you type: `# `, `## `, `### ` (headings), `- ` or `* ` (bullets), `1. ` (numbered), `> ` (quote), `---` (divider). `/` stays.
4. A floating toolbar over a selection (bold, Focus, link) and ⌘B, ⌘K as now.
5. Smooth Enter, Backspace, Tab-free list behaviour, paste cleaning (rich text in, our marks out), drag handles that reorder blocks.
6. Edit and Save are unchanged to the user: click Edit, write, ⌘S or Save writes the file, Discard drops the draft. Presence, the 409 stale-save refusal, versions and comments are unchanged.

## Non-goals

- A different doc format. The file is still Markdown with JSON component blocks, parsed and written by `src/engine/docs/`.
- Autosave or always-on editing. The user wants Edit and Save kept.
- Live multi-cursor editing (FUTURE #22). Tiptap with Yjs is the likely path later; this spec only avoids closing it off.
- Checklists (`[]`). The format has no checklist block; adding one is a format change and its own request.
- Pictures in docs (FUTURE #25), and the nested page tree.

## Anti-goals

- No silent rewriting. Anything the editor accepts must survive Save unchanged. A mark the format cannot hold must not be offered.
- No second block model. Not BlockNote.

## The design

**Engine: Tiptap (ProseMirror), plain Tiptap, not BlockNote.** I recommend this over repairing the hand-rolled editor, because the problems above (selection across blocks, undo, input rules, paste, caret) are exactly what ProseMirror provides and what a field-per-block design cannot. This is my recommendation; the user has not yet chosen it.

**One ProseMirror document is the draft.** Its schema mirrors the `Block` union in `src/engine/docs/types.ts`: paragraph, heading (levels 2 and 3), bullets, numbered, quote, divider, code, raw, and a `figure` node. Allowed inline marks are only what slide markup holds: bold, Focus, link. Tiptap's StarterKit extras (italic, strike, inline code, nested lists, hard breaks) are switched off.

**Reading and saving go through the existing engine.** Edit mode loads `Doc.blocks` into ProseMirror; Save converts ProseMirror to `Block[]` and calls the existing `docOf` and serializer. No Markdown serializer from a Tiptap package. A round-trip test (blocks → ProseMirror → blocks) over all doc starters must be identical.

**Ids.** Heading and figure ids are node attributes, and splitting a heading or pasting must not duplicate one (comments anchor to them). New headings get their id on Save, as now.

**Figures** are atom nodes with a React NodeView hosting today's `FigureEdit`. The rule stays: opening another figure, or Save, runs the open figure's Done first, and Save is refused if it has an error. A figure's own Done is one step in ProseMirror's history.

**Inputs rules and the slash menu.** The Markdown shortcuts are Tiptap input rules over the schema above. The slash menu keeps its eight text blocks and seven figures (`slash.ts`), re-implemented as a Tiptap suggestion.

**Reordering.** The drag handle moves blocks (a Tiptap drag-handle extension or a small own one). The licence of any Tiptap extension is checked in the plan's first task; if it is paid, we write the handle ourselves.

**Edit and Save on top.** `useDocEdit` shrinks to: the ProseMirror state is the draft; dirty is "state differs from the loaded doc"; `save()` closes the open figure, validates the title, converts and calls the existing save. Stale-save (409), presence and the Save bar are untouched.

**Delete the old editor outright** (`editorKeys.ts`, `editorHTML.ts`, the redraw and focus code, their tests), no shims, once the Tiptap editor passes the same browser tests.

## Tests

- Keep and port `tests/browser/doc-edit.spec.ts`, `doc-done.spec.ts`, `doc-collab.spec.ts`.
- Add: select across two blocks and delete; undo of typing; each Markdown shortcut; paste from Google Docs HTML; the doc starters round-trip; no duplicate ids after splitting a heading.

## What is left to the builder

Which Tiptap extensions to use for the drag handle and toolbar; the exact undo grouping delay; how the figure NodeView passes the draft body in and out.

## Order

1. This spec (the editor). 2. The nested page tree, as its own spec: a parent and an order on each doc and deck, a migration, drag to re-parent, what deleting a page with children does, and `parentId` over MCP. It replaces the flat sidebar; the earlier "Claude-style decks sidebar" memory is superseded by the user's Notion-style request.

## Open from before

The Neon contract for the M4 SQL (`TEST_DATABASE_URL`) was never run, and the M5 MCP run against production is now unblocked since M5 is deployed.
