/* A flow: how something is produced, as tiers of boxes top to bottom with an arrow between tiers. Each box holds one
   inner component from a closed registry, so code can measure and fit it; a new inner component is one entry here plus
   its limits in the schema. A tier sets the tone of its boxes and may put an operator between them. */
import type { Flow, FlowTier, Inner } from "../types.js";
import { heatSteps } from "./heat.js";
import { at, esc, item, join, md } from "./text.js";

export type InnerKind = "text" | "grid";
export const innerKind = (x: Inner): InnerKind => ("grid" in x ? "grid" : "text");

/** A small heat grid: 25 cells on the grid's own scale (each grid is its own measure). */
const gridHTML = (rows: number[][]) => `<div class="mini" aria-hidden="true">${heatSteps(rows.flat()).map((h) => `<i class="h${h}"></i>`).join("")}</div>`;

export const INNERS = {
  text: (x: { text: string }, p: string) => `<span class="fl-text"${at(`${p}.text`, "md")}>${md(x.text)}</span>`,
  grid: (x: { label: string; grid: number[][] }, p: string) => `<span class="fl-obj-l"${at(`${p}.label`, "esc")}>${esc(x.label)}</span>${gridHTML(x.grid)}`,
} satisfies Record<InnerKind, (x: never, path: string) => string>;
const innerHTML = (x: Inner, p: string) => ("grid" in x ? INNERS.grid(x, p) : INNERS.text(x, p));

/** More than three text boxes in a tier are chips, set three to a row. */
const isChips = (t: FlowTier) => t.boxes.length > 3;
const ARROW = `<div class="fl-arrow" aria-hidden="true"><svg viewBox="0 0 24 14"><path d="M2 2 12 12 22 2"/></svg></div>`;

export function flowHTML(f: Flow, base: string): string {
  const tiers = f.tiers.map((t, i) => {
    const p = join(base, `tiers[${i}]`), chips = isChips(t), tone = t.tone && t.tone !== "plain" ? `t-${t.tone}` : "";
    const cls = ["fl-tier", chips ? "chips" : "", tone, t.label ? "labelled" : "", t.op ? "with-op" : ""].filter(Boolean).join(" ");
    const boxes = t.boxes.map((b, j) => `${j && t.op ? `<span class="fl-op" aria-hidden="true">${esc(t.op)}</span>` : ""}<div class="fl-box${innerKind(b) === "grid" ? " has-obj" : ""}"${item(`${p}.boxes[${j}]`)}>${innerHTML(b, `${p}.boxes[${j}]`)}</div>`).join("");
    const label = t.label ? `<span class="fl-label"${at(`${p}.label`, "esc")}>${esc(t.label)}</span>` : "";
    return `<div class="${cls}" style="--n:${chips ? 3 : t.boxes.length}"${item(p)}>${label}${boxes}</div>`;
  });
  return `<div class="flow">${tiers.join(ARROW)}</div>`;
}
