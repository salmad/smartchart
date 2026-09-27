/* Waterfall (bridge): totals from zero, changes floating from the running sum, dashed connectors.
   Totals are the quiet grey, steps the pos/neg hue toned down (their labels keep the full colour), and one focus
   item takes the focus colour: the eye lands on the point, not on the biggest block. */
import { fmt, signed, waterfall } from "./chart-math";
import { esc, labelPx, lbl, plotRects, settle } from "./chart-parts";
import type { Chart } from "../../types";

/** `extra`: more room on top, when labels moved apart ran above the chart on the first draw. */
export function waterfallChart(box: HTMLElement, spec: Chart, W: number, H: number, extra = 0): void {
  const { steps } = waterfall(spec.items ?? []), f = spec.format || "{v}";
  const lo = Math.min(0, ...steps.flatMap((s) => [s.from, s.to])), hi = Math.max(0, ...steps.flatMap((s) => [s.from, s.to]));
  // Room above for up labels and totals, below the lowest bar for a down label: both follow the style's label size.
  const L = labelPx(box), P = { t: L + 20 + extra, b: 60 }, ph = H - P.t - P.b, n = steps.length, band = W / n, bw = band * .62;
  const y = (v: number) => P.t + 12 + (hi - v) / (hi - lo || 1) * (ph - L - 18);
  const xc = (i: number) => band * i + band / 2;
  let g = `<line class="base" x1="0" x2="${W}" y1="${y(0)}" y2="${y(0)}"/>`, t = "";
  // Category labels sit under the axis, or under the lowest down-step label when one reaches below it.
  const catTop = Math.max(y(Math.min(0, lo)) + 16, ...steps.filter((s) => s.kind === "down").map((s) => y(Math.min(s.from, s.to)) + L + 22));
  steps.forEach((s, i) => {
    const x = xc(i) - bw / 2, top = y(Math.max(s.from, s.to)), bottom = y(Math.min(s.from, s.to));
    const slot = s.focus ? "focus" : s.kind === "total" ? "ctx3" : s.kind === "up" ? "pos" : "neg";
    g += `<rect class="wf c-${slot}" x="${x}" y="${top}" width="${bw}" height="${Math.max(2, bottom - top)}" rx="4"/>`;
    const next = steps[i + 1];
    if (next) { const lv = y(s.to); g += `<line class="conn" x1="${x + bw}" x2="${xc(i + 1) - bw / 2}" y1="${lv}" y2="${lv}"/>`; }
    const text = s.kind === "total" ? fmt(f, s.value) : signed(f, s.value);
    t += s.kind === "down" ? lbl(`v-lbl wf-lbl c-${slot}`, xc(i), bottom + 10, "tc", text) : lbl(`v-lbl wf-lbl c-${slot}`, xc(i), top - 10, "bc", text);
    // Category labels wrap inside their column rather than run into the next one.
    t += `<span class="lbl a-tc cat wrap" style="left:${xc(i)}px;top:${catTop}px;width:${band - 12}px">${esc(s.label)}</span>`;
  });
  box.innerHTML = `<svg width="${W}" height="${H}">${g}</svg>${t}`;
  // Labels are never dropped: each keeps clear of the others, moving away from its bar.
  const up = [...box.querySelectorAll<HTMLElement>(".wf-lbl.a-bc")], down = [...box.querySelectorAll<HTMLElement>(".wf-lbl.a-tc")];
  settle(box, up, 4, -1);
  settle(box, down, 4, 1);
  const top = Math.min(0, ...up.map(plotRects(box)).map((r) => r.t));
  if (top < 0 && !extra) waterfallChart(box, spec, W, H, 4 - top);
}
