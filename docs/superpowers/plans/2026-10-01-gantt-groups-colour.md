# Gantt groups, level colours and milestones Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A timeline can have groups of sub-rows (coloured only to tell top-level from sub-level) and up to 6 milestones, all editable in the gantt editor and writable by the agent.

**Architecture:** `chart.rows` stays one flat list; a row's optional `level: 1` makes it a child of the nearest level-0 row above, and a level-0 row with children is a group whose span is derived (`timelineLines`, one pure helper used by checks, renderer and editor). Colour is derived from the level through existing allocator grey slots; nothing about colour is stored or chosen. Every editor action is a patch through `applyPatch`, the agent's own path.

**Tech Stack:** TypeScript (strict), vitest, Playwright, React 18, shadcn context menu, Tailwind.

**Spec:** `docs/superpowers/specs/2026-10-01-gantt-groups-colour-design.md`

## Global Constraints

- No `any`, no inline styles in app code (`src/app`); split components over ~300 lines.
- Slides use `slides.css` unchanged by app chrome; slide CSS additions go in `src/engine/slides/slides.css`.
- Checks warn, they never silently rewrite. The agent and the editor write the same schema path.
- No colour field, no colour menu, no highlight is added. Colour only tells top-level from sub-level. The allocator throws if two used colours are too close or a mark is below contrast: the slots used are covered by a test across all themes.
- Examples and the gallery come only from `src/engine/starters/starters.json`; no new example set. Existing starters must stay valid and render unchanged.
- Limits: 8 top-level rows, 12 lines in total, 2 minimum; with notes 6 lines and 20 characters per label; 6 milestones; periods unchanged (3–16, 8 with notes).
- The existing row `focus` flag is left exactly as it is (the starter uses it); do not remove or rename it.
- Delete superseded code outright; no shims.

## Review Focus

- A slide that already exists (every starter timeline, `focus: true`, no `level`) validates and renders exactly as before, bar colours included.
- The last child of a group is deleted or outdented: the group becomes a plain row with its old span, never `NaN` or missing dates.
- Periods are inserted or deleted while groups exist: groups (no dates) are skipped, children shift, nothing becomes `NaN`.
- The agent writes a bad shape (a group carrying `start`/`end`, a first row with `level: 1`, `level: 2`, two focus rows, 13 lines): each gets a named error pointing at the path.
- Twelve lines with a milestone lane and notes still lay out inside the chart: row height shrinks, labels do not overlap; the two greys pass the allocator in every theme.

---

### Task 1: Row model and the derived span

**Files:**
- Modify: `src/engine/types.ts:10-11`
- Create: `src/engine/slides/charts/timeline-rows.ts`
- Test: `tests/unit/timeline-rows.test.ts`

**Interfaces:**
- Produces:
  - `TimelineRow { label: string; start?: number; end?: number; level?: 0 | 1; focus?: boolean }` (`Milestone` is unchanged)
  - `interface Line { row: TimelineRow; index: number; level: 0 | 1; group: boolean; start: number; end: number; focus: boolean }`
  - `timelineLines(rows: readonly TimelineRow[]): Line[]`

- [ ] **Step 1: Write the failing test** (`tests/unit/timeline-rows.test.ts`)

```ts
import { test, expect } from 'vitest'
import { timelineLines } from '@/engine/slides/charts/timeline-rows'
import type { TimelineRow } from '@/engine/types'

const rows: TimelineRow[] = [
  { label: 'A' },
  { label: 'a1', level: 1, start: 1, end: 2 },
  { label: 'a2', level: 1, start: 3, end: 4 },
  { label: 'B', start: 0, end: 1, focus: true },
]

test('a group spans its children; a plain row keeps its own dates', () => {
  expect(timelineLines(rows).map((l) => [l.group, l.level, l.start, l.end, l.focus])).toEqual([
    [true, 0, 1, 4, false], [false, 1, 1, 2, false], [false, 1, 3, 4, false], [false, 0, 0, 1, true]])
})

test('a level-0 row with no children after it is not a group', () => {
  expect(timelineLines([{ label: 'x', start: 2, end: 3 }])[0]).toMatchObject({ group: false, start: 2, end: 3 })
})

test('a group whose children have no dates falls back to 0', () => {
  expect(timelineLines([{ label: 'g' }, { label: 'c', level: 1 }])[0]).toMatchObject({ group: true, start: 0, end: 0 })
})
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run tests/unit/timeline-rows.test.ts`
Expected: FAIL, cannot resolve `timeline-rows`.

- [ ] **Step 3: Implement**

`src/engine/types.ts`, replace the `TimelineRow` line:

```ts
export interface TimelineRow { label: string; start?: number; end?: number; level?: 0 | 1; focus?: boolean }
```

`src/engine/slides/charts/timeline-rows.ts`:

```ts
/* The timeline's rows as drawn lines: a level-1 row is a child of the level-0 row above, and a level-0 row with children
   is a group whose span is derived from them. One reading, shared by the checks, the renderer and the editor. */
import type { TimelineRow } from "../../types";

export interface Line { row: TimelineRow; index: number; level: 0 | 1; group: boolean; start: number; end: number; focus: boolean }

export function timelineLines(rows: readonly TimelineRow[]): Line[] {
  return rows.map((row, index) => {
    const level = row.level === 1 ? 1 : 0, group = level === 0 && rows[index + 1]?.level === 1;
    let start = row.start ?? 0, end = row.end ?? 0;
    if (group) {
      const kids: TimelineRow[] = [];
      for (let j = index + 1; rows[j]?.level === 1; j++) kids.push(rows[j]);
      const s = kids.map((k) => k.start).filter((n): n is number => typeof n === "number"), e = kids.map((k) => k.end).filter((n): n is number => typeof n === "number");
      start = s.length ? Math.min(...s) : 0; end = e.length ? Math.max(...e) : 0;
    }
    return { row, index, level, group, start, end, focus: !!row.focus };
  });
}
```

