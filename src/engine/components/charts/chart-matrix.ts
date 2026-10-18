/* Matrix (2×2): points placed on two judged axes (0–100), a cross at 50, four named quadrants. The quadrant that
   holds the focus point is tinted and its name takes the focus colour. Every point label is placed by code: each
   takes the side of its dot that clears the dots, the quadrant names, the other labels and the edges; when none is
   clear, the side with the least overlap, never one over a dot if it can help it. What still collides is reported by
   the chart lints (C1), so the writer can move a point or shorten a label. */
import { esc, hits, labelPx, lbl, plotRects } from "./chart-parts.js";
import type { Rect } from "./chart-parts.js";
import type { Chart, MatrixPoint } from "../../types.js";

const R = 11, RF = 17, HALO = 27;

/** Overlap area of two rects (0 when apart). */
const overlap = (a: Rect, b: Rect) => Math.max(0, Math.min(a.r, b.r) - Math.max(a.l, b.l)) * Math.max(0, Math.min(a.b, b.b) - Math.max(a.t, b.t));

export function matrixChart(box: HTMLElement, spec: Chart, W: number, H: number): void {
  const pts = spec.points ?? [], q = spec.quadrants ?? [], axes = spec.axes ?? { x: "", y: "" }, s = labelPx(box, true);
  // Gutters for the axis words, at the small chart size: "High"/"Low" on the left, the vertical axis name above the
  // plot (set level, so a short plot never runs out of room for it), the horizontal one below.
  const gl = Math.round(s * 4), gt = Math.round(s + 14), gb = Math.round(s + 18), pw = W - gl, ph = H - gb;
  const X = (v: number) => gl + v / 100 * pw, Y = (v: number) => ph - v / 100 * (ph - gt);
  const focus = pts.find((p) => p.focus), fq = focus ? (focus.y >= 50 ? 0 : 2) + (focus.x >= 50 ? 1 : 0) : -1;
  const midX = X(50), midY = Y(50);
  let g = "";
  if (fq >= 0) g += `<rect class="mx-tint" x="${fq % 2 ? midX : gl}" y="${fq < 2 ? gt : midY}" width="${pw / 2}" height="${(ph - gt) / 2}"/>`;
  g += `<line class="mx-mid" x1="${midX}" x2="${midX}" y1="${gt}" y2="${ph}"/><line class="mx-mid" x1="${gl}" x2="${W}" y1="${midY}" y2="${midY}"/>`;
  g += `<path class="mx-axis" d="M${gl},${gt}V${ph}H${W}"/>`;
  pts.forEach((p) => { if (!p.focus) g += `<circle class="mx-dot" cx="${X(p.x)}" cy="${Y(p.y)}" r="${R}"/>`; });
  if (focus) g += `<circle class="mx-halo" cx="${X(focus.x)}" cy="${Y(focus.y)}" r="${HALO}"/><circle class="mx-dot focus" cx="${X(focus.x)}" cy="${Y(focus.y)}" r="${RF}"/>`;
  // Quadrant names in the outer corners; axis words outside the plot.
  const pad = 24, corner: [number, number, string][] = [[gl + pad, gt + pad, "tc0"], [W - pad, gt + pad, "tr"], [gl + pad, ph - pad, "tl"], [W - pad, ph - pad, "br"]];
  let t = q.map((name, i) => lbl(`mx-q${i === fq ? " focus" : ""}`, corner[i][0], corner[i][1], corner[i][2], esc(name))).join("");
  t += lbl("mx-ax", gl, ph + 14, "tc0", "Low") + lbl("mx-ax", W, ph + 14, "tr", "High") + lbl("mx-ax name", gl + pw / 2, ph + 14, "tc", esc(axes.x));
  t += lbl("mx-ax", gl - 14, gt, "tr", "High") + lbl("mx-ax", gl - 14, ph, "br", "Low") + lbl("mx-ax name", gl, 0, "tc0", esc(axes.y));
  t += pts.map((p, i) => lbl(`mx-lbl${p.focus ? " focus" : ""}`, 0, 0, "tc0", esc(p.label), ` data-i="${i}"`)).join("");
  box.innerHTML = `<svg width="${W}" height="${H}">${g}</svg>${t}`;
  placeLabels(box, pts, X, Y, { l: gl, r: W, t: gt, b: ph });
}

