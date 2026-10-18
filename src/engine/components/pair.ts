/* A pair: two figures side by side, each a chart, a table, a number or points, each with its own caption. */
import type { Half } from "../types.js";
import { markKinds } from "../slides/marks.js";
import { capHTML, item, join, list } from "./text.js";
import { ballKey } from "./scores.js";
import { tableHTML } from "./table.js";
import { numberHTML } from "./number.js";

export function pairHTML(halves: Half[], base: string): string {
  const half = (h: Half | undefined, i: number) => {
    if (!h) return "";
    const p = join(base, `halves[${i}]`);
    const body = h.chart ? `<div class="chart" data-chart="${i}"></div>${h.bullets?.length ? list(h.bullets, `${p}.bullets`) : ""}`
      : h.table ? tableHTML(h.table, `${p}.table`, false, "half")
      : h.number ? numberHTML(h.number, p)
      : h.points ? list(h.points, `${p}.points`).replace('<ul class="bullets">', '<ul class="bullets points">')
      : "";
    // A half without a caption keeps the caption's line (its hairline, no words) when the other half has one, so both
    // bodies start on one line.
    const cap = h.caption ? capHTML(h.caption, "", `${p}.caption`) : halves.some((x) => x?.caption) ? `<p class="cap ghost" aria-hidden="true">&nbsp;</p>` : capHTML(undefined);
    return `<div class="half"${item(p)} data-grid="${i}">${cap}${body}</div>`;
  };
  const balls = halves.some((h) => h?.table && markKinds(h.table).has("balls"));
  return `<div class="pair grow">${halves.map(half).join("")}</div>${balls ? ballKey() : ""}`;
}
