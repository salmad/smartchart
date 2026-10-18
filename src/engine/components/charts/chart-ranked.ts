/* Ranked bars: one measure across named items, drawn horizontally so long labels read on one line.
   Labels sit right-aligned in a column sized to the longest; values sit at the bar ends. Bars are the quiet grey;
   the focus item takes the focus colour, and its label and value read in full strength. */
import { fmt } from "./chart-math.js";
import { esc, labelPx, lbl, plotRects } from "./chart-parts.js";
import type { Chart } from "../../types.js";

const GAP = 36;

export function rankedChart(box: HTMLElement, spec: Chart, W: number, H: number): void {
  const items = spec.ranking ?? [], f = spec.format || "{v}", n = items.length;
  if (!n) return;
  const max = Math.max(0, ...items.map((x) => x.value)) || 1;
  // Measure first: the label column takes the longest label (at most 40% of the width), the value column the widest value.
  box.innerHTML = items.map((x) => `<span class="lbl rk-lbl${x.focus ? " focus" : ""}">${esc(x.label)}</span>`).join("")
    + items.map((x) => lbl(`v-lbl rk-val c-${x.focus ? "focus" : "quiet"}`, 0, 0, "tc0", esc(fmt(f, x.value)))).join("");
  const rect = plotRects(box);
  const Lw = Math.min(W * .4, Math.ceil(Math.max(...[...box.querySelectorAll(".rk-lbl")].map((el) => rect(el).r - rect(el).l))) + 2);
  const Vw = Math.max(...[...box.querySelectorAll(".rk-val")].map((el) => rect(el).r - rect(el).l)) + 18;
  const x0 = Lw + GAP, span = Math.max(0, W - x0 - Vw), rh = H / n, bh = Math.min(labelPx(box) * 2.5, rh * .56);
  let g = "", t = "";
  items.forEach((x, i) => {
    const cy = rh * i + rh / 2, w = Math.max(2, x.value / max * span), y = cy - bh / 2, r = Math.min(4, w / 2);
    // Square at the baseline, rounded at the end.
    g += `<path class="bar c-${x.focus ? "focus" : "quiet"}" d="M${x0},${y}H${x0 + w - r}Q${x0 + w},${y} ${x0 + w},${y + r}V${y + bh - r}Q${x0 + w},${y + bh} ${x0 + w - r},${y + bh}H${x0}Z"/>`;
    t += `<span class="lbl rk-lbl${x.focus ? " focus" : ""}" style="left:0;top:${cy}px;width:${Lw}px">${esc(x.label)}</span>`;
    t += lbl(`v-lbl rk-val c-${x.focus ? "focus" : "quiet"}`, x0 + w + 14, cy, "ml", esc(fmt(f, x.value)));
  });
  g += `<line class="base" x1="${x0}" x2="${x0}" y1="0" y2="${H}"/>`;
  box.innerHTML = `<svg width="${W}" height="${H}">${g}</svg>${t}`;
}
