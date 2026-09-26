/* Renderer: slide JSON -> HTML at 1920×1080. Shared by the review page and the journey prototype. */
import { MENU } from "./schema.js";

export const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
export const md = (s) => esc(s)
  .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
  .replace(/\[\[(.+?)\]\]/g, '<span class="hl-focus">$1</span>')
  .replace(/\[-(.+?)-\]/g, '<span class="hl-neg">$1</span>')
  .replace(/\[\+(.+?)\+\]/g, '<span class="hl-pos">$1</span>');
const pad2 = (n) => String(n).padStart(2, "0");
const list = (items) => `<ul class="bullets">${items.map((b) => `<li>${md(b)}</li>`).join("")}</ul>`;

const notesHTML = (notes) => `<div class="notes">${notes.map((n, i) => `<div class="note"><span class="n">${pad2(i + 1)}</span>
  <div><h4>${md(n.title)}</h4>${n.text ? `<p>${md(n.text)}</p>` : ""}</div></div>`).join("")}</div>`;

function tableHTML(t) {
  const cls = (c) => [c.num ? "num" : "", c.focus ? "focus" : ""].join(" ");
  const cell = (c, i) => { const v = typeof c === "object" ? c : { value: c };
    return `<td class="${cls(t.columns[i] || {})}">${esc(v.value)}${v.note ? `<small>${esc(v.note)}</small>` : ""}</td>`; };
  return `<table class="tbl"><thead><tr>${t.columns.map((c) => `<th class="${cls(c)}">${esc(c.label)}</th>`).join("")}</tr></thead>
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
    body = `<div class="cover-mark"></div><h1 class="title">${md(s.title)}</h1><p class="cover-sub">${md(s.subtitle)}</p>`;
  } else if (s.template === "section") {
    body = `<p class="shout sec-n">${pad2(ctx.section)}</p><h2 class="title">${esc(s.title)}</h2>${s.subtitle ? `<p class="sec-sub">${md(s.subtitle)}</p>` : ""}`;
  } else {
    const kicker = deck.style === "consulting" ? s.kicker || ctx.kicker : "";
    body = (kicker ? `<div class="label">${esc(kicker)}</div>` : "")
      + `<h2 class="title">${md(s.title)}</h2>`
      + (deck.style === "pitch" && s.subtitle ? `<p class="subtitle">${md(s.subtitle)}</p>` : "")
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
  fitValues(slide);
  const host = slide.querySelector("[data-chart]");
  if (host) drawChart(host, s.chart, (s.notes || []).map((n, k) => n.point && { n: k + 1, ...n.point }).filter(Boolean));
  if (window.lucide) window.lucide.createIcons({ attrs: { "stroke-width": 1.5 } });
  return slide;
}

/* ═════════════ Charts ═════════════ */
const niceStep = (raw) => { const p = 10 ** Math.floor(Math.log10(raw)), m = raw / p; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p; };
const fmt = (tpl = "{v}", v) => tpl.replace("{v}", Number.isInteger(v) ? v : v.toFixed(1));
const lbl = (cls, x, y, a, html) => `<span class="lbl a-${a} ${cls}" style="left:${x}px;top:${y}px">${html}</span>`;
const topRounded = (x, y, w, h, r) => { r = Math.min(r, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`; };

export function drawChart(host, spec, markers = []) {
  const legend = spec.type === "bars" ? `<div class="legend">${spec.series.map((s) =>
    `<span class="c-${s.color}"><i class="${s.line ? "line" : ""}"></i>${esc(s.name)}</span>`).join("")}</div>` : "";
  host.innerHTML = `${legend}<div class="plot"></div>`;
  const box = host.querySelector(".plot"), W = box.clientWidth, H = box.clientHeight;
  (spec.type === "bars" ? bars : lines)(box, spec, W, H, markers);
}

