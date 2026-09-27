/* Measurements on a rendered slide: fit issues and layout lints. */
import { MIN_MARK, contrast } from "./colours";
import type { Style } from "../types";

/* ═════════════ Fit check (prototype): measures the rendered slide at 1920×1080 ═════════════ */
export function fitIssues(slide: HTMLElement, style: Style): string[] {
  const R = slide.getBoundingClientRect(), k = R.width / 1920, cs = getComputedStyle(slide);
  const box = (el: Element) => { const r = el.getBoundingClientRect(); return { l: (r.left - R.left) / k, r: (r.right - R.left) / k, t: (r.top - R.top) / k, b: (r.bottom - R.top) / k }; };
  // SVG elements have an SVGAnimatedString className: name them by tag.
  const name = (el: Element) => (typeof el.className !== "string" ? el.tagName : (el.className || el.tagName).split(" ")[0]);
  const lines = (el: Element, pad = 0) => Math.round((el.clientHeight - pad) / parseFloat(getComputedStyle(el).lineHeight));
  const bottom = 1080 - parseFloat(cs.paddingBottom), right = 1920 - parseFloat(cs.paddingRight), out: string[] = [];
  for (const el of slide.children) {
    if (el.classList.contains("rail")) continue;
    const b = box(el);
    if (b.b > bottom + 1) { out.push(`${name(el)} runs ${Math.round(b.b - bottom)}px into the bottom margin; shorten the body or drop the takeaway`); break; }
    if (b.r > right + 1) out.push(`${name(el)} runs ${Math.round(b.r - right)}px into the right margin`);
  }
  slide.querySelectorAll(".notes, .cards.framed .card, .card, .hero > div, .sec-n, .hero-v, .cards .v, .title").forEach((el) => {
    if (el.scrollHeight > el.clientHeight + 1 && getComputedStyle(el).overflow !== "visible") out.push(`${name(el)} content is taller than its box`);
    if (el.scrollWidth > el.clientWidth + 1) out.push(`${name(el)} “${(el.textContent ?? "").trim().slice(0, 24)}” is wider than its column`);
  });
  slide.querySelectorAll(".notes, .cards.framed .card").forEach((el) => { const last = el.lastElementChild, pb = parseFloat(getComputedStyle(el).paddingBottom);
    if (last && box(last).b > box(el).b - pb + 1) out.push(`${name(el)} content runs ${Math.round(box(last).b - box(el).b + pb)}px past its box`); });
  const title = slide.querySelector("h2.title, h1.title");
  // Section titles hold one line so the section number sits still across dividers.
  const maxTitle = slide.matches(".t-section") || (style === "pitch" && !slide.matches(".t-cover")) ? 1 : 2;
  if (title && lines(title) > maxTitle) out.push(`title wraps to ${lines(title)} lines (max ${maxTitle}); shorten it`);
  const sub = slide.querySelector(".subtitle");
  // A pitch content subtitle is one line: the head reserves one, so the body starts right below it.
  const maxSub = style === "pitch" && !slide.matches(".t-cover, .t-section") ? 1 : 2;
  if (sub && lines(sub) > maxSub) out.push(`subtitle wraps to ${lines(sub)} lines (max ${maxSub}); shorten it`);
  // The caption and the notes heading hold one line, so both columns keep one header row.
  slide.querySelectorAll(".cap:not(.blank)").forEach((el) => {
    const field = el.classList.contains("notes-h") ? "notesTitle" : "caption", n = lines(el, 16);
    if (n > 1) out.push(`${field} wraps to ${n} lines (max 1); shorten it`);
  });
  const tk = slide.querySelector(".takeaway");
  if (tk && lines(tk, 12) > 1) out.push(`takeaway wraps to ${lines(tk, 12)} lines; it must fit on one`);
  const fn = slide.querySelector(".rail .fn");
  if (fn && fn.textContent && box(fn).t < 1080 - 48 - 2 * 24 - 2) out.push("footnote + source take more than two lines");
  return out;
}

/* Layout lints (spec 3.6), measured on the rendered slide in slide pixels. Messages start with the
   part of the slide they are about and end with the rule id. L5 (body fill) is a warning: some approved
   slides leave room on purpose. */
