/* Charts: SVG for shapes, HTML for every label. `chart.kind` picks the drawing: bars (bar and line
   series, stacked, 100% or side by side, with computed annotations), waterfall or timeline.
   Colours come from the allocator (colours.js) as slots; this file never picks a colour. */
import { annotationLabel, annotationSeries, axisBreak, fmt, shares } from "./chart-math";
import { seriesSlots } from "../colours";
import type { Slot } from "../colours";
import type { Chart, Series } from "../../types";
import { esc, hits, lbl, plotRects, thinCategories, topRounded } from "./chart-parts";
import type { Rect } from "./chart-parts";
import { waterfallChart } from "./chart-waterfall";
import { timelineChart } from "./chart-timeline";

/** A note number pinned on a data point. */
export interface Marker { n: number; series: number; index: number }
/** What drawing needs from the allocator. */
export interface SeriesColours { slots: (Slot | null)[]; labelled: boolean[] }

const niceStep = (raw: number) => { const p = 10 ** Math.floor(Math.log10(raw)), m = raw / p; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p; };

/** `colours`: { slots, labelled } from allocate(); computed here when a caller has none. */
export function drawChart(host: HTMLElement, spec: Chart, markers: Marker[] = [], colours: SeriesColours = seriesSlots(spec)): void {
  const kind = spec.kind || "bars", series = spec.series ?? [];
  const allLines = kind === "bars" && series.every((s) => s.mark === "line");
  // One series needs no legend: the title names it.
  const legend = kind !== "bars" || allLines || series.length < 2 ? "" : `<div class="legend">${series.map((s, i) =>
    `<span class="c-${colours.slots[i]}"><i class="${s.mark === "line" ? "line" : ""}"></i>${esc(s.name)}</span>`).join("")}</div>`;
  host.innerHTML = `${legend}<div class="plot"></div>`;
  const box = host.querySelector<HTMLElement>(".plot");
  if (!box) return;
  const W = box.clientWidth, H = box.clientHeight;
  if (kind === "waterfall") return waterfallChart(box, spec, W, H);
  if (kind === "timeline") return timelineChart(box, spec, W, H);
  (allLines ? lines : bars)(box, spec, W, H, markers, colours);
}

// Bars, side by side or stacked, with line series over them: a line in the bars' unit shares their
// scale (a target or average); a line in another unit gets its own scale. No axes: values sit on the data.
const span = (a: { from?: number; to?: number }) => (a.to ?? 0) - (a.from ?? 0);

/* Bars and lines draw from a validated chart: series and categories are present. */
type BarsChart = Chart & { series: Series[]; categories: string[] };
const asBars = (c: Chart): BarsChart => ({ ...c, series: c.series ?? [], categories: c.categories ?? [] });

