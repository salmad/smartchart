/* Charts: SVG for shapes, HTML for every label. Bar and line series mix on one chart (spec 9.1);
   bars stack when chart.stacked is true. */
import { esc } from "./render.js";

const niceStep = (raw) => { const p = 10 ** Math.floor(Math.log10(raw)), m = raw / p; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p; };
const fmt = (tpl = "{v}", v) => tpl.replace("{v}", Number.isInteger(v) ? v : v.toFixed(1));
const lbl = (cls, x, y, a, html) => `<span class="lbl a-${a} ${cls}" style="left:${x}px;top:${y}px">${html}</span>`;
const topRounded = (x, y, w, h, r) => { r = Math.min(r, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`; };

export function drawChart(host, spec, markers = []) {
  const allLines = spec.series.every((s) => s.mark === "line");
  const legend = allLines ? "" : `<div class="legend">${spec.series.map((s) =>
    `<span class="c-${s.color || "neutral"}"><i class="${s.mark === "line" ? "line" : ""}"></i>${esc(s.name)}</span>`).join("")}</div>`;
  host.innerHTML = `${legend}<div class="plot"></div>`;
  const box = host.querySelector(".plot"), W = box.clientWidth, H = box.clientHeight;
  (allLines ? lines : bars)(box, spec, W, H, markers);
}

// Bars, side by side or stacked, with line series over them: a line in the bars' unit shares their
// scale (a target or average); a line in another unit gets its own scale. No axes: values sit on the data.
function bars(box, spec, W, H, markers) {
  const B = spec.series.filter((s) => s.mark !== "line"), L = spec.series.filter((s) => s.mark === "line");
  const stacked = spec.stacked === true && B.length > 1, unit = B[0].format || spec.format;
  const P = { t: 96, b: 44 }, ph = H - P.t - P.b, n = spec.categories.length, band = W / n;
  const totals = spec.categories.map((_, i) => B.reduce((sum, s) => sum + Math.max(0, s.values[i]), 0));
  const bMax = stacked ? Math.max(...totals) : Math.max(...B.flatMap((s) => s.values));
  const own = L.filter((s) => (s.format || spec.format) !== unit);
  const lMax = own.length ? Math.max(...own.flatMap((s) => s.values)) : 1;
  const yb = (v) => P.t + ph - (v / bMax) * ph * .86;
  const yOf = (s) => (own.includes(s) ? (v) => P.t + ph - (v / lMax) * ph : yb);
  const gw = band * .56, bw = stacked ? gw : gw / B.length, xc = (i) => band * i + band / 2;
  let g = `<line class="base" x1="0" x2="${W}" y1="${P.t + ph}" y2="${P.t + ph}"/>`, t = "";
  const pos = spec.series.map(() => []), acc = spec.categories.map(() => 0);
  spec.categories.forEach((c, i) => { t += lbl("cat", xc(i), P.t + ph + 16, "tc", esc(c)); });
  spec.series.forEach((s, si) => {
    if (s.mark === "line") return;
    const j = B.indexOf(s), f = s.format || spec.format, top1 = stacked && j === B.length - 1;
    s.values.forEach((v, i) => {
      const x = (stacked ? xc(i) - gw / 2 : xc(i) - gw / 2 + j * bw) + 4, w = bw - 8;
      const bottom = stacked ? yb(acc[i]) : P.t + ph, top = stacked ? yb(acc[i] + Math.max(0, v)) : yb(v), h = bottom - top;
      if (h > .5) g += `<path class="bar c-${s.color}" d="${stacked && !top1 ? `M${x},${bottom}V${top}H${x + w}V${bottom}Z` : topRounded(x, top, w, h, 6)}"/>`;
      // Stacked: a segment's value sits inside it, hidden when the segment is shorter than its label (spec 4.2a).
      if (stacked) { if (h >= 44) t += lbl(`seg-lbl c-${s.color}`, x + w / 2, (top + bottom) / 2, "mc", fmt(f, v)); }
      else if (s.color === "focus" || i === n - 1) t += lbl(`v-lbl c-${s.color}`, x + w / 2, top - 10, "bc", fmt(f, v));
      acc[i] += Math.max(0, v);
      pos[si][i] = [x + w / 2, top - 34];
    });
  });
  if (stacked) totals.forEach((v, i) => { t += lbl("v-lbl c-total", xc(i), yb(v) - 10, "bc", fmt(unit, v)); });
  spec.series.forEach((s, si) => {
    if (s.mark !== "line") return;
    const y = yOf(s), pts = s.values.map((v, i) => [xc(i), y(v)]);
    g += `<path class="ln c-${s.color} ${s.dashed ? "dashed" : ""}" d="${pts.map((p, i) => `${i ? "L" : "M"}${p[0]},${p[1]}`).join("")}"/>`;
    pts.forEach(([x, py], i) => { g += `<circle class="pt c-${s.color}" cx="${x}" cy="${py}" r="7"/>`;
      t += lbl(`v-lbl on-line c-${s.color}`, x, py - 16, "bc", fmt(s.format || spec.format, s.values[i])); pos[si][i] = [x, py - 40]; });
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
    g += `<path class="ln c-${s.color || "neutral"} ${s.dashed ? "dashed" : ""}" d="${d}"/>`;
    const [lx, ly] = pts.at(-1);
    g += `<circle class="pt solid c-${s.color || "neutral"}" cx="${lx}" cy="${ly}" r="10"/>`;
    t += `<div class="lbl end c-${s.color || "neutral"}" style="left:${lx + 32}px;top:${endY[si]}px"><b>${fmt(s.format || spec.format, s.values.at(-1))}</b><span>${esc(s.name)}</span></div>`;
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
