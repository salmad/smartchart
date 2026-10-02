/* Editing by hand (spec 4.2, 4.4): the operations the user's buttons make, as patch sets for applyPatch, so the
   human writes through the same path as the agent. Limits come from the schema; nothing here is per template. */
import { parsePath } from "../agent/patch.js";
import { STARTERS, starterSlide } from "../starters/index.js";
import { MENU, describe, fieldsFor, plain, type FieldView } from "./schema.js";
import type { Slide, Style, TemplateId } from "../types.js";

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => v !== null && typeof v === "object" && !Array.isArray(v);

export function getAt(slide: Slide, path: string): unknown {
  return (parsePath(path) ?? []).reduce<unknown>((v, k) => (v !== null && typeof v === "object" ? (v as Record<string | number, unknown>)[k] : undefined), slide);
}

export interface ListOp { path: string; min: number; max: number; length: number; required: boolean }
// Chart data has its own grid (a pair's two charts too; the pair itself can swap); table columns change every row,
// and cells follow the columns.
const SKIP = /^chart\b|^halves\[\d+\]\.chart\b|^table\.columns$|\.cells$/;

export function listOps(slide: Slide, style: Style): ListOp[] {
  const out: ListOp[] = [];
  const walk = (fields: Record<string, FieldView>, value: Obj, base: string) => {
    for (const [k, def] of Object.entries(fields)) {
      const path = base ? `${base}.${k}` : k, v = value[k];
      if (SKIP.test(path)) continue;
      if (def.type === "list" && Array.isArray(v)) {
        // Framed cards come in exactly 2 (a contrast), whatever the list's general limits.
        const fixed = path === "cards" && (value as Obj).framed === true;
        out.push({ path, min: fixed ? 2 : def.items?.min ?? 0, max: fixed ? 2 : def.items?.max ?? Infinity, length: v.length, required: !!def.required });
        const of = def.of?.fields;
        if (of) v.forEach((x, i) => { if (isObj(x)) walk(of, x, `${path}[${i}]`); });
      } else if (def.type === "object" && def.fields && isObj(v)) walk(def.fields, v, path);
    }
  };
  walk(describe(slide.template, style).fields, slide as unknown as Obj, "");
  return out;
}

/** The list an item path belongs to: "cards[2]" → the cards list, index 2. */
export function listOf(ops: ListOp[], itemPath: string): { op: ListOp; index: number } | null {
  const m = /^(.*)\[(\d+)\]$/.exec(itemPath), op = m && ops.find((o) => o.path === m[1]);
  return m && op ? { op, index: Number(m[2]) } : null;
}

/* A blank of one field: text empty, a choice "auto" where code may pick, else its default; lists of text keep
   their minimum of empty entries, so a new card has one empty bullet to type into. */
function blank(def: FieldView, like: unknown): unknown {
  if (def.type === "text" || def.type === "markup" || def.type === "cell") return "";
  if (def.type === "enum") return def.values?.includes("auto") ? "auto" : def.default ?? like;
  if (def.type === "boolean") return def.default ?? false;
  // A list with a minimum keeps that many empty entries (bullets: 1); one without keeps its length (a row's cells).
  if (def.type === "list") return Array.isArray(like) && def.of ? Array.from({ length: Math.max(1, def.items?.min ?? like.length) }, () => blank(def.of as FieldView, like[0])) : like;
  if (def.type === "object" && def.fields && isObj(like)) return Object.fromEntries(Object.entries(like).flatMap(([k, x]) => (def.fields?.[k] ? [[k, blank(def.fields[k], x)]] : [])));
  return like;
}

/** A new item at `at`: its neighbour's shape with the text cleared. */
export function newItem(slide: Slide, style: Style, op: ListOp, at: number): Obj {
  const list = getAt(slide, op.path) as unknown[], like = list[Math.max(0, at - 1)] ?? list[0];
  const def = viewAt(slide, style, op.path);
  const fresh = def?.of ? blank(def.of, like) : "";
  // applyPatch sets one index; shifting the rest is a whole-list write.
  return { [op.path]: [...list.slice(0, at), fresh, ...list.slice(at)] };
}

/** Removing an item: above the minimum, the item; at it, an optional list goes whole (notes: 3 or none). */
export function removeItem(op: ListOp, index: number): Obj {
  return op.length > op.min ? { [`${op.path}[${index}]`]: null } : { [op.path]: null };
}

function viewAt(slide: Slide, style: Style, path: string): FieldView | undefined {
  let def: FieldView | undefined, fields: Record<string, FieldView> | undefined = describe(slide.template, style).fields;
  for (const k of parsePath(path) ?? []) {
    if (typeof k === "number") { fields = def?.of?.fields; continue; }
    def = fields?.[k];
    fields = def?.fields;
  }
  return def;
}

