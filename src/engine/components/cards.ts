/* Cards: a row (or two over two) of icon, number, value, logo or plain cards, or framed cards side by side. */
import type { Card, Slide } from "../types.js";
import { plain } from "../slides/schema.js";
import { at, esc, item, join, list, md, pad2 } from "./text.js";
import { logoHTML } from "./pictures.js";

export function cardHTML(c: Card, variant: string, i: number, base: string): string {
  const p = join(base, `cards[${i}]`);
  const body = (c.bullets ? list(c.bullets, `${p}.bullets`) : "") + (c.text ? `<p${at(`${p}.text`, "md")}>${md(c.text)}</p>` : "");
  const tone = c.tone && c.tone !== "neutral" ? c.tone : "";
  if (variant === "framed") return `<div class="card ${tone}"${item(p)}><div class="who"${at(`${p}.label`, "esc")}>${esc(c.label || "")}</div><h3${at(`${p}.title`, "esc")}>${esc(c.title)}</h3>${body}
    ${c.facts ? `<div class="facts">${c.facts.map((x, k) => `<div${item(`${p}.facts[${k}]`)}><div class="k"${at(`${p}.facts[${k}].label`, "esc")}>${esc(x.label)}</div><div class="v"${at(`${p}.facts[${k}].text`, "md")}>${md(x.text)}</div></div>`).join("")}</div>` : ""}</div>`;
  if (variant === "value") return `<div class="card ${tone}"${item(p)}><div class="shout v"${at(`${p}.value`, "esc")}>${esc(c.value)}</div><h3${at(`${p}.title`, "md")}>${md(c.title)}</h3>${body}</div>`;
  if (variant === "logo") return `<div class="card ${tone}"${item(p)}><div class="lead">${logoHTML(c.logo, plain(c.title), `${p}.logo`)}</div><h3${at(`${p}.title`, "md")}>${md(c.title)}</h3>${body}</div>`;
  if (variant === "numbered") return `<div class="card ${tone}"${item(p)}><div class="num">${pad2(i + 1)}</div><h3${at(`${p}.title`, "md")}>${md(c.title)}</h3>${body}</div>`;
  if (variant === "plain") return `<div class="card ${tone}"${item(p)}><h3${at(`${p}.title`, "md")}>${md(c.title)}</h3>${body}</div>`;
  return `<div class="card ${tone}"${item(p)}><div class="ic"><i data-lucide="${esc(c.icon)}"></i></div><h3${at(`${p}.title`, "md")}>${md(c.title)}</h3>${body}</div>`;
}

export function cardsHTML(cards: Card[], variant: string, arrange: Slide["arrange"], base: string): string {
  // Four cards two over two are laid out as two columns; their rows line up like any other cards'.
  const grid = variant !== "framed" && cards.length === 4 && arrange === "grid";
  return `<div class="cards ${variant} ${variant === "framed" ? "grow" : grid ? "n-2 g-2x2" : `n-${cards.length}`}">${cards.map((c, i) => cardHTML(c, variant, i, base)).join("")}</div>`;
}
