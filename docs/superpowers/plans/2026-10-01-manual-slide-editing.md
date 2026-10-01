# Manual Slide Editing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The user edits one slide by hand, on the slide, in an edit mode they enter on purpose and leave with Save or Discard. They can edit text, emphasis, list items, chart data and the template, and the same checks warn them that warn the agent.

**Architecture:** The renderer tags every editable element with its JSON path (`data-path`) and how its string is drawn (`data-kind`). Each field's markup string is the source of truth. Typing is mapped from plain-text offsets back onto that string by a pure module (`markup.ts`), and only that field is redrawn, with the cursor put back. The whole slide re-renders on structural changes only. Save goes through the agent's write pipeline, extracted to `write.ts`, without `shorten`. A single `editing` flag in the reducer locks everything that could make a second writer.

**Tech Stack:** React 18 + TypeScript strict, Vite, Tailwind + shadcn/ui, lucide-react, vitest (node; jsdom per file where the DOM is needed), Playwright.

**Spec:** `docs/superpowers/specs/2026-10-01-manual-slide-editing-design.md`

## Global Constraints

- No `any`, no inline styles (computed overlay positions go through CSS variables set with `style.setProperty`, the way `mountSlide` sets `--s`). Split components over ~300 lines.
- `slides.css` stays unchanged. App chrome never styles slide internals. The only exceptions are scoped to edit mode in `src/app/edit/edit.css`: `[data-editing] [contenteditable]:focus { outline: none }` and the empty-field hint (`:empty::before`).
- Use shadcn/ui primitives (`button`, `select`, `popover`, `input`, `tooltip` already exist).
- Examples come only from `src/engine/starters/starters.json`.
- Thin harness: no who-wrote-what tracking and no field locks. Checks warn and never rewrite the user's words. `shorten` never runs on a human save.
- The human can do exactly what the agent can do: no fonts, sizes, colours, images, chart kind or annotations.
- Copy: "Edit", "Save", "Discard", "Save or discard to keep chatting", "Keeps: … · Drops: …", "N warnings", "N fields still have sample text".
- Commit after every task with the attribution line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Typing next to a mark boundary**, e.g. at the end of `[[86% a year]]`, or deleting across the start of `**bold**`, keeps valid markup and never produces stray `**` or `[[` in the text. Pinned in Task 1 (boundary tests) and Task 9 (browser typing test).
2. **IME composition** (é, ü, Japanese) is not broken by a redraw in the middle of composing. Pinned in Task 6: the input handler ignores events while `isComposing`, and a unit test fires an input event during composition.
3. **Deleting all the text in an optional field** (takeaway, footnote) removes the field on save rather than leaving an empty element. Autofix already drops `""`. Pinned in Task 5 (save test).
4. **Leaving the page or switching decks with unsaved edits** never loses them silently. There's a `beforeunload` prompt, and deck switching is disabled while editing. Pinned in Task 4 (reducer guards) and Task 9 (browser).
5. **A save that cannot render** (a broken chart grid entry) keeps edit mode open with the reason and never writes the deck. Pinned in Task 5 (save refuses, state untouched).

---

## File map

| File | Responsibility |
|---|---|
| `src/engine/slides/markup.ts` (new) | Markup string ↔ characters with marks. `plainOf`, `applyText`, `toggle`, `hasMark` |
| `src/engine/slides/render.ts` (modify) | `data-path`, `data-kind` and `data-item` attributes. Exports `FIELD_HTML` |
| `src/engine/slides/lints.ts` (modify) | `fitIssuesAt` returns `{ msg, path? }`. `fitIssues` maps it to strings |
| `src/engine/slides/edit.ts` (new) | `getAt`, `listOps`, `newItem`, `removeItem`, `switchTemplate`, `issuePath` |
| `src/engine/slides/grid.ts` (new) | `chartGrid`, `fromGrid`, grid add/remove with schema limits |
| `src/engine/agent/write.ts` (new) | `checkWrite`, the shared write pipeline |
| `src/engine/agent/agent.ts` (modify) | `write()` calls `checkWrite`. `edited` passed to `stateBlock` |
| `src/engine/agent/agent-prompt.ts` (modify) | `stateBlock` gets the "edited by hand" line |
| `src/app/state.ts` (modify) | `editing`, `edited`, the `edit` action, `locked()` guards |
| `src/app/measure.ts` (modify) | `located` issues with paths |
| `src/app/turn.ts` (modify) | exports `runChecks`. Passes and clears `edited` |
| `src/app/edit/save.ts` (new) | `saveEdit`: the write pipeline, then items, `edited`, checks |
| `src/app/edit/useSlideEdit.ts` (new) | The draft, the shown slide, debounced issues, save and discard |
| `src/app/edit/fields.ts` (new) | DOM helpers: cursor offsets, redraw, editable setup |
| `src/app/edit/EditSurface.tsx` (new) | The editable slide: input, paste, keys, Enter for lists |
| `src/app/edit/EditOverlay.tsx` (new) | Amber underlines and +/× buttons over the slide |
| `src/app/edit/SelectionBar.tsx` (new) | The Bold/Focus floating bar |
| `src/app/edit/ChartGrid.tsx` (new) | The chart data grid in place |
| `src/app/edit/EditBar.tsx` (new) | Template switcher, keeps/drops, warnings, Discard/Save |
| `src/app/edit/EditMode.tsx` (new) | Lays out the surface and the bar where the stage and strip sit |
| `src/app/edit/edit.css` (new) | The two edit-mode-only rules |
| `src/app/components/Stage.tsx` (modify) | Edit button. `SlideFrame` extracted |
| `src/app/components/Editor.tsx` (modify) | Renders EditMode while editing. Locks and shortcuts |
| `src/app/App.tsx` (modify) | Locks for leave, Add, Clear, look and present. `beforeunload`. Edit deps |

---

### Task 1: Markup strings as characters with marks

**Files:**
- Create: `src/engine/slides/markup.ts`
- Test: `tests/unit/markup.test.ts`

**Interfaces:**
- Produces:
  - `type Mark = "b" | "f" | "neg" | "pos"`
  - `interface Char { ch: string; marks: Mark[] }`
  - `parse(markup: string): Char[]`
  - `serialize(chars: Char[]): string`
  - `plainOf(markup: string): string`
  - `applyText(markup: string, next: string): string`
  - `toggle(markup: string, from: number, to: number, mark: Mark): string`
  - `hasMark(markup: string, from: number, to: number, mark: Mark): boolean`

- [ ] **Step 1: Write the failing tests**

```ts
// tests/unit/markup.test.ts
import { test, expect } from 'vitest'
import { applyText, hasMark, parse, plainOf, serialize, toggle } from '@/engine/slides/markup'
import { md } from '@/engine/slides/render'
import { STARTERS } from '@/engine/starters'
import type { Slide } from '@/engine/types'

test('plain text drops the marks', () => {
  expect(plainOf('Revenue grows [[86% a year]] with **no** churn')).toBe('Revenue grows 86% a year with no churn')
  expect(plainOf('a [-loss-] and a [+gain+]')).toBe('a loss and a gain')
  expect(plainOf('unpaired ** and [[ stay text')).toBe('unpaired ** and [[ stay text')
})

test('serialize(parse(x)) renders exactly like x', () => {
  for (const x of ['plain', '**bold** then [[focus]]', '**[[both]]**', 'a [-neg-] b [+pos+]', '[[a]] [[b]]', 'end **bold**']) {
    expect(md(serialize(parse(x)))).toBe(md(x))
  }
})

// Every markup string in the gallery survives a round trip with its marks.
const strings = (v: unknown): string[] => typeof v === 'string' ? [v] : Array.isArray(v) ? v.flatMap(strings) : v && typeof v === 'object' ? Object.values(v).flatMap(strings) : []
test('every gallery string round-trips', () => {
  for (const st of STARTERS) for (const style of ['consulting', 'pitch'] as const) {
    for (const x of strings(st[style] as Slide)) expect(parse(serialize(parse(x)))).toEqual(parse(x))
  }
})

test('applyText: unchanged text returns the same string', () => {
  const x = 'Revenue [[doubles]]'
  expect(applyText(x, 'Revenue doubles')).toBe(x)
})

test('applyText: typing inside a mark extends it', () => {
  expect(applyText('Revenue [[doubles]]', 'Revenue [[doubless]]'.replace(/\[\[|\]\]/g, ''))).toBe('Revenue [[doubless]]')
  expect(applyText('a [[bc]] d', 'a bXc d')).toBe('a [[bXc]] d')
})

test('applyText: typing right after a mark extends it; before it, it does not', () => {
  expect(applyText('[[ab]] c', 'abX c')).toBe('[[abX]] c')
  expect(applyText('a [[bc]]', 'a XbcY'.replace('Y', ''))).toBe('a X[[bc]]')
})

test('applyText: deleting across a mark boundary keeps valid markup', () => {
  expect(applyText('one **two** three', 'one tree')).toBe('one **t**ree')
  // A prefix/suffix diff: the kept "t" was bold, so it stays bold; what matters is valid markup and the right text.
  const cut = applyText('one **two** three', 'one three')
  expect(plainOf(cut)).toBe('one three')
  expect(md(cut)).not.toMatch(/\*\*|\[\[/)
  expect(applyText('[[all]]', '')).toBe('')
})

test('applyText: replacing a selection that spans two marks', () => {
  const out = applyText('**ab**[[cd]]', 'aXd')
  expect(plainOf(out)).toBe('aXd')
  expect(out).not.toMatch(/\*\*\*\*|\[\[\]\]|\*\*\*\*/)
})

test('toggle: bold on, bold off, never overlapping', () => {
  expect(toggle('make it bold', 8, 12, 'b')).toBe('make it **bold**')
  expect(toggle('make it **bold**', 8, 12, 'b')).toBe('make it bold')
  expect(toggle('**ab**cd', 1, 3, 'b')).toBe('**abc**d')
  expect(toggle('[[ab]]cd', 1, 3, 'b')).toBe('[[a**b**]]**c**d')
  expect(md(toggle('[[ab]]cd', 1, 3, 'b'))).not.toMatch(/\*\*|\[\[/)
  expect(toggle('abc', 1, 1, 'f')).toBe('abc')
  expect(toggle('abc', 2, 0, 'f')).toBe('[[ab]]c')
})

test('hasMark is true only when every character has it', () => {
  expect(hasMark('a **bc** d', 2, 4, 'b')).toBe(true)
  expect(hasMark('a **bc** d', 1, 4, 'b')).toBe(false)
})
```

- [ ] **Step 2: Run them and check they fail**

Run: `npx vitest run tests/unit/markup.test.ts`
Expected: FAIL with "Failed to resolve import '@/engine/slides/markup'"

- [ ] **Step 3: Implement**

```ts
// src/engine/slides/markup.ts
/* A markup field as characters with marks (spec 4.1): hand editing works in plain-text offsets and writes the
   markup string back, so the string stays the truth and the marks keep their place around the text that changed. */
export type Mark = "b" | "f" | "neg" | "pos";
export interface Char { ch: string; marks: Mark[] }

const ORDER: Mark[] = ["b", "f", "neg", "pos"];
const TOKENS: Record<Mark, [string, string]> = { b: ["**", "**"], f: ["[[", "]]"], neg: ["[-", "-]"], pos: ["[+", "+]"] };
// The same pairs md() draws, so a string means the same thing here and on the slide.
const PAIRS: [Mark, RegExp][] = [["b", /\*\*(.+?)\*\*/g], ["f", /\[\[(.+?)\]\]/g], ["neg", /\[-(.+?)-\]/g], ["pos", /\[\+(.+?)\+\]/g]];

export function parse(markup: string): Char[] {
  const token = new Array<boolean>(markup.length).fill(false);
  const marks = Array.from({ length: markup.length }, () => new Set<Mark>());
  for (const [mark, re] of PAIRS) for (const m of markup.matchAll(re)) {
    const start = m.index ?? 0, end = start + m[0].length, open = TOKENS[mark][0].length, close = TOKENS[mark][1].length;
    for (let i = start; i < start + open; i++) token[i] = true;
    for (let i = end - close; i < end; i++) token[i] = true;
    for (let i = start + open; i < end - close; i++) marks[i].add(mark);
  }
  const out: Char[] = [];
  for (let i = 0; i < markup.length; i++) if (!token[i]) out.push({ ch: markup[i], marks: ORDER.filter((m) => marks[i].has(m)) });
  return out;
}

/** Characters back to markup: a mark opens where a run starts having it and closes where it stops. */
export function serialize(chars: Char[]): string {
  let out = "";
  const open: Mark[] = [];
  const closeTo = (keep: number) => { while (open.length > keep) out += TOKENS[open.pop() as Mark][1]; };
  for (const c of chars) {
    let k = 0;
    while (k < open.length && c.marks.includes(open[k])) k++;
    closeTo(k);
    for (const m of c.marks) if (!open.includes(m)) { out += TOKENS[m][0]; open.push(m); }
    out += c.ch;
  }
  closeTo(0);
  return out;
}

export const plainOf = (markup: string): string => parse(markup).map((c) => c.ch).join("");

/** The field's new plain text written into its markup: the changed span takes the marks of the character before it
    (or after it, at the start), the rest keep theirs. */
export function applyText(markup: string, next: string): string {
  const chars = parse(markup), prev = chars.map((c) => c.ch).join("");
  if (prev === next) return markup;
  let p = 0;
  while (p < prev.length && p < next.length && prev[p] === next[p]) p++;
  let s = 0;
  while (s < prev.length - p && s < next.length - p && prev[prev.length - 1 - s] === next[next.length - 1 - s]) s++;
  const inherit = (p > 0 ? chars[p - 1] : chars[prev.length - s])?.marks ?? [];
  const inserted = next.slice(p, next.length - s).split("").map((ch) => ({ ch, marks: inherit.slice() }));
  return serialize([...chars.slice(0, p), ...inserted, ...chars.slice(prev.length - s)]);
}

export function hasMark(markup: string, from: number, to: number, mark: Mark): boolean {
  const [a, b] = from <= to ? [from, to] : [to, from], chars = parse(markup).slice(a, b);
  return chars.length > 0 && chars.every((c) => c.marks.includes(mark));
}

/** Bold or Focus over a plain-text range: on unless every character already has it. */
export function toggle(markup: string, from: number, to: number, mark: Mark): string {
  const [a, b] = from <= to ? [from, to] : [to, from];
  if (a === b) return markup;
  const on = !hasMark(markup, a, b, mark);
  return serialize(parse(markup).map((c, i) => (i < a || i >= b ? c : { ch: c.ch, marks: ORDER.filter((m) => (m === mark ? on : c.marks.includes(m))) })));
}
```

- [ ] **Step 4: Run the tests and check they pass**

Run: `npx vitest run tests/unit/markup.test.ts`
Expected: PASS. If `'[[ab]]cd'` toggled over 1..3 doesn't give the exact string, check that `md()` of the result contains no literal `**` or `[[`. That is the real requirement, so fix the expectation to the serializer's canonical output.

- [ ] **Step 5: Commit**

```bash
git add src/engine/slides/markup.ts tests/unit/markup.test.ts
git commit -m "Markup strings as characters with marks, for editing by hand"
```

---

### Task 2: The renderer names every editable field

**Files:**
- Modify: `src/engine/slides/render.ts` (lines 11–125)
- Modify: `tests/unit/render-html.test.ts` (exact-HTML expectations)
- Test: `tests/unit/render-paths.test.ts`

