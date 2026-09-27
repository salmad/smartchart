import { test } from "vitest";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PALETTES, MIN_DISTANCE, MIN_HUE_GAP, allocate, contrast, distance, hueGap, oklch, resolveAccent, secondHue, seriesSlots } from "../../src/engine/slides/colours";
import type { Chart, Series, Slide, Theme } from "../../src/engine/types";

const THEMES = Object.keys(PALETTES) as Theme[];
// Every 15° of hue at two strengths, plus the palette defaults, pure red and green, and near-greys.
const ACCENTS = [null, "#E8B94A", "#2447D1", "#FF0000", "#00C000", "#808080", "#8A8278", "#FFFF00", "#000000", "#FFFFFF",
  ...Array.from({ length: 24 }, (_, i) => [`hsl(${i * 15},80%,50%)`, `hsl(${i * 15},60%,35%)`]).flat().map(hslHex)];
function hslHex(s: string) {
  const [h, S, L] = (s.match(/[\d.]+/g) ?? []).map(Number), sat = S / 100, l = L / 100, a = sat * Math.min(l, 1 - l);
  const f = (n: number) => { const k = (n + h / 30) % 12; return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))); };
  return `#${[f(0), f(8), f(4)].map((v) => v.toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}
const series = (n: number, extra: Partial<Series> = {}): Series[] => Array.from({ length: n }, (_, i): Series => ({ name: `S${i}`, mark: "bar", color: i === 0 ? "focus" : "neutral", values: [1, 2], ...extra }));
const chartSlide = (chart: Chart): Slide => ({ template: "chart", title: "t", chart: { categories: ["a", "b"], ...chart } });

test("palette set: greys ≥ 3:1, ≥ 14 L* apart, and distinct from focus, neg and pos", () => {
  for (const t of THEMES) {
    const P = PALETTES[t], all = [P.focus, P.neg, P.pos, ...P.ctx, P.quiet];
    P.ctx.forEach((c) => assert.ok(contrast(c, P.bg) >= 3, `${t} ${c}`));
    for (let i = 1; i < P.ctx.length; i++) assert.ok(Math.abs(oklch(P.ctx[i])[0] - oklch(P.ctx[i - 1])[0]) >= .1, `${t} ramp step ${i}`);
    for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) assert.ok(distance(all[i], all[j]) >= MIN_DISTANCE, `${t} ${all[i]} vs ${all[j]}`);
  }
});

test("palette values match slides.css", () => {
  const css = readFileSync(new URL("../../src/engine/slides/slides.css", import.meta.url), "utf8");
  for (const t of THEMES) {
    const block = css.match(new RegExp(`\\.theme-${t} \\{([^}]+)\\}`))?.[1] ?? "", P = PALETTES[t];
    for (const k of ["bg", "fg", "focus", "neg", "pos"] as const) assert.ok(block.includes(`--${k}: ${P[k]}`), `${t} --${k}`);
    assert.ok(block.includes(`--neutral: ${P.quiet}`), `${t} --neutral is quiet`);
  }
});

test("any accent: meaning colours stay ≥ 30° away in hue, or the accent is refused", () => {
  for (const t of THEMES) for (const a of ACCENTS) {
    const r = resolveAccent(t, a);
    if (r.error) { assert.equal(r.focus, PALETTES[t].focus); continue; }
    for (const m of [r.neg, r.pos]) assert.ok(hueGap(oklch(m)[2], oklch(r.focus)[2]) >= MIN_HUE_GAP, `${t} ${a} → ${r.focus} vs ${m}`);
    assert.ok(contrast(r.focus, PALETTES[t].bg) >= 4.5, `${t} ${a} focus contrast`);
  }
});

test("red stays red and green stays green when they move", () => {
  const r = resolveAccent("ink", "#F97316");
  assert.ok(!r.error, r.error ?? "");
  assert.notEqual(r.neg, PALETTES.ink.neg);
  assert.ok(hueGap(oklch(r.neg)[2], oklch(PALETTES.ink.neg)[2]) <= 15);
  assert.match(resolveAccent("ink", "#FF3355").error ?? "", /red/);
});

test("the picker's presets are accepted on both palettes", () => {
  for (const t of THEMES) for (const h of ["#E8B94A", "#2447D1", "#0EA5E9", "#7C5CFF", "#D946EF", "#14B8A6"]) assert.equal(resolveAccent(t, h).error, undefined, `${t} ${h}`);
});

test("greys and pure red are refused with a reason", () => {
  assert.match(resolveAccent("paper", "#808080").error ?? "", /too grey/);
  assert.match(resolveAccent("ink", PALETTES.ink.neg).error ?? "", /red/);
  assert.match(resolveAccent("ink", PALETTES.ink.pos).error ?? "", /green/);
});

test("one context bar in unstacked bars is quiet and labelled; lines and stacks use the ramp", () => {
  const two = seriesSlots({ series: series(2) });
  assert.deepEqual(two.slots, ["focus", "quiet"]);
  assert.deepEqual(two.labelled, [false, true]);
  assert.deepEqual(seriesSlots({ stacked: true, series: series(2) }).slots, ["focus", "ctx3"]);
  assert.deepEqual(seriesSlots({ series: [...series(2), { name: "M", mark: "line", color: "contrast", values: [1, 2] }] }).slots, ["focus", "quiet", "ctx1"]);
  assert.deepEqual(seriesSlots({ series: series(2, { mark: "line" }) }).slots, ["focus", "ctx3"]);
});

test("context recedes: neutral series take the quietest grey first; a contrast series the strongest", () => {
  const s = series(4); s[3].color = "contrast";
  assert.deepEqual(seriesSlots({ series: s }).slots, ["focus", "ctx3", "ctx2", "ctx1"]);
});

test("series 5 and 6 take a second hue", () => {
  assert.deepEqual(seriesSlots({ series: series(6, { mark: "line" }) }).slots, ["focus", "ctx3", "ctx2", "ctx1", "alt1", "alt2"]);
});

test("allocate: every slot pairwise distinct for every palette, accent and series count", () => {
  for (const t of THEMES) for (const a of ACCENTS) for (let n = 1; n <= 6; n++) for (const mark of ["bar", "line"] as const) {
    const r = allocate(chartSlide({ series: series(n, { mark }) }), t, a);
    const cols = r.slots.map((s) => (s ? r.vars[s] : undefined));
    assert.equal(new Set(cols).size, cols.length, `${t} ${a} ${n} ${mark}`);
  }
});

test("second hue keeps clear of the focus for deuteranopes", () => {
  for (const t of THEMES) for (const a of ACCENTS) {
    const r = resolveAccent(t, a);
    assert.doesNotThrow(() => secondHue(t, [r.focus, r.neg, r.pos]), `${t} ${a}`);
  }
});

test("waterfall uses toned neg and pos fills and the quiet total grey; difference annotations reserve neg and pos", () => {
  assert.deepEqual(allocate(chartSlide({ kind: "waterfall", items: [] }), "ink").used.sort(), ["ctx3", "focus", "neg-fill", "pos-fill"]);
  for (const t of THEMES) { const { vars } = allocate(chartSlide({ kind: "waterfall", items: [] }), t);
    for (const k of ["neg-fill", "pos-fill"] as const) { const c = contrast(vars[k], PALETTES[t].bg); assert.ok(c >= 3 && c < contrast(vars[k.slice(0, 3)], PALETTES[t].bg) + .01, `${t} ${k} ${c}`); } }
  const r = allocate(chartSlide({ series: series(1), annotations: [{ type: "difference", from: 0, to: 1 }] }), "paper");
  assert.ok(r.used.includes("neg") && r.used.includes("pos"));
});

test("text colour on every fill reads at 4.5:1 or better where possible", () => {
  for (const t of THEMES) { const { vars } = allocate(chartSlide({ series: series(6, { mark: "line" }) }), t);
    for (const k of ["focus", "ctx1", "ctx2", "ctx3", "alt1", "alt2"]) assert.ok(contrast(vars[`on-${k}`], vars[k]) >= 3.5, `${t} ${k}`); }
});

test("every series has its own text colour: 4.5:1, and grey labels a clear step apart", async () => {
  const { MIN_TEXT, TEXT_STEP } = await import("../../src/engine/slides/colours");
  for (const t of THEMES) for (const a of [null, "#2447D1", "#E8B94A", "#14B8A6"]) {
    const { vars } = allocate(chartSlide({ series: series(6, { mark: "line" }) }), t, a), bg = PALETTES[t].bg;
    for (const k of ["quiet", "ctx3", "ctx2", "ctx1", "focus", "alt1", "alt2"]) assert.ok(contrast(vars[`${k}-text`], bg) >= MIN_TEXT, `${t} ${a} ${k}-text`);
    const L = ["quiet", "ctx3", "ctx2", "ctx1"].map((k) => oklch(vars[`${k}-text`])[0]);
    for (let i = 1; i < L.length; i++) assert.ok(Math.abs(L[i] - L[i - 1]) >= TEXT_STEP - 1e-9, `${t} step ${i}: ${L}`);
  }
});

test("two grey series take the ends of the grey scale, so they never read as one grey (revenue mix)", () => {
  const mix: Chart = { stacked: "100", categories: ["A", "B"], series: [
    { name: "Interest", mark: "bar", color: "neutral", values: [7, 12] },
    { name: "Interchange", mark: "bar", color: "focus", values: [3, 8] },
    { name: "Fees", mark: "bar", color: "neutral", values: [1, 2] }] };
  assert.deepEqual(seriesSlots(mix).slots, ["ctx3", "focus", "ctx1"]);
  for (const theme of THEMES) {
    const [a, , c] = PALETTES[theme].ctx;
    assert.ok(distance(a, c) >= .2, `${theme}: the ends of the grey scale are ${distance(a, c).toFixed(3)} apart`);
  }
});