- [ ] **Step 4: Run test and typecheck**

Run: `npx vitest run tests/unit/timeline-rows.test.ts && npx tsc --noEmit -p .`
Expected: test PASS. `tsc` now reports errors where `r.start`/`r.end` are read as numbers (`chart-timeline.ts`, `gantt.ts`, `Gantt.tsx`, `schema.ts`). Keep this commit green by changing only the reads that block compile to `?? 0`; the renderer and editor are rewritten in Tasks 3–5.

- [ ] **Step 5: Commit**

```bash
git add -A src tests && git commit -m "Timeline rows: level and the derived group span"
```

---

### Task 2: Schema, checks and the agent's description

**Files:**
- Modify: `src/engine/slides/schema.ts` (the timeline rule near line 130, the `periods`/`rows`/`milestones` fields near 188-205, `checkTimeline` near 554, the notes limits near 585-592, the rules string near 235)
- Modify: `src/engine/agent/suggest.ts:11`
- Test: `tests/unit/schema.test.ts` (extend; update the existing notes-limits case)

**Interfaces:**
- Consumes: `timelineLines` (Task 1).
- Produces: schema fields `rows[].level`; `start`/`end` no longer `required` in the schema (the check below enforces them for non-groups); `rows` items `{ min: 2, max: 12 }`; `milestones` items `{ max: 6 }`; the error texts below.

- [ ] **Step 1: Write the failing tests** (append to `tests/unit/schema.test.ts`, using its `errs`, `chart`, `TL`)

```ts
const GROUPED = { kind: "timeline", periods: ["Q1", "Q2", "Q3", "Q4"], rows: [
  { label: "Platform" }, { label: "API", level: 1, start: 0, end: 1 }, { label: "UI", level: 1, start: 1, end: 3 },
  { label: "Launch", start: 3, end: 3, focus: true }], milestones: [{ label: "Beta", at: 1 }] };

test("timeline groups: valid shapes pass, bad ones are named", () => {
  assert.deepEqual(errs(chart(GROUPED)), []);
  assert.match(errs(chart({ ...GROUPED, rows: [{ ...GROUPED.rows[0], start: 0, end: 1 }, ...GROUPED.rows.slice(1)] })).join(), /rows\[0\].*group.*start/);
  assert.match(errs(chart({ ...GROUPED, rows: [{ label: "x", level: 1, start: 0, end: 1 }, GROUPED.rows[3]] })).join(), /rows\[0\].*sub-row/);
  assert.match(errs(chart({ ...GROUPED, rows: [GROUPED.rows[3], { label: "x", level: 2, start: 0, end: 1 }] })).join(), /rows\[1\]\.level/);
  assert.match(errs(chart({ ...GROUPED, rows: [GROUPED.rows[3], { ...GROUPED.rows[3] }] })).join(), /at most one focus/);
  assert.match(errs(chart({ ...GROUPED, rows: [GROUPED.rows[0], { label: "c", level: 1 }] })).join(), /rows\[1\].*start.*end/);
});

test("timeline limits count lines, not only workstreams", () => {
  const many = (n: number, extra: object = {}) => Array.from({ length: n }, (_, i) => ({ label: `R${i}`, start: 0, end: 1, ...extra }));
  assert.match(errs(chart({ ...TL, rows: many(9) })).join(), /at most 8 workstreams/);
  const twelve = [...many(4), ...many(8, { level: 1 })];
  assert.deepEqual(errs(chart({ ...TL, rows: twelve })), []);
  assert.match(errs(chart({ ...TL, rows: [...twelve, { label: "x", level: 1, start: 0, end: 1 }] })).join(), /rows/);
  assert.match(errs(chart({ ...TL, rows: many(7) }, { notes: [{ title: "a" }, { title: "b" }] })).join(), /with notes at most 6/);
  assert.match(errs(chart({ ...TL, milestones: Array.from({ length: 7 }, (_, i) => ({ label: `M${i}`, at: 0 })) })).join(), /milestones/);
});
```

Also change the existing assertion in `"notes limits per kind"` from `/with notes at most 4/` to `/with notes at most 6/` and its fixture from 5 rows to 7.

- [ ] **Step 2: Run, see fail**

Run: `npx vitest run tests/unit/schema.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

`schema.ts` field definitions (replace `rows` and `milestones`; `periods` unchanged):

```ts
    rows: f("list", "Timeline only. One bar per workstream. A workstream made of smaller steps is a group: give the steps `level: 1` directly after it and leave the group's own `start` and `end` out (it spans its steps).", {
      items: { min: 2, max: 12 },
      of: f("object", "One workstream or step.", { fields: {
        label: f("text", "Workstream name.", { required: true, max: 28 }),
        level: f("number", "`1` makes this a step of the nearest workstream above it. Leave out for a workstream.", { default: 0 }),
        start: f("number", "0-based index of its first period. Not on a group."),
        end: f("number", "0-based index of its last period (inclusive). Not on a group."),
        focus: f("boolean", "Highlight the workstream the title is about. At most one.", { default: false }),
      } }),
    }),
    milestones: f("list", "Timeline only. Optional diamonds on the time axis.", {
      items: { max: 6 },
      of: f("object", "One milestone.", { fields: {
        label: f("text", "What happens.", { required: true, max: 16 }),
        at: f("number", "0-based index of the period it falls at the end of.", { required: true }),
      } }),
    }),