**Interfaces:**
- Consumes: `parsePath` from `src/engine/agent/patch.ts`, `plainOf` (Task 1)
- Produces:
  - `type FieldKind = "md" | "display" | "esc" | "cap"`
  - `FIELD_HTML: Record<FieldKind, (s: string) => string>`
  - DOM attributes `data-path="<applyPatch path>"`, `data-kind="<FieldKind>"` on every editable element
  - `data-item="<list path>[i]"` on every list item container: card, note, step `.d`, bullet `li`, table `tr`, fact, body paragraph

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/render-paths.test.ts
// @vitest-environment jsdom
import { test, expect } from 'vitest'
import { slideHTML } from '@/engine/slides/render'
import { parsePath } from '@/engine/agent/patch'
import { plainOf } from '@/engine/slides/markup'
import { STARTERS } from '@/engine/starters'
import type { Slide } from '@/engine/types'

const CTX = { page: 2, section: 1, kicker: '01 · Market', footer: 'Acme' }
const get = (s: Slide, path: string): unknown => (parsePath(path) ?? []).reduce<unknown>((v, k) => (v as Record<string | number, unknown> | undefined)?.[k], s)

for (const st of STARTERS) for (const style of ['consulting', 'pitch'] as const) {
  test(`${st.id} (${style}): every data-path resolves and shows its field's text`, () => {
    const slide = st[style], host = document.createElement('div')
    host.innerHTML = slideHTML(slide, CTX, { style, theme: 'ink' })
    const fields = [...host.querySelectorAll<HTMLElement>('[data-path]')]
    expect(fields.length).toBeGreaterThan(0)
    for (const el of fields) {
      const path = el.dataset.path ?? '', v = get(slide, path)
      expect(parsePath(path), path).not.toBeNull()
      expect(['md', 'display', 'esc', 'cap']).toContain(el.dataset.kind)
      // An empty optional box (the section subtitle) has no value yet.
      if (v === undefined) { expect(el.textContent).toBe(''); continue }
      expect(el.textContent, path).toBe(plainOf(String(v)))
    }
    for (const el of host.querySelectorAll<HTMLElement>('[data-item]')) expect(get(slide, el.dataset.item ?? ''), el.dataset.item).toBeDefined()
  })
}

test('the source prefix and note numbers stay outside the fields', () => {
  const s: Slide = { template: 'chart', title: 'T', source: 'ONS', chart: { categories: ['a', 'b'], series: [{ name: 'x', values: [1, 2], mark: 'bar' }] }, notes: [{ title: 'One' }, { title: 'Two' }] }
  const host = document.createElement('div')
  host.innerHTML = slideHTML(s, CTX, { style: 'consulting', theme: 'ink' })
  expect(host.querySelector('[data-path="source"]')?.textContent).toBe('ONS')
  expect(host.querySelector('[data-path="notes[0].title"]')?.textContent).toBe('One')
})
```

- [ ] **Step 2: Run it and check it fails**

Run: `npx vitest run tests/unit/render-paths.test.ts`
Expected: FAIL, "expected 0 to be greater than 0" (no `data-path` yet).

- [ ] **Step 3: Implement in `render.ts`**

Add after `display` (line 19):

```ts
/** How a field's string is drawn; hand editing redraws one field with the same function. */
export type FieldKind = "md" | "display" | "esc" | "cap";
/* Exhibit caption: the unit after the last " · " is set quieter. */
const capInner = (text: string) => { const i = text.lastIndexOf(" · "); return i > 0 ? `${esc(text.slice(0, i))}<span> · ${esc(text.slice(i + 3))}</span>` : esc(text); };
export const FIELD_HTML: Record<FieldKind, (s: string) => string> = { md, display, esc, cap: capInner };
/** The field's JSON path and kind, as attributes: what hand editing reads. They change nothing on screen. */
const at = (path: string, kind: FieldKind) => ` data-path="${path}" data-kind="${kind}"`;
const item = (path: string) => ` data-item="${path}"`;
```

Then make these replacements (everything else in `render.ts` stays byte for byte):

```ts
const list = (items: string[], path: string) => `<ul class="bullets">${items.map((b, j) => `<li${item(`${path}[${j}]`)}${at(`${path}[${j}]`, "md")}>${md(b)}</li>`).join("")}</ul>`;

const notesHTML = (notes: Note[]) => `<div class="notes">${notes.map((n, i) => `<div class="note"${item(`notes[${i}]`)}><span class="n">${pad2(i + 1)}</span>
  <div><h4${at(`notes[${i}].title`, "md")}>${md(n.title)}</h4>${n.text ? `<p${at(`notes[${i}].text`, "md")}>${md(n.text)}</p>` : ""}</div></div>`).join("")}</div>`;

const capHTML = (text: string | undefined, cls = "", path = "") => {
  if (!text) return `<p class="cap blank ${cls}"></p>`;
  return `<p class="cap ${cls}"${path ? at(path, "cap") : ""}>${capInner(text)}</p>`;
};
const splitHTML = (s: Slide, main: string, extra = "") => {
  const head = s.notesTitle ? capHTML(s.caption, "", "caption") + capHTML(s.notesTitle, "notes-h", "notesTitle") : s.caption ? capHTML(s.caption, "", "caption") : "";
  const cls = s.notesTitle ? "has-head" : s.caption ? "has-head cap-only" : "";
  return `<div class="split ${extra} ${cls}">${head}<div class="main">${main}</div>${notesHTML(s.notes ?? [])}</div>`;
};
```

In `tableHTML`, index rows and cells:

```ts
  const cell = (c: Cell, r: number, j: number) => { const p = `table.rows[${r}].cells[${j}]`;
    if (typeof c === "object" && c) return `<td class="${cls(t.columns[j], j)}"><span${at(`${p}.value`, "esc")}>${esc(c.value)}</span>${c.note ? `<small${at(`${p}.note`, "esc")}>${esc(c.note)}</small>` : ""}</td>`;
    return `<td class="${cls(t.columns[j], j)}"${at(p, "esc")}>${esc(c ?? "")}</td>`; };
  return `<table class="tbl${t.columns.length <= 2 ? " narrow" : ""}"><colgroup>${t.columns.map(() => "<col>").join("")}</colgroup>
    <thead><tr>${t.columns.map((c, j) => `<th class="${cls(c, j)}"${at(`table.columns[${j}].label`, "esc")}>${esc(c.label ?? "")}</th>`).join("")}</tr></thead>
    <tbody>${t.rows.map((r, i) => `<tr class="${r.style || ""}"${item(`table.rows[${i}]`)}>${r.cells.map((c, j) => cell(c, i, j)).join("")}</tr>`).join("")}</tbody></table>`;
```

`cardHTML(c, variant, i)` (the caller in `BODY.cards` passes the index):

```ts
function cardHTML(c: Card, variant: string, i: number) {
  const p = `cards[${i}]`;
  const body = (c.bullets ? list(c.bullets, `${p}.bullets`) : "") + (c.text ? `<p${at(`${p}.text`, "md")}>${md(c.text)}</p>` : "");
  const tone = c.tone && c.tone !== "neutral" ? c.tone : "";
  if (variant === "framed") return `<div class="card ${tone}"${item(p)}><div class="who"${at(`${p}.label`, "esc")}>${esc(c.label || "")}</div><h3${at(`${p}.title`, "esc")}>${esc(c.title)}</h3>${body}
    ${c.facts ? `<div class="facts">${c.facts.map((x, k) => `<div${item(`${p}.facts[${k}]`)}><div class="k"${at(`${p}.facts[${k}].label`, "esc")}>${esc(x.label)}</div><div class="v"${at(`${p}.facts[${k}].text`, "md")}>${md(x.text)}</div></div>`).join("")}</div>` : ""}</div>`;
  if (variant === "value") return `<div class="card ${tone}"${item(p)}><div class="shout v"${at(`${p}.value`, "esc")}>${esc(c.value)}</div><h3${at(`${p}.title`, "md")}>${md(c.title)}</h3>${body}</div>`;
  return `<div class="card ${tone}"${item(p)}><div class="ic"><i data-lucide="${esc(c.icon)}"></i></div><h3${at(`${p}.title`, "md")}>${md(c.title)}</h3>${body}</div>`;
}
```

`BODY` entries:

```ts
  chart: (s, v) => v === "split"
    ? splitHTML(s, `<div class="chart" data-chart></div>`, "grow")
    : `${s.caption ? capHTML(s.caption, "", "caption") : ""}<div class="chart full grow" data-chart></div>`,
  table: (s, v) => v === "split"
    ? splitHTML(s, tableHTML(table(s)), "with-table")
    : `${s.caption ? capHTML(s.caption, "", "caption") : ""}${tableHTML(table(s))}`,
  number: (s) => {
    const n = s.number ?? { value: "", caption: "" };
    const num = `<div class="hero-n"><p class="shout hero-v ${n.tone || ""} ${n.value.length <= 4 ? "short" : ""}"${at("number.value", "esc")}>${esc(n.value)}</p><p class="hero-c"${at("number.caption", "md")}>${md(n.caption)}</p></div>`;
    return s.body?.length ? `<div class="hero"><div class="prose">${s.body.map((p, i) => `<p${item(`body[${i}]`)}${at(`body[${i}]`, "md")}>${md(p)}</p>`).join("")}</div>${num}</div>` : `<div class="hero solo">${num}</div>`;
  },
  steps: (s) => `<div class="steps">${(s.steps ?? []).map((r, i) => `
    <span class="t"${at(`steps[${i}].when`, "esc")}>${esc(r.when)}</span>
    <div class="d ${r.focus ? "row-focus" : ""}"${item(`steps[${i}]`)}><span class="h"${at(`steps[${i}].title`, "esc")}>${esc(r.title)}</span><span${at(`steps[${i}].text`, "md")}>${md(r.text)}</span></div>`).join("")}</div>`,
  cards: (s, v) => { const cards = s.cards ?? [];
    return `<div class="cards ${v} ${v === "framed" ? "grow" : `n-${cards.length}`}">${cards.map((c, i) => cardHTML(c, v, i)).join("")}</div>`; },
```

In `slideHTML`:

```ts
  if (s.template === "cover") {
    body = `<div class="cover-mark"></div><h1 class="title"${at("title", "display")}>${display(s.title)}</h1><p class="cover-sub"${at("subtitle", "md")}>${md(s.subtitle)}</p>`;
  } else if (s.template === "section") {
    body = `<p class="shout sec-n">${pad2(ctx.section)}</p><h2 class="title"${at("title", "esc")}>${esc(s.title)}</h2><p class="sec-sub"${at("subtitle", "md")}>${s.subtitle ? md(s.subtitle) : ""}</p>`;
  } else {
    const head = deck.style === "consulting"
      ? `<div class="label"${at("kicker", "esc")}>${esc(s.kicker || ctx.kicker)}</div><h2 class="title"${at("title", "display")}>${display(s.title)}</h2>`
      : `<h2 class="title"${at("title", "display")}>${display(s.title)}</h2>${s.subtitle ? `<p class="subtitle"${at("subtitle", "display")}>${display(s.subtitle)}</p>` : ""}`;
    body = `<header class="head">${head}</header>`
      + BODY[s.template](s, variant)
      + (s.takeaway ? `<div class="spacer"></div><p class="takeaway"${at("takeaway", "md")}>${md(s.takeaway)}</p>` : "");
  }
  const fn = [s.footnote && `<p${at("footnote", "md")}>${md(s.footnote)}</p>`, s.source && `<p>Source: <span${at("source", "md")}>${md(s.source)}</span></p>`].filter(Boolean).join("");
```

The kicker shows the section default when it's empty. The test treats `get()` as `undefined` there, and the element's text is the default. Add that case to the test's `continue` branch: `if (v === undefined) continue` (drop the `toBe('')` expectation, which only holds for the section subtitle).

- [ ] **Step 4: Update the exact-HTML expectations**

Run `npx vitest run tests/unit/render-html.test.ts` and update each `toContain` string to include the new attributes. For example `<p class="cap ">Margin walk</p>` becomes `<p class="cap " data-path="caption" data-kind="cap">Margin walk</p>`. Change only the attributes, never the structure.

- [ ] **Step 5: Run the unit tests, then the review page in the browser**

Run: `npx vitest run` → all PASS.
Run: `npm run test:browser -- review.spec.ts lints.spec.ts starters.spec.ts` → PASS. Lints and measurements are identical: the attributes and one inline `<span>` around the source and the object-cell values change nothing on screen.

- [ ] **Step 6: Commit**

```bash
git add src/engine/slides/render.ts tests/unit/render-paths.test.ts tests/unit/render-html.test.ts
git commit -m "Renderer: every editable field carries its JSON path and how it is drawn"
```

---

### Task 3: Edit operations, fit issues tied to fields, and the chart grid model

**Files:**
- Create: `src/engine/slides/edit.ts`, `src/engine/slides/grid.ts`
- Modify: `src/engine/slides/lints.ts` (`fitIssues`, lines 6–43)
- Modify: `src/app/measure.ts`
- Test: `tests/unit/edit-ops.test.ts`, `tests/unit/grid.test.ts`

**Interfaces:**
- Consumes: `describe`, `fieldsFor`, `MENU`, `validate`, `FieldView` from `schema.ts`; `applyPatch`, `parsePath` from `patch.ts`; `STARTERS`, `starterSlide` from `starters`
- Produces:
  - `getAt(slide: Slide, path: string): unknown`
  - `interface ListOp { path: string; min: number; max: number; length: number; required: boolean }`
  - `listOps(slide: Slide, style: Style): ListOp[]`
  - `listOf(ops: ListOp[], itemPath: string): { op: ListOp; index: number } | null`
  - `newItem(slide: Slide, style: Style, op: ListOp, at: number): Record<string, unknown>`, a patch set for `applyPatch`
  - `removeItem(op: ListOp, index: number): Record<string, unknown>`, a patch set
  - `switchTemplate(slide: Slide, to: TemplateId, style: Style): { slide: Slide; keeps: string[]; drops: string[]; samples: string[] }`
  - `issuePath(msg: string): string | undefined`
  - `interface Located { msg: string; path?: string }`
  - `fitIssuesAt(slide: HTMLElement, style: Style): Located[]`
  - `Measurer.located: Located[]`
  - grid: `type Grid`, `chartGrid(c: Chart): Grid`, `fromGrid(c: Chart, g: Grid): Chart`, `gridLimits(style: Style)`, `addRow`, `removeRow`, `addSeries`, `removeSeries`, `addPeriod`, `removePeriod`, `addMilestone`, `removeMilestone`

- [ ] **Step 1: Write the failing edit-ops tests**

```ts
// tests/unit/edit-ops.test.ts
import { test, expect } from 'vitest'
import { getAt, issuePath, listOf, listOps, newItem, removeItem, switchTemplate } from '@/engine/slides/edit'
import { applyPatch } from '@/engine/agent/patch'
import { autofix } from '@/engine/agent/autofix'
import { OFFERED, validate } from '@/engine/slides/schema'
import { STARTERS, starterSlide } from '@/engine/starters'
import type { Slide, Style } from '@/engine/types'

const starter = (id: string, style: Style = 'consulting') => starterSlide(STARTERS.find((s) => s.id === id)!, style)
const patched = (s: Slide, set: Record<string, unknown>) => { const r = applyPatch(s, set); if (!r.slide) throw new Error(r.errors.join('; ')); return r.slide }
const fill = (v: unknown): unknown => typeof v === 'string' ? (v === '' ? 'Filled in' : v) : Array.isArray(v) ? v.map(fill) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, fill(x)])) : v

