# Page tree P3: drag and drop — plan

Spec: `docs/superpowers/specs/2026-10-19-page-tree-design.md` (section 4, "Drag and drop"). P1 (data and server) and P2 (the sidebar) are built. Everything a drag does already has a keyboard path (Move to…, Tab, Shift-Tab, ⌘/Ctrl-↑↓) and goes through the same `tree.move`, so P3 adds a pointer shortcut and no new rule: the server and `canMove` still refuse what is illegal. Inline execution; stop at each task boundary (memory). Each task ends with `npm test`, `npm run lint`, `npm run build` and the browser tests it touches (`npm run test:browser`; `doc-done.spec.ts` already fails on `origin/main`).

**Done when** (from the spec): a browser test drags a page under another and between two siblings, and an illegal drop does nothing.

**Out of P3:** MCP (P4); touch (HTML drag does not fire on touch screens: Move to… is the touch path, and below 900 px the sidebar is hidden anyway).

## What exists (read before starting)

- `PageTree.tsx` renders `PageRow`s in one `role="tree"` div (`grid-cols-[minmax(0,1fr)]`), inside a scrolling div in `Sidebar.tsx`. Rows are flat; `Row` has `ref`, `depth`, `parentRef`, `hasChildren`, `expanded`. `tree.move(ref, { parent, before?, after? })` (from `usePageTree`) is optimistic, refuses with a sentence (`tree.notice`) and reverts. `moveStep` in `treeKeys.ts` already turns a key into a `{ to, expand? }`; a drop does the same job with a different input.
- `canMove(pages, ref, parent)` (`engine/pages/tree.ts`) answers 'ok' or the cycle, depth or missing-page sentence; `slotKey` picks the key. `moveTargets.ts` already turns it into per-page reasons for the picker.
- Slide strip dragging (`Strip.tsx`) is native HTML5 drag with `draggable`, `onDragStart`, `onDragOver`, `onDrop`; Playwright's `dragTo` drives it (`add-slide.spec.ts`). No drag library is in `package.json` and none is added.

## Task 1. Where a drop lands: a pure function — done

