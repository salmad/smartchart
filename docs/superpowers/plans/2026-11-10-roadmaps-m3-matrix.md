# Roadmaps M3: Matrix and Duplicate — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A roadmap gains a Matrix tab that pivots choice fields into columns over the same issue tree as the table, and the table gains Duplicate so a country subtree can be copied then retargeted with bulk Set field.

**Architecture:** Pure `src/engine/roadmaps/matrix.ts` owns pivot, columns, top-most hits, and group cells; it calls shared `matchesChips` and `sortIssues` exported from `view.ts`. `progressUnder` lives in `rollup.ts`. Duplicate is one `applyOp` op; body text is copied in the three writers after the issue rows land. The matrix is a `<table>` with sticky title column and horizontal scroll; no server changes beyond body copy on duplicate.

**Tech Stack:** React 18 + TypeScript strict, Tailwind + shadcn/ui, lucide, vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-10-roadmaps-m3-matrix-design.md`

## Global Constraints

- M1/M2 constraints still apply (no `any`, no inline styles, ~300 lines, shadcn, app tokens).
- Matrix uses `<table>` + `min-w-[148px]` columns; title column `sticky left-0`; header sticky. No CSS-variable widths on elements.
- No hard-coded field names. Pivot only on `choice` fields.
- Checks, MCP, chat, slide export: out of scope.

## Review Focus

1. Top-most vs tasks under a country (worked example UK cell ids).
2. Dim filter: blocked leaf on dim parent column; progress includes filtered-out leaves under top-most.
3. Duplicate: parent+child once; body copied; no comments/events; race map incomplete refuses.
4. `progressUnder` leaf pool (not average of bars); overdue uses own `due` only.
5. Two-field columns: cartesian only used+pins; `liveMatrix` drops stale option ids.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/engine/roadmaps/matrix.ts` | `matrixGrid`, `liveMatrix`, `dueQuarter`, `cellWorst` |
| `src/engine/roadmaps/rollup.ts` | `progressUnder` |
| `src/engine/roadmaps/view.ts` | `MatrixSettings`, `layout` `'matrix'`, export `matchesChips`, `sortIssues` |
| `src/engine/roadmaps/ops.ts` | `{ op: 'duplicate', copies }` |
| `src/app/components/roadmap/Matrix.tsx` | scroll, keyboard, `visibleRows` |
| `src/app/components/roadmap/MatrixCell.tsx` | empty / one / many / group |
| `src/app/components/roadmap/MatrixPicker.tsx` | several-issue popover |
| `src/app/components/roadmap/MatrixDisplay.tsx` | Display section for matrix |
| `src/app/components/roadmap/BulkBar.tsx` | Duplicate button |
| `src/app/components/roadmap/IssueTable.tsx` | id map, selection after duplicate |
| `api/_lib/db-roadmaps.ts`, `fake-db-roadmaps.ts`, `src/app/roadmaps.ts` | body copy on duplicate |
| `tests/unit/roadmap-matrix.test.ts` | engine |
| `tests/browser/roadmap-matrix.spec.ts` | e2e |

---

### Task 1: `progressUnder` and view exports

**Files:**
- Modify: `src/engine/roadmaps/rollup.ts`, `src/engine/roadmaps/view.ts`
- Test: extend `tests/unit/roadmap-tree.test.ts` or new `tests/unit/roadmap-progress-under.test.ts`

- [ ] **Step 1:** Failing tests for `progressUnder` (2 Done + 1 To do under two top-most ids → 2/3; nested id in set skipped).
- [ ] **Step 2:** Export `matchesChips(issue, chips, today)` and `sortIssues(list, sort)` from `view.ts` (refactor `tableRows` to use them).
- [ ] **Step 3:** Implement `progressUnder`.
- [ ] **Step 4:** Vitest pass; `npm run build`.
- [ ] **Step 5:** Commit `Roadmaps: progressUnder and shared view match/sort.`

### Task 2: Matrix engine