function bars(box: HTMLElement, chart: Chart, W: number, H: number, markers: Marker[], { slots, labelled }: SeriesColours) {
  const spec = asBars(chart);
  const B = spec.series.filter((s) => s.mark !== "line"), L = spec.series.filter((s) => s.mark === "line");
  const pct = spec.stacked === "100" && B.length > 1, stacked = (spec.stacked === true || pct) && B.length > 1;
  const sh = pct ? shares(spec) : null, val = (s: Series, i: number) => (sh ? sh[B.indexOf(s)][i] : s.values[i]);
  const unit = pct ? "{v}%" : B[0].format || spec.format;
  const anns = pct ? [] : spec.annotations || [], arrows = anns.filter((a) => a.type !== "target"), targets = anns.filter((a) => a.type === "target");
  const brk = stacked ? null : axisBreak(spec);
  // A target keeps a gutter on the right for its label, level with the end of its line.
  const gutter = targets.length ? 190 : 0;
  const P = { t: 96, b: 44 }, ph = H - P.t - P.b, n = spec.categories.length, band = (W - gutter) / n;
  const totals = spec.categories.map((_, i) => B.reduce((sum, s) => sum + Math.max(0, val(s, i)), 0));
  const bMax = Math.max(brk ? brk.cap : stacked ? Math.max(...totals) : Math.max(...B.flatMap((s) => s.values)), ...targets.map((a) => a.value ?? NaN));
  const own = L.filter((s) => (s.format || spec.format) !== unit);
  const lMax = own.length ? Math.max(...own.flatMap((s) => s.values)) : 1;
  // Each arrow level takes headroom from the bars, so annotations never leave the plot.
  const head = .86 - .13 * Math.min(arrows.length, 3);
  const yb = (v: number) => P.t + ph - (v / bMax) * ph * head;
  const yOf = (s: Series) => (own.includes(s) ? (v: number) => P.t + ph - (v / lMax) * ph * head : yb);
  const gw = band * .56, bw = stacked ? gw : gw / B.length, xc = (i: number) => band * i + band / 2;
  const barX = (s: Series, i: number) => (stacked ? xc(i) - gw / 2 : xc(i) - gw / 2 + B.indexOf(s) * bw) + 4;
  // Target lines go first, so the bars pass in front of them.
  let g = targets.map((a) => `<line class="target" x1="0" x2="${W}" y1="${yb(a.value ?? NaN)}" y2="${yb(a.value ?? NaN)}"/>`).join("")
    + `<line class="base" x1="0" x2="${W - gutter}" y1="${P.t + ph}" y2="${P.t + ph}"/>`, t = "";
  const pos: [number, number][][] = spec.series.map(() => []), acc = spec.categories.map(() => 0), tops = spec.categories.map(() => Infinity);
  spec.categories.forEach((c, i) => { t += lbl("cat", xc(i), P.t + ph + 16, "tc", esc(c)); });
  spec.series.forEach((s, si) => {
    if (s.mark === "line") return;
    const j = B.indexOf(s), f = pct ? "{v}%" : s.format || spec.format, top1 = stacked && j === B.length - 1, slot = slots[si];
    s.values.forEach((raw, i) => {
      const v = val(s, i), x = barX(s, i), w = bw - 8, broken = brk && brk.series === si && brk.index === i;
      const bottom = stacked ? yb(acc[i]) : P.t + ph, top = stacked ? yb(acc[i] + Math.max(0, v)) : broken ? yb(bMax) - ph * .08 : yb(v), h = bottom - top;
      if (h > .5) g += `<path class="bar c-${slot}" data-series="${si}" d="${stacked && !top1 ? `M${x},${bottom}V${top}H${x + w}V${bottom}Z` : topRounded(x, top, w, h, 6)}"/>`;
      // The axis break: the outlier bar is cut, and its label keeps the true value.
      if (broken) { const yk = yb(bMax * .88); g += `<path class="brk" d="M${x - 8},${yk + 12}L${x + w + 8},${yk - 4}M${x - 8},${yk + 26}L${x + w + 8},${yk + 10}"/>`; }
      // Stacked: a segment's value sits inside it, hidden when the segment is shorter than its label (spec 4.2a).
      const text = pct ? `${Math.round(v)}%` : fmt(f, raw);
      if (stacked) { if (h >= 44) t += lbl(`seg-lbl c-${slot}`, x + w / 2, (top + bottom) / 2, "mc", text); }
      else if (slot === "focus" || labelled[si] || i === n - 1) t += lbl(`v-lbl c-${slot}${labelled[si] ? " keep" : ""}`, x + w / 2, top - 10, "bc", text);
      acc[i] += Math.max(0, v);
      tops[i] = Math.min(tops[i], top);
      pos[si][i] = [x + w / 2, top - 34];
    });
  });
  if (stacked && !pct) totals.forEach((v, i) => { t += lbl("v-lbl c-total keep", xc(i), yb(v) - 10, "bc", fmt(unit, v)); });
  spec.series.forEach((s, si) => {
    if (s.mark !== "line") return;
    const y = yOf(s), pts = s.values.map((v, i) => [xc(i), y(v)]), slot = slots[si];
    g += `<path class="ln c-${slot} ${s.dashed ? "dashed" : ""}" data-series="${si}" d="${pts.map((p, i) => `${i ? "L" : "M"}${p[0]},${p[1]}`).join("")}"/>`;
    // A line keeps its first and last values (the "from 12% to 38%" a title quotes); the ones between may drop.
    pts.forEach(([x, py], i) => { g += `<circle class="pt c-${slot}" cx="${x}" cy="${py}" r="7"/>`;
      t += lbl(`v-lbl on-line c-${slot}${i === 0 || i === n - 1 ? " keep" : ""}`, x, py - 16, "bc", fmt(s.format || spec.format, s.values[i])); pos[si][i] = [x, py - 40]; tops[i] = Math.min(tops[i], py); });
  });
  targets.forEach((a) => { const y = yb(a.value ?? NaN), l = annotationLabel(spec, a);
    if (!l) return;
    t += lbl("tgt", W, y, "br", `<span>${esc(l.caption)}</span><b>${esc(l.figure)}</b>`, ` data-y="${y}"`); });
  // Arrows: the narrowest span first, each level above the bars, labels and arrows it spans.
  const placed: { from: number; to: number; y: number }[] = [];
  [...arrows].sort((a, b) => span(a) - span(b)).forEach((a) => {
    const from = a.from ?? 0, to = a.to ?? 0;
    const s = a.series !== undefined ? spec.series[a.series] : stacked ? null : B.find((x) => x.color === "focus") || B[0];
    const src = annotationSeries(spec, a), ax = (i: number) => (s ? barX(s, i) + (bw - 8) / 2 : xc(i));
    const end = (i: number) => (s && src ? yb(src.values[i]) : yb(totals[i])) - 44;
    let y = Math.min(...tops.slice(from, to + 1)) - 92;
    placed.forEach((p) => { if (p.from <= to && from <= p.to) y = Math.min(y, p.y - 84); });
    placed.push({ from, to, y });
    const [x1, x2] = [ax(from), ax(to)], label = annotationLabel(spec, a);
    if (!label) return;
    g += `<path class="arrow" d="M${x1},${end(from)}V${y}H${x2}V${end(to) - 8}"/><circle class="arrow-dot" cx="${x1}" cy="${end(from)}" r="4"/>`
      + `<path class="arrow-head" d="M${x2 - 7},${end(to) - 11}L${x2},${end(to)}L${x2 + 7},${end(to) - 11}Z"/>`;
    // The figure is the hero: in the focus colour when it measures the focus series, in pos/neg for a change.
    const tone = a.type === "difference" ? (label.sign < 0 ? " neg" : " pos") : s?.color === "focus" || (!s && B.some((x) => x.color === "focus")) ? " focus" : "";
    t += lbl(`ann${tone}`, (x1 + x2) / 2, y, "mc", `<b>${esc(label.figure)}</b>${label.caption ? `<span>${esc(label.caption)}</span>` : ""}`);
  });
  markers.forEach((m) => { const p = pos[m.series]?.[m.index]; if (!p) return; const [x, y] = p;
    g += `<line class="leader" data-n="${m.n}" x1="${x}" x2="${x}" y1="${y - 26}" y2="${y + 2}"/>`;
    t += lbl("mk", x, y - 46, "mc", String(m.n), ` data-n="${m.n}"`); });
  box.innerHTML = `<svg width="${W}" height="${H}">${g}</svg>${t}`;
  thinCategories(box);
  box.querySelectorAll<HTMLElement>(".tgt").forEach((el) => placeTarget(box, el, W));
  declutter(box);
}

