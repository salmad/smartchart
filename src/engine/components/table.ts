/* A table: columns aligned by their figures, marks and scores, status pills, bullets, logos and in-cell bars, and groups
   as rows or as a first column. `base` is the table's own path ("table" on a slide, "halves[0].table" in a pair). */
import type { Cell, Table } from "../types.js";
import { plain } from "../slides/schema.js";
import { markKinds, markOf } from "../slides/marks.js";
import { columnAlign, figureOf } from "../slides/align.js";
import { groupLayout, type TableRoom } from "../slides/groups.js";
import { at, esc, item, list, md } from "./text.js";
import { ballKey, markHTML } from "./scores.js";
import { named } from "./pictures.js";

export function tableHTML(t: Table, base: string, key = true, room: TableRoom = "full"): string {
  const al = columnAlign(t), n = t.columns.length, byColumn = groupLayout(t, room) === "column";
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
  const cls = (c: Table["columns"][number] | undefined, j: number) => [`al-${al[j]}`, c?.focus ? "focus" : "", c?.muted ? "muted" : "", c?.bold ? "bold" : "", c?.italic ? "italic" : ""].filter(Boolean).join(" ");
  const P = (r: number, j: number) => `${base}.rows[${r}].cells[${j}]`;
  const note = (o: { note?: string }, p: string) => (o.note ? `<small${at(`${p}.note`, "esc")}>${esc(o.note)}</small>` : "");
  const cell = (c: Cell, r: number, j: number) => {
    const p = P(r, j), o = typeof c === "object" && c ? c : null, text = o ? o.value ?? "" : c ?? "", mark = markOf(String(text)), k = cls(t.columns[j], j);
    if (mark && o?.note) return `<td class="${k} score has-note"><span${at(`${p}.value`, "md")}>${markHTML(mark, plain(String(text)))}</span>${note(o, p)}</td>`;
    if (mark) return `<td class="${k} score"${at(o ? `${p}.value` : p, "md")}>${markHTML(mark, plain(String(text)))}</td>`;
    if (o?.status) return `<td class="${k} status"><span class="pill"${at(`${p}.value`, "esc")}>${esc(o.value ?? "")}</span>${note(o, p)}</td>`;
    if (o?.bullets) return `<td class="${k} has-bul">${o.value ? `<span${at(`${p}.value`, "md")}>${md(o.value)}</span>` : ""}${list(o.bullets, `${p}.bullets`)}</td>`;
    if (o?.logo) return `<td class="${k} has-lg">${named(o.logo, `<span${at(`${p}.value`, "md")}>${md(o.value ?? "")}</span>`, plain(String(o.value ?? "")), `${p}.logo`)}${note(o, p)}</td>`;
    if (bars[j]) return `<td class="${k} has-bar" style="--vc:${bars[j]?.ch}">${barred(j, c, `<span${at(o ? `${p}.value` : p, "md")}>${md(o ? o.value ?? "" : c ?? "")}</span>`)}${o ? note(o, p) : ""}</td>`;
    if (o) return `<td class="${k}"><span${at(`${p}.value`, "md")}>${md(o.value ?? "")}</span>${note(o, p)}</td>`;
    return `<td class="${k}"${at(p, "md")}>${md(c ?? "")}</td>`;
  };
  const head = (c: Table["columns"][number], j: number) => c.logo
    ? `<th class="${cls(c, j)} has-lg">${named(c.logo, `<span${at(`${base}.columns[${j}].label`, "esc")}>${esc(c.label ?? "")}</span>`, c.label ?? "", `${base}.columns[${j}].logo`)}</th>`
    : c.icon
    ? `<th class="${cls(c, j)} has-ic"><i data-lucide="${esc(c.icon)}"></i><span${at(`${base}.columns[${j}].label`, "esc")}>${esc(c.label ?? "")}</span></th>`
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
  return `<table class="tbl${n <= 2 ? " narrow" : ""}${byColumn ? " by-group" : ""}"><colgroup>${byColumn ? `<col class="grp">` : ""}${t.columns.map((c) => (c.focus ? `<col class="focus">` : "<col>")).join("")}</colgroup>
    <thead><tr>${byColumn ? `<th class="grp"></th>` : ""}${t.columns.map(head).join("")}</tr></thead>
    <tbody>${byColumn ? columnRows() : t.rows.map(row).join("")}</tbody></table>${key && markKinds(t).has("balls") ? ballKey() : ""}`;
}
