/* Header icons sit inline, left of their label, so the header keeps one line. Where an icon and its label would not fit
   across a column, every icon goes above its label instead (render.ts measures that). The budget cannot measure, so it
   asks here with the narrowest columns the table could get: it may count icons above that end up inline, never the
   reverse. */
import { plainOf } from "./markup.js";
import { groupLayout, type TableRoom } from "./groups.js";
import type { Table } from "../types.js";

/** Table widths at 1920 (measured): the full body, beside notes or a narrow table. */
const WIDTH: Record<TableRoom, number> = { full: 1664, split: 1024, half: 0 };
const CHAR = 14.1;          // a header character: 19px mono with .14em tracking
const ICON = 32;            // an inline icon and its gap
const PAD = 48;             // a cell's right padding, plus the inset of a highlighted column

/** Could any icon in this table end up above its label? Assumes the label column at its widest (40%). */
export function iconsMayStack(t: Partial<Table> | undefined, room: TableRoom): boolean {
  const cols = t?.columns ?? [];
  if (!cols.some((c) => c?.icon) || room === "half") return false;
  const heads = (t?.rows ?? []).filter((r) => r?.style === "group").map((r) => plainOf(String(r.cells?.[0] ?? "")).length);
  const group = groupLayout(t, room) === "column" ? Math.max(0, ...heads) * CHAR + 28 : 0;
  const data = (WIDTH[room] * .6 - group) / Math.max(1, cols.length - 1) - PAD - ICON;
  return cols.some((c) => c?.icon && plainOf(c.label ?? "").length * CHAR > data);
}
