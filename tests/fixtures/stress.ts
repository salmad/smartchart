/* Stress deck (?stress=1 on the review page): every field filled to its limit, within the rules.
   Moved out of the engine's examples unchanged; only tests and the dev review page use it. */
import { fieldsFor, type FieldDef } from "@/engine/slides/schema";
import type { Chart, Slide, Style, TemplateId } from "@/engine/types";

/* The claim under test: if a slide passes validate(), it fits. */
const WORDS = ["market", "credit", "the", "growth", "customers", "revenue", "and", "for", "business", "card", "a", "lending", "of", "spend"];
const W = (n: number) => { let t = "", i = 0; while (t.length < n) t += (t ? " " : "") + WORDS[i++ % WORDS.length]; return t.slice(0, n).trim(); };
const TIMES = (n: number) => Array.from({ length: n });

/** The limit of a field path for a style, read from the registry so the stress deck follows the schema. */
function max(id: TemplateId, style: Style, ...path: string[]): number {
  let d: Partial<FieldDef> | undefined = { fields: fieldsFor(id, style) };
  for (const k of path) d = d?.fields?.[k] || d?.of?.fields?.[k];
  if (d?.type === "list") d = d.of;
  // A field with no limit gives 0, which W() turns into empty text.
  return (typeof d?.max === "object" ? d.max[style] : d?.max) ?? 0;
}

