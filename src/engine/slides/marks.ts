/* Marks in table cells: a cell that is only a Harvey ball (○ ◔ ◑ ◕ ●) or a tick or cross (✓ ✗) is drawn as that mark,
   so every table scores in one drawn set rather than in whatever the font makes of the characters. */
import { plainOf } from "./markup.js";
import type { Cell, Table } from "../types.js";

export const BALLS = ["○", "◔", "◑", "◕", "●"] as const;
export const TICK = "✓", CROSS = "✗";
export type Mark = { kind: "ball"; v: number } | { kind: "tick" } | { kind: "cross" };

export function markOf(text: string): Mark | null {
  const t = plainOf(text).trim(), b = (BALLS as readonly string[]).indexOf(t);
  if (b >= 0) return { kind: "ball", v: b };
  if (t === TICK || t === "✔") return { kind: "tick" };
  if (t === CROSS || t === "✕" || t === "✘") return { kind: "cross" };
  return null;
}
const cellText = (c: Cell | null | undefined) => String(c && typeof c === "object" ? c.value : c ?? "");
/** The kinds of mark a table uses: "balls", "ticks" (ticks and crosses), both or neither. */
export function markKinds(t: Partial<Table> | undefined): Set<"balls" | "ticks"> {
  const out = new Set<"balls" | "ticks">();
  for (const r of t?.rows ?? []) for (const c of r?.cells ?? []) { const m = markOf(cellText(c)); if (m) out.add(m.kind === "ball" ? "balls" : "ticks"); }
  return out;
}
