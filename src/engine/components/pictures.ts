/* Pictures. A logo is its shape drawn in one colour (a mask over currentColor), sized by CSS from its aspect (`--a`) so
   every logo carries the same weight; a wordmark spells the name, so the name beside it is kept as hidden text. */
import type { ImageRef, LogoItem, Person } from "../types.js";
import { imageMeta, isWordmark } from "../slides/images.js";
import { at, esc, item, join, md } from "./text.js";

const cssUrl = (src: string) => `url(&quot;${esc(src).replace(/[()\\]/g, (c) => `\\${c}`)}&quot;)`;
/** `path` is the picture field's JSON path: what edit mode replaces. */
const pic = (path: string) => (path ? ` data-pic="${path}"` : "");
export const logoHTML = (ref: ImageRef | undefined, name: string, path = "") => {
  const m = imageMeta(ref?.src);
  if (!ref || !m) return "";
  return `<span class="brand${isWordmark(m.aspect) ? " word" : ""}"${pic(path)} role="img" aria-label="${esc(name)}" style="--a:${+m.aspect.toFixed(4)};--src:${cssUrl(ref.src)}"></span>`;
};
/** A logo standing in for a name: a wordmark replaces the visible name, a symbol sits before it. */
export const named = (ref: ImageRef | undefined, nameHTML: string, name: string, path: string) => {
  const m = imageMeta(ref?.src);
  if (!m) return nameHTML;
  return logoHTML(ref, name, path) + (isWordmark(m.aspect) ? `<span class="mk-txt">${nameHTML}</span>` : nameHTML);
};
export const imgHTML = (ref: ImageRef | undefined, cls: string, path: string) => {
  const m = imageMeta(ref?.src);
  if (!ref || !m) return `<div class="${cls} missing"></div>`;
  return `<div class="${cls} k-${m.kind}"${pic(path)} style="--a:${+m.aspect.toFixed(4)}"><img src="${esc(ref.src)}" alt="${esc(ref.alt ?? "")}" width="${m.w}" height="${m.h}" decoding="sync" draggable="false"></div>`;
};
const initials = (name: string) => name.trim().split(/\s+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
/* A team with photos keeps every tile (initials stand in for one that is missing); a team without is text over a rule. */
function personHTML(p: Person, at0: string, photos: boolean) {
  const photo = !photos ? "" : p.photo && imageMeta(p.photo.src) ? imgHTML({ src: p.photo.src, alt: p.name }, "ph", `${at0}.photo`) : `<div class="ph ini" aria-hidden="true">${esc(initials(p.name ?? ""))}</div>`;
  return `<div class="person"${item(at0)}>${photo}<div class="who"><h3${at(`${at0}.name`, "esc")}>${esc(p.name ?? "")}</h3><p class="role"${at(`${at0}.role`, "esc")}>${esc(p.role ?? "")}</p>${p.text ? `<p class="bio"${at(`${at0}.text`, "md")}>${md(p.text)}</p>` : ""}</div></div>`;
}
export function teamHTML(people: Person[], variant: string, base: string): string {
  const photos = people.some((p) => p?.photo);
  return `<div class="team ${variant} n-${people.length}${photos ? "" : " no-ph"}">${people.map((p, i) => personHTML(p ?? { name: "", role: "" }, join(base, `people[${i}]`), photos)).join("")}</div>`;
}
/* The wall's grid: 3–4 in a row, then rows of 3, 4, 5 and 6 as the count grows. */
const wallColumns = (n: number) => (n <= 4 ? n : n <= 6 ? 3 : n <= 8 ? 4 : n <= 10 ? 5 : 6);
export function wallHTML(logos: LogoItem[], base: string): string {
  const cols = wallColumns(logos.length);
  return `<div class="wall c-${cols} r-${Math.ceil(logos.length / cols)}">${logos.map((l, i) => { const p = join(base, `logos[${i}]`);
    return `<div class="cell${i % cols ? "" : " fl"}${i < cols ? " ft" : ""}"${item(p)}>${logoHTML(l?.logo, l?.name ?? "", `${p}.logo`) || `<span class="lg-name"${at(`${p}.name`, "esc")}>${esc(l?.name ?? "")}</span>`}</div>`; }).join("")}</div>`;
}
