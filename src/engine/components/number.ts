/* A key figure: the number in the display face, its sentence under it (a pair's number half) or beside it (`row`: a
   doc's number, across the full width). */
import type { Tone } from "../types.js";
import { at, esc, join, md } from "./text.js";

export const numberHTML = (n: { value: string; caption: string; tone?: Tone }, base: string, row = false): string =>
  `<div class="half-num${row ? " row" : ""}"><div class="shout big-v${n.tone && n.tone !== "focus" ? ` ${n.tone}` : ""}"${at(join(base, "number.value"), "esc")}>${esc(n.value)}</div><p${at(join(base, "number.caption"), "md")}>${md(n.caption)}</p></div>`;
