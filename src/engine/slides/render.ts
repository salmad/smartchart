/* Renderer: slide JSON -> HTML at 1920×1080. Shared by the app, the review page and the tests. */
import { MENU, NOTE_POINTS } from "./schema.js";
import type { Deck, Slide, SlideContext, Table, TemplateId } from "../types.js";
import { drawChart } from "../components/charts/chart.js";
import { allocate } from "./colours.js";
import { roomOf } from "./groups.js";
import { at, capHTML, display, esc, md, pad2 } from "../components/text.js";
import { imgHTML, teamHTML, wallHTML } from "../components/pictures.js";
import { tableHTML } from "../components/table.js";
import { cardsHTML } from "../components/cards.js";
import { splitHTML } from "../components/notes.js";
import { stepsHTML, summaryHTML } from "../components/rows.js";
import { pairHTML } from "../components/pair.js";
import { alignHalves, drawIcons, fitPictures, fitValues, sizeTable, stackIcons } from "../components/fit.js";

/** Each link to a slide gets that slide's page now; a link to a slide no longer in the deck shows its words alone. */
const pageRefs = (html: string, pages: Record<string, number> | undefined) =>
  html.replace(/<span class="ref" data-ref="([\w-]+)"><\/span>/g, (all, id: string) => (pages?.[id] ? `<span class="ref" data-ref="${id}" data-page="${pad2(pages[id])}"></span>` : all))

/* Body per menu entry. The variant (layout) comes from the registry, never from the agent. */
const table = (s: Slide): Table => s.table ?? { columns: [], rows: [] };
const BODY: Record<Exclude<TemplateId, "cover" | "section" | "number" | "quote" | "agenda">, (s: Slide, variant: string) => string> = {
  chart: (s, v) => v === "split"
    ? splitHTML(s, `<div class="chart" data-chart></div>`, "grow", "")
    : `${s.caption ? capHTML(s.caption, "", "caption") : ""}<div class="chart full grow" data-chart></div>`,
  table: (s, v) => v === "split"
    ? splitHTML(s, tableHTML(table(s), "table", true, "split"), "with-table", "")
    : `${s.caption ? capHTML(s.caption, "", "caption") : ""}${tableHTML(table(s), "table", true, roomOf(table(s), false))}`,
  steps: (s) => stepsHTML(s.steps ?? [], ""),
  pair: (s) => pairHTML(s.halves ?? [], ""),
  summary: (s) => summaryHTML(s.points ?? [], ""),
  image: (s, v) => v === "split"
    ? splitHTML(s, imgHTML(s.image, "pic", "image"), "grow with-pic", "")
    : `${s.caption ? capHTML(s.caption, "", "caption") : ""}${imgHTML(s.image, "pic grow", "image")}`,
  team: (s, v) => teamHTML(s.people ?? [], v, ""),
  logos: (s) => `${s.caption ? capHTML(s.caption, "", "caption") : ""}${wallHTML(s.logos ?? [], "")}`,
  cards: (s, v) => cardsHTML(s.cards ?? [], v, s.arrange, ""),
};