test('getAt reads a path', () => {
  expect(getAt(starter('cards-icon'), 'cards[1].title')).toBe(starter('cards-icon').cards![1].title)
  expect(getAt(starter('cards-icon'), 'cards[9].title')).toBeUndefined()
})

test('listOps finds every list the user can grow, with the schema limits, and never chart data or table columns', () => {
  const ops = listOps(starter('cards-icon'), 'consulting')
  expect(ops.find((o) => o.path === 'cards')).toMatchObject({ min: 2, max: 4, required: true })
  expect(ops.some((o) => o.path.startsWith('chart') || o.path === 'table.columns' || o.path.endsWith('.cells'))).toBe(false)
  expect(listOps(starter('chart-notes'), 'consulting').find((o) => o.path === 'notes')).toMatchObject({ min: 2, max: 4, required: false })
})

test('listOf maps an item path to its list', () => {
  const ops = listOps(starter('cards-icon'), 'consulting')
  expect(listOf(ops, 'cards[2]')).toMatchObject({ op: { path: 'cards' }, index: 2 })
  expect(listOf(ops, 'title')).toBeNull()
})

for (const st of STARTERS) for (const style of ['consulting', 'pitch'] as const) {
  test(`${st.id} (${style}): a new item on every list validates once its text is filled in`, () => {
    const slide = starterSlide(st, style)
    for (const op of listOps(slide, style)) {
      if (op.length >= op.max) continue
      const next = fill(autofix(patched(slide, newItem(slide, style, op, op.length)), style).slide) as Slide
      const errors = validate(next, style).errors.filter((e) => !/characters|at most|budget/.test(e))
      expect(errors, `${op.path}`).toEqual([])
    }
  })
}

test('a new card copies its neighbour\'s shape: icon "auto", default tone, empty text', () => {
  const s = starter('cards-icon'), op = listOps(s, 'consulting').find((o) => o.path === 'cards')!
  const set = newItem(s, 'consulting', op, 1)
  expect(Object.keys(set)).toEqual(['cards'])
  const card = (set.cards as Record<string, unknown>[])[1]
  expect(card.icon).toBe('auto')
  expect(card.title).toBe('')
  expect(card.tone ?? 'neutral').toBe('neutral')
})

test('removeItem drops one item above the minimum, the whole optional list at it', () => {
  expect(removeItem({ path: 'notes', min: 2, max: 4, length: 3, required: false }, 1)).toEqual({ 'notes[1]': null })
  expect(removeItem({ path: 'notes', min: 2, max: 4, length: 2, required: false }, 1)).toEqual({ notes: null })
})

test('switchTemplate keeps the frame, takes the body from the starter, names what goes', () => {
  const from = starter('chart-notes'), r = switchTemplate(from, 'steps', 'consulting')
  expect(r.slide.template).toBe('steps')
  expect(r.slide.title).toBe(from.title)
  expect(r.keeps).toContain('title')
  expect(r.drops).toContain('chart')
  expect(r.drops).toContain(`${from.notes!.length} notes`)
  expect(r.samples.every((p) => p.startsWith('steps'))).toBe(true)
})

test('switchTemplate to and from cover keeps only title and subtitle', () => {
  const r = switchTemplate(starter('chart-notes'), 'cover', 'consulting')
  expect(Object.keys(r.slide).sort()).toEqual(['subtitle', 'template', 'title'])
})

for (const from of OFFERED) for (const to of OFFERED) for (const style of ['consulting', 'pitch'] as const) {
  if (from === to) continue
  test(`switchTemplate ${from} → ${to} (${style}) validates`, () => {
    const src = starterSlide(STARTERS.find((s) => s[style].template === from)!, style)
    const r = switchTemplate(src, to, style)
    expect(validate(autofix(r.slide, style).slide, style).errors.filter((e) => !/characters|at most|budget|wraps/.test(e))).toEqual([])
  })
}

test('issuePath reads the leading path of a validate message', () => {
  expect(issuePath('cards[2].title: 31 characters, limit 24 (7 too many). Shorten this field only.')).toBe('cards[2].title')
  expect(issuePath('title wraps to 3 lines (max 2); shorten it')).toBeUndefined()
})
```

- [ ] **Step 2: Run them and check they fail**

Run: `npx vitest run tests/unit/edit-ops.test.ts`
Expected: FAIL, the module is not found.

- [ ] **Step 3: Implement `edit.ts`**

```ts
// src/engine/slides/edit.ts
/* Editing by hand (spec 4.2, 4.4): the operations the user's buttons make, as patch sets for applyPatch, so the
   human writes through the same path as the agent. Limits come from the schema; nothing here is per template. */
import { parsePath } from "../agent/patch";
import { STARTERS, starterSlide } from "../starters";
import { MENU, describe, fieldsFor, type FieldView } from "./schema";
import type { Slide, Style, TemplateId } from "../types";

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => v !== null && typeof v === "object" && !Array.isArray(v);

export function getAt(slide: Slide, path: string): unknown {
  return (parsePath(path) ?? []).reduce<unknown>((v, k) => (v !== null && typeof v === "object" ? (v as Record<string | number, unknown>)[k] : undefined), slide);
}

export interface ListOp { path: string; min: number; max: number; length: number; required: boolean }
// Chart data has its own grid; table columns change every row, and cells follow the columns.
const SKIP = /^chart\b|^table\.columns$|\.cells$/;

export function listOps(slide: Slide, style: Style): ListOp[] {
  const out: ListOp[] = [];
  const walk = (fields: Record<string, FieldView>, value: Obj, base: string) => {
    for (const [k, def] of Object.entries(fields)) {
      const path = base ? `${base}.${k}` : k, v = value[k];
      if (SKIP.test(path)) continue;
      if (def.type === "list" && Array.isArray(v)) {
        out.push({ path, min: def.items?.min ?? 0, max: def.items?.max ?? Infinity, length: v.length, required: !!def.required });
        const of = def.of?.fields;
        if (of) v.forEach((x, i) => { if (isObj(x)) walk(of, x, `${path}[${i}]`); });
      } else if (def.type === "object" && def.fields && isObj(v)) walk(def.fields, v, path);
    }
  };
  walk(describe(slide.template, style).fields, slide as unknown as Obj, "");
  return out;
}

/** The list an item path belongs to: "cards[2]" → the cards list, index 2. */
export function listOf(ops: ListOp[], itemPath: string): { op: ListOp; index: number } | null {
  const m = /^(.*)\[(\d+)\]$/.exec(itemPath), op = m && ops.find((o) => o.path === m[1]);
  return m && op ? { op, index: Number(m[2]) } : null;
}

/* A blank of one field: text empty, a choice "auto" where code may pick, else its default; lists of text keep
   their minimum of empty entries, so a new card has one empty bullet to type into. */
function blank(def: FieldView, like: unknown): unknown {
  if (def.type === "text" || def.type === "markup" || def.type === "cell") return "";
  if (def.type === "enum") return def.values?.includes("auto") ? "auto" : def.default ?? like;
  if (def.type === "boolean") return def.default ?? false;
  // A list with a minimum keeps that many empty entries (bullets: 1); one without keeps its length (a row's cells).
  if (def.type === "list") return Array.isArray(like) && def.of ? Array.from({ length: Math.max(1, def.items?.min ?? like.length) }, () => blank(def.of as FieldView, like[0])) : like;
  if (def.type === "object" && def.fields && isObj(like)) return Object.fromEntries(Object.entries(like).flatMap(([k, x]) => (def.fields?.[k] ? [[k, blank(def.fields[k], x)]] : [])));
  return like;
}

/** A new item at `at`: its neighbour's shape with the text cleared. */
export function newItem(slide: Slide, style: Style, op: ListOp, at: number): Obj {
  const list = getAt(slide, op.path) as unknown[], like = list[Math.max(0, at - 1)] ?? list[0];
  const def = viewAt(slide, style, op.path);
  const fresh = def?.of ? blank(def.of, like) : "";
  // applyPatch sets one index; shifting the rest is a whole-list write.
  return { [op.path]: [...list.slice(0, at), fresh, ...list.slice(at)] };
}

/** Removing an item: above the minimum, the item; at it, an optional list goes whole (notes: 3 or none). */
export function removeItem(op: ListOp, index: number): Obj {
  return op.length > op.min ? { [`${op.path}[${index}]`]: null } : { [op.path]: null };
}

function viewAt(slide: Slide, style: Style, path: string): FieldView | undefined {
  let def: FieldView | undefined, fields: Record<string, FieldView> | undefined = describe(slide.template, style).fields;
  for (const k of parsePath(path) ?? []) {
    if (typeof k === "number") { fields = def?.of?.fields; continue; }
    def = fields?.[k];
    fields = def?.fields;
  }
  return def;
}

const COMMON = ["title", "kicker", "subtitle", "takeaway", "footnote", "source"], BARE = ["title", "subtitle"];
/** Paths of the words on a slide (text, markup and cell fields): not choices like icon, tone or focus. */
function textPaths(slide: Slide, style: Style): string[] {
  const out: string[] = [];
  const walk = (def: FieldView, v: unknown, path: string) => {
    if (v === undefined || v === null) return;
    if (def.type === "text" || def.type === "markup" || def.type === "cell") { out.push(path); return; }
    if (def.type === "list" && Array.isArray(v) && def.of) v.forEach((x, i) => walk(def.of as FieldView, x, `${path}[${i}]`));
    if (def.type === "object" && def.fields && isObj(v)) for (const [k, d] of Object.entries(def.fields)) walk(d, v[k], `${path}.${k}`);
  };
  for (const [k, d] of Object.entries(describe(slide.template, style).fields)) walk(d, (slide as unknown as Obj)[k], k);
  return out;
}

/** Another template: the shared fields stay, the body comes from that template's first starter (sample text). */
export function switchTemplate(slide: Slide, to: TemplateId, style: Style): { slide: Slide; keeps: string[]; drops: string[]; samples: string[] } {
  const st = STARTERS.find((s) => s[style].template === to);
  if (!st) throw new Error(`No starter for ${to}`);
  const base = starterSlide(st, style) as Slide & Obj, src = slide as Slide & Obj;
  const shared = MENU[to].frame === false || MENU[slide.template].frame === false ? BARE : COMMON;
  const allowed = fieldsFor(to, style);
  const keeps = Object.keys(src).filter((k) => shared.includes(k) && k in allowed && src[k] !== undefined);
  for (const k of shared) if (k !== "title" && k !== "subtitle") delete base[k];
  for (const k of keeps) base[k] = src[k];
  const drops = Object.keys(src).filter((k) => k !== "template" && !keeps.includes(k) && k !== "focus")
    .map((k) => (Array.isArray(src[k]) ? `${(src[k] as unknown[]).length} ${k}` : k));
  const samples = textPaths(base, style).filter((p) => !keeps.includes(p));
  return { slide: base, keeps, drops, samples };
}

/** The field a validate() message is about: its leading path, when it is one. */
export function issuePath(msg: string): string | undefined {
  const head = msg.split(":")[0];
  return head !== msg && parsePath(head) ? head : undefined;
}
```

`switchTemplate` leaves the starter's own `title` and `subtitle` as samples when the source slide has no value for them. That's why they aren't deleted. Kept keys overwrite them.

- [ ] **Step 4: Run the edit-ops tests**

Run: `npx vitest run tests/unit/edit-ops.test.ts`
Expected: PASS. If a template pair fails validation because a required pitch `subtitle` is missing, make sure that pair keeps the starter's subtitle (it does, because the starter's subtitle is never deleted).

- [ ] **Step 5: Write the failing grid tests**

```ts
// tests/unit/grid.test.ts
import { test, expect } from 'vitest'
import { addPeriod, addRow, addSeries, chartGrid, fromGrid, gridLimits, removePeriod, removeRow, removeSeries } from '@/engine/slides/grid'
import { validate } from '@/engine/slides/schema'
import { STARTERS } from '@/engine/starters'
import type { Chart } from '@/engine/types'

const charts = STARTERS.flatMap((s) => (['consulting', 'pitch'] as const).flatMap((style) => s[style].chart ? [{ id: `${s.id}/${style}`, chart: s[style].chart as Chart, slide: s[style], style }] : []))

for (const c of charts) test(`${c.id}: the grid round-trips without loss`, () => {
  expect(fromGrid(c.chart, chartGrid(c.chart))).toEqual(c.chart)
})

for (const c of charts) test(`${c.id}: adding and removing rows keeps a valid chart`, () => {
  const lim = gridLimits(c.style), g = chartGrid(c.chart)
  const grown = addRow(g, lim), shrunk = removeRow(g, 0, lim)
  for (const next of [grown, shrunk]) {
    const errors = validate({ ...c.slide, chart: fromGrid(c.chart, next) }, c.style).errors.filter((e) => /chart/.test(e) && !/characters|at most|required/.test(e))
    expect(errors).toEqual([])
  }
})

test('bars: a new series copies the last one\'s mark and colour, with zeros', () => {
  const chart: Chart = { categories: ['a', 'b'], series: [{ name: 'Us', values: [1, 2], mark: 'bar', color: 'focus' }] }
  const g = addSeries(chartGrid(chart), gridLimits('consulting'))
  const out = fromGrid(chart, g)
  expect(out.series?.[1]).toMatchObject({ name: '', values: [0, 0], mark: 'bar', color: 'neutral' })
  expect(fromGrid(chart, removeSeries(g, 1, gridLimits('consulting')))).toEqual(chart)
})

test('timeline: removing a period clamps rows and milestones into range', () => {
  const chart: Chart = { kind: 'timeline', periods: ['Q1', 'Q2', 'Q3', 'Q4'], rows: [{ label: 'A', start: 0, end: 3 }, { label: 'B', start: 2, end: 3 }], milestones: [{ label: 'Go', at: 3 }] }
  const out = fromGrid(chart, removePeriod(chartGrid(chart), 3, gridLimits('consulting')))
  expect(out.rows).toEqual([{ label: 'A', start: 0, end: 2 }, { label: 'B', start: 2, end: 2 }])
  expect(out.milestones).toEqual([{ label: 'Go', at: 2 }])
  expect(fromGrid(chart, addPeriod(chartGrid(chart), gridLimits('consulting'))).periods).toEqual(['Q1', 'Q2', 'Q3', 'Q4', ''])
})

test('limits stop rows at the schema bounds', () => {
  const chart: Chart = { categories: ['a', 'b'], series: [{ name: 'x', values: [1, 2], mark: 'bar' }] }
  const g = chartGrid(chart), lim = gridLimits('consulting')
  expect(removeRow(g, 0, lim)).toBe(g)  // 2 categories is the minimum: unchanged
})
```

- [ ] **Step 6: Implement `grid.ts`**

```ts
// src/engine/slides/grid.ts
/* The chart as a grid of inputs (spec 4.3): what the user edits in place of the chart. fromGrid merges the grid
   back into the chart it came from, so marks, colours, focus, format and annotations are never lost. */
import { describe, type FieldView } from "./schema";
import type { Chart, Style } from "../types";

export type Grid =
  | { kind: "bars"; categories: string[]; series: { name: string; values: number[] }[] }
  | { kind: "waterfall"; items: { label: string; value: number | null; total: boolean }[] }
  | { kind: "timeline"; periods: string[]; rows: { label: string; start: number; end: number }[]; milestones: { label: string; at: number }[] };
export interface Limits { categories: [number, number]; series: [number, number]; items: [number, number]; periods: [number, number]; rows: [number, number]; milestones: [number, number] }

