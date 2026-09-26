/* Design checks (spec 6): rule checks in code, judgment checks as one Jev call.
   They are advisory: shown on the slide, never blocking. */
import { MENU, plain } from "../v5/schema.js";
import { jev } from "./llm.js";

const words = (s) => plain(s || "").toLowerCase().match(/[a-z0-9£$€%]+/g) || [];
const hasFocusSpan = (s) => /\[\[.+?\]\]/.test(s || "");
const UNIT = /[%£$€×]|\dx\b|\d\s?(k|m|bn|mn|pp|h|hrs?|min|s)\b|\b(bps|hours?|days?|weeks?|months?|years?|mins?)\b/i;

function focusCount(s) {
  switch (s.template) {
    case "chart": return (s.chart?.series || []).filter((x) => x.color === "focus").length;
    case "table": return (s.table?.columns || []).filter((c) => c.focus).length;
    case "steps": return (s.steps || []).filter((x) => x.focus).length;
    case "cards": return s.framed ? 1 : (s.cards || []).filter((c) => c.tone === "focus").length;
    default: return null;
  }
}

function parallelTexts(s) {
  if (s.template === "cards") return (s.cards || []).map((c) => plain(c.text || (c.bullets || []).join(" ") || c.title));
  if (s.template === "steps") return (s.steps || []).map((x) => plain(x.text));
  return (s.notes || []).map((n) => plain(n.title + " " + (n.text || "")));
}

const hasFigures = (s) => ["chart", "table", "number"].includes(s.template) || (s.template === "cards" && (s.cards || []).some((c) => c.value));

/** Rule checks R1–R8. `lines` is the measured title line count. */
export function ruleChecks(s, style, lines) {
  if (MENU[s.template].frame === false) return [];
  const out = [], add = (id, ok, msg) => out.push({ id, ok, msg });
  const maxLines = style === "pitch" ? 1 : 2;
  add("R1", lines <= maxLines, lines <= maxLines ? `Title fits on ${lines} line${lines > 1 ? "s" : ""}` : `Title runs to ${lines} lines (max ${maxLines})`);
  const n = words(s.title).length;
  if (style === "consulting") add("R2", n >= 5, n >= 5 ? "Title is a full sentence" : `Title has ${n} words; action titles state a so-what`);
  if (style === "pitch") add("R3", n <= 3 && !!s.subtitle, n > 3 ? `Title has ${n} words; keep the topic to 1–3` : s.subtitle ? "Topic title with the claim in the subtitle" : "No subtitle: the claim is missing");
  const fc = focusCount(s);
  if (fc !== null) {
    const head = style === "pitch" ? `${s.title} ${s.subtitle || ""}` : s.title;
    // A framed contrast can carry its point in the negative or positive colour instead.
    const titled = hasFocusSpan(head) || (s.framed && /\[-.+?-\]|\[\+.+?\+\]/.test(head));
    add("R4", fc === 1 && titled, fc !== 1 ? `${fc} focus elements; exactly one should stand out` : titled ? "One focus element, highlighted in the title" : "Focus element is not highlighted in the title with [[…]]");
  }
  if (s.template === "chart") add("R5", UNIT.test(s.chart?.format || "") || (s.chart?.series || []).some((x) => UNIT.test(x.format || "")), "Chart values carry a unit");
  if (s.template === "number") add("R5", UNIT.test(s.number?.value || "") || /\d/.test(s.number?.value || "") === false, UNIT.test(s.number?.value || "") ? "The big number carries a unit" : "The big number has no unit");
  if (s.takeaway) {
    const t = new Set(words(s.title)), k = words(s.takeaway), overlap = k.filter((w) => t.has(w)).length / Math.max(1, k.length);
    add("R6", overlap < 0.6, overlap < 0.6 ? "Takeaway adds to the title" : "Takeaway repeats the title");
  }
  const lens = parallelTexts(s).map((x) => x.length).filter(Boolean);
  if (lens.length >= 2) { const r = Math.max(...lens) / Math.min(...lens); add("R7", r <= 2.5, r <= 2.5 ? "Parallel items are balanced" : `Parallel items are unbalanced (${r.toFixed(1)}× longest vs shortest)`); }
  if (style === "consulting" && hasFigures(s)) add("R8", !!s.source, s.source ? "Figures have a source" : "Figures have no source");
  // Fix the R5 message when it fails.
  out.forEach((c) => { if (c.id === "R5" && !c.ok && c.msg.startsWith("Chart")) c.msg = "Chart values have no unit in `format`"; });
  return out;
}