// Grouped bars with an optional line on its own scale. No axes: values are written on the data.
function bars(box, spec, W, H, markers) {
  const B = spec.series.filter((s) => !s.line), L = spec.series.filter((s) => s.line);
  const P = { t: 96, b: 44 }, ph = H - P.t - P.b, n = spec.categories.length, band = W / n;
  const bMax = Math.max(...B.flatMap((s) => s.values)), lMax = L.length ? Math.max(...L.flatMap((s) => s.values)) : 1;
  const yb = (v) => P.t + ph - (v / bMax) * ph * .86, yl = (v) => P.t + ph - (v / lMax) * ph;
  const gw = band * .56, bw = gw / B.length, xc = (i) => band * i + band / 2;
  let g = `<line class="base" x1="0" x2="${W}" y1="${P.t + ph}" y2="${P.t + ph}"/>`, t = "";
  const pos = spec.series.map(() => []);
  spec.categories.forEach((c, i) => { t += lbl("cat", xc(i), P.t + ph + 16, "tc", esc(c)); });
  spec.series.forEach((s, si) => {
    if (s.line) return;
    const j = B.indexOf(s), f = s.format || spec.format;
    s.values.forEach((v, i) => {
      const x = xc(i) - gw / 2 + j * bw + 4, w = bw - 8, top = yb(v), h = P.t + ph - top;
      if (h > .5) g += `<path class="bar c-${s.color}" d="${topRounded(x, top, w, h, 6)}"/>`;
      if (s.color === "focus" || i === n - 1) t += lbl(`v-lbl c-${s.color}`, x + w / 2, top - 10, "bc", fmt(f, v));
      pos[si][i] = [x + w / 2, top - 34];
    });
  });
  spec.series.forEach((s, si) => {
    if (!s.line) return;
    const pts = s.values.map((v, i) => [xc(i), yl(v)]);
    g += `<path class="ln c-${s.color}" d="${pts.map((p, i) => `${i ? "L" : "M"}${p[0]},${p[1]}`).join("")}"/>`;
    pts.forEach(([x, y], i) => { g += `<circle class="pt c-${s.color}" cx="${x}" cy="${y}" r="7"/>`;
      t += lbl(`v-lbl on-line c-${s.color}`, x, y - 16, "bc", fmt(s.format || spec.format, s.values[i])); pos[si][i] = [x, y - 40]; });
  });
  markers.forEach((m) => { const p = pos[m.series]?.[m.index]; if (!p) return; const [x, y] = p;
    g += `<line class="leader" data-n="${m.n}" x1="${x}" x2="${x}" y1="${y - 26}" y2="${y + 2}"/>`;
    t += lbl("mk", x, y - 46, "mc", m.n).replace("<span", `<span data-n="${m.n}"`); });
  box.innerHTML = `<svg width="${W}" height="${H}">${g}</svg>${t}`;
  thinCategories(box);
  declutter(box);
}

// Lines with dashed gridlines and big direct end labels instead of a legend.
function lines(box, spec, W, H) {
  const P = { t: 20, r: 250, b: 48 }, pw = W - P.r, ph = H - P.t - P.b, n = spec.categories.length;
  const max = Math.max(...spec.series.flatMap((s) => s.values)), step = niceStep(max / 3), top = Math.ceil(max / step) * step;
  const x = (i) => (i / (n - 1)) * pw, y = (v) => P.t + ph - (v / top) * ph;
  let g = `<defs><linearGradient id="gA" x1="0" x2="0" y1="0" y2="1"><stop class="area-top" offset="0"/><stop class="area-bot" offset="1"/></linearGradient></defs>`, t = "";
  for (let v = step; v <= top; v += step) { g += `<line class="grid" x1="0" x2="${pw}" y1="${y(v)}" y2="${y(v)}"/>`; t += lbl("tick", 0, y(v) - 10, "tl", fmt(spec.format, v)); }
  g += `<line class="base" x1="0" x2="${pw}" y1="${y(0)}" y2="${y(0)}"/>`;
  spec.categories.forEach((c, i) => { t += lbl("cat", x(i), y(0) + 16, i === 0 ? "tc0" : "tc", esc(c)); });
  // End labels: stacked apart when two series end at similar values (spec 4.2a).
  const ends = spec.series.map((s, i) => ({ i, y: y(s.values.at(-1)) })).sort((a, b) => a.y - b.y);
  for (let k = 1; k < ends.length; k++) if (ends[k].y - ends[k - 1].y < 96) ends[k].y = ends[k - 1].y + 96;
  const endY = Object.fromEntries(ends.map((e) => [e.i, e.y]));
  spec.series.forEach((s, si) => {
    const pts = s.values.map((v, i) => [x(i), y(v)]), d = pts.map((p, i) => `${i ? "L" : "M"}${p[0]},${p[1]}`).join("");
    if (s.area) g += `<path d="${d}L${pw},${y(0)}L0,${y(0)}Z" fill="url(#gA)"/>`;
    g += `<path class="ln c-${s.color} ${s.dashed ? "dashed" : ""}" d="${d}"/>`;
    const [lx, ly] = pts.at(-1);
    g += `<circle class="pt solid c-${s.color}" cx="${lx}" cy="${ly}" r="10"/>`;
    t += `<div class="lbl end c-${s.color}" style="left:${lx + 32}px;top:${endY[si]}px"><b>${fmt(s.format || spec.format, s.values.at(-1))}</b><span>${esc(s.name)}</span></div>`;
  });
  box.innerHTML = `<svg width="${W}" height="${H}">${g}</svg>${t}`;
  thinCategories(box);
}

