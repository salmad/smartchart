/* An object's settings, read from the schema (hand editing). The enums and booleans on the object under the pointer are
   the settings; a choice whose patch would make validate report a new error is left out. Every setting is a patch for
   applyPatch, the same path the agent writes on, so a new schema field shows up here with no other code. */
import { applyPatch, parsePath } from "../agent/patch.js";
import { getAt } from "./edit.js";
import { KIND_FIELDS, describe, validate, type FieldView } from "./schema.js";
import type { Target } from "./actions.js";
import type { Slide, Style } from "../types.js";

type Patch = Record<string, unknown>;
export type Setting = { id: string; label: string; path: string } & (
  | { kind: "choice"; options: { value: string; label: string }[]; value: string; set(value: string): Patch }
  | { kind: "flag"; on: boolean; set(on: boolean): Patch });

const LABELS: Record<string, string> = {
  emphasis: "Emphasis", align: "Alignment", area: "Fill under the line", dashed: "Dashed", bars: "Bars", bold: "Bold", italic: "Italic",
  stacking: "Stacking", mark: "Mark", tone: "Emphasis", highlight: "Highlight this bar",
};
const VALUES: Record<string, string> = { focus: "Highlight", neutral: "Normal", normal: "Normal", muted: "Mute", contrast: "Contrast", neg: "Negative", pos: "Positive" };
const cap = (s: string) => `${s[0].toUpperCase()}${s.slice(1)}`;
const label = (field: string) => LABELS[field] ?? cap(field);
const valueLabel = (v: string) => VALUES[v] ?? cap(v);
/* Fields that are never a setting: the kind of thing, words, pictures. */
const NEVER = new Set(["kind", "icon", "logo"]);

/** The fields of the object at a path ("chart.series[1]", "table.columns[2]"), as the template card describes them. */
function fieldsAt(slide: Slide, style: Style, path: string): Record<string, FieldView> | undefined {
  let fields: Record<string, FieldView> | undefined = describe(slide.template, style).fields, def: FieldView | undefined;
  for (const k of parsePath(path) ?? []) {
    if (typeof k === "number") { def = def?.of; fields = def?.fields; } else { def = fields?.[k]; fields = def?.fields; }
  }
  return fields;
}

/** The object(s) a target points at: their paths, and the chart bar when it is one. */
function objectsOf(t: Target, slide: Slide): string[] {
  switch (t.kind) {
    case "item": return [t.item];
    case "series": case "bar": return [`chart.series[${t.series}]`];
    case "cells": {
      const lo = Math.min(t.c0, t.c1), hi = Math.max(t.c0, t.c1), n = slide.table?.columns.length ?? 0;
      if (Math.min(t.r0, t.r1) < 0) return Array.from({ length: Math.min(hi, n - 1) - lo + 1 }, (_, i) => `table.columns[${lo + i}]`);
      return [`table.rows[${Math.max(0, Math.min(t.r0, t.r1))}]`];
    }
    case "slide": return slide.chart ? ["chart"] : [];
    default: return [];
  }
}

const isEnum = (d: FieldView | undefined): d is FieldView & { values: readonly string[] } => d?.type === "enum" && Array.isArray(d.values) && d.values.length > 0;
const bool = (d: FieldView | undefined) => d?.type === "boolean";
const obj = (slide: Slide, path: string) => (getAt(slide, path) ?? {}) as Record<string, unknown>;

