/* Colour allocator (spec: 2026-09-27-colour-allocator-design.md). Pure: no DOM, no model.
   The agent writes roles (focus / contrast / neutral, [[…]] [-…-] [+…+]); code picks every colour,
   so no two different things on a slide share one and every mark stays legible. */

/* ═════════════ Colour maths: sRGB, WCAG contrast, OKLab/OKLCH ═════════════ */
const rgb = (hex) => { const n = parseInt(hex.replace("#", ""), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
const toHex = (c) => `#${c.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0")).join("")}`.toUpperCase();
const lin = (v) => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; };
const gam = (v) => 255 * (v <= .0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - .055);
const lum = (hex) => { const [r, g, b] = rgb(hex).map(lin); return .2126 * r + .7152 * g + .0722 * b; };
export const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + .05) / (y + .05); };

const linToLab = ([r, g, b]) => {
  const l = Math.cbrt(.4122214708 * r + .5363325363 * g + .0514459929 * b);
  const m = Math.cbrt(.2119034982 * r + .6806995451 * g + .1073969566 * b);
  const s = Math.cbrt(.0883024619 * r + .2817188376 * g + .6299787005 * b);
  return [.2104542553 * l + .7936177850 * m - .0040720468 * s, 1.9779984951 * l - 2.4285922050 * m + .4505937099 * s, .0259040371 * l + .7827717662 * m - .8086757660 * s];
};
export const oklab = (hex) => linToLab(rgb(hex).map(lin));
function labToHex([L, a, b]) {
  const l = (L + .3963377774 * a + .2158037573 * b) ** 3, m = (L - .1055613458 * a - .0638541728 * b) ** 3, s = (L - .0894841775 * a - 1.2914855480 * b) ** 3;
  return toHex([4.0767416621 * l - 3.3077115913 * m + .2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - .3413193965 * s, -.0041960863 * l - .7034186147 * m + 1.7076147010 * s].map(gam));
}
export const oklch = (hex) => { const [L, a, b] = oklab(hex); return [L, Math.hypot(a, b), (Math.atan2(b, a) * 180 / Math.PI + 360) % 360]; };
/** OKLCH to sRGB; out-of-gamut colours lose chroma, never hue. */
function fromLch(L, C, h) {
  const lab = (c) => [L, c * Math.cos(h * Math.PI / 180), c * Math.sin(h * Math.PI / 180)];
  const inGamut = (c) => { const [l, a, b] = lab(c), lms = [(l + .3963377774 * a + .2158037573 * b) ** 3, (l - .1055613458 * a - .0638541728 * b) ** 3, (l - .0894841775 * a - 1.2914855480 * b) ** 3];
    return [4.0767416621 * lms[0] - 3.3077115913 * lms[1] + .2309699292 * lms[2], -1.2684380046 * lms[0] + 2.6097574011 * lms[1] - .3413193965 * lms[2], -.0041960863 * lms[0] - .7034186147 * lms[1] + 1.7076147010 * lms[2]].every((v) => v >= -1e-4 && v <= 1.0001); };
  let lo = 0, hi = C;
  if (!inGamut(C)) { for (let k = 0; k < 24; k++) { const m = (lo + hi) / 2; if (inGamut(m)) lo = m; else hi = m; } C = lo; }
  return labToHex(lab(C));
}
export const distance = (a, b) => { const [x, y] = [oklab(a), oklab(b)]; return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]); };
export const hueGap = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };

/** How a colour reads to a deuteranope (Machado et al. 2009, severity 1). */
export function deutan(hex) {
  const [r, g, b] = rgb(hex).map(lin);
  return toHex([.367322 * r + .860646 * g - .227968 * b, .280085 * r + .672501 * g + .047413 * b, -.01182 * r + .04294 * g + .968881 * b].map((v) => gam(Math.max(0, v))));
}

/* ═════════════ Palettes: the fixed, CI-checked colour set (spec 4) ═════════════ */
export const PALETTES = {
  ink: { bg: "#0B0A09", fg: "#F3EEE4", focus: "#E8B94A", neg: "#FF5A45", pos: "#7BD88F",
    ctx: ["#ADAAA2", "#8A8782", "#686561"], quiet: "#4A443B", alt: { L: .72, L2: .58, C: .11 } },
  paper: { bg: "#F6F3EC", fg: "#16140F", focus: "#2447D1", neg: "#D2402C", pos: "#1C8248",
    ctx: ["#44423D", "#66635D", "#898680"], quiet: "#CFC6B6", alt: { L: .52, L2: .38, C: .11 } },
};
export const MIN_MARK = 3, MIN_HUE_GAP = 30, MAX_HUE_SHIFT = 15, MIN_CHROMA = .06, MIN_DISTANCE = .08, MIN_DEUTAN = .10;
export const MAX_SERIES = 6;
const ALT_HUES = [200, 250, 300, 60];