**Files:**
- Create: `src/engine/roadmaps/matrix.ts`
- Test: `tests/unit/roadmap-matrix.test.ts`

- [ ] **Step 1:** Failing tests: worked grid (parent spec), blocked filter, `dueQuarter`, `liveMatrix` pruning, collapse does not change cell ids, pin crossing (two-field).
- [ ] **Step 2:** Implement per spec interfaces (`matrixGrid`, `liveMatrix`, `dueQuarter`, `cellWorst`).
- [ ] **Step 3:** Vitest pass.
- [ ] **Step 4:** Commit `Roadmaps: matrix engine (grid, columns, top-most).`

### Task 3: Duplicate op

**Files:**
- Modify: `src/engine/roadmaps/ops.ts`, `tests/unit/roadmap-ops.test.ts`

- [ ] **Step 1:** Failing tests: subtree dedupe, sibling order `A, A', B, B'`, numbers, `created` + `duplicatedFrom`, refusals, empty selection.
- [ ] **Step 2:** Implement `duplicate` branch in `applyOp`.
- [ ] **Step 3:** Vitest pass.
- [ ] **Step 4:** Commit `Roadmaps: duplicate op.`

### Task 4: Body copy in writers

**Files:**
- Modify: `api/_lib/db-roadmaps.ts`, `tests/unit/fake-db-roadmaps.ts`, `src/app/roadmaps.ts`
- Test: fake-db / store test that duplicate leaves body text on copy, comments `[]`

- [ ] **Step 1:** Failing contract test.
- [ ] **Step 2:** After issue insert on duplicate, copy `body` from source; local repo same; upsert must not wipe on conflict for normal sets.
- [ ] **Step 3:** Pass; commit `Roadmaps: duplicate copies issue body.`

### Task 5: View settings and Matrix tab shell

**Files:**
- Modify: `view.ts` `DEFAULT_VIEW`, `useViewSettings.ts`, `TopBar.tsx`, `DisplayMenu.tsx`, `RoadmapScreen.tsx`
- Create: `MatrixDisplay.tsx` (controls wired), `Matrix.tsx` placeholder region `aria-label="Matrix"`
- Test: `tests/browser/roadmap-matrix.spec.ts` — `switches to Matrix and keeps settings after reload`

- [ ] **Step 1:** Failing browser test.
- [ ] **Step 2:** Third tab; `mergeView` defaults for `matrix`; Display hides table group/columns on matrix layout.
- [ ] **Step 3:** Browser pass + `roadmap.spec.ts` + `roadmap-gantt.spec.ts` unchanged green.
- [ ] **Step 4:** Commit `Roadmaps: Matrix tab and view settings.`

### Task 6: Matrix UI

**Files:**
- Create/finish: `Matrix.tsx`, `MatrixCell.tsx`, `MatrixPicker.tsx`
- Modify: `issueTableView.tsx` `visibleRows`, `RoadmapScreen.tsx`, `useIssueDetail.ts` refetch on seq

- [ ] **Step 1:** Extend browser test: worked tree, UK/FR/SG cells, open from cell, filter case from spec.
- [ ] **Step 2:** Implement table UI per spec (sticky, virtualization reuse `VIRT`, keyboard).
- [ ] **Step 3:** Browser pass; build.
- [ ] **Step 4:** Commit `Roadmaps: Matrix grid and cells.`

### Task 7: Duplicate in table + e2e

**Files:**
- Modify: `BulkBar.tsx`, `IssueTable.tsx`

- [ ] **Step 1:** Browser test: duplicate country row, set field, see new matrix column.
- [ ] **Step 2:** Duplicate only on table bulk bar; build id map; selection → new ids on ok.
- [ ] **Step 3:** Full `roadmap*.spec.ts` pass.
- [ ] **Step 4:** Commit `Roadmaps: Duplicate on the table.`

### Task 8: Whole check

- [ ] `npm test`, `npm run build`, roadmap browser suite pass.
- [ ] Commit if fixes: `Roadmaps M3: checked end to end.`
