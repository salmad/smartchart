/* Text, the bits every component is written with: escaping, inline markup, display text, captions, bullet lists, and the
   data attributes hand editing reads. Shared by slides and docs. */

const ENTITIES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };
export const esc = (s: unknown): string => String(s).replace(/[&<>"]/g, (c) => ENTITIES[c]);
/** A link, in any text field: `[FCA report](https://…)` is the words with a small arrow (kept on the last word's line),
    and a click goes to the page. */
const EXT = `<svg class="ext" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7h10v10"/><path d="M7 17 17 7"/></svg>`;
export const md = (s: unknown): string => esc(s)
  .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
  .replace(/\[\[(.+?)\]\]/g, '<span class="hl-focus">$1</span>')
  .replace(/\[-(.+?)-\]/g, '<span class="hl-neg">$1</span>')
  .replace(/\[\+(.+?)\+\]/g, '<span class="hl-pos">$1</span>')
  .replace(/\[([^\][]+)\]\((https?:\/\/[^\s)<>]+)\)/g,
    (_, label: string, url: string) => `<a href="${url}" target="_blank" rel="noopener noreferrer">${linkWords(label, EXT)}</a>`)
  // A link to a slide of the deck: the words, then the slide's page now (set by slideHTML, drawn by CSS so it is not text).
  .replace(/\[([^\][]+)\]\(#([\w-]+)\)/g,
    (_, label: string, id: string) => `<a href="#${id}" data-slide="${id}">${linkWords(label, `<span class="ref" data-ref="${id}"></span>`)}</a>`);
/** The arrow (or page) stays with the label's last word: a line never starts with it. A span adds no characters, so
    hand editing reads the same text. */
function linkWords(label: string, tail: string): string {
  const cut = label.search(/\S+\s*$/)
  return `${label.slice(0, cut)}<span class="nw">${label.slice(cut)}${tail}</span>`
}
export const pad2 = (n: number) => String(n).padStart(2, "0");
/** Display text: hyphenated compounds ("5-hospital", "well-known") never break at the hyphen. Text only, not tags. */
export const display = (s: string) => md(s).split(/(<[^>]+>)/).map((part) => (part.startsWith("<") ? part
  : part.replace(/[\p{L}\p{N}£$€%]+(?:[-‑][\p{L}\p{N}%]+)+/gu, (w) => `<span class="nw">${w}</span>`))).join("");
/** How a field's string is drawn; hand editing redraws one field with the same function. */
export type FieldKind = "md" | "display" | "esc" | "cap";
/* Exhibit caption: the unit after the last " · " is set quieter. */
export const capInner = (text: string) => { const i = text.lastIndexOf(" · "); return i > 0 ? `${esc(text.slice(0, i))}<span> · ${esc(text.slice(i + 3))}</span>` : esc(text); };
export const FIELD_HTML: Record<FieldKind, (s: string) => string> = { md, display, esc, cap: capInner };

/** A key under its component's base path: a slide's components sit at the root (""), a doc's under their block. */
export const join = (base: string, key: string) => (base ? `${base}.${key}` : key);
/** The field's JSON path and kind, as attributes: what hand editing reads. They change nothing on screen. */
export const at = (path: string, kind: FieldKind) => ` data-path="${path}" data-kind="${kind}"`;
export const item = (path: string) => ` data-item="${path}"`;
export const list = (items: string[], path: string) => `<ul class="bullets">${items.map((b, j) => `<li${item(`${path}[${j}]`)}${at(`${path}[${j}]`, "md")}>${md(b)}</li>`).join("")}</ul>`;

/* Exhibit caption: what the chart or table shows; the unit after the last " · " is set quieter. */
export const capHTML = (text: string | undefined, cls = "", path = "") => {
  if (!text) return `<p class="cap blank ${cls}"></p>`;
  return `<p class="cap ${cls}"${path ? at(path, "cap") : ""}>${capInner(text)}</p>`;
};