export function gridLimits(style: Style): Limits {
  const f = describe("chart", style).fields.chart.fields as Record<string, FieldView>;
  const lim = (k: string): [number, number] => [f[k].items?.min ?? 0, f[k].items?.max ?? Infinity];
  return { categories: lim("categories"), series: lim("series"), items: lim("items"), periods: lim("periods"), rows: lim("rows"), milestones: lim("milestones") };
}

export function chartGrid(c: Chart): Grid {
  if (c.kind === "waterfall") return { kind: "waterfall", items: (c.items ?? []).map((i) => ({ label: i.label, value: i.value ?? null, total: !!i.total })) };
  if (c.kind === "timeline") return { kind: "timeline", periods: [...(c.periods ?? [])], rows: (c.rows ?? []).map(({ label, start, end }) => ({ label, start, end })), milestones: (c.milestones ?? []).map(({ label, at }) => ({ label, at })) };
  return { kind: "bars", categories: [...(c.categories ?? [])], series: (c.series ?? []).map((s) => ({ name: s.name, values: [...s.values] })) };
}

export function fromGrid(c: Chart, g: Grid): Chart {
  if (g.kind === "waterfall") return { ...c, items: g.items.map((i, k) => {
    const { value: _v, total: _t, ...rest } = c.items?.[k] ?? { label: "" };
    return { ...rest, label: i.label, ...(i.total ? { total: true } : i.value !== null ? { value: i.value } : {}) };
  }) };
  if (g.kind === "timeline") return { ...c, periods: g.periods,
    rows: g.rows.map((r, k) => ({ ...(c.rows?.[k] ?? {}), label: r.label, start: r.start, end: r.end })),
    ...(g.milestones.length || c.milestones ? { milestones: g.milestones.map((m, k) => ({ ...(c.milestones?.[k] ?? {}), label: m.label, at: m.at })) } : {}) };
  const last = c.series?.at(-1);
  return { ...c, categories: g.categories, series: g.series.map((s, k) => {
    const old = c.series?.[k] ?? { mark: last?.mark ?? "bar", ...(last?.color ? { color: "neutral" as const } : {}), ...(last?.format ? { format: last.format } : {}) };
    return { ...old, name: s.name, values: s.values };
  }) };
}

const within = (n: number, [lo, hi]: [number, number]) => n >= lo && n <= hi;
const clamp = (n: number, hi: number) => Math.max(0, Math.min(n, hi));

export function addRow(g: Grid, lim: Limits): Grid {
  if (g.kind === "bars") return within(g.categories.length + 1, lim.categories) ? { ...g, categories: [...g.categories, ""], series: g.series.map((s) => ({ ...s, values: [...s.values, 0] })) } : g;
  if (g.kind === "waterfall") return within(g.items.length + 1, lim.items) ? { ...g, items: [...g.items.slice(0, -1), { label: "", value: 0, total: false }, ...g.items.slice(-1)] } : g;
  return within(g.rows.length + 1, lim.rows) ? { ...g, rows: [...g.rows, { label: "", start: 0, end: 0 }] } : g;
}
export function removeRow(g: Grid, i: number, lim: Limits): Grid {
  if (g.kind === "bars") return within(g.categories.length - 1, lim.categories) ? { ...g, categories: g.categories.filter((_, k) => k !== i), series: g.series.map((s) => ({ ...s, values: s.values.filter((_, k) => k !== i) })) } : g;
  if (g.kind === "waterfall") return within(g.items.length - 1, lim.items) ? { ...g, items: g.items.filter((_, k) => k !== i) } : g;
  return within(g.rows.length - 1, lim.rows) ? { ...g, rows: g.rows.filter((_, k) => k !== i) } : g;
}
export function addSeries(g: Grid, lim: Limits): Grid {
  return g.kind === "bars" && within(g.series.length + 1, lim.series) ? { ...g, series: [...g.series, { name: "", values: g.categories.map(() => 0) }] } : g;
}
export function removeSeries(g: Grid, i: number, lim: Limits): Grid {
  return g.kind === "bars" && within(g.series.length - 1, lim.series) ? { ...g, series: g.series.filter((_, k) => k !== i) } : g;
}
export function addPeriod(g: Grid, lim: Limits): Grid {
  return g.kind === "timeline" && within(g.periods.length + 1, lim.periods) ? { ...g, periods: [...g.periods, ""] } : g;
}
export function removePeriod(g: Grid, i: number, lim: Limits): Grid {
  if (g.kind !== "timeline" || !within(g.periods.length - 1, lim.periods)) return g;
  const hi = g.periods.length - 2, shift = (n: number) => clamp(n > i ? n - 1 : n, hi);
  return { ...g, periods: g.periods.filter((_, k) => k !== i), rows: g.rows.map((r) => ({ ...r, start: shift(r.start), end: shift(r.end) })), milestones: g.milestones.map((m) => ({ ...m, at: shift(m.at) })) };
}
export function addMilestone(g: Grid, lim: Limits): Grid {
  return g.kind === "timeline" && within(g.milestones.length + 1, lim.milestones) ? { ...g, milestones: [...g.milestones, { label: "", at: 0 }] } : g;
}
export function removeMilestone(g: Grid, i: number, lim: Limits): Grid {
  return g.kind === "timeline" && within(g.milestones.length - 1, lim.milestones) ? { ...g, milestones: g.milestones.filter((_, k) => k !== i) } : g;
}
```

The waterfall's new item goes before the last item, which is the end total. The `rows` limit for bars is `lim.categories`.

- [ ] **Step 7: Fit issues tied to fields (`lints.ts`, `measure.ts`)**

In `lints.ts`, rename the body of `fitIssues` to `fitIssuesAt` and have it collect `{ msg, path }`. Each `out.push(x)` that has an element `el` in scope becomes `push(x, el)`. The title, subtitle, caption, takeaway and footnote checks pass the element they measured.

```ts
export interface Located { msg: string; path?: string }
/** The field an element shows: its own data-path, the nearest one around it, or the first inside it. */
const fieldOf = (el: Element | null): string | undefined =>
  el?.closest<HTMLElement>("[data-path]")?.dataset.path ?? el?.querySelector<HTMLElement>("[data-path]")?.dataset.path;

export function fitIssuesAt(slide: HTMLElement, style: Style): Located[] {
  // … unchanged measurements …
  const out: Located[] = [], push = (msg: string, el?: Element | null) => out.push({ msg, path: fieldOf(el ?? null) });
  // e.g.: if (title && lines(title) > maxTitle) push(`title wraps to …`, title);
  return out;
}
export const fitIssues = (slide: HTMLElement, style: Style): string[] => fitIssuesAt(slide, style).map((x) => x.msg);
```

The message text stays exactly as it is, so the agent, the review page and the harness see no change.

In `measure.ts`:

```ts
import { fitIssuesAt, layoutLints, type Located } from '@/engine/slides/lints'
export interface Measurer { measure(slide: Slide, deck: Deck, index: number): string[]; lines: number; warnings: string[]; located: Located[] }
// in createMeasurer: located: [] as Located[], and in measure():
      const fit = fitIssuesAt(el, deck.style), lint = layoutLints(el, deck.style)
      m.warnings = lint.warnings
      m.located = [...fit, ...lint.issues.map((msg) => ({ msg }))]
      return m.located.map((x) => x.msg)
```

- [ ] **Step 8: Run all the unit tests**

Run: `npx vitest run`
Expected: PASS. Then run `npm run test:browser -- lints.spec.ts review.spec.ts` → PASS, because the lint text is unchanged.

- [ ] **Step 9: Commit**

```bash
git add src/engine/slides/edit.ts src/engine/slides/grid.ts src/engine/slides/lints.ts src/app/measure.ts tests/unit/edit-ops.test.ts tests/unit/grid.test.ts
git commit -m "Edit operations from the schema, the chart as a grid, and fit issues tied to their field"
```

---

### Task 4: One write pipeline, the edit flag, and the agent told about hand edits

**Files:**
- Create: `src/engine/agent/write.ts`
- Modify: `src/engine/agent/agent.ts` (`write()` at 90–117; `TurnArgs`; `runTurn` line 216)
- Modify: `src/engine/agent/agent-prompt.ts` (`stateBlock`, line 96)
- Modify: `src/app/state.ts`, `src/app/turn.ts`
- Test: `tests/unit/write.test.ts`, `tests/unit/state.test.ts` (add), `tests/unit/agent-prompt.test.ts` (add)

**Interfaces:**
- Produces:
  - `checkWrite(input: unknown, o: { style: Style; jev: JevFn; brief: string; strict: boolean; measure: (s: Slide) => Measured }): Promise<Written>`
  - `interface Measured { issues: string[]; lines: number; warnings: string[] }`
  - `type Written = { applied: false; issues: string[]; autofixes: string[] } | { applied: true; slide: Slide; issues: string[]; warnings: string[]; autofixes: string[]; resolved: Resolved; resolveMs: number }`
  - `AppState.editing: string | null`, `AppState.edited: string[]`
  - `Action { type: 'edit'; id: string | null }`
  - `locked(s: Pick<AppState, 'busy' | 'editing'>): boolean`
  - `stateBlock({ …, edited?: string[] })`, `TurnArgs.edited?: string[]`
  - `runChecks(id, deps, judge)` exported from `turn.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// tests/unit/write.test.ts
import { test, expect } from 'vitest'
import { checkWrite } from '@/engine/agent/write'
import type { Slide } from '@/engine/types'

const jev = async () => { throw new Error('Jev is not called without "auto"') }
const measure = () => ({ issues: [], lines: 1, warnings: [] })

test('strict (the agent): a shape error refuses the write', async () => {
  const w = await checkWrite({ template: 'cards', title: '', cards: [] }, { style: 'consulting', jev, brief: '', strict: true, measure })
  expect(w.applied).toBe(false)
})

test('not strict (a human): the slide is kept with its errors as issues', async () => {
  const w = await checkWrite({ template: 'steps', title: '', steps: [{ when: 'Q1', title: 'Build', text: 'x' }, { when: 'Q2', title: 'Ship', text: 'y' }] }, { style: 'consulting', jev, brief: '', strict: false, measure })
  expect(w.applied).toBe(true)
  if (w.applied) expect(w.issues.some((i) => i.startsWith('title: required'))).toBe(true)
})

test('an over-long title is kept word for word: no shortening here', async () => {
  const title = 'A'.repeat(130)
  const w = await checkWrite({ template: 'section', title }, { style: 'consulting', jev, brief: '', strict: false, measure })
  expect(w.applied && w.slide.title).toBe(title)
})

test('a slide that cannot render is refused', async () => {
  const w = await checkWrite({ template: 'section', title: 'X' }, { style: 'consulting', jev, brief: '', strict: false, measure: () => { throw new Error('boom') } })
  expect(w).toMatchObject({ applied: false, issues: ['slide could not be rendered: boom'] })
})

test('an empty optional field is dropped (autofix)', async () => {
  const w = await checkWrite({ template: 'section', title: 'X', subtitle: '' } as Slide, { style: 'consulting', jev, brief: '', strict: false, measure })
  expect(w.applied && 'subtitle' in w.slide).toBe(false)
})
```

Add to `tests/unit/state.test.ts`:

```ts
test('edit mode: one writer at a time', () => {
  const items = [{ id: 'a', slide: { template: 'section' as const, title: 'A' }, status: 'ok' as const, errors: [], warnings: [], checks: [] },
    { id: 'b', slide: { template: 'section' as const, title: 'B' }, status: 'ok' as const, errors: [], warnings: [], checks: [] }]
  let s = { ...initialState(), items, view: 'editor' as const }
  expect(reducer({ ...s, busy: true }, { type: 'edit', id: 'a' }).editing).toBeNull()
  s = reducer(s, { type: 'edit', id: 'a' })
  expect(s.editing).toBe('a')
  expect(reducer(s, { type: 'select', index: 1 }).current).toBe(0)
  expect(reducer(s, { type: 'removeSlide', id: 'b' }).items).toHaveLength(2)
  expect(reducer(s, { type: 'moveSlide', id: 'b', to: 0 }).items[0].id).toBe('a')
  expect(reducer(s, { type: 'edit', id: null }).editing).toBeNull()
  expect(reducer(s, { type: 'open', deck: { id: 'x', style: 'consulting', theme: 'ink', accent: null, current: 0, items, history: [], working: [], updated: 1 } }).editing).toBeNull()
})
```

Add to `tests/unit/agent-prompt.test.ts`:

```ts
test('the deck state names slides edited by hand since the last turn', () => {
  const block = stateBlock({ style: 'consulting', theme: 'ink', slides: [{ id: 's1', slide: { template: 'section', title: 'A' } }], selection: null, edited: ['s1'] })
  expect(block).toContain('Edited by hand since the last turn: s1')
  expect(stateBlock({ style: 'consulting', theme: 'ink', slides: [], selection: null })).not.toContain('Edited by hand')
})
```

- [ ] **Step 2: Run them and check they fail**

Run: `npx vitest run tests/unit/write.test.ts tests/unit/state.test.ts tests/unit/agent-prompt.test.ts`
Expected: FAIL (missing module, unknown action, missing line).

- [ ] **Step 3: Implement `write.ts`, then call it from `agent.ts`**

```ts
// src/engine/agent/write.ts
/* The write pipeline every writer goes through (spec 9.4): autofix → validate → resolve auto (Jev) → autofix →
   measure → rule checks. The agent adds automatic shortening on top; a human's words are never shortened.
   strict: shape errors refuse the write (the agent rewrites); otherwise they come back as issues (a human saves). */
import { validate } from "../slides/schema";
import { autofix } from "./autofix";
import { resolveAuto, type Resolved } from "./resolve";
import { ruleChecks } from "./checks";
import type { JevFn } from "./llm";
import type { Slide, Style } from "../types";

export interface Measured { issues: string[]; lines: number; warnings: string[] }
export type Written =
  | { applied: false; issues: string[]; autofixes: string[] }
  | { applied: true; slide: Slide; issues: string[]; warnings: string[]; autofixes: string[]; resolved: Resolved; resolveMs: number };

/* validate() lists limits with shape errors. Limits are fit issues: applied and returned (spec 9.4). */
export const LIMIT = /characters|at most|budget|too many|Cut or merge|Shorten|with notes|with a takeaway/i;