/* Label placement runs on the rendered plot, in plot pixels (the slide itself is scaled). */
function plotRects(box) {
  const B = box.getBoundingClientRect(), k = B.width / box.clientWidth;
  return (el) => { const r = el.getBoundingClientRect();
    return { l: (r.left - B.left) / k, r: (r.right - B.left) / k, t: (r.top - B.top) / k, b: (r.bottom - B.top) / k }; };
}
const hits = (a, b, gap) => a.l < b.r + gap && b.l < a.r + gap && a.t < b.b + gap && b.t < a.b + gap;

/* Category labels: show every k-th one counting back from the last, with the smallest k that keeps a clear gap. */
function thinCategories(box) {
  const cats = [...box.querySelectorAll(".cat")], rect = plotRects(box), rs = cats.map(rect);
  for (let k = 1; k < cats.length; k++) {
    const shown = (i) => (cats.length - 1 - i) % k === 0, kept = cats.map((_, i) => i).filter(shown);
    if (kept.every((i, j) => !j || rs[i].l >= rs[kept[j - 1]].r + 28)) { cats.forEach((c, i) => { if (!shown(i)) c.remove(); }); return; }
  }
}

/* Value labels, then markers, move up until they clear everything placed before them.
   Labels clear points, other bars and earlier labels; markers also clear the line itself.
   A moved marker keeps its leader down to the bar. */
function declutter(box) {
  const rect = plotRects(box), placed = [...box.querySelectorAll(".pt")].map(rect), line = [];
  const bars = [...box.querySelectorAll(".bar")].map(rect);
  box.querySelectorAll(".ln").forEach((ln) => { for (let d = 0, L = ln.getTotalLength(); d <= L; d += 12) {
    const p = ln.getPointAtLength(d); line.push({ l: p.x - 3, r: p.x + 3, t: p.y - 3, b: p.y + 3 }); } });
  const settle = (el, gap, obstacles) => {
    let r = rect(el), moved = 0;
    for (let n = 0; n < 40; n++) {
      const hit = obstacles.find((o) => hits(r, o, gap));
      if (!hit) break;
      const d = r.b - hit.t + gap;
      el.style.top = `${parseFloat(el.style.top) - d}px`; moved += d; r = { ...r, t: r.t - d, b: r.b - d };
    }
    placed.push(r);
    return moved;
  };
  const cx = (r) => (r.l + r.r) / 2;
  [...box.querySelectorAll(".v-lbl")].sort((a, b) => b.classList.contains("c-focus") - a.classList.contains("c-focus")).forEach((el) => {
    // A bar label may touch its own bar; a line label clears every bar.
    const r = rect(el), mine = (b) => !el.classList.contains("on-line") && b.l <= cx(r) && cx(r) <= b.r;
    const obstacles = [...placed, ...bars.filter((b) => !mine(b))];
    // A neutral bar's value is context: drop it rather than float it away from its bar.
    if (el.classList.contains("c-neutral") && obstacles.some((o) => hits(r, o, 4))) el.remove();
    else settle(el, 4, obstacles);
  });
  box.querySelectorAll(".mk").forEach((mk) => { const moved = settle(mk, 6, [...placed, ...bars, ...line]);
    const ld = box.querySelector(`.leader[data-n="${mk.dataset.n}"]`); if (moved) ld.setAttribute("y1", +ld.getAttribute("y1") - moved); });
}