export interface LayoutLints { issues: string[]; warnings: string[] }
export function layoutLints(slide: HTMLElement, _style: Style): LayoutLints {
  const R = slide.getBoundingClientRect(), k = R.width / 1920, out: string[] = [], warnings: string[] = [];
  const box = (el: Element) => { const r = el.getBoundingClientRect(); return { t: (r.top - R.top) / k, b: (r.bottom - R.top) / k, w: r.width / k, h: r.height / k }; };
  const spread = (xs: number[]) => (xs.length > 1 ? Math.max(...xs) - Math.min(...xs) : 0);

  const tbl = slide.querySelector(".tbl");
  if (tbl) {
    const ths = [...tbl.querySelectorAll("thead th")].map((th) => box(th).w), d = spread(ths.slice(1));
    if (d > 1) out.push(`table: data columns differ by ${Math.round(d)}px; they must be equal (L1)`);
    const share = ths[0] / box(tbl).w;
    if (share < .195 || share > .405) out.push(`table: the label column is ${Math.round(share * 100)}% of the table; it must be 20–40% (L1)`);
  }

  // L3: the body starts on one line per style: top padding + the head's reserved height + the gap.
  const head = slide.querySelector(":scope > .head"), body = head?.nextElementSibling;
  if (body && !body.matches(".spacer, .rail")) {
    const cs = getComputedStyle(slide), line = parseFloat(cs.paddingTop) + parseFloat(getComputedStyle(head).minHeight) + parseFloat(cs.getPropertyValue("--body-gap"));
    if (Math.abs(box(body).t - line) > 2) out.push(`body: starts at ${Math.round(box(body).t)}px; it must start at ${Math.round(line)}px (L3). Shorten the title or subtitle.`);
  }

  const main = slide.querySelector(".t-table.v-full > .tbl, :scope > .cards:not(.framed), :scope > .steps")
    || (slide.matches(".t-table.v-full") ? slide.querySelector(":scope > .tbl") : null);
  if (main) {
    const bottom = 1080 - parseFloat(getComputedStyle(slide).paddingBottom), tk = slide.querySelector(".takeaway");
    const end = tk ? box(tk).t - 40 : bottom, b = box(main), fill = b.h / (end - b.t);
    const what = main.matches(".tbl") ? "table" : main.matches(".steps") ? "steps" : "cards";
    if (fill < .6) warnings.push(`body: ${Math.round((1 - fill) * 100)}% empty below the ${what}; add content or a takeaway, or use another template (L5)`);
  }

  const cards = [...slide.querySelectorAll(".cards > .card")].map((c) => box(c).h);
  if (spread(cards) > 1) out.push(`cards: heights differ by ${Math.round(spread(cards))}px; parallel cards share one size (L6)`);
  const steps = [...slide.querySelectorAll(".steps > .d")].map((d) => box(d).h);
  if (spread(steps) > 1) out.push(`steps: row heights differ by ${Math.round(spread(steps))}px (L6)`);
  out.push(...chartLabelLints(slide), ...colourLints(slide));
  return { issues: out, warnings };
}

/* Chart labels (spec 4.2a): none leaves the chart area and no two overlap. */
export function chartLabelLints(slide: HTMLElement): string[] {
  const host = slide.querySelector("[data-chart]");
  if (!host) return [];
  const R = slide.getBoundingClientRect(), k = R.width / 1920;
  const box = (el: Element) => { const r = el.getBoundingClientRect(); return { l: (r.left - R.left) / k, r: (r.right - R.left) / k, t: (r.top - R.top) / k, b: (r.bottom - R.top) / k }; };
  const H = box(host), out: string[] = [], labels = [...host.querySelectorAll(".plot > .lbl")].map((el) => ({ el, r: box(el) }));
  const what = (el: Element) => `“${(el.textContent ?? "").trim().slice(0, 20)}”`;
  labels.forEach(({ el, r }) => { if (r.l < H.l - 2 || r.r > H.r + 2 || r.t < H.t - 2 || r.b > H.b + 2) out.push(`chart: label ${what(el)} runs outside the chart area (C1)`); });
  for (let i = 0; i < labels.length; i++) for (let j = i + 1; j < labels.length; j++) {
    const [a, b] = [labels[i].r, labels[j].r];
    if (a.l < b.r - 1 && b.l < a.r - 1 && a.t < b.b - 1 && b.t < a.b - 1) out.push(`chart: labels ${what(labels[i].el)} and ${what(labels[j].el)} overlap (C1)`);
  }
  return out;
}

const hex = (css: string) => { const m = css.match(/[\d.]+/g); return m ? `#${m.slice(0, 3).map((v) => Math.round(+v).toString(16).padStart(2, "0")).join("")}` : null; };

/* R15: the colours Chrome painted. Different slots never share a colour; every mark has 3:1 against the
   background, except quiet bars, which must each carry a value label (colour spec C4). */
export function colourLints(slide: HTMLElement): string[] {
  const out: string[] = [], bg = hex(getComputedStyle(slide).backgroundColor) ?? "#000000", bySlot = new Map<string, { slot: string; colour: string }>();
  // Series marks are keyed by series (two series must differ even if code gave them one slot); other marks by slot.
  slide.querySelectorAll<SVGElement>("[data-chart] :is(.bar, .ln, .wf, .tl-bar)").forEach((el) => {
    const slot = [...el.classList].find((c) => c.startsWith("c-"));
    if (!slot) return;
    const key = el.dataset.series !== undefined ? `series ${el.dataset.series}` : slot.slice(2);
    const cs = getComputedStyle(el), colour = hex(el.classList.contains("ln") ? cs.stroke : cs.fill);
    if (colour && !bySlot.has(key)) bySlot.set(key, { slot, colour });
  });
  const seen = new Map<string, string>();
  for (const [key, { slot, colour }] of bySlot) {
    if (seen.has(colour)) out.push(`colours: ${key} and ${seen.get(colour)} are both ${colour}; different things never share a colour (R15)`);
    seen.set(colour, key);
    if (contrast(colour, bg) < MIN_MARK) {
      const bars = slide.querySelectorAll(`.bar.${slot}`).length, labels = slide.querySelectorAll(`.v-lbl.${slot}`).length;
      if (slot !== "c-quiet" || labels < bars) out.push(`colours: ${slot.slice(2)} ${colour} has ${contrast(colour, bg).toFixed(1)}:1 on the background and ${labels} of ${bars} values labelled (R15)`);
    }
  }
  const marks = [".hl-focus", ".hl-neg", ".hl-pos"].map((sel) => slide.querySelector(sel)).flatMap((el) => (el ? [hex(getComputedStyle(el).color)] : []));
  if (new Set(marks).size < marks.length) out.push("colours: focus, loss and gain highlights share a colour (R15)");
  return out;
}
