/* The timeline's rows as drawn lines: a level-1 row is a child of the level-0 row above, and a level-0 row with children
   is a group whose span is derived from them. One reading, shared by the checks, the renderer and the editor. */
import type { TimelineRow } from "../../types.js";

export interface Line { row: TimelineRow; index: number; level: 0 | 1; group: boolean; start: number; end: number; focus: boolean }

export function timelineLines(rows: readonly TimelineRow[]): Line[] {
  return rows.map((row, index) => {
    const level = row.level === 1 ? 1 : 0, group = level === 0 && rows[index + 1]?.level === 1;
    let start = row.start ?? 0, end = row.end ?? 0;
    if (group) {
      const kids: TimelineRow[] = [];
      for (let j = index + 1; rows[j]?.level === 1; j++) kids.push(rows[j]);
      const s = kids.map((k) => k.start).filter((n): n is number => typeof n === "number"), e = kids.map((k) => k.end).filter((n): n is number => typeof n === "number");
      start = s.length ? Math.min(...s) : 0; end = e.length ? Math.max(...e) : 0;
    }
    return { row, index, level, group, start, end, focus: !!row.focus };
  });
}