/* Big values in a row shrink together (to 75% at most) so the widest fits. */
function fitValues(slide) {
  for (const sel of [".cards.value .v", ".hero-v"]) {
    const els = [...slide.querySelectorAll(sel)];
    const k = Math.min(1, ...els.map((e) => e.clientWidth / e.scrollWidth));
    if (k < 1) els.forEach((e) => { e.style.fontSize = `${parseFloat(getComputedStyle(e).fontSize) * Math.max(k, .75)}px`; });
  }
}

/* ═════════════ Fit check (prototype): measures the rendered slide at 1920×1080 ═════════════ */
export function fitIssues(slide, style) {
  const R = slide.getBoundingClientRect(), k = R.width / 1920, cs = getComputedStyle(slide);
  const box = (el) => { const r = el.getBoundingClientRect(); return { l: (r.left - R.left) / k, r: (r.right - R.left) / k, t: (r.top - R.top) / k, b: (r.bottom - R.top) / k }; };
  const name = (el) => (el.className.baseVal !== undefined ? el.tagName : (el.className || el.tagName).split(" ")[0]);
  const lines = (el, pad = 0) => Math.round((el.clientHeight - pad) / parseFloat(getComputedStyle(el).lineHeight));
  const bottom = 1080 - parseFloat(cs.paddingBottom), right = 1920 - parseFloat(cs.paddingRight), out = [];
  for (const el of slide.children) {
    if (el.classList.contains("rail")) continue;
    const b = box(el);
    if (b.b > bottom + 1) { out.push(`${name(el)} runs ${Math.round(b.b - bottom)}px into the bottom margin; shorten the body or drop the takeaway`); break; }
    if (b.r > right + 1) out.push(`${name(el)} runs ${Math.round(b.r - right)}px into the right margin`);
  }
  slide.querySelectorAll(".notes, .cards.framed .card, .card, .hero > div, .sec-n, .hero-v, .cards .v, .title").forEach((el) => {
    if (el.scrollHeight > el.clientHeight + 1 && getComputedStyle(el).overflow !== "visible") out.push(`${name(el)} content is taller than its box`);
    if (el.scrollWidth > el.clientWidth + 1) out.push(`${name(el)} “${el.textContent.trim().slice(0, 24)}” is wider than its column`);
  });
  slide.querySelectorAll(".notes, .cards.framed .card").forEach((el) => { const last = el.lastElementChild, pb = parseFloat(getComputedStyle(el).paddingBottom);
    if (last && box(last).b > box(el).b - pb + 1) out.push(`${name(el)} content runs ${Math.round(box(last).b - box(el).b + pb)}px past its box`); });
  const title = slide.querySelector("h2.title, h1.title");
  const maxTitle = style === "pitch" && !slide.matches(".t-cover, .t-section") ? 1 : 2;
  if (title && lines(title) > maxTitle) out.push(`title wraps to ${lines(title)} lines (max ${maxTitle}); shorten it`);
  const sub = slide.querySelector(".subtitle");
  if (sub && lines(sub) > 2) out.push(`subtitle wraps to ${lines(sub)} lines (max 2); shorten it`);
  const tk = slide.querySelector(".takeaway");
  if (tk && lines(tk, 12) > 1) out.push(`takeaway wraps to ${lines(tk, 12)} lines; it must fit on one`);
  const fn = slide.querySelector(".rail .fn");
  if (fn && fn.textContent && box(fn).t < 1080 - 48 - 2 * 24 - 2) out.push("footnote + source take more than two lines");
  return out;
}
