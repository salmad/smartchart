/* Scores in a table cell: Harvey balls, ticks and crosses, and the key that says what empty and full mean. */
import type { Mark } from "../slides/marks.js";
import { esc } from "./text.js";

export const ball = (v: number) => {
  if (v >= 4) return `<svg class="mk-ball" viewBox="0 0 40 40" aria-hidden="true"><circle class="full" cx="20" cy="20" r="18"/></svg>`;
  const a = v / 4 * 2 * Math.PI, x = 20 + 18 * Math.sin(a), y = 20 - 18 * Math.cos(a);
  return `<svg class="mk-ball" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="18"/>${v ? `<path d="M20,20V2A18,18 0 ${v > 2 ? 1 : 0},1 ${x},${y}Z"/>` : ""}</svg>`;
};
/* The cell keeps its own character as text (hidden under a drawn ball), so the field still reads as what was written. */
export const markHTML = (m: Mark, raw: string) => (m.kind === "ball" ? `${ball(m.v)}<span class="mk-txt">${esc(raw)}</span>` : `<span class="mk-tick${m.kind === "cross" ? " no" : ""}">${esc(raw)}</span>`);
/** The key under a table of Harvey balls: what empty and full mean. Consulting only (pitch hides it in CSS). */
export const ballKey = () => `<div class="mk-key"><span>${ball(0)}None</span>${[1, 2, 3].map((v) => `<span>${ball(v)}</span>`).join("")}<span>${ball(4)}Full</span></div>`;
