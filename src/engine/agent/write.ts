/* The write pipeline every writer goes through (spec 9.4): autofix → validate → resolve auto (Jev) → autofix →
   measure → rule checks. The agent adds automatic shortening on top; a human's words are never shortened.
   strict: shape errors refuse the write (the agent rewrites); otherwise they come back as issues (a human saves). */
import { validate } from "../slides/schema";
import { autofix } from "./autofix";
import { resolveAuto, type Resolved } from "./resolve";
import { ruleChecks } from "./checks";
import type { JevFn } from "./llm";
import type { Slide, Style } from "../types";

export interface Measured { issues: string[]; lines: number; warnings: string[] }
export type Written =
  | { applied: false; issues: string[]; autofixes: string[] }
  | { applied: true; slide: Slide; issues: string[]; warnings: string[]; autofixes: string[]; resolved: Resolved; resolveMs: number };

/* validate() lists limits with shape errors. Limits are fit issues: applied and returned (spec 9.4). */
export const LIMIT = /characters|at most|budget|too many|Cut or merge|Shorten|with notes|with a takeaway/i;

export async function checkWrite(input: unknown, { style, jev, brief, strict, measure }: { style: Style; jev: JevFn; brief: string; strict: boolean; measure: (s: Slide) => Measured }): Promise<Written> {
  const first = autofix(input, style), v = validate(first.slide, style);
  const shape = v.errors.filter((e) => !LIMIT.test(e)), limits = v.errors.filter((e) => LIMIT.test(e));
  if (strict && shape.length) return { applied: false, issues: shape, autofixes: first.fixes };
  const r = await resolveAuto(first.slide, style, jev, brief);
  const done = autofix(r.slide, style), slide = done.slide;
  let m: Measured;
  try { m = measure(slide); } catch (e) { return { applied: false, issues: [`slide could not be rendered: ${e instanceof Error ? e.message : String(e)}`, ...limits], autofixes: first.fixes }; }
  const rules = ruleChecks(slide, style, m.lines).filter((c) => !c.ok).map((c) => `${c.id}: ${c.msg}`);
  return { applied: true, slide, issues: [...(strict ? [] : shape), ...limits, ...m.issues], warnings: [...v.warnings, ...m.warnings, ...rules],
    autofixes: [...first.fixes, ...done.fixes], resolved: r.resolved, resolveMs: r.ms };
}