export function stressFor(st: Style): (Slide & { name: string })[] {
  const c = st === "consulting";
  const frame = (id: TemplateId) => ({
    ...(c ? { kicker: W(40) } : { subtitle: W(max(id, st, "subtitle")) }),
    title: W(max(id, st, "title")), takeaway: W(max(id, st, "takeaway")), footnote: W(110), source: W(110),
  });
  const bars: Chart = { categories: ["Year 1", "Year 2", "Year 3", "Year 4", "Year 5", "Year 6"], format: "£{v}m", series: [
    { name: "Interest income", mark: "bar", color: "neutral", values: [1, 3, 14, 42, 85, 99] }, { name: "Interchange", mark: "bar", color: "focus", values: [1, 2, 11, 36, 80, 95] },
    { name: "Gross margin", mark: "line", color: "contrast", format: "{v}%", values: [12, 24, 31, 36, 38, 40] }] };
  const notes = (n: number, withPoint: boolean) => TIMES(n).map((_, i) => ({ title: W(28), ...(c ? { text: W(i ? 75 : 50) } : {}), ...(withPoint ? { point: { series: 1, index: i + 2 } } : {}) }));
  const rows = (n: number, noted: boolean) => TIMES(n).map(() => ({ cells: [W(noted ? 40 : 24), noted ? { value: "(1,234)", note: "8% × £10.5k" } : "(1,234)", "12,345", "(34)"] }));
  return [
    { template: "cover", name: "Stress · cover", title: W(max("cover", st, "title")), subtitle: W(max("cover", st, "subtitle")) },
    { template: "section", name: "Stress · section", title: W(max("section", st, "title")), subtitle: W(max("section", st, "subtitle")) },
    { template: "number", name: "Stress · number", ...frame("number"), body: TIMES(c ? 2 : 1).map(() => W(max("number", st, "body"))), number: { value: "€400bn", caption: W(max("number", st, "number", "caption")) } },
    { template: "chart", name: "Stress · chart + notes", ...frame("chart"), chart: bars, notes: notes(3, false) },
    { template: "chart", name: "Stress · chart full", ...frame("chart"), chart: { categories: TIMES(12).map((_, i) => `Q${i % 4 + 1} ’${27 + (i >> 2)}`), format: "£{v}m",
      series: [{ name: "Base case", mark: "line", color: "focus", area: true, values: TIMES(12).map((_, i) => (i + 1) ** 2) }, { name: "Downside", mark: "line", color: "contrast", dashed: true, values: TIMES(12).map((_, i) => (i + 1) ** 2 * .6) }, { name: "Market", mark: "line", color: "neutral", values: TIMES(12).map((_, i) => 20 + i * 5) }] } },
    { template: "chart", name: "Stress · chart stacked", ...frame("chart"), chart: { stacked: true, categories: TIMES(6).map((_, i) => `Year ${i + 1}`), format: "£{v}m",
      series: [{ name: `${W(22)} 1`, mark: "bar", color: "focus", values: [4, 9, 15, 24, 33, 41] }, { name: `${W(22)} 2`, mark: "bar", color: "neutral", values: [2, 5, 9, 14, 20, 26] },
        { name: `${W(22)} 3`, mark: "bar", color: "contrast", values: [1, 2, 4, 7, 11, 15] }, { name: "Margin", mark: "line", color: "contrast", format: "{v}%", values: [12, 18, 24, 29, 33, 36] }] } },
    { template: "chart", name: "Stress · bars + 3 annotations", ...frame("chart"), chart: { categories: TIMES(6).map((_, i) => `Year ${i + 1}`), format: "£{v}m",
      series: [{ name: "Interest income", mark: "bar", color: "neutral", values: [4, 9, 15, 24, 33, 41] }, { name: "Interchange", mark: "bar", color: "focus", values: [2, 6, 13, 26, 40, 58] }],
      annotations: [{ type: "cagr", from: 0, to: 5 }, { type: "difference", from: 3, to: 5, series: 0 }, { type: "target", value: 50, label: W(16) }] } },
    { template: "chart", name: "Stress · axis break", ...frame("chart"), chart: { categories: TIMES(6).map((_, i) => `Region ${i + 1}`), format: "£{v}m",
      series: [{ name: "Spend", mark: "bar", color: "focus", values: [240, 38, 31, 26, 20, 12] }] } },
    { template: "chart", name: "Stress · waterfall 10", ...frame("chart"), chart: { kind: "waterfall", format: "£{v}m",
      items: [{ label: W(12), value: 120 }, ...TIMES(7).map((_, i) => ({ label: W(12), value: i % 3 === 2 ? -14.5 : 18.5 })), { label: W(12), total: true, value: 183.5 }, { label: W(12), value: -30.5 }] } },
    { template: "chart", name: "Stress · waterfall + notes", ...frame("chart"), notes: notes(3, false), chart: { kind: "waterfall", format: "£{v}m",
      items: [{ label: W(12), value: 120 }, ...TIMES(5).map((_, i) => ({ label: W(12), value: i % 2 ? -21.5 : 34.5, focus: i === 2 })), { label: W(12), total: true }] } },
    { template: "chart", name: "Stress · waterfall below zero", ...frame("chart"), chart: { kind: "waterfall", format: "£{v}m",
      items: [{ label: "Start", value: 4 }, { label: "Loss", value: -9 }, { label: "Low", total: true }, { label: "Raise", value: 12 }, { label: "End", total: true }] } },
    { template: "chart", name: "Stress · timeline 8×16", ...frame("chart"), chart: { kind: "timeline", periods: TIMES(16).map((_, i) => `M${i + 1}`),
      rows: TIMES(8).map((_, i) => ({ label: W(28), start: i, end: Math.min(15, i + 7), focus: i === 3 })),
      milestones: TIMES(4).map((_, i) => ({ label: W(16), at: 2 + i * 4 })) } },
    { template: "chart", name: "Stress · timeline + notes", ...frame("chart"), notes: notes(3, false), chart: { kind: "timeline", periods: TIMES(8).map((_, i) => `Q${i % 4 + 1} ’${27 + (i >> 2)}`),
      rows: TIMES(4).map((_, i) => ({ label: W(20), start: i, end: Math.min(7, i + 3) })), milestones: [{ label: W(16), at: 1 }, { label: W(16), at: 2 }, { label: W(16), at: 6 }] } },
    { template: "chart", name: "Stress · six bars and lines", ...frame("chart"), chart: { categories: TIMES(6).map((_, i) => `Year ${i + 1}`), format: "£{v}m",
      series: [1, 2, 3, 4, 5, 6].map((k) => ({ name: `${W(22)} ${k}`, mark: k <= 3 ? "bar" : "line", color: k === 1 ? "focus" : k === 4 ? "contrast" : "neutral",
        values: [[4, 9, 15, 24, 33, 41], [2, 5, 9, 14, 20, 26], [1, 2, 4, 7, 11, 15], [3, 6, 10, 16, 22, 30], [5, 8, 12, 18, 25, 35], [1, 3, 6, 9, 13, 20]][k - 1] })) } },
    { template: "table", name: "Stress · table full", ...frame("table"), table: { columns: [{ label: W(26) }, ...TIMES(4).map((_, i) => ({ label: W(12), focus: i === 0 }))],
      rows: c ? [...TIMES(5).map(() => ({ cells: [W(40), { value: "(1,234)", note: "8% × £10.5k" }, "12,345", "(34)", "—"] })), { cells: [W(30), "£179", "£10", "£128", "£95"], style: "total" }]
              : [...TIMES(4).map(() => ({ cells: [W(30), "(1,234)", "12,345", "(34)", "—"] })), { cells: [W(24), "£179", "£10", "£128", "£95"], style: "total" }] } },
    { template: "table", name: "Stress · table + notes", ...frame("table"), notes: notes(3, false), table: { columns: [{ label: W(20) }, ...TIMES(3).map((_, i) => ({ label: W(12), focus: i === 0 }))],
      rows: c ? [...rows(5, false), { cells: [W(24), "£179", "£10", "£128"], style: "total" }] : [...rows(4, false), { cells: [W(24), "£179", "£10", "£128"], style: "total" }] } },
    { template: "steps", name: "Stress · steps", ...frame("steps"), steps: TIMES(c ? 5 : 3).map((_, i) => ({ when: "Q3 2027+", title: W(max("steps", st, "steps", "title")), text: W(max("steps", st, "steps", "text")), focus: i === 1 })) },
    { template: "cards", name: "Stress · cards icon ×3", ...frame("cards"), cards: TIMES(3).map(() => c ? { icon: "zap", title: W(24), bullets: TIMES(3).map(() => W(40)) } : { icon: "zap", title: W(22), text: W(50) }) },
    { template: "cards", name: "Stress · cards icon ×4", ...frame("cards"), cards: TIMES(4).map(() => c ? { icon: "zap", title: W(24), bullets: TIMES(2).map(() => W(48)) } : { icon: "zap", title: W(22), text: W(30) }) },
    { template: "cards", name: "Stress · cards value ×4", ...frame("cards"), cards: TIMES(4).map((_, i) => ({ value: "€400bn", title: W(c ? 24 : 22), text: W(c ? 80 : 44), tone: i === 1 ? "focus" : "neutral" })) },
    { template: "cards", name: "Stress · cards framed", ...frame("cards"), framed: true, cards: TIMES(2).map((_, i) => ({ tone: i ? "focus" : "neg", label: W(30), title: W(14),
      ...(c ? { bullets: TIMES(3).map(() => W(48)), facts: TIMES(2).map(() => ({ label: W(14), text: W(38) })) } : { text: W(50) }) })) },
  ].map((s) => withExhibitHeads(s as Slide & { name: string }, st));
}

/** Charts take a caption at its limit. A table takes one only where its row budget leaves room (the full consulting
    table is already at 10 of 10.5 rows; pitch tables stay plain). A notes heading does not go with a takeaway, so
    the waterfall with notes trades its takeaway for a heading at its limit. */
function withExhibitHeads(s: Slide & { name: string }, st: Style): Slide & { name: string } {
  const caption = s.template === "chart" || (s.template === "table" && st === "consulting" && s.notes?.length) ? { caption: `${W(max(s.template, st, "caption") - 5)} · £m` } : {};
  if (s.name !== "Stress · waterfall + notes") return { ...s, ...caption };
  const { takeaway: _dropped, ...rest } = s;
  return { ...rest, ...caption, notesTitle: W(max(s.template, st, "notesTitle")) };
}
