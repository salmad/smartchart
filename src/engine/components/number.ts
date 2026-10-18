/* A key figure: the number in the display face, its sentence under it. A pair's number half, and a doc's number. */
import type { Tone } from "../types.js";
import { at, esc, join, md } from "./text.js";

export const numberHTML = (n: { value: string; caption: string; tone?: Tone }, base: string): string =>
  `<div class="half-num"><div class="shout big-v${n.tone && n.tone !== "focus" ? ` ${n.tone}` : ""}"${at(join(base, "number.value"), "esc")}>${esc(n.value)}</div><p${at(join(base, "number.caption"), "md")}>${md(n.caption)}</p></div>`;