/* A target's label sits at an end of its line, above or below it: the first spot clear of every bar. */
function placeTarget(box: HTMLElement, el: HTMLElement, W: number) {
  const rect = plotRects(box), bars = [...box.querySelectorAll(".bar")].map(rect), y = Number(el.dataset.y);
  for (const [x, dy, a] of [[W, -10, "br"], [0, -10, "tl"], [W, 10, "tr"], [0, 10, "tc0"]] as const) {
    el.className = el.className.replace(/a-\w+/, `a-${a}`);
    Object.assign(el.style, { left: `${x}px`, top: `${y + dy}px` });
    if (!bars.some((b) => hits(rect(el), b, 6))) return;
  }
}

// Lines with dashed gridlines and big direct end labels instead of a legend.
function lines(box: HTMLElement, chart: Chart, W: number, H: number, _markers: Marker[], { slots }: SeriesColours) {
  const spec = asBars(chart), P = { t: 40, r: 250, b: 48 }, pw = W - P.r, ph = H - P.t - P.b, n = spec.categories.length;
  const max = Math.max(...spec.series.flatMap((s) => s.values)), step = niceStep(max / 3), top = Math.ceil(max / step) * step;
  const x = (i: number) => (i / (n - 1)) * pw, y = (v: number) => P.t + ph - (v / top) * ph;
  let g = `<defs><linearGradient id="gA" x1="0" x2="0" y1="0" y2="1"><stop class="area-top" offset="0"/><stop class="area-bot" offset="1"/></linearGradient></defs>`, t = "";
  for (let v = step; v <= top; v += step) { g += `<line class="grid" x1="0" x2="${pw}" y1="${y(v)}" y2="${y(v)}"/>`; t += lbl("tick", 0, y(v) - 10, "tl", fmt(spec.format, v)); }
  g += `<line class="base" x1="0" x2="${pw}" y1="${y(0)}" y2="${y(0)}"/>`;
  // The first and last categories align to the plot's edges, so the last never runs into the end labels.
  spec.categories.forEach((c, i) => { t += lbl("cat", x(i), y(0) + 16, i === 0 ? "tc0" : i === n - 1 ? "tr" : "tc", esc(c)); });
  // End labels: stacked apart when two series end at similar values (spec 4.2a).
  // Five or more series use compact labels; all of them stay inside the plot, pushed up from the bottom if needed.
  const compact = spec.series.length >= 5, gap = compact ? 70 : 96, half = compact ? 34 : 46;
  const ends = spec.series.map((s, i) => ({ i, y: Math.max(half, y(s.values.at(-1) ?? 0)) })).sort((a, b) => a.y - b.y);
  for (let k = 1; k < ends.length; k++) if (ends[k].y - ends[k - 1].y < gap) ends[k].y = ends[k - 1].y + gap;
  for (let k = ends.length - 1; k >= 0; k--) ends[k].y = Math.min(ends[k].y, H - half - (ends.length - 1 - k) * gap);
  const endY = Object.fromEntries(ends.map((e) => [e.i, e.y]));
  spec.series.forEach((s, si) => {
    const pts = s.values.map((v, i) => [x(i), y(v)]), d = pts.map((p, i) => `${i ? "L" : "M"}${p[0]},${p[1]}`).join(""), slot = slots[si];
    if (s.area && slot === "focus") g += `<path d="${d}L${pw},${y(0)}L0,${y(0)}Z" fill="url(#gA)"/>`;
    g += `<path class="ln c-${slot} ${s.dashed ? "dashed" : ""}" data-series="${si}" d="${d}"/>`;
    const [lx, ly] = pts.at(-1) ?? [0, 0];
    g += `<circle class="pt solid c-${slot}" cx="${lx}" cy="${ly}" r="10"/>`;
    t += `<div class="lbl end${compact ? " compact" : ""} c-${slot}" style="left:${lx + 32}px;top:${endY[si]}px"><b>${fmt(s.format || spec.format, s.values.at(-1) ?? 0)}</b><span>${esc(s.name)}</span></div>`;
  });
  box.innerHTML = `<svg width="${W}" height="${H}">${g}</svg>${t}`;
  thinCategories(box);
}

