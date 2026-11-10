# Roadmaps M4a: Checks — Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development or executing-plans task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** A **Checks** tab beside Table, Gantt, and Matrix that surfaces seven derived health signals, badge count of distinct failing issues, and card click → table filtered by a new check chip—no writes, no server, instant like the table.

**Architecture:** Pure `src/engine/roadmaps/checks.ts` owns `runChecks` and one shared predicate per check id; `view.ts` gains `{ on: 'check'; id: CheckId }` and delegates `chipMatches` to that predicate with an **`IssueIndex`** threaded through `matchesChips` (table, Gantt via `tableRows`, and **matrix.ts** call sites). The screen memoises `runChecks(live, { today, chips })` on every layout and filters chips with `on !== 'check'` when counting. M4b is **out of scope**.

**Tech Stack:** React 18 + TypeScript strict, Tailwind, vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-10-roadmaps-m4-checks-agent-design.md` (M4a only)

**Plan review:** `.superpowers/sdd/2026-11-10-roadmaps-m4-checks/plan-review-grok-4.7.md` ([Grok 4.7 plan review](485a55f1-99c6-4830-9f77-b520f4bb31dc))

## Global Constraints

- M1–M3 constraints still apply (no `any`, no inline styles, split files ~300 lines, shadcn, app tokens).
- No new API routes, schema, or CSS files. No stored check results.
- Checks never write; cards only set `layout: 'table'` + check chip (AND existing chips).
- Do not virtualise seven rows. Do not add a checks fetch.
- `checks.ts` uses `import type { Chip }` from `view.ts` only (avoid value import cycle).
- Do not add the seven checks to `FilterBar` “+ Filter”; entry is only from the Checks tab.

## Review Focus (spec — confirm at branch review)

1. No dates = open **leaves** only.
2. Long = **92** UTC calendar days, open leaves only; `CHECK_COPY` says "3 months".
3. Outside parent = **own** dates, direct parent only; Cancelled skipped; `dateSpan` is not a bound.
4. Done + open children walks descendants; Cancelled descendants ignored.
5. Tab badge = **`report.issues`** (distinct), not sum of `cards[].count`.
6. Red counts: overdue, blocked, outside_parent, done_open only; zero → `text-ink-3`.
7. One check chip; AND with other chips; check chip ignored in `runChecks` opts; card → table; other layouts keep chip; Matrix uses same `matchesChips` + index.
8. No writes from tab or report.

## File Structure

| File | Responsibility |
|---|---|
| `src/engine/roadmaps/checks.ts` | `CHECK_IDS`, `CHECK_THRESHOLDS`, `CHECK_COPY`, predicates, `runChecks` (`import type { Chip }`) |
| `src/engine/roadmaps/view.ts` | Check `Chip` variant; `layout` union includes `'checks'`; **`DEFAULT_VIEW.layout` stays `'table'`**; `chipMatches` / `matchesChips(issue, chips, today, index)` |
| `src/engine/roadmaps/matrix.ts` | Pass existing index into all `matchesChips` call sites (five) |
| `src/app/components/roadmap/useViewSettings.ts` | `mergeView` whitelists `'checks'` like `'matrix'` |
| `src/app/components/roadmap/chipLabel.ts` | Check labels from `CHECK_COPY[id].label` |
| `src/app/components/roadmap/Checks.tsx` | Seven rows from `CHECK_COPY`, `onOpen(id)` |
| `src/app/components/roadmap/TopBar.tsx` | Checks tab; badge `report.issues`; hide Display when `layout === 'checks'` |
| `src/app/components/roadmap/RoadmapScreen.tsx` | Memo on all layouts; Checks mount + `FilterBar` + branch before Matrix default |
| `tests/unit/roadmap-checks.test.ts` | Engine per spec § Tests |
| `tests/unit/roadmap-view.test.ts` | Check chip, dim, `liveChips` |
| `tests/browser/roadmap-checks.spec.ts` | Flow via `roadmap-helpers.ts` |

---

### Task 0: SDD ledger

**Files:** `.superpowers/sdd/2026-11-10-roadmaps-m4-checks/progress.md`

- [ ] **Step 1:** Ledger with goal, branch `roadmaps-m4`, tasks 1–5.

---

### Task 1: Checks engine

**Files:**
- Create: `src/engine/roadmaps/checks.ts`
- Test: `tests/unit/roadmap-checks.test.ts`
- Reuse: `tests/unit/roadmap-builders.ts`, `buildIndex`

- [ ] **Step 1:** Failing tests per spec § Tests (M4a), including:
  - Each id: smallest failing issue + quiet boundary next to it.
  - Long: 92 quiet, 93 fires; milestone quiet; one date → No dates not Long; Done leaf 200 days quiet.
  - No dates: open leaf missing start/due/both; open parent with children quiet; Done leaf no dates quiet.
  - Overdue: yesterday fires, today quiet, Done+past due quiet, no due quiet; **same ids as** `tableRows` + `{ on: 'dates', when: 'overdue' }` on one fixture.
  - No assignee: open leaf; not open parent with child; not Done leaf.
  - Blocked: parent and leaf; issue both Blocked and Overdue.
  - Outside parent: spec examples; parent `dateSpan` wide but missing own dates → no hit; grandchild vs direct parent only; Cancelled child skipped.
  - Done open: Done parent + open grandchild; Cancelled-only descendants quiet; Done leaf quiet.
  - **Distinct badge:** one issue on two cards → `issues === 1`, sum of counts `=== 2`.
  - Soft-delete absent; parent whose only child deleted is leaf.
  - Field chip AND run drops card count; `{ on: 'check' }` in `opts.chips` does not change report.
  - `issueIds` sibling `sortKey`, parent before child.
- [ ] **Step 2:** Implement predicates + `runChecks` (ignore check chips in opts for counting).
- [ ] **Step 3:** `npm test` + `npm run build`.
- [ ] **Step 4:** Commit `Roadmaps: checks engine (runChecks, seven rules).`

---

### Task 2: Check chip in view layer + matrix

**Files:**
- Modify: `view.ts`, `matrix.ts`, `useViewSettings.ts`, `chipLabel.ts`
- Test: `tests/unit/roadmap-view.test.ts`, matrix unit tests if chip filtering regresses

- [ ] **Step 1:** Failing tests: `chipMatches` each id with index; check AND status; `chipLabel`; `liveChips` keeps check when field removed; `tableRows` dims ancestor; unknown `chip.on` must not match-all.
- [ ] **Step 2:** Extend `Chip`; thread `IssueIndex` into `matchesChips` / `chipMatches`; delegate check variant to shared predicate; fix `default` branch.
- [ ] **Step 3:** Update `matrix.ts` five `matchesChips` sites to pass index.
- [ ] **Step 4:** `mergeView` accepts `'checks'`; **do not** change `DEFAULT_VIEW.layout`.
- [ ] **Step 5:** Vitest pass; commit `Roadmaps: check filter chip and matrix filters.`

---

### Task 3: Checks tab shell + RoadmapScreen wiring

**Files:**
- Modify: `TopBar.tsx`, `RoadmapScreen.tsx`
- Create: `Checks.tsx` (placeholder)
- Test: `tests/browser/roadmap-checks.spec.ts` (extend `roadmap-helpers.ts` for overdue + clean)

- [ ] **Step 1:** Failing browser: fourth tab `aria-pressed`; reload keeps `layout: 'checks'`; no Display on checks layout; **filter row visible** when issues exist; no checks HTTP route.
- [ ] **Step 2:** Top bar: Table, Gantt, Matrix, Checks; badge from `report.issues` on **every** layout; `aria` name `Checks, N issues` when N > 0 else `Checks`.
- [ ] **Step 3:** `RoadmapScreen`: memo `runChecks(live, { today, chips })` with screen `today`. If `layout === 'checks'`, render Checks even when `showTable` is false (not `EMPTY`). Else keep existing `showTable` / `EMPTY`. Inside loaded column: **`FilterBar` when `hasIssues`**, including Checks. Branch `checks` **before** Matrix default. Pass `report.issues` to `TopBar`.
- [ ] **Step 4:** Browser pass; commit `Roadmaps: Checks tab and screen wiring.`

---

### Task 4: Card list UI + hand-off to table

**Files:** `Checks.tsx`, `RoadmapScreen.tsx` (card click)

- [ ] **Step 1:** Browser: badge 1 with one overdue + one clean; Overdue card 1, others 0; click Overdue → table, overdue row matches, **clean row not a matching row**, chip "Overdue"; remove chip → both visible; no checks fetch.
- [ ] **Step 2:** Seven rows in `CHECK_IDS` order from `CHECK_COPY`; empty list line "Nothing to look at."; `count > 0` → button, name `{label}, {count} issues`, `text-bad` or `text-ink` per spec; `count === 0` → not a button, `text-ink-3`.
- [ ] **Step 3:** Card click: `{ ...view, layout: 'table', chips: [...withoutCheck, { on: 'check', id }] }` (at most one check chip).
- [ ] **Step 4:** Full `roadmap*.spec.ts` green; commit `Roadmaps: Checks cards and table hand-off.`

---

### Task 5: Whole check

- [ ] `npm test`, `npm run lint`, `npm run build`, roadmap browser suite including `roadmap-checks.spec.ts`.
- [ ] Grok 4.7 branch review on `roadmaps-m4` before merge.

---

## Explicitly deferred (M4b — separate plan)

Agent chat, `src/engine/tools/roadmaps.ts`, `timelineDraft`, `roadmaps.chat`, MCP registry—spec § M4b only.
