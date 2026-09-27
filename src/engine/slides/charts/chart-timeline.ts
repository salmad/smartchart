/* Timeline (Gantt): one bar per workstream over period columns, milestones as diamonds.
   Rows are labelled, so they share the quiet grey (colour spec C4); the focus row takes the focus colour. */
import { esc, labelPx, lbl, thinCategories } from "./chart-parts";
import type { Chart, Milestone } from "../../types";

/* Milestone labels: measured first, then each takes the first lane where it clears the labels before it.
   The foot of the chart is as tall as the lanes need; rows share what is left. */
function milestoneLanes(box: HTMLElement, ms: Milestone[], x: (at: number) => number, W: number) {
  box.innerHTML = ms.map((m) => lbl("ms-lbl", 0, 0, "tc0", esc(m.label))).join("");
  const k = box.getBoundingClientRect().width / box.clientWidth;
  const placed = [...box.querySelectorAll(".ms-lbl")].map((el, i) => { const w = el.getBoundingClientRect().width / k;
    return { i, w, l: Math.min(Math.max(0, x(ms[i].at) - w / 2), W - w), lane: 0 }; }).sort((a, b) => a.l - b.l);
  const lanes: number[] = [];
  placed.forEach((p) => { let j = lanes.findIndex((r) => r + 20 <= p.l); if (j < 0) j = lanes.push(0) - 1; lanes[j] = p.l + p.w; p.lane = j; });
  return { labels: Object.fromEntries(placed.map((p) => [p.i, p])), lanes: lanes.length };
}

export function timelineChart(box: HTMLElement, spec: Chart, W: number, H: number): void {
  const periods = spec.periods ?? [], n = periods.length, rows = spec.rows ?? [], ms = spec.milestones || [];
  const Lw = Math.min(W * .34, 440), cw = (W - Lw) / n, head = 56;
  // Milestone lanes are one small label plus a gap apart, at this style's size.
  const lane = labelPx(box, true) + 8;
  const { labels, lanes } = milestoneLanes(box, ms, (at) => Lw + (at + 1) * cw, W), foot = ms.length ? 52 + lanes * lane : 0;
  const rh = Math.min(104, (H - head - foot) / rows.length), bh = Math.min(40, rh * .46);
  const px = (i: number) => Lw + i * cw, rowsBottom = head + rh * rows.length;
  let g = "", t = "";
  for (let i = 0; i <= n; i++) g += `<line class="grid-v" x1="${px(i)}" x2="${px(i)}" y1="${head - 12}" y2="${rowsBottom}"/>`;
  periods.forEach((p, i) => { t += lbl("cat", px(i) + cw / 2, 8, "tc", esc(p)); });
  rows.forEach((r, i) => {
    const cy = head + rh * i + rh / 2, x = px(r.start) + 6, w = (r.end - r.start + 1) * cw - 12;
    g += `<line class="row-rule" x1="0" x2="${W}" y1="${head + rh * (i + 1)}" y2="${head + rh * (i + 1)}"/>`;
    g += `<rect class="tl-bar c-${r.focus ? "focus" : "quiet"}" x="${x}" y="${cy - bh / 2}" width="${w}" height="${bh}" rx="${bh / 2}"/>`;
    // Many rows in a short chart: the row name shrinks to its row (never below 18px) instead of running into the next.
    const fit = rh < 34 ? `;font-size:${Math.max(18, Math.floor(rh * .8))}px` : "";
    t += `<span class="lbl row-lbl${r.focus ? " focus" : ""}" style="left:0;top:${cy}px;width:${Lw - 28}px${fit}">${esc(r.label)}</span>`;
  });
  ms.forEach((m, i) => {
    const x = px(m.at + 1), yd = rowsBottom + 28;
    g += `<line class="ms-line" x1="${x}" x2="${x}" y1="${head - 12}" y2="${yd - 12}"/>`;
    g += `<path class="ms" d="M${x},${yd - 12}L${x + 12},${yd}L${x},${yd + 12}L${x - 12},${yd}Z"/>`;
    t += lbl("ms-lbl", labels[i].l, yd + 22 + labels[i].lane * lane, "tc0", esc(m.label));
  });
  box.innerHTML = `<svg width="${W}" height="${H}">${g}</svg>${t}`;
  thinCategories(box);
}