/** The accent as drawn on a background: lightened (dark palette) or darkened (light palette) in OKLCH,
    keeping its hue and as much chroma as fits, until it has 4.5:1. Mixing with black would turn it grey. */
export function accentOn(hex, bg) {
  const [L, C, h] = oklch(hex), dir = lum(bg) < .5 ? 1 : -1;
  let focus = hex.toUpperCase();
  for (let l = L; contrast(focus, bg) < 4.5 && l >= 0 && l <= 1; l += dir * .01) focus = fromLch(l, C, h);
  return focus;
}
/** A colour moved towards the background (keeping its hue) while it keeps at least 3.2:1. */
function toned(hex, bg) {
  const [L, C, h] = oklch(hex), Lb = oklch(bg)[0];
  let out = hex;
  for (let t = .05; t < 1; t += .05) { const c = fromLch(L + (Lb - L) * t, C * (1 - t * .6), h); if (contrast(c, bg) < 3.2) break; out = c; }
  return out;
}

/** Text on a fill: whichever of white or near-black reads better. */
export const textOn = (fill) => (contrast("#FFFFFF", fill) >= contrast("#0B0A09", fill) ? "#FFFFFF" : "#0B0A09");

/** Turn a meaning colour's hue away from the focus, within its own family (C7). */
function moveMeaning(hex, focusHue) {
  const [L, C, h] = oklch(hex), gap = hueGap(h, focusHue);
  if (gap >= MIN_HUE_GAP) return hex;
  const away = ((h - focusHue + 540) % 360) - 180 >= 0 ? 1 : -1;
  const shift = Math.min(MAX_HUE_SHIFT, MIN_HUE_GAP - gap + 1);
  return fromLch(L, C, h + away * shift);
}

