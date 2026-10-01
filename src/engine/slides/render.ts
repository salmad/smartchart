/* Renderer: slide JSON -> HTML at 1920×1080. Shared by the app, the review page and the tests. */
import { createElement, icons } from "lucide";
import { MENU, NOTE_POINTS, plain } from "./schema";
import type { Card, Cell, Deck, Note, Slide, SlideContext, Table, TemplateId } from "../types";
import { drawChart } from "./charts/chart";
import { allocate } from "./colours";
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

const cellValue = (c: Cell | undefined) => plain(c && typeof c === "object" ? c.value : c ?? "").trim();
const NUMERIC = /^~?\(?[+−-]?[£$€]?\d[\d,.]*(?:[–-]\d[\d,.]*)?\s?(%|x|×|k|m|bn|pp|bps)?\)?(\/\w+)?$/i;

/** Alignment per column from its content (spec 3.6 L2): label column text, numbers right, short symbols centred. */
export type Align = "text" | "num" | "sym";
export function columnAlign(t: Table): Align[] {
  return t.columns.map((_, j) => {
    if (j === 0) return "text";
    const vals = t.rows.map((r) => cellValue(r.cells?.[j])).filter((v) => v && v !== "—" && v !== "–" && v !== "-");
    if (!vals.length || vals.every((v) => v.length <= 3 && !/\d/.test(v))) return "sym";
    return vals.every((v) => NUMERIC.test(v)) ? "num" : "text";
  });
}

function tableHTML(t: Table) {
  const al = columnAlign(t), cls = (c: Table["columns"][number] | undefined, j: number) => [`al-${al[j]}`, c?.focus ? "focus" : "", c?.muted ? "muted" : "", c?.bold ? "bold" : "", c?.italic ? "italic" : ""].filter(Boolean).join(" ");
  const cell = (c: Cell, r: number, j: number) => { const p = `table.rows[${r}].cells[${j}]`;
    if (typeof c === "object" && c) return `<td class="${cls(t.columns[j], j)}"><span${at(`${p}.value`, "md")}>${md(c.value)}</span>${c.note ? `<small${at(`${p}.note`, "esc")}>${esc(c.note)}</small>` : ""}</td>`;
    return `<td class="${cls(t.columns[j], j)}"${at(p, "md")}>${md(c ?? "")}</td>`; };
  return `<table class="tbl${t.columns.length <= 2 ? " narrow" : ""}"><colgroup>${t.columns.map(() => "<col>").join("")}</colgroup>
    <thead><tr>${t.columns.map((c, j) => `<th class="${cls(c, j)}"${at(`table.columns[${j}].label`, "esc")}>${esc(c.label ?? "")}</th>`).join("")}</tr></thead>
    <tbody>${t.rows.map((r, i) => `<tr class="${r.style || ""}"${item(`table.rows[${i}]`)}>${r.cells.map((c, j) => cell(c, i, j)).join("")}</tr>`).join("")}</tbody></table>`;
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
const BODY: Record<Exclude<TemplateId, "cover" | "section">, (s: Slide, variant: string) => string> = {
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
  } else {
    // The head holds its longest form (L3), so the body starts on one line per style. The consulting
    // kicker line is kept even when empty, so the title does not move up on slides without one.
    const head = deck.style === "consulting"
      ? `<div class="label"${at("kicker", "esc")}>${esc(s.kicker || ctx.kicker)}</div><h2 class="title"${at("title", "display")}>${display(s.title)}</h2>`
      : `<h2 class="title"${at("title", "display")}>${display(s.title)}</h2>${s.subtitle ? `<p class="subtitle"${at("subtitle", "display")}>${display(s.subtitle)}</p>` : ""}`;
    body = `<header class="head">${head}</header>`
      + BODY[s.template](s, variant)
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
  sizeTable(slide); growTable(slide);
  const host = slide.querySelector<HTMLElement>("[data-chart]");
  if (host && s.chart) drawChart(host, s.chart, NOTE_POINTS ? (s.notes || []).flatMap((n, k) => (n.point ? [{ n: k + 1, ...n.point }] : [])) : [], colours);
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

/* L1: the label column takes its natural width within 20–40%; fixed layout splits the rest equally. */
function sizeTable(slide: HTMLElement) {
  const tbl = slide.querySelector<HTMLElement>(".tbl"), col = tbl?.querySelector<HTMLElement>("col");
  if (!tbl || !col) return;
  tbl.classList.add("measuring");
  const natural = Math.max(...[...tbl.querySelectorAll("tr > :first-child")].map((c) => c.scrollWidth));
  tbl.classList.remove("measuring");
  // +2px: at exactly its natural width, subpixel rounding can wrap the label.
  const share = Math.min(.4, Math.max(.2, (natural + 2) / tbl.clientWidth));
  col.style.width = `${(share * 100).toFixed(2)}%`;
}

/* L5: a table under 60% of the body grows its rows, up to 1.5× its natural height; beside notes too, so the
   notes' bands (which share the split's height) grow with it. */
function growTable(slide: HTMLElement) {
  const tbl = slide.matches(".t-table.v-full") ? slide.querySelector<HTMLElement>(":scope > .tbl")
    : slide.matches(".t-table.v-split") ? slide.querySelector<HTMLElement>(".split.with-table > .main > .tbl") : null;
  if (!tbl) return;
  // The slide is scaled with a transform: measure in slide pixels.
  const R = slide.getBoundingClientRect(), k = R.width / 1920, top = (el: Element) => (el.getBoundingClientRect().top - R.top) / k;
  const bottom = 1080 - parseFloat(getComputedStyle(slide).paddingBottom), tk = slide.querySelector(".takeaway");
  const area = (tk ? top(tk) - 40 : bottom) - top(tbl), natural = tbl.getBoundingClientRect().height / k;
  if (natural < area * .6) tbl.style.height = `${Math.min(area * .6, natural * 1.5)}px`;
}

/* Big values in a row shrink together (to 75% at most) so the widest fits. */
function fitValues(slide: HTMLElement) {
  for (const sel of [".cards.value .v", ".hero-v"]) {
    const els = [...slide.querySelectorAll<HTMLElement>(sel)];
    const k = Math.min(1, ...els.map((e) => e.clientWidth / e.scrollWidth));
    if (k < 1) els.forEach((e) => { e.style.fontSize = `${parseFloat(getComputedStyle(e).fontSize) * Math.max(k, .75)}px`; });
  }
}