/** Deck context per slide: page number, section number and the default kicker. */
export function contexts(deck: Pick<Deck, "slides" | "footer" | "ids">): SlideContext[] {
  let section = 0, sectionTitle = "";
  const pages = deck.ids?.length === deck.slides.length ? Object.fromEntries(deck.ids.map((id, i) => [id, i + 1])) : undefined;
  const sections = deck.slides.filter((s) => s.template === "section").map((s) => ({ title: s.title, ...(s.subtitle ? { subtitle: s.subtitle } : {}) }));
  return deck.slides.map((s, i) => {
    if (s.template === "section") { section += 1; sectionTitle = s.title; }
    return { page: i + 1, section, kicker: sectionTitle ? `${pad2(section)} · ${sectionTitle}` : "", footer: deck.footer || "", sections, ...(pages ? { pages } : {}) };
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
  } else if (s.template === "agenda") {
    // The deck's chapters, from its dividers. After chapter k the next one is highlighted and the covered ones go quiet; after
    // the last chapter (or before the first) the list is plain.
    const list = ctx.sections ?? [], next = ctx.section >= 1 && ctx.section < list.length ? ctx.section + 1 : 0;
    body = `<h2 class="title"${at("title", "esc")}>${esc(s.title || "Agenda")}</h2>` + (list.length
      ? `<ol class="agenda${list.length > 5 ? " many" : ""}">${list.map((x, i) => `<li class="${i + 1 === next ? "next" : i + 1 < next ? "done" : ""}"><span class="n">${pad2(i + 1)}</span><span class="t">${esc(x.title)}</span>${x.subtitle ? `<span class="s">${md(x.subtitle)}</span>` : ""}</li>`).join("")}</ol>`
      : `<p class="agenda-empty">No chapters yet. Add chapter dividers and they are listed here, numbered, in order.</p>`);
  } else if (s.template === "number") {
    // No title: the number and its sentence are the slide (the sentence is its line in the storyline).
    const n = s.number ?? { value: "", caption: "" };
    body = `<p class="shout big-v ${n.tone && n.tone !== "focus" ? n.tone : ""}"${at("number.value", "esc")}>${esc(n.value)}</p><p class="big-c"${at("number.caption", "md")}>${md(n.caption)}</p>`;
  } else if (s.template === "quote") {
    body = `<p class="q-mark" aria-hidden="true">“</p><p class="q-text"${at("quote", "md")}>${md(s.quote ?? "")}</p><p class="q-who"${at("who", "esc")}>${esc(s.who ?? "")}</p>`;
  } else {
    // The head holds its longest form (L3), so the body starts on one line per style. The consulting
    // kicker sits in the top margin (slides.css), so the title starts at the margin with or without one.
    const head = deck.style === "consulting"
      ? `<div class="label"${at("kicker", "esc")}>${esc(s.kicker || ctx.kicker)}</div><h2 class="title"${at("title", "display")}>${display(s.title)}</h2>`
      : `<h2 class="title"${at("title", "display")}>${display(s.title)}</h2>${s.subtitle ? `<p class="subtitle"${at("subtitle", "display")}>${display(s.subtitle)}</p>` : ""}`;
    body = `<header class="head">${head}</header>`
      + BODY[s.template as keyof typeof BODY](s, variant)
      + (s.takeaway ? `<div class="spacer"></div><p class="takeaway"${at("takeaway", "md")}>${md(s.takeaway)}</p>` : "");
  }
  const fn = [s.footnote && `<p${at("footnote", "md")}>${md(s.footnote)}</p>`, s.source && `<p>Source: <span${at("source", "md")}>${md(s.source)}</span></p>`].filter(Boolean).join("");
  const rail = s.template === "cover" ? "" : `<div class="rail"><div class="fn">${fn}</div><div class="pg">${esc(ctx.footer)}<b>${pad2(ctx.page)}</b></div></div>`;
  return pageRefs(`<section class="slide t-${s.template} v-${variant} style-${deck.style} theme-${deck.theme}">${body}${rail}</section>`, ctx.pages);
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
  // The fitters measure in slide pixels: the slide's drawn width over its 1920.
  const k = slide.getBoundingClientRect().width / 1920;
  fitValues(slide);
  sizeTable(slide, k); stackIcons(slide, k); growTable(slide);
  // A chart slide has one host; a pair has two, each its own chart with its own colours.
  slide.querySelectorAll<HTMLElement>("[data-chart]").forEach((host) => {
    const i = host.dataset.chart, spec = i ? s.halves?.[Number(i)]?.chart : s.chart;
    if (!spec) return;
    if (!i) return drawChart(host, spec, NOTE_POINTS ? (s.notes || []).flatMap((n, k) => (n.point ? [{ n: k + 1, ...n.point }] : [])) : [], colours);
    const own = allocate({ ...s, template: "chart", chart: spec }, deck.theme, deck.accent);
    for (const [k, v] of Object.entries(own.vars)) host.style.setProperty(`--${k}`, v);
    drawChart(host, spec, [], own);
  });
  drawIcons(slide); growCards(slide); fitPictures(slide, k); alignHalves(slide, k);
  return slide;
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

/* L5 for cards: icon, logo and value cards grow towards the bottom of the body (or the takeaway), up to 1.5× their natural
   height, so their column rules run down the slide like a table's rows instead of stopping halfway. After the icons are
   drawn: they are part of the natural height. */
function growCards(slide: HTMLElement) {
  const cards = slide.querySelector<HTMLElement>(":scope > .cards:not(.framed)");
  if (!cards) return;
  const R = slide.getBoundingClientRect(), k = R.width / 1920, top = (el: Element) => (el.getBoundingClientRect().top - R.top) / k;
  const bottom = 1080 - parseFloat(getComputedStyle(slide).paddingBottom), tk = slide.querySelector(".takeaway");
  const room = () => (tk ? top(tk) - 40 : bottom) - top(cards), natural0 = () => cards.getBoundingClientRect().height / k;
  // Numbers sit above their titles while the slide has room, and beside them when it has not.
  if (cards.classList.contains("numbered") && natural0() > room() + 1) cards.classList.add("inline");
  const area = room(), natural = natural0();
  if (natural < area) cards.style.height = `${Math.min(area, natural * 1.5)}px`;
}
