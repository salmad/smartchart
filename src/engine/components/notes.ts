/* Notes beside a figure, and the split that holds them: main ⅔ + notes ⅓. */
import type { Note, Slide } from "../types.js";
import { at, capHTML, item, join, md, pad2 } from "./text.js";

/** A figure's furniture: what a slide and a doc block both carry around their component. */
export type Furniture = Pick<Slide, "caption" | "notesTitle" | "notes">;

export const notesHTML = (notes: Note[], base: string): string => `<div class="notes">${notes.map((n, i) => { const p = join(base, `notes[${i}]`);
  return `<div class="note"${item(p)}><span class="n">${pad2(i + 1)}</span>
  <div><h4${at(`${p}.title`, "md")}>${md(n.title)}</h4>${n.text ? `<p${at(`${p}.text`, "md")}>${md(n.text)}</p>` : ""}</div></div>`; }).join("")}</div>`;

/* Split body: main ⅔ + notes ⅓. With a notes heading, both columns get a header row on one line (a missing
   caption stays blank). With a caption alone, the notes keep the column's full height from the body line. */
export const splitHTML = (f: Furniture, main: string, extra: string, base: string): string => {
  const cap = join(base, "caption");
  const head = f.notesTitle ? capHTML(f.caption, "", cap) + capHTML(f.notesTitle, "notes-h", join(base, "notesTitle")) : f.caption ? capHTML(f.caption, "", cap) : "";
  const cls = f.notesTitle ? "has-head" : f.caption ? "has-head cap-only" : "";
  return `<div class="split ${extra} ${cls}">${head}<div class="main">${main}</div>${notesHTML(f.notes ?? [], base)}</div>`;
};
