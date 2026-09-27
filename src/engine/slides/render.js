/* Renderer: slide JSON -> HTML at 1920×1080. Shared by the review page and the journey prototype. */
import { MENU } from "./schema";
import { drawChart } from "./charts/chart";
import { allocate } from "./colours";
export { drawChart };

export const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
export const md = (s) => esc(s)
  .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
  .replace(/\[\[(.+?)\]\]/g, '<span class="hl-focus">$1</span>')
  .replace(/\[-(.+?)-\]/g, '<span class="hl-neg">$1</span>')
  .replace(/\[\+(.+?)\+\]/g, '<span class="hl-pos">$1</span>');
const pad2 = (n) => String(n).padStart(2, "0");
/** Display text: hyphenated compounds ("5-hospital", "well-known") never break at the hyphen. Text only, not tags. */
const display = (s) => md(s).split(/(<[^>]+>)/).map((part) => (part.startsWith("<") ? part
  : part.replace(/[\p{L}\p{N}£$€%]+(?:[-‑][\p{L}\p{N}%]+)+/gu, (w) => `<span class="nw">${w}</span>`))).join("");
const list = (items) => `<ul class="bullets">${items.map((b) => `<li>${md(b)}</li>`).join("")}</ul>`;

const notesHTML = (notes) => `<div class="notes">${notes.map((n, i) => `<div class="note"><span class="n">${pad2(i + 1)}</span>
  <div><h4>${md(n.title)}</h4>${n.text ? `<p>${md(n.text)}</p>` : ""}</div></div>`).join("")}</div>`;

const cellValue = (c) => String(c && typeof c === "object" ? c.value : c ?? "").trim();
const NUMERIC = /^~?\(?[+−-]?[£$€]?\d[\d,.]*(?:[–-]\d[\d,.]*)?\s?(%|x|×|k|m|bn|pp|bps)?\)?(\/\w+)?$/i;

/** Alignment per column from its content (spec 3.6 L2): label column text, numbers right, short symbols centred. */
export function columnAlign(t) {
  return t.columns.map((_, j) => {
    if (j === 0) return "text";
    const vals = t.rows.map((r) => cellValue(r.cells?.[j])).filter((v) => v && v !== "—" && v !== "–" && v !== "-");
    if (!vals.length || vals.every((v) => v.length <= 3 && !/\d/.test(v))) return "sym";
    return vals.every((v) => NUMERIC.test(v)) ? "num" : "text";
  });
}

function tableHTML(t) {
  const al = columnAlign(t), cls = (c, j) => [`al-${al[j]}`, c?.focus ? "focus" : ""].join(" ");
  const cell = (c, j) => { const v = typeof c === "object" && c ? c : { value: c };
    return `<td class="${cls(t.columns[j], j)}">${esc(v.value)}${v.note ? `<small>${esc(v.note)}</small>` : ""}</td>`; };
  return `<table class="tbl${t.columns.length <= 2 ? " narrow" : ""}"><colgroup>${t.columns.map(() => "<col>").join("")}</colgroup>
    <thead><tr>${t.columns.map((c, j) => `<th class="${cls(c, j)}">${esc(c.label)}</th>`).join("")}</tr></thead>
    <tbody>${t.rows.map((r) => `<tr class="${r.style || ""}">${r.cells.map(cell).join("")}</tr>`).join("")}</tbody></table>`;
}

function cardHTML(c, variant) {
  const body = (c.bullets ? list(c.bullets) : "") + (c.text ? `<p>${md(c.text)}</p>` : "");
  const tone = c.tone && c.tone !== "neutral" ? c.tone : "";
  if (variant === "framed") return `<div class="card ${tone}"><div class="who">${esc(c.label || "")}</div><h3>${esc(c.title)}</h3>${body}
    ${c.facts ? `<div class="facts">${c.facts.map((x) => `<div><div class="k">${esc(x.label)}</div><div class="v">${md(x.text)}</div></div>`).join("")}</div>` : ""}</div>`;
  if (variant === "value") return `<div class="card ${tone}"><div class="shout v">${esc(c.value)}</div><h3>${md(c.title)}</h3>${body}</div>`;
  return `<div class="card ${tone}"><div class="ic"><i data-lucide="${esc(c.icon)}"></i></div><h3>${md(c.title)}</h3>${body}</div>`;
}

/* Body per menu entry. The variant (layout) comes from the registry, never from the agent. */
const BODY = {
  chart: (s, v) => v === "split"
    ? `<div class="split grow"><div class="chart" data-chart></div>${notesHTML(s.notes)}</div>`
    : `<div class="chart full grow" data-chart></div>`,
  table: (s, v) => v === "split"
    ? `<div class="split with-table"><div>${tableHTML(s.table)}</div>${notesHTML(s.notes)}</div>`
    : tableHTML(s.table),
  number: (s) => {
    const num = `<div><p class="shout hero-v ${s.number.tone || ""}">${esc(s.number.value)}</p><p class="hero-c">${md(s.number.caption)}</p></div>`;
    return s.body?.length ? `<div class="hero"><div class="prose">${s.body.map((p) => `<p>${md(p)}</p>`).join("")}</div>${num}</div>` : `<div class="hero solo">${num}</div>`;
  },
  steps: (s) => `<div class="steps">${s.steps.map((r) => `
    <span class="t">${esc(r.when)}</span>
    <div class="d ${r.focus ? "row-focus" : ""}"><span class="h">${esc(r.title)}</span><span>${md(r.text)}</span></div>`).join("")}</div>`,
  cards: (s, v) => `<div class="cards ${v} ${v === "framed" ? "grow" : `n-${s.cards.length}`}">${s.cards.map((c) => cardHTML(c, v)).join("")}</div>`,
};