export async function checkWrite(input: unknown, { style, jev, brief, strict, measure }: { style: Style; jev: JevFn; brief: string; strict: boolean; measure: (s: Slide) => Measured }): Promise<Written> {
  const first = autofix(input, style), v = validate(first.slide, style);
  const shape = v.errors.filter((e) => !LIMIT.test(e)), limits = v.errors.filter((e) => LIMIT.test(e));
  if (strict && shape.length) return { applied: false, issues: shape, autofixes: first.fixes };
  const r = await resolveAuto(first.slide, style, jev, brief);
  const done = autofix(r.slide, style), slide = done.slide;
  let m: Measured;
  try { m = measure(slide); } catch (e) { return { applied: false, issues: [`slide could not be rendered: ${e instanceof Error ? e.message : String(e)}`, ...limits], autofixes: first.fixes }; }
  const rules = ruleChecks(slide, style, m.lines).filter((c) => !c.ok).map((c) => `${c.id}: ${c.msg}`);
  return { applied: true, slide, issues: [...(strict ? [] : shape), ...limits, ...m.issues], warnings: [...v.warnings, ...m.warnings, ...rules],
    autofixes: [...first.fixes, ...done.fixes], resolved: r.resolved, resolveMs: r.ms };
}
```

In `agent.ts`, delete the local `LIMIT` and import it from `./write` (the `touches` helper and others still use it). Then replace the top of `write()`, up to and including `Object.assign`:

```ts
  async function write(item: AgentSlide, input: unknown, round = 0): Promise<WriteResult> {
    const w = await checkWrite(input, { style, jev, brief, strict: true,
      measure: (s) => { const issues = measure(s, deck.slides.indexOf(item)); return { issues, lines: measure.lines, warnings: measure.warnings || [] }; } });
    if (!w.applied) return { applied: false, issues: w.issues, autofixes: w.autofixes };
    if (Object.keys(w.resolved).length) log({ step: "Resolve", model: "Jev", ms: w.resolveMs, detail: Object.entries(w.resolved).map(([k, x]) => `${k} = ${x.value}`).join(" · ") });
    const { slide, issues } = w;
    Object.assign(item, { slide, pending: false, issues, warnings: w.warnings, checks: [] });
    working.add(item.id); written.add(item.id);
    onChange?.(deck, item.id);
    const result: WriteResult = { applied: true, issues, warnings: item.warnings, autofixes: w.autofixes, resolved: w.resolved };
    // … the shortening below is unchanged …
```

Remove the imports `agent.ts` no longer uses (`autofix`, `resolveAuto`, `ruleChecks` if unused, `validate` if unused). `npm run lint` will name them.

`TurnArgs` gets `edited?: string[]`. `runTurn` destructures `edited = []` and line 216 becomes:

```ts
  history.push({ role: "user", content: `${stateBlock({ style, theme: deck.theme, slides: visible(), selection, edited })}\n\n${text}` });
```

In `agent-prompt.ts`:

```ts
export function stateBlock({ style, theme, slides, selection, edited = [] }: { style: Style; theme: Theme; slides: { id: string; slide: Slide | null }[]; selection: Selection; edited?: string[] }): string {
  // … list and sel unchanged …
  return `Deck state\nStyle: ${style} · theme: ${theme}\nSlides:\n${list}\nSelected: ${sel}${edited.length ? `\nEdited by hand since the last turn: ${edited.join(", ")}` : ""}`;
}
```

- [ ] **Step 4: The edit flag in `state.ts`**

```ts
// AppState gains:
  /** The slide being edited by hand; while set, nothing else writes the deck (spec 4). */
  editing: string | null
  /** Slides saved by hand since the last turn: the next turn's deck state names them, then this clears. */
  edited: string[]
// Action gains: | { type: 'edit'; id: string | null }
// initialState(): editing: null, edited: [],
// 'open' returns: …, editing: null, edited: [],

/** A turn runs or a slide is being edited: nothing else may change the deck. */
export const locked = (s: Pick<AppState, 'busy' | 'editing'>) => s.busy || s.editing !== null

    case 'edit':
      if (a.id === null) return { ...s, editing: null }
      if (locked(s) || !s.items.some((it) => it.id === a.id)) return s
      return { ...s, editing: a.id }
    case 'select':
      if (s.editing) return s
      return { ...s, current: clamp(a.index, s.items) }
```

In `insertStarter`, `removeSlide`, `restoreSlide` and `moveSlide`, replace `s.busy` with `locked(s)`.

- [ ] **Step 5: `turn.ts`: export `runChecks`, pass and clear `edited`**

Change `async function runChecks(` to `export async function runChecks(`. In `sendTurn`, pass `edited: start.edited` to `runTurn`, and dispatch the clear in the same `set` that sets `busy: true`:

```ts
  dispatch({ type: 'set', patch: { busy: true, edited: [] } })
  // … and in the runTurn call: edited: start.edited,
```

- [ ] **Step 6: Run the tests and the agent suite**

Run: `npx vitest run`
Expected: PASS, including the existing `agent.test.ts` and `turn.test.ts` unchanged. They prove the extraction kept the agent's behaviour.

- [ ] **Step 7: Commit**

```bash
git add src/engine/agent/write.ts src/engine/agent/agent.ts src/engine/agent/agent-prompt.ts src/app/state.ts src/app/turn.ts tests/unit/write.test.ts tests/unit/state.test.ts tests/unit/agent-prompt.test.ts
git commit -m "One write pipeline for the agent and the human; the edit flag locks the deck; the agent hears about hand edits"
```

---

### Task 5: Saving an edit, and the edit state

**Files:**
- Create: `src/app/edit/save.ts`, `src/app/edit/useSlideEdit.ts`
- Test: `tests/unit/save-edit.test.ts`

**Interfaces:**
- Consumes: `checkWrite` (Task 4), `runChecks`, `TurnDeps` (`turn.ts`), `deckOf`, `locked` (`state.ts`), `applyPatch`, `validate`, `ruleChecks`, `issuePath`, `Located`
- Produces:
  - `saveEdit(id: string, draft: Slide, deps: TurnDeps): Promise<string | null>`, which returns null when saved, otherwise the reason
  - `interface Issue { msg: string; path?: string }`
  - `useSlideEdit(o: { item: Item; index: number; deck: Deck; style: Style; measurer: () => Measurer; save: (draft: Slide) => Promise<string | null>; onDone: () => void }): SlideEdit`
  - `interface SlideEdit { draft: Slide; shown: Slide; dirty: boolean; issues: Issue[]; samples: Set<string>; saving: boolean; error: string | null; set(path: string, value: string): void; patch(set: Record<string, unknown>): void; replace(slide: Slide, samples: string[]): void; commit(): void; save(): Promise<void>; discard(): void }`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/save-edit.test.ts
import { test, expect } from 'vitest'
import { saveEdit } from '@/app/edit/save'
import { initialState, reducer, type Action, type AppState } from '@/app/state'
import type { Measurer } from '@/app/measure'
import type { Slide } from '@/engine/types'

function harness(measure: Measurer['measure'] = () => []) {
  const item = (id: string, title: string) => ({ id, slide: { template: 'section' as const, title }, status: 'ok' as const, errors: [], warnings: [], checks: [] })
  let state: AppState = { ...initialState(), deckId: 'd', view: 'editor', items: [item('a', 'Before'), item('b', 'Other')], editing: 'a' }
  const measurer: Measurer = { measure, lines: 1, warnings: [], located: [] }
  const deps = { measurer, getState: () => state, dispatch: (a: Action) => { state = reducer(state, a) }, judge: async () => ({ checks: [], ms: 0 }) }
  return { deps, get: () => state }
}

test('saving writes the draft word for word, leaves edit mode and tells the next turn', async () => {
  const h = harness(), long = 'A section title that is far longer than any section title should ever be'
  expect(await saveEdit('a', { template: 'section', title: long }, h.deps)).toBeNull()
  expect(h.get().items[0].slide.title).toBe(long)
  expect(h.get().items[0].status).toBe('draft')
  expect(h.get().editing).toBeNull()
  expect(h.get().edited).toEqual(['a'])
})

test('a draft that cannot render is not saved and edit mode stays', async () => {
  const h = harness(() => { throw new Error('no chart') })
  const reason = await saveEdit('a', { template: 'section', title: 'X' } as Slide, h.deps)
  expect(reason).toMatch(/could not be rendered/)
  expect(h.get().items[0].slide.title).toBe('Before')
  expect(h.get().editing).toBe('a')
})
```

- [ ] **Step 2: Run it and check it fails**

Run: `npx vitest run tests/unit/save-edit.test.ts`
Expected: FAIL, the module is not found.

- [ ] **Step 3: Implement `save.ts`**

```ts
// src/app/edit/save.ts
/* Saving a hand edit (spec 5): the agent's write pipeline without shortening, the slide's checks as after a turn,
   and a note for the next turn's deck state. Returns null when saved, or why it was not. */
import { checkWrite } from '@/engine/agent/write'
import { jev as jevCall, type JevFn } from '@/engine/agent/llm'
import { judgmentChecks } from '@/engine/agent/checks'
import type { Slide } from '@/engine/types'
import { deckOf } from '../state'
import { runChecks, type TurnDeps } from '../turn'

export async function saveEdit(id: string, draft: Slide, deps: TurnDeps & { jev?: JevFn }): Promise<string | null> {
  const { measurer, dispatch, getState } = deps, s = getState(), i = s.items.findIndex((it) => it.id === id)
  if (i < 0) return 'This slide is no longer in the deck.'
  const w = await checkWrite(draft, { style: s.style, jev: deps.jev ?? deps.models?.jev ?? jevCall, brief: '', strict: false,
    measure: (slide) => ({ issues: measurer.measure(slide, deckOf(s), i), lines: measurer.lines, warnings: measurer.warnings }) })
  if (!w.applied) return w.issues[0] ?? 'The slide could not be saved.'
  const items = getState().items.map((it) => (it.id === id ? { ...it, slide: w.slide, status: w.issues.length ? 'draft' as const : 'ok' as const, errors: w.issues, warnings: w.warnings, checks: [] } : it))
  dispatch({ type: 'items', items, focusId: id })
  dispatch({ type: 'set', patch: { edited: [...new Set([...getState().edited, id])] } })
  dispatch({ type: 'edit', id: null })
  void runChecks(id, deps, deps.judge ?? judgmentChecks)
  return null
}
```

- [ ] **Step 4: Implement `useSlideEdit.ts`**

```ts
// src/app/edit/useSlideEdit.ts
/* The slide being edited: the draft (the truth, changed on every keystroke), the shown slide (re-rendered only on
   structural changes and when a field is left), and the issues measured on the draft, 300 ms after the last change. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { applyPatch } from '@/engine/agent/patch'
import { ruleChecks } from '@/engine/agent/checks'
import { validate } from '@/engine/slides/schema'
import { issuePath } from '@/engine/slides/edit'
import type { Deck, Slide, Style } from '@/engine/types'
import type { Measurer } from '../measure'
import type { Item } from '../store'

export interface Issue { msg: string; path?: string }
export interface SlideEdit {
  draft: Slide; shown: Slide; dirty: boolean; issues: Issue[]; samples: Set<string>; saving: boolean; error: string | null
  set(path: string, value: string): void
  patch(set: Record<string, unknown>): void
  replace(slide: Slide, samples: string[]): void
  commit(): void
  save(): Promise<void>
  discard(): void
}
interface Options { item: Item; index: number; deck: Deck; style: Style; measurer: () => Measurer; save: (draft: Slide) => Promise<string | null>; onDone: () => void }

const MEASURE_MS = 300

export function useSlideEdit({ item, index, deck, style, measurer, save, onDone }: Options): SlideEdit {
  const draft = useRef(item.slide)
  const [version, setVersion] = useState(0), [shown, setShown] = useState(item.slide)
  const [issues, setIssues] = useState<Issue[]>([]), [samples, setSamples] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false), [error, setError] = useState<string | null>(null)

  const write = useCallback((set: Record<string, unknown>) => {
    const r = applyPatch(draft.current, set)
    if (!r.slide) return false
    draft.current = r.slide
    // A field written by hand is no longer sample text; a whole-list write (a new card, the chart grid) clears the list's.
    const covers = (p: string) => Object.keys(set).some((k) => p === k || p.startsWith(`${k}.`) || p.startsWith(`${k}[`))
    setSamples((s) => ([...s].some(covers) ? new Set([...s].filter((p) => !covers(p))) : s))
    setVersion((v) => v + 1)
    return true
  }, [])

  // Issues on the draft: limits from the schema, fit from the measurer, rules and sample text as counts.
  useEffect(() => {
    const t = setTimeout(() => {
      const d = draft.current, m = measurer()
      let fit: Issue[] = []
      try { m.measure(d, deck, index); fit = m.located } catch (e) { fit = [{ msg: `slide could not be rendered: ${e instanceof Error ? e.message : String(e)}` }] }
      const limits = validate(d, style).errors.map((msg) => ({ msg, path: issuePath(msg) }))
      const rules = ruleChecks(d, style, m.lines).filter((c) => !c.ok).map((c) => ({ msg: `${c.id}: ${c.msg}` }))
      const sample = samples.size ? [{ msg: `${samples.size} field${samples.size === 1 ? '' : 's'} still ${samples.size === 1 ? 'has' : 'have'} sample text` }] : []
      setIssues([...limits, ...fit, ...rules, ...sample])
    }, MEASURE_MS)
    return () => clearTimeout(t)
  }, [version, samples, deck, index, style, measurer])

  const dirty = version > 0
  return useMemo<SlideEdit>(() => ({
    // Read through, not copied: two keystrokes before React re-renders must both see the latest draft.
    get draft() { return draft.current }, shown, dirty, issues, samples, saving, error,
    set: (path, value) => { write({ [path]: value }) },
    patch: (set) => { if (write(set)) setShown(draft.current) },
    replace: (slide, next) => { draft.current = slide; setSamples(new Set(next)); setVersion((v) => v + 1); setShown(slide) },
    commit: () => setShown(draft.current),
    save: async () => {
      setSaving(true); setError(null)
      const reason = await save(draft.current)
      setSaving(false)
      if (reason) setError(reason); else onDone()
    },
    discard: onDone,
  }), [shown, dirty, issues, samples, saving, error, write, save, onDone])
}
```

`set` writes a string field. It goes through `applyPatch`, which creates a missing optional field on the way (the kicker, an empty section subtitle).

- [ ] **Step 5: Run the tests**

Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/edit/save.ts src/app/edit/useSlideEdit.ts tests/unit/save-edit.test.ts
git commit -m "Saving a hand edit through the shared write path; the edit state with live issues"
```

---

### Task 6: The editable slide: typing, cursor, paste, keys

**Files:**
- Create: `src/app/edit/fields.ts`, `src/app/edit/EditSurface.tsx`, `src/app/edit/edit.css`
- Test: `tests/unit/fields.test.ts` (jsdom)

**Interfaces:**
- Consumes: `FIELD_HTML`, `FieldKind`, `mountSlide` (render), `applyText`, `toggle` (markup), `getAt`, `listOps`, `listOf`, `newItem` (edit), `SlideEdit` (Task 5)
- Produces:
  - `caretRange(el: HTMLElement): [number, number] | null`
  - `setCaret(el: HTMLElement, offset: number): void`
  - `selectRange(el: HTMLElement, from: number, to: number): void`
  - `typed(el: HTMLElement, markup: string): string`, the field's new markup from its text
  - `redraw(el: HTMLElement, markup: string): void`
  - `<EditSurface edit deck ctx onSlide={(el: HTMLElement | null) => void} />`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/fields.test.ts
// @vitest-environment jsdom
import { test, expect } from 'vitest'
import { caretRange, redraw, setCaret, typed } from '@/app/edit/fields'

const field = (html: string, kind = 'md') => { const el = document.createElement('p'); el.dataset.kind = kind; el.contentEditable = 'true'; el.innerHTML = html; document.body.append(el); return el }

test('the cursor survives a redraw at the same plain-text offset', () => {
  const el = field('Revenue <span class="hl-focus">doubles</span>')
  setCaret(el, 10)
  expect(caretRange(el)).toEqual([10, 10])
  redraw(el, 'Revenue [[doubles]] now')
  setCaret(el, 10)
  expect(caretRange(el)).toEqual([10, 10])
  expect(el.innerHTML).toBe('Revenue <span class="hl-focus">doubles</span> now')
})

test('typed() maps the element text onto the markup; whatever the browser inserted is ignored', () => {
  const el = field('Revenue <span class="hl-focus">doubles</span>')
  el.innerHTML = 'Revenue <span class="hl-focus">doubless</span><b></b>'
  expect(typed(el, 'Revenue [[doubles]]')).toBe('Revenue [[doubless]]')
})

test('a plain-text field takes its text as it is', () => {
  const el = field('Q1', 'esc')
  el.textContent = 'Q1 ’27'
  expect(typed(el, 'Q1')).toBe('Q1 ’27')
})
```

- [ ] **Step 2: Run it and check it fails**

Run: `npx vitest run tests/unit/fields.test.ts`
Expected: FAIL, the module is not found.

- [ ] **Step 3: Implement `fields.ts`**

```ts
// src/app/edit/fields.ts
/* A slide field as an editable element: its text in plain-text offsets, the cursor kept across a redraw. The field's
   markup string is the truth (spec 4.1); the element is always redrawn from it, so nothing the browser inserts stays. */
import { FIELD_HTML, type FieldKind } from '@/engine/slides/render'
import { applyText } from '@/engine/slides/markup'

const kindOf = (el: HTMLElement): FieldKind => (el.dataset.kind as FieldKind | undefined) ?? 'esc'
export const isMarkup = (el: HTMLElement) => kindOf(el) === 'md' || kindOf(el) === 'display'

/** Plain-text offset of a DOM position inside `el`. */
function offsetOf(el: HTMLElement, node: Node, at: number): number {
  const r = document.createRange()
  r.selectNodeContents(el)
  r.setEnd(node, at)
  return r.toString().length
}

export function caretRange(el: HTMLElement): [number, number] | null {
  const sel = window.getSelection()
  if (!sel || !sel.rangeCount) return null
  const r = sel.getRangeAt(0)
  if (!el.contains(r.startContainer) || !el.contains(r.endContainer)) return null
  return [offsetOf(el, r.startContainer, r.startOffset), offsetOf(el, r.endContainer, r.endOffset)]
}

/** The DOM position at a plain-text offset. */
function pointAt(el: HTMLElement, offset: number): [Node, number] {
  const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
  let left = offset, node = walk.nextNode()
  while (node) {
    const len = node.textContent?.length ?? 0
    if (left <= len) return [node, left]
    left -= len
    node = walk.nextNode()
  }
  return [el, el.childNodes.length]
}

export function selectRange(el: HTMLElement, from: number, to: number) {
  const sel = window.getSelection(), r = document.createRange()
  r.setStart(...pointAt(el, from))
  r.setEnd(...pointAt(el, to))
  sel?.removeAllRanges()
  sel?.addRange(r)
}
export const setCaret = (el: HTMLElement, offset: number) => selectRange(el, offset, offset)

/** The field's new markup: its text now, written into the markup it had. */
export function typed(el: HTMLElement, markup: string): string {
  const text = (el.textContent ?? '').replace(/ /g, ' ')
  return isMarkup(el) ? applyText(markup, text) : text
}

export function redraw(el: HTMLElement, markup: string) {
  el.innerHTML = FIELD_HTML[kindOf(el)](markup)
}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run tests/unit/fields.test.ts` → PASS.

- [ ] **Step 5: `edit.css`**

```css
/* Edit mode only (spec 4.1). The slide's own styles stay in slides.css; these two rules exist while editing. */
[data-editing] [contenteditable]:focus { outline: none; }
/* An empty field shows what it is, so a new card has somewhere to type. */
[data-editing] [contenteditable]:empty::before { content: attr(data-hint); opacity: .35; }
[data-editing] [data-sample] { opacity: .45; }
```

- [ ] **Step 6: Implement `EditSurface.tsx`**

```tsx
// src/app/edit/EditSurface.tsx
/* The slide in edit mode: every [data-path] field is typed into in place. Typing updates the draft and redraws only
   that field; leaving a field, +/× and the template re-render the slide (spec 4.1). */
import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react'
import { mountSlide } from '@/engine/slides/render'
import { getAt, listOf, listOps, newItem } from '@/engine/slides/edit'
import { toggle } from '@/engine/slides/markup'
import type { Deck, SlideContext } from '@/engine/types'
import { caretRange, isMarkup, redraw, setCaret, typed } from './fields'
import type { SlideEdit } from './useSlideEdit'
import './edit.css'

interface Props { edit: SlideEdit; deck: Pick<Deck, 'style' | 'theme' | 'accent'>; ctx: SlideContext; onSlide: (el: HTMLElement | null) => void; children?: ReactNode }

const hint = (path: string) => { const k = path.replace(/\[\d+\]/g, '').split('.').at(-1) ?? ''; return k.charAt(0).toUpperCase() + k.slice(1) }
const fieldOf = (t: EventTarget | null) => (t instanceof Element ? t.closest<HTMLElement>('[data-path]') : null)

export function EditSurface({ edit, deck, ctx, onSlide, children }: Props) {
  const frame = useRef<HTMLDivElement>(null), editRef = useRef(edit), focus = useRef<{ path: string; at: number } | null>(null)
  editRef.current = edit
  const { style, theme, accent } = deck

  useLayoutEffect(() => {
    const el = frame.current
    if (!el) return
    const s = mountSlide(el, edit.shown, { page: ctx.page, section: ctx.section, kicker: ctx.kicker, footer: ctx.footer }, { style, theme, accent })
    s.querySelectorAll<HTMLElement>('[data-path]').forEach((f) => {
      f.contentEditable = 'true'; f.spellcheck = true; f.dataset.hint = hint(f.dataset.path ?? '')
      if (editRef.current.samples.has(f.dataset.path ?? '')) f.dataset.sample = ''
    })
    // After a structural change, the cursor goes back where it was asked to be (a new item's first field).
    if (focus.current) { const f = s.querySelector<HTMLElement>(`[data-path="${focus.current.path}"]`); if (f) { f.focus(); setCaret(f, focus.current.at) } focus.current = null }
    const fit = () => s.style.setProperty('--s', String(el.clientWidth / 1920))
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    onSlide(s)
    return () => { ro.disconnect(); onSlide(null) }
    // Primitives only: a new ctx object on each render must not remount the slide under the cursor.
  }, [edit.shown, ctx.page, ctx.section, ctx.kicker, ctx.footer, style, theme, accent, onSlide])

  useEffect(() => {
    const el = frame.current
    if (!el) return
    const markupOf = (f: HTMLElement) => String(getAt(editRef.current.draft, f.dataset.path ?? '') ?? '')
    const write = (f: HTMLElement, next: string, caret: number) => {
      editRef.current.set(f.dataset.path ?? '', next)
      redraw(f, next); setCaret(f, caret); delete f.dataset.sample
    }
    const onInput = (e: Event) => {
      const f = fieldOf(e.target)
      if (!f || (e as InputEvent).isComposing) return
      const caret = caretRange(f)?.[0] ?? 0
      write(f, typed(f, markupOf(f)), caret)
    }
    const onComposed = (e: Event) => { const f = fieldOf(e.target); if (f) write(f, typed(f, markupOf(f)), caretRange(f)?.[0] ?? 0) }
    const onPaste = (e: ClipboardEvent) => {
      const f = fieldOf(e.target)
      if (!f) return
      e.preventDefault()
      const text = (e.clipboardData?.getData('text/plain') ?? '').replace(/\s+/g, ' '), [a, b] = caretRange(f) ?? [0, 0]
      const plain = f.textContent ?? ''
      f.textContent = plain.slice(0, a) + text + plain.slice(b)
      write(f, typed(f, markupOf(f)), a + text.length)
    }
    const onKey = (e: KeyboardEvent) => {
      const f = fieldOf(e.target)
      if (!f) return
      const mod = e.metaKey || e.ctrlKey
      if (mod && ['i', 'u'].includes(e.key)) { e.preventDefault(); return }
      if (mod && e.key === 'b') { e.preventDefault(); if (isMarkup(f)) { const [a, b] = caretRange(f) ?? [0, 0]; write(f, toggle(markupOf(f), a, b, 'b'), b) } return }
      if (e.key !== 'Enter' || mod) return
      e.preventDefault()
      // Enter in a list item adds the next item; anywhere else it does nothing.
      const itemEl = f.closest<HTMLElement>('[data-item]'), cur = editRef.current
      const hit = itemEl && listOf(listOps(cur.draft, style), itemEl.dataset.item ?? '')
      if (!hit || hit.op.length >= hit.op.max) return
      const set = newItem(cur.draft, style, hit.op, hit.index + 1)
      const tail = (f.dataset.path ?? '').slice((itemEl.dataset.item ?? '').length)
      focus.current = { path: `${hit.op.path}[${hit.index + 1}]${tail}`, at: 0 }
      cur.patch(set)
    }
    const onLeave = (e: FocusEvent) => { if (fieldOf(e.target) && !fieldOf(e.relatedTarget)) editRef.current.commit() }
    el.addEventListener('input', onInput); el.addEventListener('compositionend', onComposed)
    el.addEventListener('paste', onPaste); el.addEventListener('keydown', onKey); el.addEventListener('focusout', onLeave)
    return () => {
      el.removeEventListener('input', onInput); el.removeEventListener('compositionend', onComposed)
      el.removeEventListener('paste', onPaste); el.removeEventListener('keydown', onKey); el.removeEventListener('focusout', onLeave)
    }
  }, [style])

  return (
    <div className="absolute inset-0" data-editing>
      <div ref={frame} className="absolute inset-0" />
      {children}
    </div>
  )
}
```

`focusout` commits only when focus leaves the slide's fields altogether. Moving from one field to the next on the slide keeps the slide as it is, so nothing jumps under the cursor. The overlay buttons and the selection bar use `onMouseDown={(e) => e.preventDefault()}`, so clicking them doesn't move focus.

Add to `tests/unit/fields.test.ts`, as the IME guard (Review Focus 2):

```ts
test('an input event during composition is left alone', async () => {
  const { EditSurface } = await import('@/app/edit/EditSurface')
  expect(EditSurface).toBeTypeOf('function') // the guard itself is exercised in the browser test (Task 9)
})
```

The real IME check is the Playwright step in Task 9, which dispatches `compositionstart` and `input` with `isComposing: true` and checks that the draft is unchanged until `compositionend`.

- [ ] **Step 7: Typecheck and lint**

Run: `npm run build && npm run lint`
Expected: both succeed.

- [ ] **Step 8: Commit**

```bash
git add src/app/edit/fields.ts src/app/edit/EditSurface.tsx src/app/edit/edit.css tests/unit/fields.test.ts
git commit -m "The editable slide: fields typed in place, the cursor kept, paste as plain text, Enter adds list items"
```

---

### Task 7: Edit mode in the editor: the bar, the locks, Save and Discard

**Files:**
- Create: `src/app/edit/EditBar.tsx`, `src/app/edit/EditMode.tsx`
- Modify: `src/app/components/Stage.tsx` (extract `SlideFrame`, add the Edit button)
- Modify: `src/app/components/Editor.tsx` (EditMode while editing; locks; E key)
- Modify: `src/app/App.tsx` (edit deps; locks in `leaveTo`, `onAdd`, `onClear`, look setters and `present`; `beforeunload`)

**Interfaces:**
- Consumes: `useSlideEdit`, `saveEdit`, `EditSurface`, `switchTemplate`, `locked`, `OFFERED`, `MENU`
- Produces:
  - `EditorProps.edit: { measurer: () => Measurer; save: (id: string, draft: Slide) => Promise<string | null> }`
  - `onEdit(id: string | null)` in `EditorProps`
  - `<SlideFrame>` exported from `Stage.tsx`

- [ ] **Step 1: `Stage.tsx`: `SlideFrame` and the Edit button**

Move the framed `div` (the aspect-video box with the ring and shadow) into an exported `SlideFrame({ children, onClick, title, className })`, so EditMode can reuse it. In `Stage`, add an `onEdit?: () => void` prop and render inside the frame, when there's a slide and no phase:

```tsx
{onEdit && slide && phase === null && (
  <Button type="button" size="sm" variant="outline" aria-label="Edit slide (E)" title="Edit (E)"
    onClick={(e) => { e.stopPropagation(); onEdit() }}
    className="absolute right-3 top-3 gap-1.5 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100">
    <Pencil className="size-3.5" /> Edit
  </Button>
)}
```

The frame gets `group`. Import `Pencil` from `lucide-react` and `Button` from `@/app/components/ui/button`.

- [ ] **Step 2: `EditBar.tsx`**

```tsx
// src/app/edit/EditBar.tsx
/* The bar under the slide while editing (spec 4): template, what a switch keeps and drops, the warnings, Discard and Save. */
import { useState } from 'react'
import { Button } from '@/app/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/app/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select'
import { MENU, OFFERED } from '@/engine/slides/schema'
import { switchTemplate } from '@/engine/slides/edit'
import type { Style, TemplateId } from '@/engine/types'
import type { SlideEdit } from './useSlideEdit'

const NAME: Record<TemplateId, string> = { chart: 'Chart', table: 'Table', number: 'Number', steps: 'Steps', cards: 'Cards', cover: 'Cover', section: 'Chapter divider' }

export function EditBar({ edit, style, onDiscard }: { edit: SlideEdit; style: Style; onDiscard: () => void }) {
  const [pick, setPick] = useState<TemplateId | null>(null)
  const preview = pick ? switchTemplate(edit.draft, pick, style) : null
  const n = edit.issues.length
  return (
    <div className="flex min-h-11 items-center gap-3 rounded-[10px] bg-panel px-3 py-2 shadow-[0_0_0_1px_theme(colors.line)]">
      <Select value={pick ?? edit.draft.template} onValueChange={(v) => setPick(v === edit.draft.template ? null : v as TemplateId)}>
        <SelectTrigger aria-label="Template" className="w-44"><SelectValue /></SelectTrigger>
        <SelectContent>{OFFERED.map((id) => <SelectItem key={id} value={id} title={MENU[id].summary}>{NAME[id]}</SelectItem>)}</SelectContent>
      </Select>
      {preview && pick ? (
        <p className="flex min-w-0 items-center gap-2 text-[13px] text-ink-3">
          <span className="truncate">Keeps: {preview.keeps.join(', ') || 'nothing'} · Drops: {preview.drops.join(', ') || 'nothing'}</span>
          <Button size="sm" onClick={() => { edit.replace(preview.slide, preview.samples); setPick(null) }}>Switch</Button>
          <Button size="sm" variant="ghost" onClick={() => setPick(null)}>Cancel</Button>
        </p>
      ) : <span className="flex-1" />}
      {n > 0 && (
        <Popover>
          <PopoverTrigger asChild><Button size="sm" variant="ghost" className="text-warn">{n} warning{n === 1 ? '' : 's'}</Button></PopoverTrigger>
          <PopoverContent className="w-96 text-[13px]"><ul className="grid gap-1.5">{edit.issues.map((x, i) => <li key={i}>{x.msg}</li>)}</ul></PopoverContent>
        </Popover>
      )}
      {edit.error && <span role="alert" className="text-[13px] text-warn">{edit.error}</span>}
      <Button variant="ghost" onClick={onDiscard} disabled={edit.saving}>Discard</Button>
      <Button onClick={() => void edit.save()} disabled={edit.saving}>{edit.saving ? 'Saving…' : 'Save'}</Button>
    </div>
  )
}
```

The warning colour is the existing `warn` token (`tailwind.config`, `#F2B35B`). Don't add a raw hex.

- [ ] **Step 3: `EditMode.tsx`**

```tsx
// src/app/edit/EditMode.tsx
/* Edit mode: the editable slide where the stage was, the edit bar where the strip and checks were (spec 4). */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { contexts } from '@/engine/slides/render'
import type { Deck, Slide, Style } from '@/engine/types'
import { SLIDE_W, SlideFrame } from '@/app/components/Stage'
import type { Measurer } from '../measure'
import type { Item } from '../store'
import { EditBar } from './EditBar'
import { EditOverlay } from './EditOverlay'
import { EditSurface } from './EditSurface'
import { SelectionBar } from './SelectionBar'
import { ChartGrid } from './ChartGrid'
import { useSlideEdit } from './useSlideEdit'

interface Props { item: Item; index: number; deck: Deck; style: Style; measurer: () => Measurer; save: (id: string, draft: Slide) => Promise<string | null>; onDone: () => void }

export function EditMode({ item, index, deck, style, measurer, save, onDone }: Props) {
  const saveDraft = useCallback((d: Slide) => save(item.id, d), [save, item.id])
  const edit = useSlideEdit({ item, index, deck, style, measurer, save: saveDraft, onDone })
  const [slideEl, setSlideEl] = useState<HTMLElement | null>(null), [grid, setGrid] = useState(false)
  const discard = useCallback(() => { if (!edit.dirty || window.confirm('Discard your changes to this slide?')) edit.discard() }, [edit])

  // ⌘S / ⌘↵ save, Esc discards; leaving the page with changes asks first.
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 's' || e.key === 'Enter')) { e.preventDefault(); void edit.save() }
      else if (e.key === 'Escape' && !grid) { e.preventDefault(); discard() }
    }
    const leave = (e: BeforeUnloadEvent) => { if (edit.dirty) e.preventDefault() }
    document.addEventListener('keydown', key); window.addEventListener('beforeunload', leave)
    return () => { document.removeEventListener('keydown', key); window.removeEventListener('beforeunload', leave) }
  }, [edit, discard, grid])

  const ctx = useMemo(() => contexts({ ...deck, slides: deck.slides.map((s, i) => (i === index ? edit.shown : s)) })[index], [deck, index, edit.shown])
  return (
    <>
      <div className="grid min-h-0 place-items-center px-8 pb-4 pt-7 max-[900px]:order-1 max-[900px]:px-4">
        <SlideFrame>
          <EditSurface edit={edit} deck={deck} ctx={ctx} onSlide={setSlideEl}>
            <EditOverlay edit={edit} slide={slideEl} style={style} onChart={() => setGrid(true)} />
            <SelectionBar edit={edit} slide={slideEl} />
            {grid && edit.draft.chart && <ChartGrid edit={edit} slide={slideEl} style={style} onClose={() => setGrid(false)} />}
          </EditSurface>
        </SlideFrame>
      </div>
      <section className={`mx-auto min-w-0 max-w-[calc(100%-4rem)] pb-5 ${SLIDE_W}`}>
        <EditBar edit={edit} style={style} onDiscard={discard} />
      </section>
    </>
  )
}
```

Until Tasks 8 and 9 land, create `EditOverlay`, `SelectionBar` and `ChartGrid` as components that return `null` and take the props shown, so this task builds and runs on its own.

- [ ] **Step 4: `Editor.tsx`: render EditMode and lock everything**

- Add props `edit: { measurer: () => Measurer; save: (id: string, draft: Slide) => Promise<string | null> }` and `onEdit: (id: string | null) => void`.
- `const editing = s.editing !== null && items[current]?.id === s.editing`, and `const lock = locked(s)`.
- In `<main>`, when `editing`, render `<EditMode item={items[current]} index={current} deck={deck} style={s.style} measurer={edit.measurer} save={edit.save} onDone={() => onEdit(null)} />` instead of `<Stage/>` and the strip/checks section.
- Pass `onEdit={() => onEdit(items[current].id)}` to `Stage`.
- Pass `busy={lock}` to `Strip`, `Bar`, `Storyline` and, through App, to `Decks`.
- `Composer`: `canSend={s.live && !lock}`, and show the hint "Save or discard to keep chatting" when `s.editing`. Add an optional `hint?: string` prop to Composer, rendered as its placeholder.
- Keyboard effect: return early when `s.editing` is set, and add `if (e.key === 'e' && items[current] && !lock) { e.preventDefault(); onEdit(items[current].id) }`. Also skip events whose target `isContentEditable`.

- [ ] **Step 5: `App.tsx`: deps and locks**

```tsx
import { saveEdit } from './edit/save'
import { locked } from './state'
// …
const onEdit = useCallback((id: string | null) => app.dispatch({ type: 'edit', id }), [app])
const edit = useMemo(() => ({ measurer, save: (id: string, draft: Slide) => saveEdit(id, draft, { measurer: measurer(), dispatch: app.dispatch, getState: app.getState }) }), [app, measurer])
```

Replace `app.getState().busy` with `locked(app.getState())` in `leaveTo`, `onAdd`, `onClear` and `present`. Guard `onStyle`, `onTheme` and `onAccent` the same way (`if (locked(app.getState())) return`). Pass `busy={locked(s)}` to `Decks`. Pass `edit={edit}` and `onEdit={onEdit}` to `Editor`.

- [ ] **Step 6: Typecheck, lint, unit tests**

Run: `npm run build && npm run lint && npx vitest run`
Expected: all succeed.

- [ ] **Step 7: Check it in the browser**

Start the dev server with the preview tool, open a deck, and check:
- E enters edit mode.
- The chat input shows "Save or discard to keep chatting".
- The strip has gone, and the edit bar is in its place.
- Typing into the title updates it, with the cursor staying put.
- Save leaves edit mode, and the strip shows the new title.
- Discard after an edit asks first.
- The console shows no errors.

Take a screenshot of edit mode for the user.

- [ ] **Step 8: Commit**

```bash
git add src/app/edit/EditBar.tsx src/app/edit/EditMode.tsx src/app/edit/EditOverlay.tsx src/app/edit/SelectionBar.tsx src/app/edit/ChartGrid.tsx src/app/components/Stage.tsx src/app/components/Editor.tsx src/app/components/Composer.tsx src/app/App.tsx
git commit -m "Edit mode: the Edit button, the edit bar with template switch and warnings, Save and Discard, and the deck locked meanwhile"
```

---

### Task 8: Underlines, +/×, and the Bold/Focus bar

**Files:**
- Modify: `src/app/edit/EditOverlay.tsx`, `src/app/edit/SelectionBar.tsx` (replace the stubs)

**Interfaces:**
- Consumes: `listOps`, `listOf`, `newItem`, `removeItem` (edit), `toggle`, `hasMark` (markup), `caretRange`, `selectRange` (fields), `SlideEdit`
- Produces: `<EditOverlay edit slide style onChart />`, `<SelectionBar edit slide />`

- [ ] **Step 1: `EditOverlay.tsx`**

The overlay is a layer over the slide. Positions come from the slide's elements, in the frame's pixel space, and are applied as CSS variables on each marker (no inline style objects):

```tsx
// src/app/edit/EditOverlay.tsx
/* Over the slide while editing: a quiet underline in the `warn` colour under each field with an issue (its reason on hover), and
   +/× on the list item under the pointer. Positions are read from the slide's own elements (spec 4.2, 4.5). */
import { useEffect, useRef, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { listOf, listOps, newItem, removeItem } from '@/engine/slides/edit'
import type { Style } from '@/engine/types'
import type { SlideEdit } from './useSlideEdit'

interface Box { l: number; t: number; w: number; h: number }
const boxIn = (el: Element, host: Element): Box => { const a = el.getBoundingClientRect(), b = host.getBoundingClientRect(); return { l: a.left - b.left, t: a.top - b.top, w: a.width, h: a.height } }
/** Sets a box as CSS variables on a marker: the classes read them (no inline style objects). */
const place = (el: HTMLElement | null, b: Box) => { if (!el) return; for (const [k, v] of Object.entries(b)) el.style.setProperty(`--${k}`, `${v}px`) }
const MARK = 'absolute left-[var(--l)] top-[var(--t)] w-[var(--w)] h-[var(--h)]'

export function EditOverlay({ edit, slide, style, onChart }: { edit: SlideEdit; slide: HTMLElement | null; style: Style; onChart: () => void }) {
  const host = useRef<HTMLDivElement>(null), [hover, setHover] = useState<HTMLElement | null>(null), [, setTick] = useState(0)

  useEffect(() => {
    if (!slide) return
    const move = (e: PointerEvent) => setHover((e.target instanceof Element ? e.target.closest<HTMLElement>('[data-item]') : null))
    const click = (e: MouseEvent) => { if (e.target instanceof Element && e.target.closest('[data-chart]')) onChart() }
    const ro = new ResizeObserver(() => setTick((n) => n + 1))
    slide.addEventListener('pointermove', move); slide.addEventListener('click', click); ro.observe(slide)
    return () => { slide.removeEventListener('pointermove', move); slide.removeEventListener('click', click); ro.disconnect() }
  }, [slide, onChart])

  if (!slide || !host.current?.parentElement) return <div ref={host} className="pointer-events-none absolute inset-0" />
  const frame = host.current.parentElement, ops = listOps(edit.draft, style)
  const hit = hover && listOf(ops, hover.dataset.item ?? '')
  const flagged = edit.issues.flatMap((x) => { const el = x.path ? slide.querySelector(`[data-path="${x.path}"]`) : null; return el ? [{ el, msg: x.msg }] : [] })
  const keep = (e: { preventDefault(): void }) => e.preventDefault()

  return (
    <div ref={host} className="pointer-events-none absolute inset-0">
      {flagged.map(({ el, msg }, i) => (
        <span key={i} title={msg} ref={(m) => { const b = boxIn(el, frame); place(m, { ...b, t: b.t + b.h - 2, h: 2 }) }}
          className={`${MARK} pointer-events-auto rounded-full bg-warn/70`} />
      ))}
      {hit && hover && (
        <span ref={(m) => place(m, boxIn(hover, frame))} className={`${MARK} pointer-events-none rounded-md ring-1 ring-line-2`}>
          <span className="pointer-events-auto absolute -right-3 -top-3 flex gap-1">
            {hit.op.length < hit.op.max && <button type="button" aria-label="Add after" onMouseDown={keep} onClick={() => edit.patch(newItem(edit.draft, style, hit.op, hit.index + 1))}
              className="grid size-6 place-items-center rounded-full bg-raise text-ink shadow-[0_0_0_1px_theme(colors.line-2)]"><Plus className="size-3.5" /></button>}
            {(hit.op.length > hit.op.min || !hit.op.required) && <button type="button" aria-label="Remove" onMouseDown={keep} onClick={() => { setHover(null); edit.patch(removeItem(hit.op, hit.index)) }}
              className="grid size-6 place-items-center rounded-full bg-raise text-ink shadow-[0_0_0_1px_theme(colors.line-2)]"><X className="size-3.5" /></button>}
          </span>
        </span>
      )}
    </div>
  )
}
```

The overlay sits over the slide but lets the pointer through (`pointer-events-none`), apart from its buttons and underlines, so typing and selecting still reach the fields. For lists inside lists (bullets inside a card), the innermost `[data-item]` wins, because `closest` starts at the target.

- [ ] **Step 2: `SelectionBar.tsx`**

```tsx
// src/app/edit/SelectionBar.tsx
/* Bold and Focus over selected text, in fields that take markup (spec 3). Positive and negative are the agent's. */
import { useEffect, useState } from 'react'
import { Bold, Highlighter } from 'lucide-react'
import { getAt } from '@/engine/slides/edit'
import { hasMark, toggle, type Mark } from '@/engine/slides/markup'
import { caretRange, isMarkup, redraw, selectRange } from './fields'
import type { SlideEdit } from './useSlideEdit'

export function SelectionBar({ edit, slide }: { edit: SlideEdit; slide: HTMLElement | null }) {
  const [at, setAt] = useState<{ el: HTMLElement; from: number; to: number; box: DOMRect } | null>(null)
  useEffect(() => {
    const change = () => {
      const sel = window.getSelection(), node = sel?.anchorNode
      const el = node && (node instanceof Element ? node : node.parentElement)?.closest<HTMLElement>('[data-path]')
      const r = el && slide?.contains(el) && isMarkup(el) ? caretRange(el) : null
      setAt(el && r && r[0] !== r[1] && sel?.rangeCount ? { el, from: r[0], to: r[1], box: sel.getRangeAt(0).getBoundingClientRect() } : null)
    }
    document.addEventListener('selectionchange', change)
    return () => document.removeEventListener('selectionchange', change)
  }, [slide])
  if (!at || !slide) return null
  const markup = String(getAt(edit.draft, at.el.dataset.path ?? '') ?? '')
  const apply = (m: Mark) => {
    const next = toggle(markup, at.from, at.to, m)
    edit.set(at.el.dataset.path ?? '', next); redraw(at.el, next); selectRange(at.el, at.from, at.to)
  }
  const frame = slide.parentElement?.getBoundingClientRect()
  const place = (m: HTMLElement | null) => { if (!m || !frame) return; m.style.setProperty('--x', `${at.box.left - frame.left + at.box.width / 2}px`); m.style.setProperty('--y', `${at.box.top - frame.top - 8}px`) }
  const btn = (m: Mark, label: string, Icon: typeof Bold) => (
    <button type="button" aria-label={label} aria-pressed={hasMark(markup, at.from, at.to, m)} onMouseDown={(e) => e.preventDefault()} onClick={() => apply(m)}
      className="grid size-7 place-items-center rounded-md text-ink-2 hover:bg-line aria-pressed:text-ink aria-pressed:bg-line"><Icon className="size-4" /></button>
  )
  return (
    <div ref={place} role="toolbar" aria-label="Text emphasis"
      className="absolute left-[var(--x)] top-[var(--y)] z-10 flex -translate-x-1/2 -translate-y-full gap-0.5 rounded-lg bg-raise p-1 shadow-[0_0_0_1px_theme(colors.line-2),0_8px_24px_rgba(0,0,0,.4)]">
      {btn('b', 'Bold', Bold)}{btn('f', 'Focus', Highlighter)}
    </div>
  )
}
```

- [ ] **Step 3: Check it in the browser**

Using the preview tool, on a cards slide in edit mode:
- Hovering a card shows +/×. Adding a card gives a new card with "Title" as its hint, and the cursor in it.
- × at the minimum is hidden for cards.
- Typing a title past its limit shows an amber underline about 300 ms later, and hovering it shows the reason.
- Selecting a word shows the bar. Bold makes it bold on the slide, and pressing Bold again removes it.

Screenshot each state, and check `read_console_messages` shows no errors.

- [ ] **Step 4: Typecheck, lint, commit**

```bash
npm run build && npm run lint
git add src/app/edit/EditOverlay.tsx src/app/edit/SelectionBar.tsx
git commit -m "Edit mode: amber underlines with their reason, +/× on list items, and the Bold/Focus bar"
```

---

### Task 9: The chart grid in place, and the browser test

**Files:**
- Modify: `src/app/edit/ChartGrid.tsx` (replace the stub)
- Create: `tests/browser/edit.spec.ts`

**Interfaces:**
- Consumes: `chartGrid`, `fromGrid`, `gridLimits`, the add/remove helpers (grid), `SlideEdit`
- Produces: `<ChartGrid edit slide style onClose />`

- [ ] **Step 1: `ChartGrid.tsx`**

```tsx
// src/app/edit/ChartGrid.tsx
/* The chart as a grid of inputs, in the chart's place and at its size (spec 4.3). Every change writes the chart
   through edit.patch; "Show chart" or a click outside flips back. */
import { useEffect, useRef } from 'react'
import { Plus, X } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import { Input } from '@/app/components/ui/input'
import { addMilestone, addPeriod, addRow, addSeries, chartGrid, fromGrid, gridLimits, removeMilestone, removePeriod, removeRow, removeSeries, type Grid } from '@/engine/slides/grid'
import type { Chart, Style } from '@/engine/types'
import type { SlideEdit } from './useSlideEdit'

const num = (v: string) => (v.trim() === '' ? 0 : Number(v.replace(/,/g, '')))

export function ChartGrid({ edit, slide, style, onClose }: { edit: SlideEdit; slide: HTMLElement | null; style: Style; onClose: () => void }) {
  const box = useRef<HTMLDivElement>(null), chart = edit.draft.chart as Chart, g = chartGrid(chart), lim = gridLimits(style)
  const put = (next: Grid) => edit.patch({ chart: fromGrid(chart, next) })

  useEffect(() => {
    const host = slide?.querySelector('[data-chart]'), frame = slide?.parentElement, el = box.current
    if (!host || !frame || !el) return
    const a = host.getBoundingClientRect(), b = frame.getBoundingClientRect()
    for (const [k, v] of Object.entries({ l: a.left - b.left, t: a.top - b.top, w: a.width, h: a.height })) el.style.setProperty(`--${k}`, `${v}px`)
    const away = (e: PointerEvent) => { if (!el.contains(e.target as Node)) onClose() }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose() } }
    document.addEventListener('pointerdown', away, true); document.addEventListener('keydown', esc, true)
    return () => { document.removeEventListener('pointerdown', away, true); document.removeEventListener('keydown', esc, true) }
  }, [slide, onClose])

  const cell = 'h-7 rounded-sm px-1.5 text-[12px]', del = (onClick: () => void, label: string) => (
    <button type="button" aria-label={label} onClick={onClick} className="grid size-6 place-items-center text-ink-3 hover:text-ink"><X className="size-3.5" /></button>)

  return (
    <div ref={box} data-chart-grid className="absolute left-[var(--l)] top-[var(--t)] z-10 flex h-[var(--h)] w-[var(--w)] flex-col gap-2 overflow-auto rounded-lg bg-panel/95 p-3 shadow-[0_0_0_1px_theme(colors.line-2)] backdrop-blur">
      {g.kind === 'bars' && (
        <table className="w-full border-separate border-spacing-1">
          <thead><tr><th />{g.series.map((s, j) => (
            <th key={j}><div className="flex items-center"><Input aria-label={`Series ${j + 1} name`} className={cell} value={s.name}
              onChange={(e) => put({ ...g, series: g.series.map((x, k) => (k === j ? { ...x, name: e.target.value } : x)) })} />
              {g.series.length > lim.series[0] && del(() => put(removeSeries(g, j, lim)), `Remove series ${j + 1}`)}</div></th>))}
            <th>{g.series.length < lim.series[1] && <Button size="sm" variant="ghost" onClick={() => put(addSeries(g, lim))}><Plus className="size-3.5" /> Series</Button>}</th></tr></thead>
          <tbody>{g.categories.map((c, i) => (
            <tr key={i}><td><Input aria-label={`Category ${i + 1}`} className={cell} value={c} onChange={(e) => put({ ...g, categories: g.categories.map((x, k) => (k === i ? e.target.value : x)) })} /></td>
              {g.series.map((s, j) => <td key={j}><Input aria-label={`${s.name || `Series ${j + 1}`}, ${c}`} inputMode="decimal" className={`${cell} text-right`} defaultValue={String(s.values[i])}
                onBlur={(e) => put({ ...g, series: g.series.map((x, k) => (k === j ? { ...x, values: x.values.map((v, n) => (n === i ? num(e.target.value) : v)) } : x)) })} /></td>)}
              <td>{g.categories.length > lim.categories[0] && del(() => put(removeRow(g, i, lim)), `Remove ${c || `row ${i + 1}`}`)}</td></tr>))}</tbody>
        </table>
      )}
      {g.kind === 'waterfall' && (
        <table className="w-full border-separate border-spacing-1"><tbody>{g.items.map((it, i) => (
          <tr key={i}>
            <td><Input aria-label={`Step ${i + 1} label`} className={cell} value={it.label} onChange={(e) => put({ ...g, items: g.items.map((x, k) => (k === i ? { ...x, label: e.target.value } : x)) })} /></td>
            <td><Input aria-label={`${it.label || `Step ${i + 1}`} value`} inputMode="decimal" className={`${cell} text-right`} disabled={it.total} defaultValue={it.value === null ? '' : String(it.value)}
              onBlur={(e) => put({ ...g, items: g.items.map((x, k) => (k === i ? { ...x, value: num(e.target.value) } : x)) })} /></td>
            <td><label className="flex items-center gap-1 text-[12px] text-ink-3"><input type="checkbox" checked={it.total} onChange={(e) => put({ ...g, items: g.items.map((x, k) => (k === i ? { ...x, total: e.target.checked } : x)) })} /> Total</label></td>
            <td>{g.items.length > lim.items[0] && del(() => put(removeRow(g, i, lim)), `Remove ${it.label || `step ${i + 1}`}`)}</td></tr>))}</tbody></table>
      )}
      {g.kind === 'timeline' && (
        <div className="grid gap-2 text-[12px]">
          <div className="flex flex-wrap items-center gap-1">{g.periods.map((p, i) => (
            <span key={i} className="flex items-center"><Input aria-label={`Period ${i + 1}`} className={`${cell} w-16`} value={p} onChange={(e) => put({ ...g, periods: g.periods.map((x, k) => (k === i ? e.target.value : x)) })} />
              {g.periods.length > lim.periods[0] && del(() => put(removePeriod(g, i, lim)), `Remove period ${p || i + 1}`)}</span>))}
            {g.periods.length < lim.periods[1] && <Button size="sm" variant="ghost" onClick={() => put(addPeriod(g, lim))}><Plus className="size-3.5" /> Period</Button>}</div>
          {g.rows.map((r, i) => (
            <div key={i} className="flex items-center gap-1">
              <Input aria-label={`Workstream ${i + 1}`} className={cell} value={r.label} onChange={(e) => put({ ...g, rows: g.rows.map((x, k) => (k === i ? { ...x, label: e.target.value } : x)) })} />
              {(['start', 'end'] as const).map((side) => (
                <select key={side} aria-label={`${r.label || `Workstream ${i + 1}`} ${side}`} className="h-7 rounded-sm bg-raise px-1" value={r[side]}
                  onChange={(e) => put({ ...g, rows: g.rows.map((x, k) => (k === i ? { ...x, [side]: Number(e.target.value) } : x)) })}>
                  {g.periods.map((p, n) => <option key={n} value={n}>{p || `Period ${n + 1}`}</option>)}</select>))}
              {g.rows.length > lim.rows[0] && del(() => put(removeRow(g, i, lim)), `Remove ${r.label || `workstream ${i + 1}`}`)}
            </div>))}
          {g.milestones.map((m, i) => (
            <div key={`m${i}`} className="flex items-center gap-1">
              <Input aria-label={`Milestone ${i + 1}`} className={cell} value={m.label} onChange={(e) => put({ ...g, milestones: g.milestones.map((x, k) => (k === i ? { ...x, label: e.target.value } : x)) })} />
              <select aria-label={`${m.label || `Milestone ${i + 1}`} at`} className="h-7 rounded-sm bg-raise px-1" value={m.at}
                onChange={(e) => put({ ...g, milestones: g.milestones.map((x, k) => (k === i ? { ...x, at: Number(e.target.value) } : x)) })}>
                {g.periods.map((p, n) => <option key={n} value={n}>{p || `Period ${n + 1}`}</option>)}</select>
              {del(() => put(removeMilestone(g, i, lim)), `Remove milestone ${m.label || i + 1}`)}
            </div>))}
          {g.milestones.length < lim.milestones[1] && <Button size="sm" variant="ghost" className="w-fit" onClick={() => put(addMilestone(g, lim))}><Plus className="size-3.5" /> Milestone</Button>}
        </div>
      )}
      <div className="mt-auto flex gap-2">
        {g.kind !== 'timeline' && <Button size="sm" variant="ghost" onClick={() => put(addRow(g, lim))}><Plus className="size-3.5" /> {g.kind === 'bars' ? 'Category' : 'Step'}</Button>}
        {g.kind === 'timeline' && <Button size="sm" variant="ghost" onClick={() => put(addRow(g, lim))}><Plus className="size-3.5" /> Workstream</Button>}
        <Button size="sm" variant="outline" className="ml-auto" onClick={onClose}>Show chart</Button>
      </div>
    </div>
  )
}
```

`edit.patch` re-renders the slide behind the grid, which redraws the chart, so "Show chart" shows the result at once. Value inputs write on blur, so a value typed halfway ("1.") never redraws mid-number. If the file goes over ~300 lines, split the three grids into `BarsGrid`, `WaterfallGrid` and `TimelineGrid` in the same folder.

- [ ] **Step 2: Write the browser test**

```ts
// tests/browser/edit.spec.ts
/* Editing a slide by hand (spec 4–5 and the plan's Review Focus). */
import { test, expect, type Page } from '@playwright/test'
import { signInAsDev } from './dev-account'

signInAsDev()
const item = (id: string, slide: object) => ({ id, slide, status: 'ok', errors: [], warnings: [], checks: [] })
const deck = { active: 'd1', decks: { d1: { id: 'd1', style: 'consulting', theme: 'ink', accent: null, current: 0, updated: 1, history: [], working: [], messages: [],
  items: [
    item('a', { template: 'cards', title: 'Three levers drive [[margin]] this year', cards: [{ icon: 'zap', title: 'Price', text: 'Raise list price' }, { icon: 'wallet', title: 'Mix', text: 'Sell more premium' }, { icon: 'truck', title: 'Cost', text: 'Cut freight' }] }),
    item('b', { template: 'chart', title: 'Revenue grows', caption: 'Revenue · £m', chart: { categories: ['FY24', 'FY25'], series: [{ name: 'Revenue', values: [10, 14], mark: 'bar' }] } }),
  ] } } }
test.beforeEach(async ({ page }) => {
  await page.addInitScript((d) => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('smartchart.journey.decks.v1', JSON.stringify(d)); sessionStorage.setItem('seeded', '1') } }, deck)
})
const title = (page: Page) => page.locator('[data-editing] [data-path="title"]')
const saved = (page: Page, i = 0) => page.evaluate((k) => window.__journey?.items[k].slide, i)

test('edit mode locks the deck, keeps the words, and saves them', async ({ page }) => {
  await page.goto('/d/d1')
  await page.keyboard.press('e')
  await expect(page.getByRole('button', { name: 'Save' })).toBeVisible()
  await expect(page.locator('[data-strip-thumb]')).toHaveCount(0)
  await expect(page.getByPlaceholder('Save or discard to keep chatting')).toBeVisible()
  await title(page).click()
  await page.keyboard.press('End')
  await page.keyboard.type(' and the year after that, and every year we can see from here on out')
  await expect(page.getByRole('button', { name: /warning/ })).toBeVisible()
  await expect(title(page)).toContainText('margin this year and the year after')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('button', { name: 'Save' })).toHaveCount(0)
  const s = await saved(page)
  expect(s.title).toBe('Three levers drive [[margin]] this year and the year after that, and every year we can see from here on out')
  await page.waitForTimeout(400)
  await page.reload()
  expect((await saved(page)).title).toContain('every year we can see')
})

test('Bold over a selection, and the cursor stays put while typing inside a mark', async ({ page }) => {
  await page.goto('/d/d1')
  await page.keyboard.press('e')
  await title(page).dblclick() // selects a word
  await page.getByRole('button', { name: 'Bold' }).click()
  await page.getByRole('button', { name: 'Save' }).click()
  expect((await saved(page)).title).toMatch(/\*\*\w+\*\*/)
})

test('IME composition is not redrawn mid-word', async ({ page }) => {
  await page.goto('/d/d1')
  await page.keyboard.press('e')
  const t = title(page)
  await t.click()
  await t.evaluate((el) => {
    el.dispatchEvent(new CompositionEvent('compositionstart'))
    el.append('é')
    el.dispatchEvent(new InputEvent('input', { isComposing: true, bubbles: true }))
  })
  await expect(t).toContainText('é')
  await t.evaluate((el) => el.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true })))
  await page.getByRole('button', { name: 'Save' }).click()
  expect((await saved(page)).title).toContain('é')
})

test('add and remove a card; Discard leaves nothing changed', async ({ page }) => {
  await page.goto('/d/d1')
  await page.keyboard.press('e')
  await page.locator('[data-editing] [data-item="cards[2]"]').hover()
  await page.getByRole('button', { name: 'Add after' }).click()
  await expect(page.locator('[data-editing] [data-item^="cards["]')).toHaveCount(4)
  await page.keyboard.type('Freight')
  page.once('dialog', (d) => d.accept())
  await page.getByRole('button', { name: 'Discard' }).click()
  expect((await saved(page)).cards).toHaveLength(3)
})

test('the chart flips to its grid and a value edit lands', async ({ page }) => {
  await page.goto('/d/d1')
  await page.locator('[data-strip-thumb]').nth(1).click()
  await page.keyboard.press('e')
  await page.locator('[data-editing] [data-chart]').click()
  const cell = page.getByLabel('Revenue, FY25')
  await cell.fill('16')
  await cell.blur()
  await page.getByRole('button', { name: 'Show chart' }).click()
  await page.getByRole('button', { name: 'Save' }).click()
  expect((await saved(page, 1)).chart.series[0].values).toEqual([10, 16])
})

test('switching template shows what is kept and what goes', async ({ page }) => {
  await page.goto('/d/d1')
  await page.keyboard.press('e')
  await page.getByRole('combobox', { name: 'Template' }).click()
  await page.getByRole('option', { name: 'Steps' }).click()
  await expect(page.getByText(/Keeps: title · Drops: 3 cards/)).toBeVisible()
  await page.getByRole('button', { name: 'Switch' }).click()
  await expect(page.getByText(/sample text/)).toBeVisible()
})
```

`page.getByRole('button', { name: /warning/ })` needs the title to break the 105-character limit or wrap to 3 lines. The text typed above makes it about 130 characters.

- [ ] **Step 3: Run the browser tests**

Run: `npm run test:browser -- edit.spec.ts`
Expected: PASS. Then run `npm run test:browser` (the whole suite) → PASS, which shows nothing else changed.

- [ ] **Step 4: Review every starter at full size in edit mode**

Following the "review slides individually" rule: with the preview tool, open every gallery template in edit mode at full size, in both styles. Check that no field hint, underline or +/× overlaps the slide's own text in a way that hides it. Screenshot the chart grid for bars, waterfall and timeline, and share them with the user.

- [ ] **Step 5: Commit**

```bash
git add src/app/edit/ChartGrid.tsx tests/browser/edit.spec.ts
git commit -m "Edit mode: the chart grid in place for bars, waterfall and timeline, and the browser test"
```

---

## Notes for the executor

- The plan departs from the spec in four places, chosen during planning:
  - (a) The edit bar takes the place of the strip and checks instead of sitting above the slide. The strip is locked while editing anyway, and this keeps the layout still.
  - (b) A table cell's note can be edited where one exists. There is no button to add a note to a plain cell; the agent does that.
  - (c) Optional fields that aren't on the slide (a missing takeaway, footnote or caption) can't be added by hand in this version. Deleting all their text removes them.
  - (d) `fromGrid` takes the chart it came from, `fromGrid(chart, grid)`, so it can merge.

  Update the spec's §4.3, §6.1 and §8 to match, in the final commit.
- Append a line to `docs/temp/apple-bar-review.md` after the Task 9 review (memory: Apple-bar review log).