- `src/app/components/sidebar/dropTarget.ts`: `dropTarget(rows, pages, dragged: PageRef, over: PageRef | 'end', y: number /* 0..1 down the row */): Drop | null`, with `Drop = { to: MoveTo; indicator: { kind: 'line'; before: PageRef | 'end'; depth: number } | { kind: 'into'; row: PageRef }; expand?: PageRef }`.
  - Top quarter of a row: the dragged page goes **before** that row (same parent).
  - Middle half: **last child** of that row (`into`).
  - Bottom quarter: **after** that row (same parent). If the row is expanded and has children, the bottom quarter means **first child** instead (before its first child; the line is drawn at the child's depth), as in Notion, because a line under an open parent that put the page beside it would look like a line above its first child.
  - `over === 'end'` (the empty space under the last row): last at the top level.
  - Returns null for: dropping on itself or a descendant (`canMove` says cycle), a target that breaks the depth cap (`canMove` says too deep), a missing page, and a drop that changes nothing (same parent and the same neighbour). A null shows no indicator and drops nothing.
  - `expand`: the new parent, when it is collapsed, so a drop into a branch shows where the page went.
- Tests (`tests/unit/page-drop.test.ts`): each zone; the expanded parent's bottom quarter; a deck over a doc and the reverse (kind-safe); cycle (own child, own grandchild, itself); depth 6 refused, 5 allowed; same-place no-op in each zone; `'end'`; a hidden page (not in `rows`) never targets.

## Task 2. Dragging a row, with its indicator — done
Calls made: the drag state lives in `usePageDrag.ts` (so `PageTree` grows by a few lines); the line is gold (the app's focus colour), 2 px, placed by two custom properties set from a layout effect (no inline styles, as the app's other moving marks); `into` is a 1 px gold ring on the row. Playwright delivers a drag's last `dragover` only with the next mouse event, so a mid-drag screenshot shows the state one move behind; the real browser does not.

- `PageRow`: `draggable` when `canWrite && !busy`; `onDragStart` sets `effectAllowed = 'move'` and `dataTransfer.setData('application/x-occam-page', key)` (Firefox needs data to start a drag), and tells `PageTree` which row; `onDragEnd` clears. The dragged row is `opacity-40`. A viewer's rows are not draggable. Rows keep `onClick` to open: a drag does not click.
- `PageTree`: `dragged` state; `onDragOver` on the tree div computes the row under the pointer (`e.target.closest('[data-row]')`) and `y` from `getBoundingClientRect`, calls `dropTarget`, stores the `Drop`, and `preventDefault()` only when it is non-null (so the cursor shows "not allowed" otherwise). `onDrop` calls `onMove(dragged, drop.to)`, expands `drop.expand`, and clears. The result is announced (see Task 3).
- Indicator: a 2 px line in the accent colour (`bg-accent`-style token the app already uses for focus), absolutely positioned between rows and inset by the target's indent (14 px per shown level), with a small end cap; `into` is a 1 px ring and `bg-panel` on the target row. Drawn by `PageTree` over the list, `pointer-events-none`, nothing animated.
- Look: full-size screenshots mid-drag (line between siblings, line at a deeper indent, ring on a parent), in the dark chrome, with long names; log in `docs/temp/apple-bar-review.md`.
- Browser tests: drag Alpha under Research (middle of the row): Research expands, Alpha is its last child, a reload keeps it; drag Alpha between Research's two children (top quarter of the lower one): the order is as dropped.

## Task 3. The small things that make it usable — done

- **Open a collapsed branch by hovering:** over a collapsed row's middle zone for 600 ms expands it (a timer cleared when the pointer leaves, moves to another row, or the drag ends). No animation; reduced-motion users get the same instant expand.
- **Scroll at the edges:** the tree's scroll container scrolls 8 px per `dragover` within 32 px of its top or bottom edge (the event repeats while the pointer is held), so a long tree can be reached.
- **Drop on the empty space:** `over = 'end'` when the pointer is in the tree's blank area below the last row: last at the top level.
- **Escape cancels** (native: the drag ends with no `drop`); make sure `dragend` clears the indicator and the timers.
- **Say what happened:** a visually hidden `role="status"` line in `Sidebar` ("Moved “Alpha” under “Research”.", "Moved “Alpha” to the top level.") after a drop that was accepted; a refusal already shows `tree.notice`. The announcement is the screen-reader answer to a gesture that has no keyboard form; Move to… and the keys remain the accessible way to do the same.
- Browser tests: hover a collapsed parent 600 ms mid-drag and it opens; drop on the empty space makes a top-level page; a long tree scrolls while dragging (seed 60 pages); a viewer's rows are not draggable (`draggable` is not set).

## Task 4. The illegal drop, and close the milestone — done

- **Done-when test** (`tests/browser/page-tree.spec.ts`): the three-level seed; drag Competitors onto Revolut (its own child): no indicator, and after the drop nothing moved and no notice appeared; drag Revolut to the top of the list; drag Alpha under Research and then between Research and its child; reload, each result kept.
- A move the server refuses (a stubbed 409 in a mocked-API test, as `site.spec.ts` does) puts the row back and shows the sentence: the optimistic path that the keyboard already uses.
- `npm test`, `npm run lint`, `npm run build`, `npm run test:browser`.
- Spec: update the P3 line (status, commits, calls); add to `docs/product/FUTURE.md` only what P3 leaves out (touch dragging; dragging pages into another workspace, which is FUTURE #23). Stop; P4 (MCP) gets its own plan.

## Calls made here (to check while reading)

- Bottom quarter of an **open parent** means first child, not "after the parent".
- A drop that changes nothing shows no indicator.
- No drag library, no custom drag image, no ghost animation.
- The pointer drag has no keyboard form of its own: the keys and Move to… are it, and a drop is announced for screen readers.
- Auto-expand delay 600 ms and edge-scroll 8 px per event, as in the spec's "600 ms"; the scroll numbers are mine.

## Risks to watch

- Radix dropdown triggers inside a draggable row: a drag that starts on the `+` or `···` must not open a menu. Start the drag only from the row itself (`e.target === e.currentTarget` or not inside a button), and check with a test.
- `dragover` fires every ~50 ms: `dropTarget` must be cheap (rows are a flat array; build the key→row map once per render, not per event) and the state update must skip when the `Drop` is unchanged.
- A move over the periodic list reload: `createPageTree` already drops a list read that began before an unfinished move; the drop uses the same `move`.
- Native drag in Chromium vs Playwright: `dragTo` with `targetPosition` drives the zones; if a zone is flaky, dispatch `dragstart`, `dragover` and `drop` with a shared `DataTransfer` instead of weakening the assertion.
