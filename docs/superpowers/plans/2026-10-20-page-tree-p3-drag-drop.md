# Page tree P3: drag and drop — plan

Spec: `docs/superpowers/specs/2026-10-19-page-tree-design.md` (section 4, "Drag and drop"; P3 line in the plan of record). P1 (data, server) and P2 (sidebar, Move to…, keyboard moves) are built. Inline execution; stop at each task boundary. Each task ends with `npm test`, `npm run lint`, `npm run build` and the browser tests it touches (`npm run test:browser`; `doc-done.spec.ts` already fails on `origin/main`; Playwright here needs `/opt/pw-browsers/chromium_headless_shell-1208` linked to the installed 1194 build).

**Done when** (from the spec): a browser test drags a page under another and between two siblings, and an illegal drop does nothing.

**Out of P3:** touch drag (native HTML drag does not fire on touch, and the sidebar is hidden below 900 px anyway; Move to… stays the touch path), MCP (P4), a mobile slide-over.

## What exists (read before starting)

- A move already has one path: `PageTree` `onMove(ref, to)` → `usePageTree.move` (optimistic, reverts and shows the sentence on refusal; reloads are held back while a move is unfinished) → `PageRepo.move(page, { parent, before?, after? })`. Drag adds a new way to produce a `MoveTo`; it adds no new server or repo code.
- `canMove(nodes, ref, parent)` (`engine/pages/tree.ts`) gives `'ok'` or the sentence (cycle, too deep). `moveStep` in `treeKeys.ts` is the pure keyboard version of the same job: P3 gets its pointer twin.
- `Strip.tsx` is the house style for native drag: `draggable`, state in React (`dragged`, `gap`), `dragover` computes the slot, `drop` commits, `dragend` clears.
- Rows are one flat list (`visibleRows` → `Row[]`, with `depth`, `parentRef`, `hasChildren`, `expanded`); `PageRow` is 102 lines, `PageTree` 112.
- The deck open in the editor before its first save is a row (`withOpenDeck`) that the server does not know yet; moving it would answer "No such page."

## Task 1. The drop decision, pure

- `src/app/components/sidebar/dropTarget.ts`: `dropTarget(rows, pages, dragged, over, zone)` → `{ to: MoveTo; show: 'line-above' | 'line-below' | 'inside'; at: PageRef; indent: number } | null`.
  - `zone` is where the pointer is in the row: top quarter, middle half, bottom quarter (a pure `zoneOf(y, height)`).
  - Top quarter → before the row, under the row's parent. Bottom quarter → after the row, under the row's parent; **except** on an expanded row with children, where "after" would draw the line between the row and its first child, so it means "first child of this row" (before its first child). Middle → last child of the row (`{ parent: row }`).
  - Null (no indicator, drop refused) when: the row is the dragged page itself or inside it; the result equals where the page already is (same parent, same neighbours); `canMove` is not `'ok'`.
  - `indent` is the shown depth of the new place, for the line's left edge.
- `dropAtEnd(rows, pages, dragged)`: the blank space under the last row means top level, last.
- Tests (`tests/unit/page-drop.test.ts`): each zone; the expanded-row rule; self and descendant; no-op (dropping where it already is); too deep (a three-level branch into a depth-five parent); a deck dropped under a doc and the reverse; the blank-space target.

## Task 2. Dragging a row

- `useRowDrag.ts` (hook, like `Strip`): `dragged`, `target`, handlers for `dragstart`, `dragover` (compute zone from `getBoundingClientRect`; `preventDefault` only when `dropTarget` is not null, so an illegal row shows the not-allowed cursor), `drop` (calls `onMove`, then expands the new parent, as the picker does; focus returns to the moved row), `dragend` and `dragleave` (clear). Esc cancels natively.
- `PageRow`: `draggable={canWrite && !busy && saved}`; the dragged row at 40% opacity; `dataTransfer.effectAllowed = 'move'` and a private type, so a file or text dragged in from outside is ignored. `saved` is false for the editor's not-yet-saved deck (`Row` gets it from `usePageTree`).
- Indicator: a 2 px `bg-accent` line absolutely positioned on the row's top or bottom edge, left edge at the target indent, with a 6 px dot at its start; for "inside" a 1 px accent ring and `bg-panel` on the row. `aria-hidden`, no layout shift. The empty area under the rows is a drop target that shows its line at the end of the list.
- A viewer's rows are not draggable. A busy sidebar (a save in progress) is not draggable.
- Keep files small: the drag logic and the indicator live outside `PageTree.tsx` and `PageRow.tsx`.

## Task 3. Hover to expand, and the edges

- Hovering the middle of a collapsed row that has children for 600 ms expands it (`onToggle(ref, true)`); leaving or dropping cancels the timer. Reduced motion: the delay stays (so a stray pass does not open branches), the chevron and the list change without animation.
- Dragging to the sidebar edge scrolls the list: Chromium and Firefox auto-scroll a native drag over a scroll container; check it with a long list and add nothing unless it fails.
- Dragging out of the window or onto the main screen, `Esc`, and dropping on the same place do nothing and leave no indicator behind.
- If the refusal comes back from the server after an optimistic drop, the row goes back and the sentence shows through the existing notice (same path as the keyboard).

## Task 4. Browser tests

In `tests/browser/page-tree-drag.spec.ts`, same dev-account seed as `page-tree.spec.ts` (Playwright `dragTo` with positions inside the row; it drives native drag in Chromium):

- Drag a page onto the middle of another: it becomes its last child; the parent expands; reload keeps it.
- Drag a page between two siblings (bottom quarter of the first): the order is right; reload keeps it; the same for the top quarter of the second.
- Drag onto the blank area: back to the top level, last.
- Illegal: drag a parent onto its own child (no line while hovering, nothing changes after the drop); drag a branch onto a depth-five parent (nothing changes).
- Hover over a collapsed branch: it opens after the delay, not before.
- Drop on its own place: no request (count calls on the `?move` mock/route).
- A viewer's rows have no `draggable`; the editor's unsaved deck row has none either.
- Keyboard move still works (the existing P2 tests).

## Task 5. Close the milestone

- Full `npm test`, `npm run lint`, `npm run build`, `npm run test:browser`.
- Run **`design-guardian`** this time (P2 skipped it) over the sidebar at full size, both themes, with a drag in progress (line, ring, dragged row dim), long names, deep trees; and the two P2 looks not yet done: a viewer's tree, and the header path below 1200 px. Log in `docs/temp/apple-bar-review.md`.
- Spec P3 line: status, commits, calls made. `FUTURE.md`: only what P3 leaves out (touch drag; a list window if production janks).

## Questions to settle before Task 1

1. **Bottom quarter of an expanded row.** Recommended: it means "first child" (what Notion and Linear do), because a line between a parent and its first child can only mean that. The alternative, "after the whole branch", is reachable by dragging to the bottom quarter of the branch's last row.
2. **Blank space under the last row as "top level, last".** Recommended: yes; without it, a deep page can only reach the top level by dropping on a top-level row's edge, which is hard to find when the tree is long.

## Risks to watch

- Drop zones flicker when the pointer crosses a child element of the row: compute from the row's rectangle, not from `e.target`, and ignore `dragleave` events whose `relatedTarget` is inside the row.
- Optimistic move plus the open page: moving the open page changes nothing on screen (a move is not content), but its branch must stay expanded so the row doesn't vanish under the pointer.
- A drag started on the chevron or a menu button: make only the row's own surface start a drag.
- Playwright's `dragTo` on native HTML drag is sensitive to element movement during the drag: the indicator must not move rows.
