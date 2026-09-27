/* Chart arithmetic (spec: 2026-09-27-chart-capabilities-design.md). Pure: shared by the renderer,
   the validator and the checks, so a figure on the slide is always the figure code computed. */

const MINUS = "−";
/** A value in its format: "£{v}m" + 2.1 → "£2.1m", −5 → "−£5m" (the sign before the currency). Whole numbers stay whole, others take one decimal. */
export const fmt = (tpl = "{v}", v) => (v < 0 ? MINUS : "") + tpl.replace("{v}", Number.isInteger(v) ? Math.abs(v) : Math.abs(v).toFixed(1));
/** Signed: "+£2.1m", "−£1.2m" (a true minus sign). */
export const signed = (tpl, v) => `${v < 0 ? MINUS : "+"}${fmt(tpl, round1(Math.abs(v)))}`;
const round1 = (v) => Math.round(v * 10) / 10;
/** A rate in %: one decimal under 10, whole above ("+4.5%", "+14%"). */
const pct = (r) => { const v = r * 100, a = Math.abs(v), s = a < 10 ? String(round1(a)) : String(Math.round(a)); return `${v < 0 ? MINUS : "+"}${s}%`; };

const fmtOf = (c, s) => s?.format || c.format || "{v}";
const bars = (c) => (c.series || []).filter((s) => s.mark !== "line");

/** The values an annotation reads: the named series, else the stack totals, else the focus bar series. */
export function annotationSeries(c, a) {
  if (a.series !== undefined) { const s = c.series?.[a.series]; return s ? { values: s.values, format: fmtOf(c, s) } : null; }
  const B = bars(c);
  if (!B.length) return null;
  if (c.stacked === true) return { values: c.categories.map((_, i) => B.reduce((sum, s) => sum + Math.max(0, s.values[i] || 0), 0)), format: fmtOf(c, B[0]) };
  const s = B.find((x) => x.color === "focus") || B[0];
  return { values: s.values, format: fmtOf(c, s) };
}

export const cagr = (v0, v1, periods) => (v1 / v0) ** (1 / periods) - 1;

/**
 * What an annotation shows: { value (the number the title may quote), figure (the big part), caption (the
 * small part), text (both), sign }.
 */
export function annotationLabel(c, a) {
  const out = (value, figure, caption, sign) => ({ value, figure, caption, text: caption ? (a.type === "target" ? `${caption} ${figure}` : `${figure} ${caption}`) : figure, sign });
  if (a.type === "target") return out(a.value, fmt(fmtOf(c, bars(c)[0]), a.value), a.label || "Target", 0);
  const s = annotationSeries(c, a);
  if (!s) return null;
  const v0 = s.values[a.from], v1 = s.values[a.to];
  if (a.type === "cagr") { const r = cagr(v0, v1, a.to - a.from); return out(round1(r * 100), pct(r), "CAGR", Math.sign(r)); }
  const d = v1 - v0;
  if (a.relative) { const r = v1 / v0 - 1; return out(round1(r * 100), pct(r), "", Math.sign(r)); }
  if (/%$/.test(s.format.trim())) return out(round1(Math.abs(d)), `${d < 0 ? MINUS : "+"}${round1(Math.abs(d))}`, "pp", Math.sign(d));
  return out(round1(Math.abs(d)), signed(s.format, d), "", Math.sign(d));
}

/** Half a unit in the last digit written: 118 → 0.5, 11.8 → 0.05. */
const halfDigit = (v) => 0.5 * 10 ** -((String(v).split(".")[1] || "").length);

/**
 * A waterfall's steps: [{ label, kind: total|up|down, from, to, value, focus }], plus errors when a written
 * total does not match the running sum (the maths is checked, spec 2.1).
 */
export function waterfall(items, path = "chart.items") {
  const steps = [], errors = [];
  let run = 0;
  items.forEach((it, i) => {
    if (!it) return;
    if (i === 0 || it.total) {
      if (i === 0 && typeof it.value !== "number") errors.push(`${path}[0]: the first item is the starting total and needs a value.`);
      const given = it.value, value = i === 0 ? given ?? 0 : run;
      if (i > 0 && typeof given === "number" && Math.abs(given - run) > Math.max(halfDigit(given), Math.abs(run) * .005))
        errors.push(`${path}[${i}].value: ${given}, but the steps before it sum to ${round1(run)}. Fix a step or leave the total out (code computes it).`);
      run = value;
      steps.push({ label: it.label, kind: "total", from: 0, to: value, value, focus: !!it.focus });
    } else {
      if (typeof it.value !== "number") { errors.push(`${path}[${i}].value: a step needs a signed number (e.g. 3.1 or -1.2).`); return; }
      steps.push({ label: it.label, kind: it.value < 0 ? "down" : "up", from: run, to: run + it.value, value: it.value, focus: !!it.focus });
      run += it.value;
    }
  });
  return { steps, errors };
}

/** 100% stacked: each bar series as a share of its category total, in %. */
export const shares = (c) => {
  const B = bars(c), tot = c.categories.map((_, i) => B.reduce((sum, s) => sum + Math.max(0, s.values[i] || 0), 0));
  return B.map((s) => s.values.map((v, i) => (tot[i] ? (Math.max(0, v) / tot[i]) * 100 : 0)));
};

/**
 * Automatic axis break (spec 3): unstacked bars where the tallest bar is more than 2.5× the next tallest,
 * with no line or target in the bar unit above the cap. Returns { cap, series, index } or null.
 */
export function axisBreak(c) {
  if (c.stacked) return null;
  const B = bars(c);
  if (!B.length) return null;
  const all = B.flatMap((s) => s.values.map((v, i) => ({ v, series: c.series.indexOf(s), index: i }))).sort((a, b) => b.v - a.v);
  if (all.length < 2 || !(all[0].v > 2.5 * all[1].v) || all[1].v <= 0) return null;
  const cap = all[1].v * 1.5, unit = fmtOf(c, B[0]);
  const sameUnitLines = (c.series || []).filter((s) => s.mark === "line" && fmtOf(c, s) === unit).flatMap((s) => s.values);
  const targets = (c.annotations || []).filter((a) => a?.type === "target").map((a) => a.value);
  if ([...sameUnitLines, ...targets].some((v) => v > all[1].v * 1.2)) return null;
  return { cap, series: all[0].series, index: all[0].index };
}

/** Every figure the chart shows that code computed: R11 accepts a headline figure found here. */
export function derivedFigures(c) {
  if (!c) return [];
  if (c.kind === "waterfall") return waterfall(c.items || []).steps.map((s) => Math.abs(s.value));
  if ((c.kind || "bars") !== "bars") return [];
  const out = (c.annotations || []).map((a) => { try { return annotationLabel(c, a)?.value; } catch { return null; } }).filter((v) => typeof v === "number");
  if (c.stacked === "100" && c.categories) out.push(...shares(c).flat().map(Math.round));
  return out;
}
