/* Rows: steps on a timeline of when, and numbered summary points. */
import type { Point, Step } from "../types.js";
import { at, esc, item, join, md, pad2 } from "./text.js";

export const stepsHTML = (steps: Step[], base: string): string => `<div class="steps">${steps.map((r, i) => { const p = join(base, `steps[${i}]`);
  return `
    <span class="t"${at(`${p}.when`, "esc")}>${esc(r.when)}</span>
    <div class="d ${r.focus ? "row-focus" : ""}"${item(p)}><span class="h"${at(`${p}.title`, "esc")}>${esc(r.title)}</span><span${at(`${p}.text`, "md")}>${md(r.text)}</span></div>`; }).join("")}</div>`;

export const summaryHTML = (points: Point[], base: string): string => `<div class="sum grow">${points.map((pt, i) => { const p = join(base, `points[${i}]`);
  return `<div class="row"${item(p)}><span class="n">${pad2(i + 1)}</span>
    <span class="lead"${at(`${p}.title`, "md")}>${md(pt.title)}</span><span class="why"${at(`${p}.text`, "md")}>${md(pt.text)}</span></div>`; }).join("")}</div>`;