```

At the timeline rule line (near 130) append: ` A workstream made of smaller steps is a group (the steps have \`level: 1\`).`

Replace `checkTimeline`:

```ts
function checkTimeline(c: Chart, path: string, out: Out): void {
  if (!Array.isArray(c.periods)) out.errors.push(`${path}.periods: required. Column labels, in order.`);
  if (!Array.isArray(c.rows)) out.errors.push(`${path}.rows: required. One bar per workstream.`);
  if (!Array.isArray(c.periods) || !Array.isArray(c.rows)) return;
  const n = c.periods.length, ok = (v: unknown) => Number.isInteger(v) && (v as number) >= 0 && (v as number) < n;
  const lines = timelineLines(c.rows.map((r) => r ?? { label: "" }));
  c.rows.forEach((r, i) => {
    if (!r) return;
    if (r.level !== undefined && r.level !== 0 && r.level !== 1) { out.errors.push(`${path}.rows[${i}].level: 0 or 1 (got ${r.level}).`); return; }
    if (r.level === 1 && i === 0) { out.errors.push(`${path}.rows[0]: a sub-row needs a workstream above it.`); return; }
    if (lines[i].group) {
      if (r.start !== undefined || r.end !== undefined) out.errors.push(`${path}.rows[${i}]: a group spans its sub-rows; leave out \`start\` and \`end\`.`);
      return;
    }
    if (!ok(r.start) || !ok(r.end)) out.errors.push(`${path}.rows[${i}]: \`start\` and \`end\` must be period indices 0–${n - 1} (got ${r.start}, ${r.end}).`);
    else if ((r.start as number) > (r.end as number)) out.errors.push(`${path}.rows[${i}]: \`start\` (${r.start}) is after \`end\` (${r.end}).`);
  });
  (c.milestones || []).forEach((m, i) => { if (m && !ok(m.at)) out.errors.push(`${path}.milestones[${i}].at: must be a period index 0–${n - 1} (got ${m.at}).`); });
  if (count(c.rows, "focus") > 1) out.errors.push(`${path}.rows: at most one focus row.`);
  if (lines.filter((l) => l.level === 0).length > 8) out.errors.push(`${path}.rows: at most 8 workstreams (sub-rows are extra, 12 lines in all).`);
}
```

Add `import { timelineLines } from "./charts/timeline-rows";` to `schema.ts`. In the notes block change the timeline rows limit to lines: `if (kind === "timeline" && rows.length > 6) out.errors.push(\`chart.rows: ${rows.length} lines; with notes at most 6. Drop notes or merge workstreams.\`)`, and the rules string near line 235 (`4 workstreams` becomes `6 lines`). In `src/engine/agent/suggest.ts:11` write `timeline (workstreams with sub-steps, and milestones)`.

- [ ] **Step 4: Run all unit tests and typecheck**

Run: `npx vitest run && npx tsc --noEmit -p .`
Expected: PASS. If an agent-prompt test snapshots the description, read the diff and accept only the intended wording.

- [ ] **Step 5: Commit**

```bash
git add -A src tests && git commit -m "Timeline schema: sub-rows, six milestones, and checks that name the bad shape"
```

---

### Task 3: Colours and the renderer

**Files:**
- Modify: `src/engine/slides/colours.ts:162`
- Modify: `src/engine/slides/charts/chart-timeline.ts`
- Modify: `src/engine/slides/slides.css` (the Timeline block near line 278)
- Test: `tests/unit/render-timeline.test.ts` (new)

**Interfaces:**
- Consumes: `timelineLines`, `Line` (Task 1).
- Produces: `barTone(ln: Line, hasSub: boolean): "focus" | "ctx1" | "ctx3" | "quiet"` exported from `chart-timeline.ts`; bar classes `c-<tone>` on `.tl-bar`; group bars carry `tl-group`; labels carry `group` / `child`.

- [ ] **Step 1: Write the failing tests** (`tests/unit/render-timeline.test.ts`; use the same jsdom setup as `tests/unit/render.test.ts`)

```ts
import { test, expect } from 'vitest'
import { allocate } from '@/engine/slides/colours'
import { barTone, timelineChart } from '@/engine/slides/charts/chart-timeline'
import { timelineLines } from '@/engine/slides/charts/timeline-rows'
import type { Chart, Slide } from '@/engine/types'

const grouped: Chart = { kind: 'timeline', periods: ['Q1', 'Q2', 'Q3', 'Q4'], rows: [
  { label: 'Platform' }, { label: 'API', level: 1, start: 0, end: 1 }, { label: 'UI', level: 1, start: 1, end: 3 },
  { label: 'Launch', start: 3, end: 3 }], milestones: [{ label: 'Beta', at: 1 }] }
const plain: Chart = { kind: 'timeline', periods: ['Q1', 'Q2', 'Q3'], rows: [{ label: 'A', start: 0, end: 1 }, { label: 'B', start: 1, end: 2, focus: true }] }

test('colour follows level only when there are sub-rows; a flat chart keeps its greys and its focus', () => {
  const g = timelineLines(grouped.rows ?? []), p = timelineLines(plain.rows ?? [])
  expect(g.map((l) => barTone(l, true))).toEqual(['ctx1', 'ctx3', 'ctx3', 'ctx1'])
  expect(p.map((l) => barTone(l, false))).toEqual(['quiet', 'focus'])
})

test('a group is a bracket over its children and a child label is indented', () => {
  const box = document.createElement('div'); document.body.append(box)
  timelineChart(box, grouped, 1600, 800)
  expect(box.querySelectorAll('.tl-group').length).toBe(3)       // the bar and its two end caps
  expect(box.querySelector('.row-lbl.group')?.textContent).toBe('Platform')
  expect(box.querySelectorAll('.row-lbl.child').length).toBe(2)
  expect(box.querySelectorAll('.tl-bar.c-ctx3').length).toBe(2)
})

test('the allocator accepts the greys in every theme', () => {
  const s: Slide = { template: 'chart', title: 'T', chart: grouped }
  for (const theme of ['ink', 'paper'] as const) expect(() => allocate(s, theme)).not.toThrow()
})
```

(Use the themes list the colour tests already iterate over if it has more than these two.)

- [ ] **Step 2: Run, see fail**

Run: `npx vitest run tests/unit/render-timeline.test.ts`
Expected: FAIL (`barTone` is not exported).

- [ ] **Step 3: Implement**

`colours.ts:162`, replace the timeline line with:

```ts
  if (chart && kind === "timeline") {
    // Sub-rows are told from top-level by the two ends of the grey scale; with none, every bar is the quiet grey it always was.
    if ((chart.rows || []).some((r) => r?.level === 1)) { used.add("ctx1"); used.add("ctx3"); } else used.add("quiet");
  }
```

If a theme fails the distance check against `focus` or `quiet` (the test names the pair), fall back to `ctx1`/`ctx2`, and record which in a comment.

`chart-timeline.ts`:

```ts
import { timelineLines, type Line } from "./timeline-rows";

/** A bar's colour slot: focus keeps the focus colour; with sub-rows the top level is the strong grey and sub-rows the quiet one; otherwise the quiet grey. */
export const barTone = (ln: Line, hasSub: boolean): "focus" | "ctx1" | "ctx3" | "quiet" => (ln.focus ? "focus" : hasSub ? (ln.level === 0 ? "ctx1" : "ctx3") : "quiet");
```

In `timelineChart` replace the rows handling:

```ts
  const lines = timelineLines(spec.rows ?? []), hasSub = lines.some((l) => l.level === 1);
  // rh = Math.min(104, (H - head - foot) / lines.length); rowsBottom = head + rh * lines.length
  lines.forEach((ln, i) => {
    const cy = head + rh * i + rh / 2, x = px(ln.start) + 6, w = (ln.end - ln.start + 1) * cw - 12, cls = `c-${barTone(ln, hasSub)}`;
    g += `<line class="row-rule" x1="0" x2="${W}" y1="${head + rh * (i + 1)}" y2="${head + rh * (i + 1)}"/>`;
    if (ln.group) {
      const gh = Math.max(8, bh * .22), cap = bh * .9;
      g += `<rect class="tl-bar tl-group ${cls}" x="${x}" y="${cy - gh / 2}" width="${w}" height="${gh}"/>`;
      g += `<rect class="tl-bar tl-group ${cls}" x="${x}" y="${cy - cap / 2}" width="6" height="${cap}"/><rect class="tl-bar tl-group ${cls}" x="${x + w - 6}" y="${cy - cap / 2}" width="6" height="${cap}"/>`;
    } else g += `<rect class="tl-bar ${cls}" x="${x}" y="${cy - bh / 2}" width="${w}" height="${bh}" rx="${bh / 2}"/>`;
    const fit = rh < 34 ? `;font-size:${Math.max(18, Math.floor(rh * .8))}px` : "", ind = ln.level === 1 ? 28 : 0;
    t += `<span class="lbl row-lbl${ln.focus ? " focus" : ""}${ln.group ? " group" : ""}${ln.level === 1 ? " child" : ""}" style="left:${ind}px;top:${cy}px;width:${Lw - 28 - ind}px${fit}">${esc(ln.row.label)}</span>`;
  });
```

(The `.tl-bar` selector in `slides.css` fills with `var(--c)`; `c-ctx1` and `c-ctx3` already define `--c`.) The group test counts the bar and its two caps as `.tl-group`, so keep the three-rect bracket. Milestone drawing is unchanged except `rowsBottom` uses `lines.length`.

`slides.css`, after the `.row-lbl.focus` rule:

```css
.row-lbl.group { color: var(--fg); font-weight: 700; }
```

- [ ] **Step 4: Run tests, typecheck, and look at it**

Run: `npx vitest run && npx tsc --noEmit -p .`
Expected: PASS. Then view `/src/dev/review.html`: the existing timeline example must look unchanged. Render the grouped fixture and a 12-line fixture with milestones and notes at full size in both styles (load through `window.__journey.load`, screenshot), and check overlap, clipping and gaps. Record the check in `docs/temp/apple-bar-review.md`.

- [ ] **Step 5: Commit**

```bash
git add -A src tests && git commit -m "Timeline: groups drawn as brackets, colour by level"
```

---

### Task 4: Editor operations (pure)

**Files:**
- Modify: `src/engine/slides/gantt.ts`
- Test: `tests/unit/gantt.test.ts` (extend; existing cases keep passing unchanged)

**Interfaces:**
- Consumes: `timelineLines` (Task 1).
- Produces on the object `ganttFor(slide, style)` returns (existing members kept, `moveRow` replaced by `place`): `lines: Line[]`; `addSubRow(i)`, `indent(i)`, `outdent(i)`, `place(from: number, before: number, level: 0 | 1)`, `removeRow(i, withChildren?: boolean)`; all `Patch | null` with `Patch = Record<string, unknown>`. `insertRow(at)` inserts at the level of the row currently at `at`. Limits come from the schema plus 8 top-level.

- [ ] **Step 1: Write the failing tests** (append to `tests/unit/gantt.test.ts`)

```ts
const GR: Slide = { template: 'chart', title: 'T', chart: { kind: 'timeline', periods: ['Q1', 'Q2', 'Q3', 'Q4'], rows: [
  { label: 'Platform' }, { label: 'API', level: 1, start: 0, end: 1 }, { label: 'UI', level: 1, start: 2, end: 3 }, { label: 'Launch', start: 3, end: 3 }], milestones: [] } }
const gg = ganttFor(GR, 'consulting')
const labels = (c: ReturnType<typeof chartOf>) => c.rows?.map((r) => `${r.level === 1 ? '  ' : ''}${r.label}`)

test('a sub-row is added at the end of its group, and indent makes a row a child', () => {
  expect(labels(apply(GR, gg.addSubRow(0)))).toEqual(['Platform', '  API', '  UI', '  ', 'Launch'])
  const c = apply(GR, gg.indent(3))
  expect(labels(c)).toEqual(['Platform', '  API', '  UI', '  Launch'])
  expect(c.rows?.[3]).toMatchObject({ level: 1, start: 3, end: 3 })
  expect(gg.indent(0)).toBeNull()              // nothing above to belong to
  expect(gg.indent(0)).toBeNull()
})

test('indent under a plain row turns it into a group and drops its own dates', () => {
  const flat: Slide = { ...GR, chart: { ...chartOf(GR), rows: [{ label: 'A', start: 0, end: 1 }, { label: 'B', start: 2, end: 3 }] } }
  const c = apply(flat, ganttFor(flat, 'consulting').indent(1))
  expect(c.rows?.[0]).toEqual({ label: 'A' })
  expect(c.rows?.[1]).toMatchObject({ level: 1, start: 2, end: 3 })
})

test('outdent moves a child after its group, keeping its siblings', () => {
  const c = apply(GR, gg.outdent(1))
  expect(labels(c)).toEqual(['Platform', '  UI', 'API', 'Launch'])
  expect(c.rows?.[2]).toEqual({ label: 'API', start: 0, end: 1 })
})

test('the last child leaving turns the group back into a plain row with its old span', () => {
  const one: Slide = { ...GR, chart: { ...chartOf(GR), rows: [{ label: 'Platform' }, { label: 'API', level: 1, start: 1, end: 2 }, { label: 'Launch', start: 3, end: 3 }] } }
  const c = apply(one, ganttFor(one, 'consulting').outdent(1))
  expect(c.rows?.[0]).toEqual({ label: 'Platform', start: 1, end: 2 })
  const d = apply(one, ganttFor(one, 'consulting').removeRow(1))
  expect(d.rows?.[0]).toEqual({ label: 'Platform', start: 1, end: 2 })
})

test('place moves a row, or a whole group, and sets its level', () => {
  expect(labels(apply(GR, gg.place(3, 1, 1)))).toEqual(['Platform', '  Launch', '  API', '  UI'])
  expect(labels(apply(GR, gg.place(0, 4, 0)))).toEqual(['Launch', 'Platform', '  API', '  UI'])   // the group travels with its children
  expect(gg.place(0, 2, 0)).toBeNull()                                                           // not into its own children
  expect(apply(GR, gg.place(1, 0, 1)).rows?.[0]).toMatchObject({ label: 'API', start: 0, end: 1 }) // level 1 at the top becomes 0
})

test('deleting a group lifts its children, or takes them along', () => {
  const lift = apply(GR, gg.removeRow(0))
  expect(labels(lift)).toEqual(['API', 'UI', 'Launch'])
  expect(lift.rows?.[0]).toEqual({ label: 'API', start: 0, end: 1 })
  expect(labels(apply(GR, gg.removeRow(0, true)))).toEqual([])
})

test('periods shift children and skip groups', () => {
  const c = apply(GR, gg.insertPeriod(1))
  expect(c.rows?.[0]).toEqual({ label: 'Platform' })
  expect(c.rows?.map((r) => [r.start, r.end])).toEqual([[undefined, undefined], [0, 2], [3, 4], [4, 4]])
  const d = apply(GR, gg.removePeriod(0))
  expect(d.rows?.[0]).toEqual({ label: 'Platform' })
  expect(d.rows?.slice(1).every((r) => Number.isInteger(r.start) && Number.isInteger(r.end))).toBe(true)
})

test('limits: eight workstreams, twelve lines, six milestones', () => {
  const rows = (n: number, level?: 1) => Array.from({ length: n }, (_, i) => ({ label: `r${i}`, start: 0, end: 1, ...(level ? { level } : {}) }))
  const eight = { ...GR, chart: { ...chartOf(GR), rows: rows(8) } }
  expect(ganttFor(eight, 'consulting').insertRow(8)).toBeNull()
  const twelve = { ...GR, chart: { ...chartOf(GR), rows: [...rows(4), ...rows(8, 1)] } }
  expect(ganttFor(twelve, 'consulting').addSubRow(0)).toBeNull()
  const six = { ...GR, chart: { ...chartOf(GR), milestones: Array.from({ length: 6 }, (_, i) => ({ label: `m${i}`, at: 0 })) } }
  expect(ganttFor(six, 'consulting').insertMilestone()).toBeNull()
})
```

Clean up while writing: delete the duplicated `expect(gg.indent(0)).toBeNull()` line, and the `removeRow(0, true)` case should expect `['Launch']` (Platform and its two children go, Launch stays).

- [ ] **Step 2: Run, see fail**

Run: `npx vitest run tests/unit/gantt.test.ts`
Expected: FAIL (`addSubRow` etc. undefined); the existing cases still pass.

- [ ] **Step 3: Implement** (`gantt.ts`; keep `splice`/`move` helpers and the existing period, milestone and `setBar`/`setMilestone` members)

```ts
import { timelineLines } from "./charts/timeline-rows";
import type { Chart, Slide, Style, TimelineRow } from "../types";

// inside ganttFor, after rows/periods/miles/limits:
  const lines = timelineLines(rows), spans = new Map<TimelineRow, [number, number]>(lines.map((l) => [l.row, [l.start, l.end]]));
  const TOP = 8;

  /** Rows in the shape the schema wants: a group has no dates, everything else has them (a group that lost its last child keeps its old span). */
  const norm = (next: readonly TimelineRow[]): TimelineRow[] => {
    const ls = timelineLines(next);
    return next.map((r, i) => {
      const { level, start, end, ...rest } = r, [s0, e0] = spans.get(r) ?? [0, 0];
      const base: TimelineRow = { ...rest, ...(level === 1 && i > 0 ? { level: 1 as const } : {}) };
      return ls[i].group ? base : { ...base, start: start ?? s0, end: end ?? e0 };
    });
  };
  const fits = (next: readonly TimelineRow[]) => next.length >= rMin && next.length <= rMax && next.filter((r) => r.level !== 1).length <= TOP;
  const write = (next: TimelineRow[]): Patch | null => { const n = norm(next); return fits(n) ? { "chart.rows": n } : null; };
  /** A row and the children under it, as [from, to). */
  const family = (i: number): [number, number] => { let e = i + 1; if (lines[i]?.group) while (rows[e]?.level === 1) e++; return [i, e]; };
```

`reindex`: rows without dates (groups) pass through untouched:

```ts
    "chart.rows": rows.map((r) => (r.start === undefined || r.end === undefined ? r : { ...r, start: f(r.start), end: Math.max(f(r.start), f(r.end)) })),
```

Members:

```ts
    lines,
    insertRow: (at: number): Patch | null => write(splice(rows, at, 0, { label: "", start: 0, end: 0, ...(rows[at]?.level === 1 ? { level: 1 as const } : {}) })),
    addSubRow: (i: number): Patch | null => write(splice(rows, family(i)[1], 0, { label: "", level: 1, start: 0, end: 0 })),
    indent: (i: number): Patch | null => (i < 1 || rows[i].level === 1 || lines[i].group ? null : write(rows.map((r, k) => (k === i ? { ...r, level: 1 as const } : r)))),
    outdent: (i: number): Patch | null => {
      if (rows[i]?.level !== 1) return null;
      let e = i + 1; while (rows[e]?.level === 1) e++;
      const out = rows.slice(), [row] = out.splice(i, 1);
      out.splice(e - 1, 0, { ...row, level: 0 });
      return write(out);
    },
    /** Drop row `from` (with its children, if a group) before row `before` of the current list, at `level`. */
    place: (from: number, before: number, level: 0 | 1): Patch | null => {
      const [a, b] = family(from), len = b - a;
      if (before > a && before < b) return null;
      const at = before >= b ? before - len : before, rest = [...rows.slice(0, a), ...rows.slice(b)];
      const lv = len > 1 || at === 0 ? 0 : level;
      const moved = rows.slice(a, b).map((r, k) => (k === 0 ? { ...r, level: lv } : r));
      const next = [...rest.slice(0, at), ...moved, ...rest.slice(at)];
      return JSON.stringify(norm(next)) === JSON.stringify(norm(rows)) ? null : write(next);
    },
    removeRow: (i: number, withChildren = false): Patch | null => {
      const [a, b] = family(i), kids = b - i - 1;
      return write(withChildren ? [...rows.slice(0, a), ...rows.slice(b)] : [...rows.slice(0, i), ...rows.slice(i + 1).map((r, k) => (k < kids ? { ...r, level: 0 as const } : r))]);
    },
```

Delete the old `insertRow`, `removeRow` and `moveRow` members. Rows are always sent whole (`"chart.rows"`), so one patch is one undo step.

- [ ] **Step 4: Run tests and typecheck**

Run: `npx vitest run tests/unit/gantt.test.ts && npx vitest run && npx tsc --noEmit -p .`
Expected: PASS. (`Gantt.tsx` still calls `moveRow`/`removeRow(i)`: fix those call sites minimally in this task so the build is green; Task 5 rewrites that file's rows.)

- [ ] **Step 5: Commit**

```bash
git add -A src tests && git commit -m "Gantt operations: sub-rows, indent, outdent and place; groups skip period shifts"
```

---

### Task 5: The gantt editor UI

**Files:**
- Modify: `src/app/edit/Gantt.tsx`
- Create: `src/app/edit/GanttMenu.tsx` (the menu content, to keep `Gantt.tsx` under ~300 lines)
- Modify: `src/app/edit/drag.ts` (add `dropPlace`)
- Test: `tests/unit/drag.test.ts` (extend)

**Interfaces:**
- Consumes: `ganttFor(...)` members from Task 4.
- Produces: `dropPlace(boxes: { top: number; bottom: number }[], point: { x: number; y: number }, label: { left: number; width: number }): { before: number; level: 0 | 1 }` in `drag.ts`.

- [ ] **Step 1: Write the failing test** (append to `tests/unit/drag.test.ts`)

```ts
import { dropPlace } from '@/app/edit/drag'
const row = (top: number) => ({ top, bottom: top + 40 })
const label = { left: 40, width: 200 }

test('the drop place is the row boundary under the pointer; the level is the side of the label', () => {
  const boxes = [row(0), row(40), row(80)]
  expect(dropPlace(boxes, { x: 60, y: 10 }, label)).toEqual({ before: 0, level: 0 })
  expect(dropPlace(boxes, { x: 60, y: 70 }, label)).toEqual({ before: 2, level: 0 })
  expect(dropPlace(boxes, { x: 200, y: 70 }, label)).toEqual({ before: 2, level: 1 })
  expect(dropPlace(boxes, { x: 60, y: 500 }, label)).toEqual({ before: 3, level: 0 })
})
```

- [ ] **Step 2: Run, see fail, then implement** in `drag.ts`:

```ts
/** Where a dragged row lands: before which row (by the pointer's row half) and whether it nests (pointer over the right half of the label). */
export function dropPlace(boxes: { top: number; bottom: number }[], p: { x: number; y: number }, label: { left: number; width: number }): { before: number; level: 0 | 1 } {
  const before = boxes.findIndex((b) => p.y < (b.top + b.bottom) / 2);
  return { before: before < 0 ? boxes.length : before, level: p.x > label.left + label.width / 2 ? 1 : 0 };
}
```

Run: `npx vitest run tests/unit/drag.test.ts` (PASS).

- [ ] **Step 3: Update the rows in `Gantt.tsx`**

1. Iterate `g.lines.map((ln, i) => …)`. The `<tr>` keeps `data-row={i}`. The label cell gets `data-label`; a child's name input gets `pl-6`; a group's input gets `font-semibold`.
2. `periodCells(row, mile)`: for a group line draw the span from `g.lines[row]` as a thin bar (`h-2`), read-only: its `onPointerDown` does nothing. Bar colour follows level when the chart has sub-rows (`hasSub = g.lines.some((l) => l.level === 1)`): top-level `bg-ink/70`, sub-row `bg-ink/30`; without sub-rows keep today's classes. A `focus` line keeps `bg-ink`.
3. `lo`/`hi` read `g.lines[r].start/end`.
4. `dragRow`: on `pointermove`, `const d = dropPlace(rowBoxes, { x: ev.clientX, y: ev.clientY }, labelBox)` into `dropAt` state `{ before, level }` (row boxes from `tbody tr[data-row]`, label box from the first `[data-label]`); on `pointerup`, `write(g.place(index, d.before, d.level))`. The indicator is the existing `shadow-[0_-2px_0_0_theme(colors.ink)]` on the row at `before` (or on the bottom edge of the last row), with `ml-6` inset when `level === 1`.
5. Keyboard: `Space`/`Enter` on a group line does nothing.

- [ ] **Step 4: Create `GanttMenu.tsx`** (props `{ g: ReturnType<typeof ganttFor>; ctx: { row: number | null; period: number | null }; write: (p: Patch | null) => void }`), moving the inline menu out of `Gantt.tsx`:

Row section (when `ctx.row !== null`), each `ContextMenuItem disabled={!patch}`:
- "Insert workstream above" `g.insertRow(row)`; "Insert workstream below" `g.insertRow(end of that row's family)`; "Add sub-row" `g.addSubRow(row)`.
- "Indent" `g.indent(row)`; "Outdent" `g.outdent(row)`.
- "Delete" `g.removeRow(row)`; for a group also "Delete group and sub-rows" `g.removeRow(row, true)`.

Period section as today. Milestone section as today ("Add milestone" and "Delete milestone N"). No colour entries anywhere.

- [ ] **Step 5: Run unit tests, typecheck, lint, and drive it**

Run: `npx vitest run && npx tsc --noEmit -p . && npm run lint`
Expected: PASS. Then open the dev server (`preview_start dev`), load a grouped timeline through `window.__journey.load`, enter edit mode (`e`), open the chart, and try each menu entry, a drag to nest and ⌘Z. Fix what the eyes catch before committing; Task 6 pins it.

- [ ] **Step 6: Commit**

```bash
git add -A src tests && git commit -m "Gantt editor: sub-rows, indent and drag-to-nest, bars coloured by level"
```

---

### Task 6: Browser tests, review pass, docs

**Files:**
- Modify: `tests/browser/edit.spec.ts` (new cases; the existing gantt case stays unchanged)
- Modify: `docs/superpowers/specs/2026-10-01-manual-slide-editing-design.md` (the Timeline paragraph near line 70)

- [ ] **Step 1: Write the browser tests** (append to `tests/browser/edit.spec.ts`; reuse `open`, `saved`, `must`)

```ts
const gantt = { template: 'chart', title: 'The plan runs four quarters', chart: { kind: 'timeline', periods: ['Q1', 'Q2', 'Q3', 'Q4'], rows: [{ label: 'Platform' }, { label: 'API', level: 1, start: 0, end: 1 }, { label: 'UI', level: 1, start: 1, end: 2 }, { label: 'Launch', start: 3, end: 3 }, { label: 'EU', start: 3, end: 3 }], milestones: [{ label: 'Beta', at: 1 }] } }
const openGantt = async (page: Page) => {
  await open(page)
  await page.evaluate((s) => window.__journey?.load([s] as never, 'consulting'), gantt)
  await page.keyboard.press('e')
  await page.locator('[data-editing] [data-chart]').click()
}
const rowCell = (page: Page, r: number) => page.locator(`tr[data-row="${r}"] td`).nth(1)

test('gantt: a sub-row is added from the menu and a row is indented under a group', async ({ page }) => {
  await openGantt(page)
  await rowCell(page, 0).click({ button: 'right' })
  await page.getByRole('menuitem', { name: 'Add sub-row' }).click()
  await expect(page.locator('tr[data-row]')).toHaveCount(6)
  await rowCell(page, 4).click({ button: 'right' })
  await page.getByRole('menuitem', { name: 'Indent' }).click()
  await page.getByRole('button', { name: 'Done' }).click()
  await page.getByRole('button', { name: 'Save' }).click()
  const rows = (await saved(page)).chart?.rows
  expect(rows?.map((r) => r.level ?? 0)).toEqual([0, 1, 1, 1, 1, 0])
  expect(rows?.[0].start).toBeUndefined()
})

test('gantt: dragging a row onto the right of another nests it', async ({ page }) => {
  await openGantt(page)
  const grip = page.getByRole('button', { name: 'Move workstream 4' })
  const target = must(await rowCell(page, 2).boundingBox()), g = must(await grip.boundingBox())
  await page.mouse.move(g.x + g.width / 2, g.y + g.height / 2); await page.mouse.down()
  await page.mouse.move(target.x + target.width * .8, target.y + target.height * .9, { steps: 8 }); await page.mouse.up()
  await page.getByRole('button', { name: 'Done' }).click()
  await page.getByRole('button', { name: 'Save' }).click()
  expect((await saved(page)).chart?.rows?.map((r) => [r.label, r.level ?? 0])).toEqual([['Platform', 0], ['API', 1], ['UI', 1], ['Launch', 1], ['EU', 0]])
})

test('gantt: deleting the last child turns the group back into a plain row', async ({ page }) => {
  await openGantt(page)
  for (let i = 0; i < 2; i++) { await rowCell(page, 1).click({ button: 'right' }); await page.getByRole('menuitem', { name: 'Delete', exact: true }).click() }
  await page.getByRole('button', { name: 'Done' }).click()
  await page.getByRole('button', { name: 'Save' }).click()
  expect((await saved(page)).chart?.rows?.[0]).toMatchObject({ label: 'Platform', start: 0, end: 2 })
})

test('gantt: ⌘Z undoes an indent', async ({ page }) => {
  await openGantt(page)
  await rowCell(page, 3).click({ button: 'right' })
  await page.getByRole('menuitem', { name: 'Indent' }).click()
  await page.getByRole('grid', { name: 'Timeline' }).focus()
  await page.keyboard.press('ControlOrMeta+z')
  await page.getByRole('button', { name: 'Done' }).click()
  await page.getByRole('button', { name: 'Save' }).click()
  expect((await saved(page)).chart?.rows?.map((r) => r.level ?? 0)).toEqual([0, 1, 1, 0, 0])
})
```

Note on the drag test: the saved `Launch` row is the third child because it is dropped after `UI`; adjust the pointer's target row if the nested index differs, but keep the assertion that all three of API, UI and Launch are level 1 under Platform and EU stays top-level.

- [ ] **Step 2: Run the browser suite**

Run: `npx playwright test -c tests/browser/playwright.config.ts edit.spec --timeout 30000`
Expected: all PASS. Run it twice; if a new case flakes, investigate rather than retry.

- [ ] **Step 3: Review pass at full size**

Load the grouped fixture and a 12-line fixture with milestones and notes, screenshot each at full size in both styles (consulting and pitch), and check overlap, clipping and gaps (project rule: every slide at full size, one at a time). Confirm the starter timeline in `/src/dev/review.html` is unchanged. Append findings to `docs/temp/apple-bar-review.md`.

- [ ] **Step 4: Docs**

Update the Timeline paragraph of the manual-editing spec to describe groups, indent, drag-to-nest, colour by level, and six milestones, with a link to the new spec.

- [ ] **Step 5: Full verification and commit**

Run: `npm run build && npm run lint && npx vitest run && npx playwright test -c tests/browser/playwright.config.ts`
Expected: all green.

```bash
git add -A docs src tests && git commit -m "Gantt groups: browser tests, review pass and spec notes"
```

Do not push or open a PR without being asked. When done, ask the user whether the existing row `focus` highlight should go (the starter timeline uses it) and whether a starter should show a group.