/** Deck context per slide: page number, section number and the default kicker. */
export function contexts(deck) {
  let section = 0, sectionTitle = "";
  return deck.slides.map((s, i) => {
    if (s.template === "section") { section += 1; sectionTitle = s.title; }
    return { page: i + 1, section, kicker: sectionTitle ? `${pad2(section)} · ${sectionTitle}` : "", footer: deck.footer || "" };
  });
}

export function slideHTML(s, ctx, deck) {
  const entry = MENU[s.template], variant = entry.variant(s);
  let body;
  if (s.template === "cover") {
    body = `<div class="cover-mark"></div><h1 class="title">${display(s.title)}</h1><p class="cover-sub">${md(s.subtitle)}</p>`;
  } else if (s.template === "section") {
    // The subtitle box is always there: it holds its 2 lines, so the number and title sit still across dividers.
    body = `<p class="shout sec-n">${pad2(ctx.section)}</p><h2 class="title">${esc(s.title)}</h2><p class="sec-sub">${s.subtitle ? md(s.subtitle) : ""}</p>`;
  } else {
    // The head holds its longest form (L3), so the body starts on one line per style. The consulting
    // kicker line is kept even when empty, so the title does not move up on slides without one.
    const head = deck.style === "consulting"
      ? `<div class="label">${esc(s.kicker || ctx.kicker)}</div><h2 class="title">${display(s.title)}</h2>`
      : `<h2 class="title">${display(s.title)}</h2>${s.subtitle ? `<p class="subtitle">${display(s.subtitle)}</p>` : ""}`;
    body = `<header class="head">${head}</header>`
      + BODY[s.template](s, variant)
      + (s.takeaway ? `<div class="spacer"></div><p class="takeaway">${md(s.takeaway)}</p>` : "");
  }
  const fn = [s.footnote && `<p>${md(s.footnote)}</p>`, s.source && `<p>Source: ${md(s.source)}</p>`].filter(Boolean).join("");
  const rail = s.template === "cover" ? "" : `<div class="rail"><div class="fn">${fn}</div><div class="pg">${esc(ctx.footer)}<b>${pad2(ctx.page)}</b></div></div>`;
  return `<section class="slide t-${s.template} v-${variant} style-${deck.style} theme-${deck.theme}">${body}${rail}</section>`;
}

/** Render one slide into a frame element, scaled to the frame's width. */
export function mountSlide(frame, s, ctx, deck) {
  frame.innerHTML = slideHTML(s, ctx, deck);
  const slide = frame.firstElementChild;
  slide.style.setProperty("--s", frame.clientWidth / 1920);
  // Every colour on the slide comes from the allocator; the palette CSS only holds the defaults.
  const colours = allocate(s, deck.theme, deck.accent);
  for (const [k, v] of Object.entries(colours.vars)) slide.style.setProperty(`--${k}`, v);
  fitValues(slide);
  sizeTable(slide); growTable(slide);
  const host = slide.querySelector("[data-chart]");
  if (host) drawChart(host, s.chart, (s.notes || []).map((n, k) => n.point && { n: k + 1, ...n.point }).filter(Boolean), colours);
  if (window.lucide) window.lucide.createIcons({ attrs: { "stroke-width": 1.5 } });
  return slide;
}

/* L1: the label column takes its natural width within 20–40%; fixed layout splits the rest equally. */
function sizeTable(slide) {
  const tbl = slide.querySelector(".tbl");
  if (!tbl) return;
  tbl.classList.add("measuring");
  const natural = Math.max(...[...tbl.querySelectorAll("tr > :first-child")].map((c) => c.scrollWidth));
  tbl.classList.remove("measuring");
  // +2px: at exactly its natural width, subpixel rounding can wrap the label.
  const share = Math.min(.4, Math.max(.2, (natural + 2) / tbl.clientWidth));
  tbl.querySelector("col").style.width = `${(share * 100).toFixed(2)}%`;
}

/* L5: a full-width table under 60% of the body grows its rows, up to 1.5× its natural height. */
function growTable(slide) {
  const tbl = slide.matches(".t-table.v-full") && slide.querySelector(":scope > .tbl");
  if (!tbl) return;
  // The slide is scaled with a transform: measure in slide pixels.
  const R = slide.getBoundingClientRect(), k = R.width / 1920, top = (el) => (el.getBoundingClientRect().top - R.top) / k;
  const bottom = 1080 - parseFloat(getComputedStyle(slide).paddingBottom), tk = slide.querySelector(".takeaway");
  const area = (tk ? top(tk) - 40 : bottom) - top(tbl), natural = tbl.getBoundingClientRect().height / k;
  if (natural < area * .6) tbl.style.height = `${Math.min(area * .6, natural * 1.5)}px`;
}

/* Big values in a row shrink together (to 75% at most) so the widest fits. */
function fitValues(slide) {
  for (const sel of [".cards.value .v", ".hero-v"]) {
    const els = [...slide.querySelectorAll(sel)];
    const k = Math.min(1, ...els.map((e) => e.clientWidth / e.scrollWidth));
    if (k < 1) els.forEach((e) => { e.style.fontSize = `${parseFloat(getComputedStyle(e).fontSize) * Math.max(k, .75)}px`; });
  }
}