const COMMON = ["title", "kicker", "subtitle", "takeaway", "footnote", "source"], BARE = ["title", "subtitle"];
/** Paths of the words on a slide (text, markup and cell fields): not choices like icon, tone or focus. */
function textPaths(slide: Slide, style: Style): string[] {
  const out: string[] = [];
  const walk = (def: FieldView, v: unknown, path: string) => {
    if (v === undefined || v === null) return;
    if (def.type === "text" || def.type === "markup" || def.type === "cell") { out.push(path); return; }
    if (def.type === "list" && Array.isArray(v) && def.of) v.forEach((x, i) => walk(def.of as FieldView, x, `${path}[${i}]`));
    if (def.type === "object" && def.fields && isObj(v)) for (const [k, d] of Object.entries(def.fields)) walk(d, v[k], `${path}.${k}`);
  };
  for (const [k, d] of Object.entries(describe(slide.template, style).fields)) walk(d, (slide as unknown as Obj)[k], k);
  return out;
}

/** Another template: the shared fields stay, the body comes from that template's first starter (sample text). */
export function switchTemplate(slide: Slide, to: TemplateId, style: Style): { slide: Slide; keeps: string[]; drops: string[]; samples: string[] } {
  const st = STARTERS.find((s) => s[style].template === to);
  if (!st) throw new Error(`No starter for ${to}`);
  const base = starterSlide(st, style) as Slide & Obj, src = slide as Slide & Obj;
  const shared = MENU[to].frame === false || MENU[slide.template].frame === false ? BARE : COMMON;
  const allowed = fieldsFor(to, style);
  const keeps = Object.keys(src).filter((k) => shared.includes(k) && k in allowed && src[k] !== undefined);
  for (const k of shared) if (k !== "title" && k !== "subtitle") delete base[k];
  // A target with a plain-text field (the section title) cannot hold the markup the source's field had.
  for (const k of keeps) base[k] = typeof src[k] === "string" && allowed[k].type === "text" ? plain(src[k]) : src[k];
  const drops = Object.keys(src).filter((k) => k !== "template" && !keeps.includes(k) && k !== "focus")
    .map((k) => (Array.isArray(src[k]) ? `${(src[k] as unknown[]).length} ${k}` : k));
  const samples = textPaths(base, style).filter((p) => !keeps.includes(p));
  return { slide: base, keeps, drops, samples };
}

/** The field a validate() message is about: its leading path, when it is one. */
export function issuePath(msg: string): string | undefined {
  const head = msg.split(":")[0];
  return head !== msg && parsePath(head) ? head : undefined;
}

/** Move one list item to another place: the whole list written back in its new order. Out of range changes nothing. */
export function moveItem(slide: Slide, listPath: string, from: number, to: number): Obj {
  const list = getAt(slide, listPath)
  if (!Array.isArray(list) || from === to || [from, to].some((i) => i < 0 || i >= list.length)) return {}
  const next = list.slice(), [it] = next.splice(from, 1)
  next.splice(to, 0, it)
  return { [listPath]: next }
}

/* Table columns: a header, its format and one cell per row move together, so a column is never half-moved.
   The schema's 2–5 columns bound add and remove. */
type Tbl = NonNullable<Slide["table"]>;
const COLS = [2, 5];
const rewrite = (slide: Slide, f: (t: Tbl) => Tbl): { table?: Tbl } => (slide.table ? { table: f(structuredClone(slide.table)) } : {});

export function moveColumn(slide: Slide, from: number, to: number): { table?: Tbl } {
  const n = slide.table?.columns.length ?? 0;
  if (from === to || [from, to].some((i) => i < 0 || i >= n)) return {};
  const mv = <T,>(xs: T[]) => { const a = xs.slice(), [x] = a.splice(from, 1); a.splice(to, 0, x); return a; };
  return rewrite(slide, (t) => ({ ...t, columns: mv(t.columns), rows: t.rows.map((r) => (r.style === "group" ? r : { ...r, cells: mv(r.cells) })) }));
}

/** A blank column at index `at` (a new header with no label, empty cells). */
export function addColumn(slide: Slide, at: number): { table?: Tbl } {
  const n = slide.table?.columns.length ?? 0;
  if (n >= COLS[1]) return {};
  const put = <T,>(xs: T[], x: T) => [...xs.slice(0, at), x, ...xs.slice(at)];
  return rewrite(slide, (t) => ({ ...t, columns: put(t.columns, { label: "" }), rows: t.rows.map((r) => (r.style === "group" ? r : { ...r, cells: put(r.cells, "") })) }));
}

export function removeColumn(slide: Slide, at: number): { table?: Tbl } {
  const n = slide.table?.columns.length ?? 0;
  if (n <= COLS[0] || at < 0 || at >= n) return {};
  const drop = <T,>(xs: T[]) => xs.filter((_, i) => i !== at);
  return rewrite(slide, (t) => ({ ...t, columns: drop(t.columns), rows: t.rows.map((r) => (r.style === "group" ? r : { ...r, cells: drop(r.cells) })) }));
}
