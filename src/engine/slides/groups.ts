/* Group headings in a table: drawn as a first column (the heading beside its rows) when every heading is short enough
   to sit on one line in a narrow column; otherwise as a heading row over its rows. The row budget (schema) and the
   renderer both ask here, so the budget always costs the layout that is drawn. */
import { plainOf } from "./markup.js";
import type { Table } from "../types.js";

/** Where the table sits: the full body, beside notes (or a narrow 2-column table), or in one half of a pair. */
export type TableRoom = "full" | "split" | "half";
/** The longest heading that fits the group column on one line (about 18% of the table at the label size). */
const MAX: Record<TableRoom, number> = { full: 18, split: 12, half: 0 };
/** A table of two columns is drawn at 2/3 width, so it has the room of a table beside notes. */
export const roomOf = (t: Partial<Table> | undefined, notes: boolean): TableRoom => (notes || (t?.columns?.length ?? 0) <= 2 ? "split" : "full");

const text = (c: unknown) => String(c && typeof c === "object" ? (c as { value?: unknown }).value ?? "" : c ?? "");

export function groupLayout(t: Partial<Table> | undefined, room: TableRoom): "none" | "column" | "rows" {
  const heads = (t?.rows ?? []).filter((r) => r?.style === "group").map((r) => plainOf(text(r.cells?.[0])).trim());
  if (!heads.length) return "none";
  return room !== "half" && heads.every((h) => h.length <= MAX[room]) ? "column" : "rows";
}