/* Value labels, then markers, move up until they clear everything placed before them.
   Labels clear points, other bars and earlier labels; markers also clear the line itself.
   A moved marker keeps its leader down to the bar. */
function declutter(box: HTMLElement) {
  const rect = plotRects(box), placed = [...box.querySelectorAll(".pt, .ann, .tgt")].map(rect), line: Rect[] = [];
  const bars = [...box.querySelectorAll(".bar")].map(rect);
  box.querySelectorAll<SVGGeometryElement>(".ln, .arrow").forEach((ln) => { for (let d = 0, L = ln.getTotalLength(); d <= L; d += 12) {
    const p = ln.getPointAtLength(d); line.push({ l: p.x - 3, r: p.x + 3, t: p.y - 3, b: p.y + 3 }); } });
  const settle = (el: HTMLElement, gap: number, obstacles: Rect[]) => {
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
  const cx = (r: Rect) => (r.l + r.r) / 2, rank = (el: Element) => (el.classList.contains("c-focus") ? 2 : el.classList.contains("keep") ? 1 : 0);
  [...box.querySelectorAll<HTMLElement>(".v-lbl")].sort((a, b) => rank(b) - rank(a)).forEach((el) => {
    // A bar label may touch its own bar; a line label clears every bar.
    const r = rect(el), mine = (b: Rect) => !el.classList.contains("on-line") && b.l <= cx(r) && cx(r) <= b.r;
    const obstacles = [...placed, ...bars.filter((b) => !mine(b))];
    // A context value that is not required (spec C4) is dropped rather than floated away from its bar.
    if (!rank(el) && obstacles.some((o) => hits(r, o, 4))) el.remove();
    else settle(el, 4, obstacles);
  });
  box.querySelectorAll<HTMLElement>(".mk").forEach((mk) => { const moved = settle(mk, 6, [...placed, ...bars, ...line]);
    const ld = box.querySelector(`.leader[data-n="${mk.dataset.n}"]`); if (moved && ld) ld.setAttribute("y1", String(Number(ld.getAttribute("y1")) - moved)); });
}