function placeLabels(box: HTMLElement, pts: MatrixPoint[], X: (v: number) => number, Y: (v: number) => number, plot: Rect): void {
  const rect = plotRects(box), gap = Math.round(labelPx(box) * .45);
  // Fixed: the quadrant names and every dot. Labels must also stay inside the plot.
  const names: Rect[] = [...box.querySelectorAll(".mx-q")].map(rect);
  const dots: Rect[] = pts.map((p) => { const r = p.focus ? HALO : R, cx = X(p.x), cy = Y(p.y); return { l: cx - r, r: cx + r, t: cy - r, b: cy + r }; });
  const els = [...box.querySelectorAll<HTMLElement>(".mx-lbl")];
  // Candidate boxes per label, in order of preference: beside the dot, then above and below it, the diagonals,
  // and the sides again a line higher or lower.
  const cands = els.map((el, i) => {
    const m = rect(el), w = m.r - m.l, h = m.b - m.t, p = pts[i], cx = X(p.x), cy = Y(p.y), r = (p.focus ? RF : R) + gap, d = r * .7;
    const at: [number, number][] = [[cx + r, cy - h / 2], [cx - r - w, cy - h / 2], [cx - w / 2, cy - r - h], [cx - w / 2, cy + r],
      [cx + d, cy - d - h], [cx - d - w, cy - d - h], [cx + d, cy + d], [cx - d - w, cy + d],
      [cx + r, cy - h * 1.5 - 4], [cx + r, cy + h / 2 + 4], [cx - r - w, cy - h * 1.5 - 4], [cx - r - w, cy + h / 2 + 4]];
    return at.map(([l, t]) => ({ l, r: l + w, t, b: t + h }));
  });
  const pad = (c: Rect): Rect => ({ l: c.l - 6, r: c.r + 6, t: c.t - 6, b: c.b + 6 });
  const cost = (i: number, k: number, pick: number[]) => {
    const c = cands[i][k], w = c.r - c.l, h = c.b - c.t;
    const out = (Math.max(0, plot.l - c.l) + Math.max(0, c.r - plot.r)) * h + (Math.max(0, plot.t - c.t) + Math.max(0, c.b - plot.b)) * w;
    const near = (o: Rect) => (hits(c, o, 6) ? overlap(pad(c), o) + 50 : 0);
    const others = pick.reduce((sum, kj, j) => sum + (j !== i && kj >= 0 ? near(cands[j][kj]) : 0), 0);
    // A label over a dot hides the data: it costs four times a label over a name or another label.
    return out * 20 + names.reduce((sum, o) => sum + near(o), 0) + 4 * dots.reduce((sum, o) => sum + near(o), 0) + others + k;
  };
  // Greedy first (the focus label first, so it gets its best side), then a few rounds where each label moves to its
  // best side given all the others: a label boxed in by a neighbour can push it aside.
  const pick = els.map(() => -1), order = els.map((_, i) => i).sort((a, b) => Number(!!pts[b].focus) - Number(!!pts[a].focus));
  const best = (i: number) => cands[i].reduce((bk, _c, k) => (cost(i, k, pick) < cost(i, bk, pick) ? k : bk), 0);
  for (const i of order) pick[i] = best(i);
  for (let round = 0; round < 4; round++) {
    let moved = false;
    for (const i of order) { const k = best(i); if (k !== pick[i]) { pick[i] = k; moved = true; } }
    if (!moved) break;
  }
  els.forEach((el, i) => { const c = cands[i][pick[i]]; el.style.left = `${c.l}px`; el.style.top = `${c.t}px`; });
}
