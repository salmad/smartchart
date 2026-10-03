/* Renderer: slide JSON -> HTML at 1920×1080. Shared by the app, the review page and the tests. */
import { createElement, icons } from "lucide";
import { MENU, NOTE_POINTS, plain } from "./schema.js";
import type { Card, Cell, Deck, Half, Note, Slide, SlideContext, Table, TemplateId } from "../types.js";
import { drawChart } from "./charts/chart.js";
import { allocate } from "./colours.js";
import { markKinds, markOf, type Mark } from "./marks.js";
import { columnAlign } from "./align.js";
import { groupLayout, roomOf, type TableRoom } from "./groups.js";
export { drawChart };

const ENTITIES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };
export const esc = (s: unknown): string => String(s).replace(/[&<>"]/g, (c) => ENTITIES[c]);
export const md = (s: unknown): string => esc(s)
  .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
  .replace(/\[\[(.+?)\]\]/g, '<span class="hl-focus">$1</span>')
  .replace(/\[-(.+?)-\]/g, '<span class="hl-neg">$1</span>')
  .replace(/\[\+(.+?)\+\]/g, '<span class="hl-pos">$1</span>');
const pad2 = (n: number) => String(n).padStart(2, "0");
/** Display text: hyphenated compounds ("5-hospital", "well-known") never break at the hyphen. Text only, not tags. */
const display = (s: string) => md(s).split(/(<[^>]+>)/).map((part) => (part.startsWith("<") ? part
  : part.replace(/[\p{L}\p{N}£$€%]+(?:[-‑][\p{L}\p{N}%]+)+/gu, (w) => `<span class="nw">${w}</span>`))).join("");
/** How a field's string is drawn; hand editing redraws one field with the same function. */
export type FieldKind = "md" | "display" | "esc" | "cap";
/* Exhibit caption: the unit after the last " · " is set quieter. */
const capInner = (text: string) => { const i = text.lastIndexOf(" · "); return i > 0 ? `${esc(text.slice(0, i))}<span> · ${esc(text.slice(i + 3))}</span>` : esc(text); };
export const FIELD_HTML: Record<FieldKind, (s: string) => string> = { md, display, esc, cap: capInner };
/** The field's JSON path and kind, as attributes: what hand editing reads. They change nothing on screen. */
const at = (path: string, kind: FieldKind) => ` data-path="${path}" data-kind="${kind}"`;
const item = (path: string) => ` data-item="${path}"`;
const list = (items: string[], path: string) => `<ul class="bullets">${items.map((b, j) => `<li${item(`${path}[${j}]`)}${at(`${path}[${j}]`, "md")}>${md(b)}</li>`).join("")}</ul>`;

const notesHTML = (notes: Note[]) => `<div class="notes">${notes.map((n, i) => `<div class="note"${item(`notes[${i}]`)}><span class="n">${pad2(i + 1)}</span>
  <div><h4${at(`notes[${i}].title`, "md")}>${md(n.title)}</h4>${n.text ? `<p${at(`notes[${i}].text`, "md")}>${md(n.text)}</p>` : ""}</div></div>`).join("")}</div>`;

/* Exhibit caption: what the chart or table shows; the unit after the last " · " is set quieter. */
const capHTML = (text: string | undefined, cls = "", path = "") => {
  if (!text) return `<p class="cap blank ${cls}"></p>`;
  return `<p class="cap ${cls}"${path ? at(path, "cap") : ""}>${capInner(text)}</p>`;
};
/* Split body: main ⅔ + notes ⅓. With a notes heading, both columns get a header row on one line (a missing
   caption stays blank). With a caption alone, the notes keep the column's full height from the body line. */
const splitHTML = (s: Slide, main: string, extra = "") => {
  const head = s.notesTitle ? capHTML(s.caption, "", "caption") + capHTML(s.notesTitle, "notes-h", "notesTitle") : s.caption ? capHTML(s.caption, "", "caption") : "";
  const cls = s.notesTitle ? "has-head" : s.caption ? "has-head cap-only" : "";
  return `<div class="split ${extra} ${cls}">${head}<div class="main">${main}</div>${notesHTML(s.notes ?? [])}</div>`;
};

const ball = (v: number) => {
  if (v >= 4) return `<svg class="mk-ball" viewBox="0 0 40 40" aria-hidden="true"><circle class="full" cx="20" cy="20" r="18"/></svg>`;
  const a = v / 4 * 2 * Math.PI, x = 20 + 18 * Math.sin(a), y = 20 - 18 * Math.cos(a);
  return `<svg class="mk-ball" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="18"/>${v ? `<path d="M20,20V2A18,18 0 ${v > 2 ? 1 : 0},1 ${x},${y}Z"/>` : ""}</svg>`;
};
/* The cell keeps its own character as text (hidden under a drawn ball), so the field still reads as what was written. */
const markHTML = (m: Mark, raw: string) => (m.kind === "ball" ? `${ball(m.v)}<span class="mk-txt">${esc(raw)}</span>` : `<span class="mk-tick${m.kind === "cross" ? " no" : ""}">${esc(raw)}</span>`);
/** The key under a table of Harvey balls: what empty and full mean. Consulting only (pitch hides it in CSS). */
const ballKey = () => `<div class="mk-key"><span>${ball(0)}None</span>${[1, 2, 3].map((v) => `<span>${ball(v)}</span>`).join("")}<span>${ball(4)}Full</span></div>`;

function tableHTML(t: Table, base = "table", key = true, room: TableRoom = "full") {
  const al = columnAlign(t), n = t.columns.length, byColumn = groupLayout(t, room) === "column";
  const cls = (c: Table["columns"][number] | undefined, j: number) => [`al-${al[j]}`, c?.focus ? "focus" : "", c?.muted ? "muted" : "", c?.bold ? "bold" : "", c?.italic ? "italic" : ""].filter(Boolean).join(" ");
  const P = (r: number, j: number) => `${base}.rows[${r}].cells[${j}]`;
  const note = (o: { note?: string }, p: string) => (o.note ? `<small${at(`${p}.note`, "esc")}>${esc(o.note)}</small>` : "");
  const cell = (c: Cell, r: number, j: number) => {
    const p = P(r, j), o = typeof c === "object" && c ? c : null, text = o ? o.value ?? "" : c ?? "", mark = markOf(String(text)), k = cls(t.columns[j], j);
    if (mark && o?.note) return `<td class="${k} score has-note"><span${at(`${p}.value`, "md")}>${markHTML(mark, plain(String(text)))}</span>${note(o, p)}</td>`;
    if (mark) return `<td class="${k} score"${at(o ? `${p}.value` : p, "md")}>${markHTML(mark, plain(String(text)))}</td>`;
    if (o?.status) return `<td class="${k} status"><span class="pill"${at(`${p}.value`, "esc")}>${esc(o.value ?? "")}</span>${note(o, p)}</td>`;
    if (o?.bullets) return `<td class="${k} has-bul">${o.value ? `<span${at(`${p}.value`, "md")}>${md(o.value)}</span>` : ""}${list(o.bullets, `${p}.bullets`)}</td>`;
    if (o) return `<td class="${k}"><span${at(`${p}.value`, "md")}>${md(o.value ?? "")}</span>${note(o, p)}</td>`;
    return `<td class="${k}"${at(p, "md")}>${md(c ?? "")}</td>`;
  };
  const head = (c: Table["columns"][number], j: number) => c.icon
    ? `<th class="${cls(c, j)} has-ic"><i data-lucide="${esc(c.icon)}"></i><span${at(`${base}.columns[${j}].label`, "esc")}>${esc(c.label ?? "")}</span></th>`
    : `<th class="${cls(c, j)}"${at(`${base}.columns[${j}].label`, "esc")}>${esc(c.label ?? "")}</th>`;
  const row = (r: Table["rows"][number], i: number) => {
    if (r.style === "group") { const g = r.cells[0], o = typeof g === "object" && g ? g : null;
      return `<tr class="group"${item(`${base}.rows[${i}]`)}><td${at(o ? `${P(i, 0)}.value` : P(i, 0), "md")}>${md(o ? o.value ?? "" : g ?? "")}</td>${"<td></td>".repeat(n - 1)}</tr>`; }
    return `<tr class="${[r.style, r.focus ? "focus" : ""].filter(Boolean).join(" ")}"${item(`${base}.rows[${i}]`)}>${r.cells.map((c, j) => cell(c, i, j)).join("")}</tr>`;
  };
  /* Groups as a first column: every row gets a group cell, so columns keep their index; the heading sits in its first
     row's cell (an item of its own, so it is selected and edited as the group row), and a group's last row closes it. */
  const groupCell = (i: number) => {
    const r = t.rows[i], g = r.cells[0], o = typeof g === "object" && g ? g : null;
    return `<td class="grp"${item(`${base}.rows[${i}]`)}><span${at(o ? `${P(i, 0)}.value` : P(i, 0), "md")}>${md(o ? o.value ?? "" : g ?? "")}</span></td>`;
  };
  const columnRows = () => {
    let head = -1;
    return t.rows.flatMap((r, i) => {
      if (r.style === "group") { head = i; return []; }
      const first = head >= 0 && t.rows[i - 1]?.style === "group", end = i === t.rows.length - 1 || t.rows[i + 1]?.style === "group";
      const html = row(r, i).replace(/^(<tr class=")([^"]*)("[^>]*>)/, (_m, a: string, c: string, b: string) => `${a}${[c, end ? "grp-end" : ""].filter(Boolean).join(" ")}${b}${first ? groupCell(head) : `<td class="grp"></td>`}`);
      return [html];
    }).join("");
  };
  return `<table class="tbl${n <= 2 ? " narrow" : ""}${byColumn ? " by-group" : ""}"><colgroup>${byColumn ? `<col class="grp">` : ""}${t.columns.map((c) => (c.focus ? `<col class="focus">` : "<col>")).join("")}</colgroup>
    <thead><tr>${byColumn ? `<th class="grp"></th>` : ""}${t.columns.map(head).join("")}</tr></thead>
    <tbody>${byColumn ? columnRows() : t.rows.map(row).join("")}</tbody></table>${key && markKinds(t).has("balls") ? ballKey() : ""}`;
}

function cardHTML(c: Card, variant: string, i: number) {
  const p = `cards[${i}]`;
  const body = (c.bullets ? list(c.bullets, `${p}.bullets`) : "") + (c.text ? `<p${at(`${p}.text`, "md")}>${md(c.text)}</p>` : "");
  const tone = c.tone && c.tone !== "neutral" ? c.tone : "";
  if (variant === "framed") return `<div class="card ${tone}"${item(p)}><div class="who"${at(`${p}.label`, "esc")}>${esc(c.label || "")}</div><h3${at(`${p}.title`, "esc")}>${esc(c.title)}</h3>${body}
    ${c.facts ? `<div class="facts">${c.facts.map((x, k) => `<div${item(`${p}.facts[${k}]`)}><div class="k"${at(`${p}.facts[${k}].label`, "esc")}>${esc(x.label)}</div><div class="v"${at(`${p}.facts[${k}].text`, "md")}>${md(x.text)}</div></div>`).join("")}</div>` : ""}</div>`;
  if (variant === "value") return `<div class="card ${tone}"${item(p)}><div class="shout v"${at(`${p}.value`, "esc")}>${esc(c.value)}</div><h3${at(`${p}.title`, "md")}>${md(c.title)}</h3>${body}</div>`;
  return `<div class="card ${tone}"${item(p)}><div class="ic"><i data-lucide="${esc(c.icon)}"></i></div><h3${at(`${p}.title`, "md")}>${md(c.title)}</h3>${body}</div>`;
}

/* Body per menu entry. The variant (layout) comes from the registry, never from the agent. */
const table = (s: Slide): Table => s.table ?? { columns: [], rows: [] };
const BODY: Record<Exclude<TemplateId, "cover" | "section" | "number" | "quote">, (s: Slide, variant: string) => string> = {
  chart: (s, v) => v === "split"
    ? splitHTML(s, `<div class="chart" data-chart></div>`, "grow")
    : `${s.caption ? capHTML(s.caption, "", "caption") : ""}<div class="chart full grow" data-chart></div>`,
  table: (s, v) => v === "split"
    ? splitHTML(s, tableHTML(table(s), "table", true, "split"), "with-table")
    : `${s.caption ? capHTML(s.caption, "", "caption") : ""}${tableHTML(table(s), "table", true, roomOf(table(s), false))}`,
  steps: (s) => `<div class="steps">${(s.steps ?? []).map((r, i) => `
    <span class="t"${at(`steps[${i}].when`, "esc")}>${esc(r.when)}</span>
    <div class="d ${r.focus ? "row-focus" : ""}"${item(`steps[${i}]`)}><span class="h"${at(`steps[${i}].title`, "esc")}>${esc(r.title)}</span><span${at(`steps[${i}].text`, "md")}>${md(r.text)}</span></div>`).join("")}</div>`,
  pair: (s) => {
    const halves = s.halves ?? [];
    const half = (h: Half | undefined, i: number) => {
      if (!h) return "";
      const p = `halves[${i}]`;
      const body = h.chart ? `<div class="chart" data-chart="${i}"></div>${h.bullets?.length ? list(h.bullets, `${p}.bullets`) : ""}`
        : h.table ? tableHTML(h.table, `${p}.table`, false, "half")
        : h.number ? `<div class="half-num"><div class="shout big-v${h.number.tone && h.number.tone !== "focus" ? ` ${h.number.tone}` : ""}"${at(`${p}.number.value`, "esc")}>${esc(h.number.value)}</div><p${at(`${p}.number.caption`, "md")}>${md(h.number.caption)}</p></div>`
        : h.points ? list(h.points, `${p}.points`).replace('<ul class="bullets">', '<ul class="bullets points">')
        : "";
      return `<div class="half"${item(p)} data-grid="${i}">${capHTML(h.caption, "", h.caption ? `${p}.caption` : "")}${body}</div>`;
    };
    const balls = halves.some((h) => h?.table && markKinds(h.table).has("balls"));
    return `<div class="pair grow">${halves.map(half).join("")}</div>${balls ? ballKey() : ""}`;
  },
  summary: (s) => `<div class="sum grow">${(s.points ?? []).map((p, i) => `<div class="row"${item(`points[${i}]`)}><span class="n">${pad2(i + 1)}</span>
    <span class="lead"${at(`points[${i}].title`, "md")}>${md(p.title)}</span><span class="why"${at(`points[${i}].text`, "md")}>${md(p.text)}</span></div>`).join("")}</div>`,
  cards: (s, v) => { const cards = s.cards ?? [];
    return `<div class="cards ${v} ${v === "framed" ? "grow" : `n-${cards.length}`}">${cards.map((c, i) => cardHTML(c, v, i)).join("")}</div>`; },
};

/** Deck context per slide: page number, section number and the default kicker. */
export function contexts(deck: Pick<Deck, "slides" | "footer">): SlideContext[] {
  let section = 0, sectionTitle = "";
  return deck.slides.map((s, i) => {
    if (s.template === "section") { section += 1; sectionTitle = s.title; }
    return { page: i + 1, section, kicker: sectionTitle ? `${pad2(section)} · ${sectionTitle}` : "", footer: deck.footer || "" };
  });
}

export function slideHTML(s: Slide, ctx: SlideContext, deck: Pick<Deck, "style" | "theme">): string {
  const entry = MENU[s.template], variant = entry.variant(s);
  let body: string;
  if (s.template === "cover") {
    body = `<div class="cover-mark"></div><h1 class="title"${at("title", "display")}>${display(s.title)}</h1><p class="cover-sub"${at("subtitle", "md")}>${md(s.subtitle)}</p>`;
  } else if (s.template === "section") {
    // The subtitle box is always there: it holds its 2 lines, so the number and title sit still across dividers.
    body = `<p class="shout sec-n">${pad2(ctx.section)}</p><h2 class="title"${at("title", "esc")}>${esc(s.title)}</h2><p class="sec-sub"${at("subtitle", "md")}>${s.subtitle ? md(s.subtitle) : ""}</p>`;
  } else if (s.template === "number") {
    // No title: the number and its sentence are the slide (the sentence is its line in the storyline).
    const n = s.number ?? { value: "", caption: "" };
    body = `<p class="shout big-v ${n.tone && n.tone !== "focus" ? n.tone : ""}"${at("number.value", "esc")}>${esc(n.value)}</p><p class="big-c"${at("number.caption", "md")}>${md(n.caption)}</p>`;
  } else if (s.template === "quote") {
    body = `<p class="q-mark" aria-hidden="true">“</p><p class="q-text"${at("quote", "md")}>${md(s.quote ?? "")}</p><p class="q-who"${at("who", "esc")}>${esc(s.who ?? "")}</p>`;
  } else {
    // The head holds its longest form (L3), so the body starts on one line per style. The consulting
    // kicker line is kept even when empty, so the title does not move up on slides without one.
    const head = deck.style === "consulting"
      ? `<div class="label"${at("kicker", "esc")}>${esc(s.kicker || ctx.kicker)}</div><h2 class="title"${at("title", "display")}>${display(s.title)}</h2>`
      : `<h2 class="title"${at("title", "display")}>${display(s.title)}</h2>${s.subtitle ? `<p class="subtitle"${at("subtitle", "display")}>${display(s.subtitle)}</p>` : ""}`;
    body = `<header class="head">${head}</header>`
      + BODY[s.template as keyof typeof BODY](s, variant)
      + (s.takeaway ? `<div class="spacer"></div><p class="takeaway"${at("takeaway", "md")}>${md(s.takeaway)}</p>` : "");
  }
  const fn = [s.footnote && `<p${at("footnote", "md")}>${md(s.footnote)}</p>`, s.source && `<p>Source: <span${at("source", "md")}>${md(s.source)}</span></p>`].filter(Boolean).join("");
  const rail = s.template === "cover" ? "" : `<div class="rail"><div class="fn">${fn}</div><div class="pg">${esc(ctx.footer)}<b>${pad2(ctx.page)}</b></div></div>`;
  return `<section class="slide t-${s.template} v-${variant} style-${deck.style} theme-${deck.theme}">${body}${rail}</section>`;
}

/** Render one slide into a frame element, scaled to the frame's width. */
export function mountSlide(frame: HTMLElement, s: Slide, ctx: SlideContext, deck: Pick<Deck, "style" | "theme" | "accent">): HTMLElement {
  frame.innerHTML = slideHTML(s, ctx, deck);
  const slide = frame.firstElementChild;
  if (!(slide instanceof HTMLElement)) throw new Error("mountSlide: the slide did not render");
  slide.style.setProperty("--s", String(frame.clientWidth / 1920));
  // Every colour on the slide comes from the allocator; the palette CSS only holds the defaults.
  const colours = allocate(s, deck.theme, deck.accent);
  for (const [k, v] of Object.entries(colours.vars)) slide.style.setProperty(`--${k}`, v);
  fitValues(slide);
  sizeTable(slide); stackIcons(slide); growTable(slide); growHalfTables(slide);
  // A chart slide has one host; a pair has two, each its own chart with its own colours.
  slide.querySelectorAll<HTMLElement>("[data-chart]").forEach((host) => {
    const i = host.dataset.chart, spec = i ? s.halves?.[Number(i)]?.chart : s.chart;
    if (!spec) return;
    if (!i) return drawChart(host, spec, NOTE_POINTS ? (s.notes || []).flatMap((n, k) => (n.point ? [{ n: k + 1, ...n.point }] : [])) : [], colours);
    const own = allocate({ ...s, template: "chart", chart: spec }, deck.theme, deck.accent);
    for (const [k, v] of Object.entries(own.vars)) host.style.setProperty(`--${k}`, v);
    drawChart(host, spec, [], own);
  });
  drawIcons(slide);
  return slide;
}

/* Icons: lucide's createIcons scans the whole document; this does the same replacement (same
   attributes and classes) for the slide just mounted only. */
const pascal = (name: string) => name.replace(/(\w)(\w*)(_|-|\s*)/g, (_m, a: string, b: string) => a.toUpperCase() + b.toLowerCase());
function drawIcons(root: HTMLElement) {
  root.querySelectorAll("i[data-lucide]").forEach((el) => {
    const name = el.getAttribute("data-lucide") ?? "", node = icons[pascal(name) as keyof typeof icons];
    if (!node) return;
    const [tag, attrs, children] = node;
    el.replaceWith(createElement([tag, { ...attrs, "data-lucide": name, "stroke-width": 1.5, class: `lucide lucide-${name}` }, children]));
  });
}

/* L1: the label column takes its natural width within 20–40%; fixed layout splits the rest equally. Every table on the
   slide (a pair can have two). Group rows span the table, so they are not measured. A group column comes first and
   takes its longest heading on one line. */
function sizeTable(slide: HTMLElement) {
  const k = slide.getBoundingClientRect().width / 1920;
  slide.querySelectorAll<HTMLElement>(".tbl").forEach((tbl) => {
    const cols = [...tbl.querySelectorAll<HTMLElement>("col")], grp = tbl.classList.contains("by-group") ? 1 : 0, col = cols[grp];
    if (!col) return;
    const g = grp ? (Math.max(0, ...[...tbl.querySelectorAll("td.grp > span")].map((el) => el.getBoundingClientRect().width / k)) + 28) / tbl.clientWidth : 0;
    if (grp) cols[0].style.width = `${(g * 100).toFixed(2)}%`;
    tbl.classList.add("measuring");
    const natural = Math.max(...[...tbl.querySelectorAll(`tr:not(.group) > :nth-child(${grp + 1})`)].map((c) => c.scrollWidth));
    tbl.classList.remove("measuring");
    // +2px: at exactly its natural width, subpixel rounding can wrap the label.
    const share = Math.min(.4, Math.max(.2, (natural + 2) / tbl.clientWidth));
    col.style.width = `${(share * 100).toFixed(2)}%`;
    // A column of bullets explains positions: it takes a double share of the rest, so its bullets keep to a line or two.
    const data = cols.slice(grp + 1), bul = new Set([...tbl.querySelectorAll("td.has-bul")].map((td) => (td as HTMLTableCellElement).cellIndex - grp - 1));
    // Pitch hides bullets, so its columns stay equal.
    const shares = data.map((_, j) => (bul.has(j) && !slide.classList.contains("style-pitch") ? 2 : 1)), total = shares.reduce((a, b) => a + b, 0);
    if (!grp && total === data.length) return;
    data.forEach((c, j) => { c.style.width = `${((1 - g - share) * shares[j] / total * 100).toFixed(2)}%`; });
  });
}

/* Header icons sit inline; if any icon and its label do not fit across their column, every icon in that table goes
   above its label (one look per table). */
function stackIcons(slide: HTMLElement) {
  slide.querySelectorAll<HTMLElement>(".tbl").forEach((tbl) => {
    // Icons are drawn later (drawIcons), so an icon counts as its fixed 22px and 10px gap; the label is measured.
    const k = slide.getBoundingClientRect().width / 1920;
    const over = (th: HTMLElement) => { const cs = getComputedStyle(th), room = th.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      return (th.querySelector(":scope > span")?.getBoundingClientRect().width ?? 0) / k + 32 > room + 1; };
    if ([...tbl.querySelectorAll<HTMLElement>("thead th.has-ic")].some(over)) tbl.classList.add("ic-above");
  });
}

/* L5 in a pair: a half table grows its rows towards the bottom of its half, up to 1.5× its natural height, so it
   ends level with the chart beside it rather than stopping halfway down. */
function growHalfTables(slide: HTMLElement) {
  const R = slide.getBoundingClientRect(), k = R.width / 1920;
  slide.querySelectorAll<HTMLElement>(".pair > .half > .tbl").forEach((tbl) => {
    const half = tbl.parentElement;
    if (!half) return;
    const area = (half.getBoundingClientRect().bottom - tbl.getBoundingClientRect().top) / k, natural = tbl.getBoundingClientRect().height / k;
    if (natural < area) tbl.style.height = `${Math.min(area, natural * 1.5)}px`;
  });
}

/* L5: a table or a list of steps grows its rows towards the bottom of the body (or the takeaway), up to 1.5× its natural
   height, so a short body ends on the same line as a full one instead of leaving a band empty; beside notes too, so the
   notes' bands (which share the split's height) grow with it. */
function growTable(slide: HTMLElement) {
  const body = slide.matches(".t-table.v-full") ? slide.querySelector<HTMLElement>(":scope > .tbl")
    : slide.matches(".t-table.v-split") ? slide.querySelector<HTMLElement>(".split.with-table > .main > .tbl")
    : slide.querySelector<HTMLElement>(":scope > .steps");
  if (!body) return;
  // The slide is scaled with a transform: measure in slide pixels.
  const R = slide.getBoundingClientRect(), k = R.width / 1920, top = (el: Element) => (el.getBoundingClientRect().top - R.top) / k;
  const bottom = 1080 - parseFloat(getComputedStyle(slide).paddingBottom), tk = slide.querySelector(".takeaway");
  const area = (tk ? top(tk) - 40 : bottom) - top(body), natural = body.getBoundingClientRect().height / k;
  if (natural < area) body.style.height = `${Math.min(area, natural * 1.5)}px`;
}

/* Big values in a row shrink together (to 75% at most) so the widest fits. */
function fitValues(slide: HTMLElement) {
  for (const sel of [".cards.value .v", ".big-v"]) {
    const els = [...slide.querySelectorAll<HTMLElement>(sel)];
    const k = Math.min(1, ...els.map((e) => e.clientWidth / e.scrollWidth));
    if (k < 1) els.forEach((e) => { e.style.fontSize = `${parseFloat(getComputedStyle(e).fontSize) * Math.max(k, .75)}px`; });
  }
}