/** focus, neg and pos for a palette and accent; `error` when the accent is refused (the palette focus is used). */
export function resolveAccent(theme, accent) {
  const P = PALETTES[theme];
  const base = { focus: P.focus, neg: P.neg, pos: P.pos };
  if (!/^#[0-9a-f]{6}$/i.test(accent || "")) return base;
  const focus = accentOn(accent, P.bg), fh = oklch(focus)[2];
  if (oklch(focus)[1] < MIN_CHROMA || [...P.ctx, P.quiet, P.fg].some((g) => distance(focus, g) < MIN_DISTANCE))
    return { ...base, error: "This colour is too grey: it would not stand out from the context series." };
  const neg = moveMeaning(P.neg, fh), pos = moveMeaning(P.pos, fh);
  for (const [m, name] of [[neg, "the red that marks a loss"], [pos, "the green that marks a gain"]])
    if (hueGap(oklch(m)[2], fh) < MIN_HUE_GAP) return { ...base, error: `This colour is too close to ${name}; highlights would read that way.` };
  return { focus, neg, pos };
}

/** The second hue for series 5–6: the candidate furthest in hue from focus, neg and pos. */
export function secondHue(theme, used) {
  const P = PALETTES[theme], hues = used.map((c) => oklch(c)[2]);
  const ranked = ALT_HUES.map((h) => ({ h, gap: Math.min(...hues.map((u) => hueGap(h, u))) })).sort((a, b) => b.gap - a.gap);
  for (const { h } of ranked) {
    const alt = [fromLch(P.alt.L, P.alt.C, h), fromLch(P.alt.L2, P.alt.C, h)];
    const ok = alt.every((c) => contrast(c, P.bg) >= MIN_MARK && distance(deutan(c), deutan(used[0])) >= MIN_DEUTAN
      && [...used, ...P.ctx].every((u) => distance(c, u) >= MIN_DISTANCE));
    if (ok) return alt;
  }
  throw new Error(`No second hue fits palette ${theme} with ${used.join(", ")}`);
}

/* ═════════════ Allocation ═════════════ */
const barsOf = (c) => (c.series || []).filter((s) => s.mark !== "line");

/** Slots for a bars chart, per series: focus | quiet | ctx1–3 | alt1–2 (C3–C5). */
export function seriesSlots(chart) {
  const series = chart.series || [], slots = series.map(() => null), labelled = series.map(() => false);
  const focus = series.findIndex((s) => s.color === "focus");
  if (focus >= 0) slots[focus] = "focus";
  const ctx = series.map((s, i) => i).filter((i) => i !== focus);
  const ctxBars = ctx.filter((i) => series[i].mark !== "line");
  if (!chart.stacked && ctxBars.length === 1) { slots[ctxBars[0]] = "quiet"; labelled[ctxBars[0]] = true; }
  // Context recedes: `neutral` series take the quietest grey that still has 3:1, then louder ones; a `contrast`
  // series (one that must read clearly) takes the strongest. Series 5–6 take the second hue.
  // Names are unique within a chart (validation), so one name is one colour in the bars, legend and end labels (C8).
  const greys = ["ctx3", "ctx2", "ctx1"], rest = ["alt1", "alt2"];
  const take = (strong) => { const g = strong ? greys.pop() : greys.shift(); return g || rest.shift() || null; };
  ctx.filter((i) => !slots[i] && series[i].color === "contrast").forEach((i) => { slots[i] = take(true); });
  ctx.filter((i) => !slots[i]).forEach((i) => { slots[i] = take(false); });
  return { slots, labelled };
}

/**
 * Every colour a slide uses: { vars: CSS custom properties, slots (chart series), labelled, used, error }.
 * Throws when its own guarantees fail: that is a bug, not a content error.
 */
export function allocate(slide, theme, accent) {
  const P = PALETTES[theme], meaning = resolveAccent(theme, accent);
  const vars = { focus: meaning.focus, neg: meaning.neg, pos: meaning.pos, ctx1: P.ctx[0], ctx2: P.ctx[1], ctx3: P.ctx[2], quiet: P.quiet,
    // Waterfall steps: the meaning hue toned towards the background until just above 3:1, so a step never outshouts the focus.
    "neg-fill": toned(meaning.neg, P.bg), "pos-fill": toned(meaning.pos, P.bg) };
  const chart = slide?.template === "chart" ? slide.chart : null, kind = chart?.kind || "bars";
  let slots = [], labelled = [];
  const used = new Set(["focus"]);
  if (/\[-.+?-\]/.test(JSON.stringify(slide))) used.add("neg");
  if (/\[\+.+?\+\]/.test(JSON.stringify(slide))) used.add("pos");
  if (chart && kind === "bars" && Array.isArray(chart.series)) {
    ({ slots, labelled } = seriesSlots(chart));
    slots.forEach((s) => s && used.add(s));
    if (slots.some((s) => s?.startsWith("alt"))) [vars.alt1, vars.alt2] = secondHue(theme, [vars.focus, vars.neg, vars.pos]);
    (chart.annotations || []).forEach((a) => { if (a?.type === "difference") { used.add("neg"); used.add("pos"); } });
  }
  if (chart && kind === "waterfall") ["neg-fill", "pos-fill", "ctx3"].forEach((s) => used.add(s));
  if (chart && kind === "timeline") used.add("quiet");
  const list = [...used];
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
    if (distance(vars[list[i]], vars[list[j]]) < MIN_DISTANCE) throw new Error(`colours: ${list[i]} and ${list[j]} are too close (${vars[list[i]]}, ${vars[list[j]]})`);
  }
  for (const s of list) if (s !== "quiet" && contrast(vars[s], P.bg) < MIN_MARK) throw new Error(`colours: ${s} ${vars[s]} is below ${MIN_MARK}:1 on ${P.bg}`);
  for (const k of Object.keys(vars)) vars[`on-${k}`] = textOn(vars[k]);
  Object.assign(vars, textColours(vars, P.bg));
  return { vars, slots, labelled, used: list, error: meaning.error };
}

export const MIN_TEXT = 4.5, TEXT_STEP = .06;
/**
 * Each series' text colour (`<slot>-text`): its mark colour lifted towards the foreground until it reads as
 * text (4.5:1). Greys lift in order (quiet, ctx3, ctx2, ctx1), each a clear step past the one before, so
 * every label reads in its own series' shade and no two grey labels look alike.
 */
export function textColours(vars, bg) {
  const dir = lum(bg) < .5 ? 1 : -1, out = {};
  const lift = (hex, floor) => {
    const [L0, C, h] = oklch(hex);
    let L = L0, c = hex;
    while ((contrast(c, bg) < MIN_TEXT || (floor !== null && (L - floor) * dir < TEXT_STEP)) && L >= 0 && L <= 1) { L += dir * .01; c = fromLch(L, C, h); }
    return c;
  };
  let prev = null;
  for (const k of ["quiet", "ctx3", "ctx2", "ctx1"]) { out[`${k}-text`] = lift(vars[k], prev); prev = oklch(out[`${k}-text`])[0]; }
  for (const k of ["focus", "alt1", "alt2", "pos", "neg"]) if (vars[k]) out[`${k}-text`] = lift(vars[k], null);
  return out;
}
