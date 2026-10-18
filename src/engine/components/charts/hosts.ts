/* Every chart host in a root: one with no index draws the figure's chart (with the root's colours); a pair's hosts
   (`data-chart="i"`) each draw their half's chart with its own colours. */
import type { Slide, Theme } from "../../types.js";
import { NOTE_POINTS } from "../../slides/schema.js";
import { allocate, type Allocation } from "../../slides/colours.js";
import { drawChart } from "./chart.js";

export function drawCharts(root: HTMLElement, s: Slide, theme: Theme, accent: string | null | undefined, colours: Allocation): void {
  root.querySelectorAll<HTMLElement>("[data-chart]").forEach((host) => {
    const i = host.dataset.chart, spec = i ? s.halves?.[Number(i)]?.chart : s.chart;
    if (!spec) return;
    if (!i) return drawChart(host, spec, NOTE_POINTS ? (s.notes || []).flatMap((n, k) => (n.point ? [{ n: k + 1, ...n.point }] : [])) : [], colours);
    const own = allocate({ ...s, template: "chart", chart: spec }, theme, accent);
    for (const [k, v] of Object.entries(own.vars)) host.style.setProperty(`--${k}`, v);
    drawChart(host, spec, [], own);
  });
}