const slideText = (s) => JSON.stringify(s, (k, v) => (typeof v === "string" ? plain(v) : v));

/** Judgment checks J1–J7: one Jev call; a check fails only when a failing value has p ≥ 0.7. */
export async function judgmentChecks(s, style) {
  if (MENU[s.template].frame === false) return { checks: [], ms: 0 };
  const qs = {}, add = (id, styles, instructions, options, pass, label) => { if (styles.includes(style)) qs[id] = { instructions, options, pass, label }; };
  add("J1", ["consulting"], "Is the title an action title that states a so-what, or a topic label?", { action: "States a conclusion or so-what.", topic: "Names a topic without a claim." }, "action", { action: "Title states a so-what", topic: "Title reads like a topic label" });
  add("J2", ["consulting", "pitch"], "Does the body (data, cards, notes, steps) support the claim in the title and subtitle?", { supported: "The body proves the claim.", partly: "The body supports part of the claim.", unsupported: "The body does not support the claim." }, "supported", { supported: "Body supports the claim", partly: "Body supports the claim only partly", unsupported: "Body does not support the claim" });
  const parallel = ["cards", "steps"].includes(s.template) || s.notes?.length;
  if (parallel) add("J3", ["consulting"], "Are the parallel items (cards, notes or steps) mutually exclusive and collectively exhaustive with respect to the title?", { mece: "Distinct and together complete.", overlap: "Some items overlap.", gap: "Something important is missing." }, "mece", { mece: "Parallel items are MECE", overlap: "Parallel items overlap", gap: "Parallel items leave a gap" });
  if (focusCount(s) === 1) add("J4", ["consulting", "pitch"], "Does the highlighted focus element (focus series, card, step or column) match what the title claims?", { matches: "The highlighted element is what the title is about.", mismatch: "The highlight points at something else." }, "matches", { matches: "Highlight matches the claim", mismatch: "Highlight does not match the claim" });
  if (s.takeaway) add("J5", ["consulting", "pitch"], "Does the takeaway add an implication, or restate the slide?", { adds: "Adds an implication.", restates: "Repeats what the slide already says." }, "adds", { adds: "Takeaway adds an implication", restates: "Takeaway restates the slide" });
  add("J6", ["pitch"], "Does the slide carry one idea, or several?", { one: "One idea.", several: "Several ideas competing." }, "one", { one: "One idea per slide", several: "Several ideas on one slide" });
  add("J7", ["consulting", "pitch"], `The slide uses the "${s.template}" template. Is that the right kind of slide for this content?`, { right: "The template suits the content.", ...Object.fromEntries(Object.keys(MENU).filter((k) => k !== s.template && !["cover", "section"].includes(k)).map((k) => [`better_${k}`, `A ${k} slide would show this better.`])) }, "right", {});
  const r = await jev(`Deck style: ${style}.\nSlide JSON: ${slideText(s)}`, Object.fromEntries(Object.entries(qs).map(([id, q]) => [id, { instructions: q.instructions, options: q.options }])));
  const checks = Object.entries(qs).map(([id, q]) => {
    const a = r[id]; if (!a) return null;
    const failP = Object.entries(a.probabilities).filter(([v]) => v !== q.pass).sort((x, y) => y[1] - x[1])[0] || ["", 0];
    const ok = failP[1] < 0.7;
    const msg = id === "J7" ? (ok ? "Template suits the content" : `A ${failP[0].replace("better_", "")} slide may show this better`) : q.label[ok ? q.pass : failP[0]];
    return { id, ok, msg, p: ok ? a.probabilities[q.pass] ?? 0 : failP[1] };
  }).filter(Boolean);
  return { checks, ms: r._ms };
}
