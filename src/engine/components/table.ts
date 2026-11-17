/* A table: columns aligned by their figures, marks and scores, status pills, bullets, logos and in-cell bars, and groups
   as rows or as a first column. `base` is the table's own path ("table" on a slide, "halves[0].table" in a pair). */
import type { Cell, Table } from "../types.js";
import { CELL_MAX, plain } from "../slides/schema.js";
import { markKinds, markOf } from "../slides/marks.js";
import { columnAlign, figureOf, placeOf } from "../slides/align.js";
import { groupLayout, docGroupLayout, type TableRoom } from "../slides/groups.js";
import { at, esc, item, list, md } from "./text.js";
import { ballKey, markHTML } from "./scores.js";
import { named } from "./pictures.js";
import { heatSteps } from "./heat.js";

export function tableHTML(t: Table, base: string, key = true, room: TableRoom = "full", doc = false): string {
  const al = columnAlign(t), n = t.columns.length, byColumn = (doc ? docGroupLayout(t) : groupLayout(t, room)) === "column";
  // Bars: each figure to scale with its column's largest; the figures right-aligned in a fixed width (in ch, mono) so every
  // bar in the column starts and is measured from one edge.
  const body = t.rows.filter((r) => r.style !== "group");
  const bars = t.columns.map((c, j) => (c.bars && al[j] === "num" ? { max: Math.max(0, ...body.filter((r) => r.style !== "total").map((r) => figureOf(r.cells[j]) ?? 0)), ch: Math.max(1, ...body.map((r) => plain(String(typeof r.cells[j] === "object" && r.cells[j] ? (r.cells[j] as { value?: string }).value ?? "" : r.cells[j] ?? "")).length)) } : null));
  const barred = (j: number, c: Cell, inner: string) => {
    const b = bars[j], v = figureOf(c);
    if (!b) return inner;
    const p = b.max > 0 && v !== null && v > 0 ? Math.round((v / b.max) * 1000) / 10 : 0;
    return `<span class="cbar"><i style="width:${p}%"></i></span>${inner}`;
  };
  // A target line: the renderer states where it goes (share of the bar track, the bars' own scale); a fitter draws it.
  const passes = (j: number, c: Cell) => { const tg = t.columns[j]?.target, v = figureOf(c);
    return !!tg && v !== null && (tg.better === "above" ? v >= tg.value : v <= tg.value); };
  const targetHTML = (j: number) => { const tg = t.columns[j]?.target, b = bars[j];
    if (!tg || !b || b.max <= 0) return "";
    return `<span class="tbl-target" style="--at:${Math.round((tg.value / b.max) * 1000) / 10}"><span${at(`${base}.columns[${j}].target.label`, "esc")}>${esc(tg.label)}</span></span>`; };
  // Heat: every heat column on one scale, struck cells left out; the [[focus]] cell in a heat column is drawn solid (best).
  // Struck cells are greyed with a cross; the outlined column closes on the last body row.
  const obj = (c: Cell | undefined) => (typeof c === "object" && c ? c : null);
  const heatAt = new Map<string, number>(), lastBody = t.rows.reduce((last, r, i) => (r.style !== "group" ? i : last), -1);
  const heatCells = t.rows.flatMap((r, i) => (r.style === "group" || r.style === "total" ? [] : t.columns.flatMap((c, j) => (c.heat && j > 0 ? [{ i, j, v: obj(r.cells[j])?.struck ? null : figureOf(r.cells[j]) }] : []))));
  heatSteps(heatCells.map((x) => x.v)).forEach((h, n) => heatAt.set(`${heatCells[n].i},${heatCells[n].j}`, h));
  const extra = (c: Cell, i: number, j: number) => {
    const out: string[] = [], h = heatAt.get(`${i},${j}`) ?? 0;
    if (obj(c)?.struck) out.push("struck");
    else if (heatAt.has(`${i},${j}`) && /\[\[.+?\]\]/.test(String(obj(c) ? obj(c)?.value ?? "" : c ?? ""))) out.push("heat best");
    else if (h) out.push(`heat h${h}`);
    if (t.columns[j]?.outline && i === lastBody) out.push("outline-end");
    return out.join(" ");
  };
  const keyHTML = () => { const k = t.key; if (!k) return "";
    const parts = (["focus", "struck", "outline"] as const).filter((x) => k[x]).map((x) => `<span class="k-${x}"${at(`${base}.key.${x}`, "esc")}>${esc(k[x] ?? "")}</span>`);
    return parts.length ? `<p class="heat-key">${parts.join("")}</p>` : ""; };
  // A verdict column (ticks, pros and cons): every cell a mark with its reason (✗ Pasted in, then restyled). The mark leads
  // its words on one line, left-aligned like text. Bare marks (a scorecard) and figures stay as their column aligns them.
  const verdict = t.columns.map((_, j) => j > 0 && body.length > 0 && body.every((r) => { const c = r.cells[j], o = typeof c === "object" && c ? c : null; return !!o?.note && !!markOf(String(o.value ?? "")); }));
  const cls = (c: Table["columns"][number] | undefined, j: number) => [`al-${verdict[j] ? "text" : al[j]}`, verdict[j] ? "verdict" : "", placeOf(c) ? `pl-${placeOf(c)}` : "", c?.focus ? "focus" : "", c?.outline ? "outline" : "", c?.heat && j > 0 ? "heat-col" : "", c?.muted ? "muted" : "", c?.bold ? "bold" : "", c?.italic ? "italic" : ""].filter(Boolean).join(" ");
  const P = (r: number, j: number) => `${base}.rows[${r}].cells[${j}]`;
  const note = (o: { note?: string }, p: string) => (o.note ? `<small${at(`${p}.note`, "esc")}>${esc(o.note)}</small>` : "");
  const cell = (c: Cell, r: number, j: number) => {
    const p = P(r, j), o = typeof c === "object" && c ? c : null, text = o ? o.value ?? "" : c ?? "", mark = markOf(String(text)), k = [cls(t.columns[j], j), extra(c, r, j)].filter(Boolean).join(" ");
    if (mark && o?.note && verdict[j]) return `<td class="${k}"><span class="vd"${at(`${p}.value`, "md")}>${markHTML(mark, plain(String(text)))}</span><span${at(`${p}.note`, "esc")}>${esc(o.note)}</span></td>`;
    if (mark && o?.note) return `<td class="${k} score has-note"><span${at(`${p}.value`, "md")}>${markHTML(mark, plain(String(text)))}</span>${note(o, p)}</td>`;
    if (mark) return `<td class="${k} score"${at(o ? `${p}.value` : p, "md")}>${markHTML(mark, plain(String(text)))}</td>`;
    if (o?.status) return `<td class="${k} status"><span class="pill"${at(`${p}.value`, "esc")}>${esc(o.value ?? "")}</span>${note(o, p)}</td>`;
    if (o?.bullets) return `<td class="${k} has-bul">${o.value ? `<span${at(`${p}.value`, "md")}>${md(o.value)}</span>` : ""}${list(o.bullets, `${p}.bullets`)}</td>`;
    if (o?.icon) return `<td class="${k} has-ric"><span class="ric"><i data-lucide="${esc(o.icon)}"></i><span${at(`${p}.value`, "md")}>${md(o.value ?? "")}</span></span>${note(o, p)}</td>`;
    if (o?.logo) return `<td class="${k} has-lg">${named(o.logo, `<span${at(`${p}.value`, "md")}>${md(o.value ?? "")}</span>`, plain(String(o.value ?? "")), `${p}.logo`)}${note(o, p)}</td>`;
    if (bars[j]) return `<td class="${k} has-bar${passes(j, c) ? " pass" : ""}" style="--vc:${bars[j]?.ch}">${barred(j, c, `<span${at(o ? `${p}.value` : p, "md")}>${md(o ? o.value ?? "" : c ?? "")}</span>`)}${o ? note(o, p) : ""}</td>`;
    if (o) return `<td class="${k}"><span${at(`${p}.value`, "md")}>${md(o.value ?? "")}</span>${o.struck ? `<span class="strike-x" aria-hidden="true">✗</span>` : ""}${note(o, p)}</td>`;
    return `<td class="${k}"${at(p, "md")}>${md(c ?? "")}</td>`;
  };
  const head = (c: Table["columns"][number], j: number) => c.logo
    ? `<th class="${cls(c, j)} has-lg">${named(c.logo, `<span${at(`${base}.columns[${j}].label`, "esc")}>${esc(c.label ?? "")}</span>`, c.label ?? "", `${base}.columns[${j}].logo`)}</th>`
    : c.icon
    ? `<th class="${cls(c, j)} has-ic"><i data-lucide="${esc(c.icon)}"></i><span${at(`${base}.columns[${j}].label`, "esc")}>${esc(c.label ?? "")}</span></th>`
    : c.target && bars[j]
    ? `<th class="${cls(c, j)} has-target"><span${at(`${base}.columns[${j}].label`, "esc")}>${esc(c.label ?? "")}</span>${targetHTML(j)}</th>`
    : `<th class="${cls(c, j)}"${at(`${base}.columns[${j}].label`, "esc")}>${esc(c.label ?? "")}</th>`;
  const row = (r: Table["rows"][number], i: number) => {
    if (r.style === "group") { const g = r.cells[0], o = typeof g === "object" && g ? g : null;
      return `<tr class="group"${item(`${base}.rows[${i}]`)}><td${at(o ? `${P(i, 0)}.value` : P(i, 0), "md")}>${md(o ? o.value ?? "" : g ?? "")}</td>${"<td></td>".repeat(n - 1)}</tr>`; }
    return `<tr class="${[r.style, r.focus ? "focus" : ""].filter(Boolean).join(" ")}"${item(`${base}.rows[${i}]`)}>${r.cells.map((c, j) => cell(c, i, j)).join("")}</tr>`;
  };
  /* Groups as a first column: every row gets a group cell, so columns keep their index; the heading sits in its first
     row's cell (an item of its own, so it is selected and edited as the group row), and a group's last row closes it. */
  const groupCell = (i: number) => {
    const r = t.rows[i], g = r.cells[0], o = typeof g === "object" && g ? g : null;
    return `<td class="grp"${item(`${base}.rows[${i}]`)}><span${at(o ? `${P(i, 0)}.value` : P(i, 0), "md")}>${md(o ? o.value ?? "" : g ?? "")}</span></td>`;
  };
  const columnRows = () => {
    let head = -1;
    return t.rows.flatMap((r, i) => {
      if (r.style === "group") { head = i; return []; }
      const first = head >= 0 && t.rows[i - 1]?.style === "group", end = i === t.rows.length - 1 || t.rows[i + 1]?.style === "group";
      const html = row(r, i).replace(/^(<tr class=")([^"]*)("[^>]*>)/, (_m, a: string, c: string, b: string) => `${a}${[c, end ? "grp-end" : ""].filter(Boolean).join(" ")}${b}${first ? groupCell(head) : `<td class="grp"></td>`}`);
      return [html];
    }).join("");
  };
  // Two columns of label and figure sit narrow; two columns of words take the full width.
  const wordy = body.some((r) => r.cells.some((c) => plain(String(typeof c === "object" && c ? c.value ?? "" : c ?? "")).length > CELL_MAX));
  return `<table class="tbl${n <= 2 && !wordy ? " narrow" : ""}${byColumn ? " by-group" : ""}${doc ? " wrap" : ""}"><colgroup>${byColumn ? `<col class="grp">` : ""}${t.columns.map((c) => { const k = [c.focus ? "focus" : "", c.outline ? "outline" : ""].filter(Boolean).join(" "); return k ? `<col class="${k}">` : "<col>"; }).join("")}</colgroup>
    <thead><tr>${byColumn ? `<th class="grp"></th>` : ""}${t.columns.map(head).join("")}</tr></thead>
    <tbody>${byColumn ? columnRows() : t.rows.map(row).join("")}</tbody></table>${key && markKinds(t).has("balls") ? ballKey() : ""}${keyHTML()}`;
}
