/* Fit on the server without a browser: character limits (validate) do the work; this only estimates the title's
   line count for rule check R1. The app re-measures every slide in a real browser when the deck is opened. */
import { plain } from "../slides/schema";
import type { Measured } from "../agent/write";
import type { Slide, Style } from "../types";

/** Characters per title line, from the title limits (consulting: 105 over 2 lines; pitch: one line). */
const PER_LINE: Record<Style, number> = { consulting: 53, pitch: 20 };

export const estimate = (style: Style) => (slide: Slide): Measured => ({
  issues: [], warnings: [], lines: Math.max(1, Math.ceil(plain(slide.title ?? "").length / PER_LINE[style])),
});