/** The one Emphasis choice an object's own fields fold into (spec: Highlight, Normal, Mute; Contrast for a series). */
type Choice = Extract<Setting, { kind: "choice" }>;
function emphasis(fields: Record<string, FieldView>, paths: string[], slide: Slide): { setting: Choice; used: string[] } | null {
  const first = paths[0], values = (get: (o: Record<string, unknown>) => string) => new Set(paths.map((p) => get(obj(slide, p))));
  const make = (options: string[], get: (o: Record<string, unknown>) => string, set: (p: string, v: string) => Patch, used: string[]) => {
    const seen = values(get);
    return { used, setting: { id: "emphasis", label: label("emphasis"), path: `${first}.${used[0]}`, kind: "choice" as const, options: options.map((value) => ({ value, label: valueLabel(value) })),
      value: seen.size === 1 ? [...seen][0] : "", set: (v: string): Patch => Object.assign({}, ...paths.map((p) => set(p, v))) } };
  };
  if (isEnum(fields.color) && fields.color.values.includes("focus"))
    return make(fields.color.values.map(String).filter((v) => v !== "auto"), (o) => String(o.color ?? "neutral"), (p, v) => ({ [`${p}.color`]: v }), ["color"]);
  if (bool(fields.focus) && bool(fields.muted))
    return make(["focus", "normal", "muted"], (o) => (o.focus ? "focus" : o.muted ? "muted" : "normal"), (p, v) => ({ [`${p}.focus`]: v === "focus" ? true : null, [`${p}.muted`]: v === "muted" ? true : null }), ["focus", "muted"]);
  if (bool(fields.focus) && isEnum(fields.style) && fields.style.values.includes("muted"))
    return make(["focus", "normal", "muted"], (o) => (o.focus ? "focus" : o.style === "muted" ? "muted" : "normal"),
      (p, v) => ({ [`${p}.focus`]: v === "focus" ? true : null, ...(v === "muted" ? { [`${p}.style`]: "muted" } : obj(slide, p).style === "muted" ? { [`${p}.style`]: null } : {}) }), ["focus", "style"]);
  // A list takes one focus item ("at most one"), so Highlight moves it: the item that had it is cleared in the same patch.
  if (bool(fields.focus)) return make(["focus", "normal"], (o) => (o.focus ? "focus" : "normal"), (p, v) => {
    const parent = p.replace(/\[\d+\]$/, ""), list = getAt(slide, parent), mine = Number(/\[(\d+)\]$/.exec(p)?.[1]);
    const others = v === "focus" && Array.isArray(list) ? list.flatMap((x, i) => (i !== mine && x && typeof x === "object" && (x as Record<string, unknown>).focus ? [[`${parent}[${i}].focus`, null]] : [])) : [];
    return { [`${p}.focus`]: v === "focus" ? true : null, ...Object.fromEntries(others) };
  }, ["focus"]);
  if (isEnum(fields.tone) && fields.tone.values.includes("focus"))
    return make(fields.tone.values.map(String), (o) => String(o.tone ?? "neutral"), (p, v) => ({ [`${p}.tone`]: v }), ["tone"]);
  return null;
}

export function settingsFor(target: Target, slide: Slide, style: Style): Setting[] {
  const paths = objectsOf(target, slide), out: Setting[] = [];
  if (!paths.length) return out;
  const fields = fieldsAt(slide, style, paths[0]);
  if (!fields) return out;
  const before = new Set(validate(slide, style).errors);
  // A patch is offered when applying it adds no error the slide did not already have.
  const fine = (patch: Patch) => { const r = applyPatch(slide, patch); return !!r.slide && validate(r.slide, style).errors.every((e) => before.has(e)); };

  if (target.kind === "bar" && (slide.chart?.kind ?? "bars") === "bars") {
    const { series, index } = target, h = slide.chart?.highlight, on = h?.series === series && h.index === index;
    // A series that is the focus gives way: the highlighted bar is the focus, so the two never stand together.
    const demote = Object.fromEntries((slide.chart?.series ?? []).flatMap((s, i) => (s.color === "focus" ? [[`chart.series[${i}].color`, "neutral"]] : [])));
    const flag: Setting = { id: "highlight", label: label("highlight"), path: "chart.highlight", kind: "flag", on,
      set: (v) => (v ? { "chart.highlight": { series, index }, ...demote } : { "chart.highlight": null }) };
    if (slide.chart?.series?.[series]?.mark !== "line" && fine(flag.set(!on))) out.push(flag);
  }

  const emph = (target.kind === "slide" ? null : emphasis(fields, paths, slide)), skip = new Set(emph?.used ?? []);
  if (emph) {
    const { setting } = emph, options = setting.options.filter((o) => o.value === setting.value || fine(setting.set(o.value)));
    if (options.length > 1) out.push({ ...setting, options });
  }

  const chartKind = slide.chart?.kind ?? "bars";
  for (const [name, def] of Object.entries(fields)) {
    if (skip.has(name) || NEVER.has(name) || (paths[0] === "chart" && !KIND_FIELDS[chartKind as keyof typeof KIND_FIELDS]?.includes(name))) continue;
    const path = (p: string) => `${p}.${name}`;
    if (isEnum(def)) {
      const current = new Set(paths.map((p) => String(obj(slide, p)[name] ?? def.default ?? "")));
      const value = current.size === 1 ? [...current][0] : "";
      const set = (v: string): Patch => Object.fromEntries(paths.map((p) => [path(p), v]));
      const options = def.values.map(String).filter((v) => v === value || fine(set(v))).map((v) => ({ value: v, label: valueLabel(v) }));
      if (options.length > 1) out.push({ id: name, label: label(name), path: path(paths[0]), kind: "choice", options, value, set });
    } else if (bool(def)) {
      const on = paths.every((p) => (obj(slide, p)[name] ?? def.default ?? false) === true);
      const set = (v: boolean): Patch => Object.fromEntries(paths.map((p) => [path(p), def.default === true ? (v ? null : false) : v ? true : null]));
      // Offered only when neither state is an error: a flag the field cannot take here (dashed on a bar) stays out.
      const explicit = (v: boolean) => Object.fromEntries(paths.map((p) => [path(p), v]));
      if (fine(explicit(true)) && fine(explicit(false))) out.push({ id: name, label: label(name), path: path(paths[0]), kind: "flag", on, set });
    }
  }
  return out;
}
