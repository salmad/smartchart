/* A callout: a note, a decision or a risk, as one labelled line over a rule (PRDs and legal memos). */
import type { Callout } from "../types.js";
import { at, esc, join, md } from "./text.js";

const LABEL = { note: "Note", decision: "Decision", risk: "Risk" } as const;
export const calloutHTML = (c: Callout, base: string): string =>
  `<div class="callout t-${c.tone}"><span class="co-l"${c.label ? at(join(base, "label"), "esc") : ""}>${esc(c.label || LABEL[c.tone] || "")}</span><p${at(join(base, "text"), "md")}>${md(c.text)}</p></div>`;
