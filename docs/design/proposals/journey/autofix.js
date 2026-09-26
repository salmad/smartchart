/* Code fixes what has one right answer and reports it (spec 9.4); it never shortens text or changes meaning.
   Idempotent: the write path runs it before and after `auto` choices are resolved. */
import { MENU } from "../v5/schema.js";

const cellText = (c) => String(c && typeof c === "object" ? c.value : c ?? "").trim();
/** "£1,000" → 1000, "(200)" → -200, "12%" → 12; null when the cell is not a number. */
const num = (c) => {
  const t = cellText(c), m = t.match(/^\(?[+−-]?[£$€]?(\d[\d,]*(?:\.\d+)?)\s?[%kmbn×x]*\)?$/i);
  return m ? (t.startsWith("(") || /^[−-]/.test(t) ? -1 : 1) * parseFloat(m[1].replace(/,/g, "")) : null;
};

export function autofix(slide, style) {
  const fixes = [];
  const walk = (v) => {
    if (typeof v === "string") return v.trim().replace(/\s+/g, " ").replace(/(\d)\s?percent\b/gi, "$1%").replace(/(^|[\s(])"(\S)/g, "$1“$2").replace(/(\S)"/g, "$1”").replace(/(\w)'(\w)/g, "$1’$2");
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).filter(([, x]) => x !== null && x !== undefined && x !== "").map(([k, x]) => [k, walk(x)]));
    return v;
  };
  const out = walk(slide);
  if (typeof out.source === "string" && /^source:\s*/i.test(out.source)) { out.source = out.source.replace(/^source:\s*/i, ""); fixes.push("removed 'Source:' prefix"); }
  if (style === "consulting" && MENU[out.template]?.frame !== false && /[^.]\.$/.test(out.title || "")) { out.title = out.title.slice(0, -1); fixes.push("removed title full stop"); }
  if (style === "pitch") delete out.kicker;
  if (out.template === "chart" && out.chart && Array.isArray(out.chart.series)) fixChart(out, fixes);
  if (out.template === "table" && out.table) fixTable(out.table, fixes);
  return { slide: out, fixes };
}

function fixChart(s, fixes) {
  const c = s.chart, series = c.series, fmt = (x) => x?.format || c.format || "{v}";
  series.forEach((x, i) => {
    if (x?.mark === "bar" && (x.area || x.dashed)) { delete x.area; delete x.dashed; fixes.push(`chart.series[${i}]: removed area/dashed (bar series)`); }
    if (x && !x.color && s.focus !== "auto") x.color = "neutral";
  });
  const bars = series.filter((x) => x?.mark === "bar");
  if (c.stacked === true && (bars.length < 2 || new Set(bars.map(fmt)).size > 1)) { c.stacked = false; fixes.push("chart.stacked: off (needs 2 or more bar series in one unit)"); }
  if (s.focus !== "auto") {
    const focus = series.map((x, i) => (x?.color === "focus" ? i : -1)).filter((i) => i >= 0);
    focus.slice(1).forEach((i) => { series[i].color = "neutral"; fixes.push(`chart.series[${i}].color: neutral (only one series is the focus)`); });
  }
  const allLines = series.length && series.every((x) => x?.mark === "line");
  (s.notes || []).forEach((n, i) => {
    if (!n?.point) return;
    if (allLines || !series[n.point.series] || !(n.point.index >= 0 && n.point.index < (c.categories || []).length)) { delete n.point; fixes.push(`notes[${i}].point: removed (${allLines ? "a chart of only lines has no points" : "it points past the data"})`); }
  });
}

function fixTable(t, fixes) {
  (t.columns || []).forEach((col, j) => { if (col && "num" in col) { delete col.num; fixes.push(`table.columns[${j}].num: removed (alignment is set by code)`); } });
  const rows = t.rows || [], last = rows.at(-1);
  if (rows.length < 2 || !last || last.style) return;
  const n = (t.columns || []).length;
  const sums = Array.from({ length: n }, (_, j) => j).slice(1).filter((j) => rows.every((r) => num(r.cells?.[j]) !== null));
  const isSum = sums.length > 0 && sums.every((j) => {
    const total = rows.slice(0, -1).reduce((sum, r) => sum + num(r.cells[j]), 0), v = num(last.cells[j]);
    return Math.abs(total - v) <= Math.max(1e-9, Math.abs(v) * 0.01);
  });
  if (/^\s*(total|sum|overall)\b/i.test(cellText(last.cells?.[0])) || isSum) { last.style = "total"; fixes.push(`table.rows[${rows.length - 1}].style: total`); }
}
