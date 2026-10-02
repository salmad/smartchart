/* Column alignment from content (spec 3.6 L2). Framework-free: the renderer and the validator both use it. */
import { plainOf } from "./markup.js";
import type { Cell, Table } from "../types.js";

const cellValue = (c: Cell | undefined) => plainOf(String(c && typeof c === "object" ? c.value ?? "" : c ?? "")).trim();
const NUMERIC = /^~?\(?[+−-]?[£$€]?\d[\d,.]*(?:[–-]\d[\d,.]*)?\s?(%|x|×|k|m|bn|pp|bps)?\)?(\/\w+)?$/i;
const rich = (c: Cell | undefined) => !!c && typeof c === "object" && (!!c.status || !!c.bullets);

/** Alignment per column from its content: label column text, numbers right, short symbols centred. */
export type Align = "text" | "num" | "sym";
export function columnAlign(t: Pick<Table, "columns" | "rows">): Align[] {
  const rows = t.rows.filter((r) => r.style !== "group");
  return t.columns.map((_, j) => {
    if (j === 0) return "text";
    if (rows.some((r) => rich(r.cells?.[j]))) return "text";
    const vals = rows.map((r) => cellValue(r.cells?.[j])).filter((v) => v && v !== "—" && v !== "–" && v !== "-");
    // Symbols are marks (✓, —, ●) or yes/no; a short word such as "CEO" is text.
    if (!vals.length || vals.every((v) => v.length <= 3 && !/\d/.test(v) && (!/\p{L}/u.test(v) || /^(yes|no|y|n|n\/a)$/i.test(v)))) return "sym";
    return vals.every((v) => NUMERIC.test(v)) ? "num" : "text";
  });
}
