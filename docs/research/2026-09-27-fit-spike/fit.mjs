/* Line-count predictor: HarfBuzz shaping + UAX #14 break opportunities + greedy fill (+ balance).
   Pure Node. The same slot table drives the Chrome page (chrome.mjs), so both sides use one geometry. */
import * as hb from "harfbuzzjs";
import LineBreaker from "linebreak";
import { readFileSync } from "node:fs";
import { makeAdvances } from "./hvar.mjs";

const here = new URL(".", import.meta.url);
const FONT_FILES = { archivo: "fonts/Archivo-VF.ttf", geist: "fonts/Geist-VF.ttf" };

/* Slots as rendered by docs/design/proposals/v5/slides.css; widths measured from the DOM (README, "Setup"). */
export const SLOTS = {
  "consulting-title": { family: "archivo", weight: 800, stretch: 78, size: 74, lh: 75.48, ls: -0.012, ws: 0, upper: false, width: 1620, maxLines: 2, wrap: "balance", bold: 700 },
  "pitch-title": { family: "archivo", weight: 900, stretch: 62, size: 150, lh: 129, ls: -0.005, ws: 0.05, upper: true, width: 1664, maxLines: 1, wrap: "nowrap", bold: 700 },
  "pitch-title-wrap": { family: "archivo", weight: 900, stretch: 62, size: 150, lh: 129, ls: -0.005, ws: 0.05, upper: true, width: 1664, maxLines: 2, wrap: "wrap", bold: 700 },
  "pitch-subtitle": { family: "geist", weight: 500, stretch: 100, size: 48, lh: 57.6, ls: -0.012, ws: 0, upper: false, width: 1480, maxLines: 2, wrap: "pretty", bold: 700 },
  "note-p": { family: "geist", weight: 400, stretch: 100, size: 25, lh: 35, ls: 0, ws: 0, upper: false, width: 475.59375, maxLines: 6, wrap: "pretty", bold: 700 },
  "card-p": { family: "geist", weight: 400, stretch: 100, size: 26, lh: 35.88, ls: 0, ws: 0, upper: false, width: 380, maxLines: 6, wrap: "pretty", bold: 700 },
};

/* Feature lock: font-kerning: normal, font-variant-ligatures: none. */
const FEATURES = ["kern=1", "liga=0", "clig=0", "dlig=0", "hlig=0", "calt=0"].map((f) => hb.Feature.fromString(f));

const faces = Object.fromEntries(Object.entries(FONT_FILES).map(([k, f]) => [k, new hb.Face(new hb.Blob(readFileSync(new URL(f, here))))]));
const advancers = Object.fromEntries(Object.entries(faces).map(([k, f]) => [k, makeAdvances(f)]));
const upem = (face) => { const h = face.referenceTable("head"); return (h[18] << 8) | h[19]; };
const fontCache = new Map();
/** Fractional advances on (the default), or HarfBuzz's own whole-unit advances (`exactAdvances: false`). */
export const options = { exactAdvances: true, rules: "chrome", lineEndReshape: true, balanceSlack: 2 };
/**
 * The HarfBuzz font for an instance, plus `fix[gid]`: the difference (16.16 px) between the fractional
 * advance (hvar.mjs) and HarfBuzz's whole-unit advance. Added after shaping, so kerning is untouched.
 * (A FontFuncs advance callback works too, but leaks ~18 KB per shape call in harfbuzzjs 1.6.2.)
 */
function fontFor(family, weight, stretch, size) {
  const key = `${family}/${weight}/${stretch}/${size}/${options.exactAdvances}`;
  let entry = fontCache.get(key);
  if (!entry) {
    const face = faces[family];
    const font = new hb.Font(face);
    font.setScale(size * 65536, size * 65536); // 16.16, as Chrome passes the size to HarfBuzz
    const coords = { wght: weight };
    const v = [new hb.Variation("wght", weight)];
    if (face.getAxisInfos().wdth) { v.push(new hb.Variation("wdth", stretch)); coords.wdth = stretch; }
    font.setVariations(v);
    let fix = null;
    if (options.exactAdvances) {
      const adv = advancers[family](coords), k = (size * 65536) / upem(face);
      fix = new Float64Array(adv.length);
      for (let g = 0; g < adv.length; g++) fix[g] = Math.round(adv[g] * k) - font.glyphHAdvance(g);
    }
    entry = { font, fix };
    fontCache.set(key, entry);
  }
  return entry;
}
const buf = new hb.Buffer();

/** Markup → runs. Same regexes as v5/render.js: **bold**, [[focus]] (colour only). */
export function parse(markup) {
  const runs = [];
  const re = /\*\*(.+?)\*\*|\[\[(.+?)\]\]/g;
  let last = 0, m;
  const push = (text, bold, focus) => { if (text) runs.push({ text, bold, focus }); };
  while ((m = re.exec(markup))) {
    push(markup.slice(last, m.index), false, false);
    if (m[1] !== undefined) {
      // bold may contain focus
      const inner = m[1].split(/\[\[(.+?)\]\]/);
      inner.forEach((t, i) => push(t, true, i % 2 === 1));
    } else {
      const inner = m[2].split(/\*\*(.+?)\*\*/);
      inner.forEach((t, i) => push(t, i % 2 === 1, true));
    }
    last = re.lastIndex;
  }
  push(markup.slice(last), false, false);
  return runs;
}

/** HTML for Chrome, from the same runs. */
export function toHTML(markup) {
  const tag = { "\u0001": "<strong>", "\u0002": "</strong>", "\u0003": '<span class="hl-focus">', "\u0004": "</span>", "&": "&amp;", "<": "&lt;", " ": "&nbsp;" };
  return markup.replace(/\*\*(.+?)\*\*/g, (_, t) => `\u0001${t}\u0002`).replace(/\[\[(.+?)\]\]/g, (_, t) => `\u0003${t}\u0004`)
    .replace(/[\u0001-\u0004&< ]/g, (c) => tag[c]);
}

/**
 * Per-character advances (px) for the paragraph, with letter/word spacing applied.
 * Runs with the same face are shaped together (Chrome merges items with an identical font), so
 * kerning is kept across a colour-only span and lost across a bold boundary.
 */
export function measure(slot, markup) {
  const s = SLOTS[slot] ?? slot;
  let runs = parse(markup);
  if (s.upper) runs = runs.map((r) => ({ ...r, text: r.text.toUpperCase() }));
  const text = runs.map((r) => r.text).join("");
  const adv = new Float64Array(text.length), solo = new Float64Array(text.length);
  const lsPx = s.ls * s.size, wsPx = s.ws * s.size;
  // merge adjacent runs with the same weight into shaping items
  const items = [];
  let pos = 0;
  for (const r of runs) {
    const w = r.bold ? s.bold : s.weight;
    const prev = items[items.length - 1];
    if (prev && prev.w === w) prev.end += r.text.length; else items.push({ start: pos, end: pos + r.text.length, w });
    pos += r.text.length;
  }
  const itemEnds = [];
  for (const it of items) {
    const { font, fix } = fontFor(s.family, it.w, s.stretch, s.size);
    buf.reset();
    buf.addText(text, it.start, it.end - it.start);
    buf.guessSegmentProperties();
    buf.setClusterLevel(1); // monotone characters
    hb.shape(font, buf, FEATURES);
    const infos = buf.getGlyphInfos(), posns = buf.getGlyphPositions();
    for (let g = 0; g < infos.length; g++) adv[infos[g].cluster] += (posns[g].xAdvance + (fix ? fix[infos[g].codepoint] : 0)) / 65536;
    for (let i = it.start; i < it.end; i++) solo[i] = soloAdvance(font, fix, text[i]);
    itemEnds.push(it.end);
  }
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c >= 0xdc00 && c <= 0xdfff) continue; // low surrogate: spacing counted once per code point
    adv[i] += lsPx; solo[i] += lsPx;
    if (c === 0x20 || c === 0xa0) { adv[i] += wsPx; solo[i] += wsPx; }
  }
  return { text, adv, solo, itemEnds };
}

/* Advance of one character shaped on its own: the width it has at the end of a line, where Chrome
   reshapes and the kerning pair with the next character (e.g. "-Y") is gone. */
const soloCache = new Map();
function soloAdvance(font, fix, ch) {
  let perFont = soloCache.get(font);
  if (!perFont) soloCache.set(font, (perFont = new Map()));
  let a = perFont.get(ch);
  if (a === undefined) {
    buf.reset(); buf.addText(ch); buf.guessSegmentProperties();
    hb.shape(font, buf, FEATURES);
    const infos = buf.getGlyphInfos();
    a = buf.getGlyphPositions().reduce((t, p, g) => t + (p.xAdvance + (fix ? fix[infos[g].codepoint] : 0)) / 65536, 0);
    perFont.set(ch, a);
  }
  return a;
}

const isCollapsibleSpace = (c) => c === " ";
const snap64 = (x) => Math.round(x * 64) / 64; // Chrome rounds a text width to the nearest layout unit (1/64 px)

/** Break opportunities (end offsets) from plain UAX #14 (the `linebreak` package). */
export function breaksUax14(text) {
  const lb = new LineBreaker(text), out = [];
  let b;
  while ((b = lb.nextBreak())) out.push(b.position);
  return out;
}

/* Chrome's fast pair table for U+0021..U+00FF, rebuilt from Blink's generator
   (character_property_data_generator.cc, LineBreakData): ICU pairwise, then the ASCII overrides. */
const MIN = 0x21, MAX = 0xff;
const TABLE = (() => {
  const t = Array.from({ length: MAX - MIN + 1 }, () => new Uint8Array(MAX - MIN + 1));
  const set = (a0, a1, b0, b1, v) => { for (let a = a0; a <= a1; a++) for (let b = b0; b <= b1; b++) t[a - MIN][b - MIN] = v ? 1 : 0; };
  for (let a = MIN; a <= MAX; a++) for (let b = MIN; b <= MAX; b++) {
    const lb = new LineBreaker(String.fromCharCode(a, b)); let x, br = false;
    while ((x = lb.nextBreak())) if (x.position === 1) br = true;
    t[a - MIN][b - MIN] = br ? 1 : 0;
  }
  const c = (ch) => ch.charCodeAt(0), ALL = [0x21, 0x7f];
  set(...ALL, ...ALL, false);
  for (const ch of "(<[{") set(...ALL, c(ch), c(ch), true);
  set(c("-"), c("-"), ...ALL, true); set(c("?"), c("?"), ...ALL, true);
  set(c("-"), c("-"), c("$"), c("$"), false);
  set(...ALL, c("!"), c("!"), false);
  set(c("?"), c("?"), c('"'), c('"'), false); set(c("?"), c("?"), c("'"), c("'"), false);
  for (const ch of "),./") set(...ALL, c(ch), c(ch), false);
  set(c("-"), c("-"), c("0"), c("9"), false);
  for (const ch of ":;?]}") set(...ALL, c(ch), c(ch), false);
  for (const ch of "$'(/<@[{") set(c(ch), c(ch), ...ALL, false);
  set(c("0"), c("9"), ...ALL, false); set(c("A"), c("Z"), ...ALL, false); set(c("^"), c("`"), ...ALL, false);
  set(c("a"), c("z"), ...ALL, false); set(0x7f, 0x7f, ...ALL, false);
  return t;
})();
const isSpace = (ch) => ch === 0x20 || ch === 0x09 || ch === 0x0a;
const isDigit = (ch) => ch >= 0x30 && ch <= 0x39;
const isAlnum = (ch) => isDigit(ch) || (ch >= 0x41 && ch <= 0x5a) || (ch >= 0x61 && ch <= 0x7a);

/** Break opportunities as Blink's LazyLineBreakIterator finds them (text_break_iterator.cc, NextBreakablePosition). */
export function breaksChrome(text) {
  const icu = new Set(breaksUax14(text)); // stand-in for ICU's full-context iterator
  const out = [];
  for (let i = 1; i < text.length; i++) {
    const last = text.charCodeAt(i - 1), ch = text.charCodeAt(i), ll = i > 1 ? text.charCodeAt(i - 2) : 0;
    if (isSpace(ch)) continue;
    if (isSpace(last)) { out.push(i); continue; }
    if (last < MIN || ch < MIN) continue;
    let fast = "unknown";
    if (last === 0x2d && ch <= 0x7f && isDigit(ch)) fast = isAlnum(ll) ? "break" : "no";
    else if (last === 0x2d && ch > 0x7f) fast = "unknown";
    else if (last <= MAX && ch <= MAX) fast = TABLE[last - MIN][ch - MIN] ? "break" : "no";
    if (fast === "break") { out.push(i); continue; }
    if (fast === "no") continue;
    if (icu.has(i)) out.push(i);
  }
  out.push(text.length);
  return out;
}

export const breaks = (text, rules = options.rules) => (rules === "uax14" ? breaksUax14(text) : breaksChrome(text));
/** Width of text[a, b) with trailing collapsible spaces hanging (not counted). */
function lineWidth(m, prefix, a, b) {
  const atSpace = b < m.text.length && isCollapsibleSpace(m.text[b - 1]);
  while (b > a && isCollapsibleSpace(m.text[b - 1])) b--;
  if (b <= a) return 0;
  // A space break keeps the hanging space on the line, so kerning with it stays. Any other break
  // (after a hyphen, dash, "?") splits a shaped pair: Chrome checks the width from the paragraph
  // shaping, then reshapes the line end without the pair and checks again. Both must fit.
  const reshape = options.lineEndReshape && !atSpace && b < m.text.length;
  return prefix[b - 1] - prefix[a] + (reshape ? Math.max(m.solo[b - 1], m.adv[b - 1]) : m.adv[b - 1]);
}

/**
 * Greedy fill. Returns line end offsets plus the closest decision distance in px (how near the
 * string sits to a wrap point), which the generator uses to pick boundary cases.
 */
export function greedy(m, avail, { tol = 0, prefix = prefixOf(m), bps = breaks(m.text) } = {}) {
  const ends = [];
  let start = 0, lastFit = -1, minGap = Infinity;
  for (let i = 0; i < bps.length; i++) {
    const end = bps[i];
    const w = lineWidth(m, prefix, start, end);
    const gap = avail + tol - snap64(w);
    if (gap >= 0) { lastFit = end; minGap = Math.min(minGap, gap); continue; }
    minGap = Math.min(minGap, -gap);
    if (lastFit > start) { ends.push(lastFit); start = lastFit; lastFit = -1; i--; continue; }
    // single segment wider than the line: overflow, break after it
    ends.push(end); start = end; lastFit = -1;
  }
  if (start < m.text.length) ends.push(m.text.length);
  return { ends, minGap, width: Math.max(...ends.map((e, k) => lineWidth(m, prefix, k ? ends[k - 1] : 0, e))) };
}

function prefixOf(m) {
  const p = new Float64Array(m.text.length + 1);
  for (let i = 0; i < m.text.length; i++) p[i + 1] = p[i] + m.adv[i];
  return p;
}

/** text-wrap: balance as bisection on the width, keeping the greedy line count (Chrome's approach). */
function balance(m, avail, opts) {
  const base = greedy(m, avail, opts);
  const n = base.ends.length;
  if (n <= 1) return base;
  let lo = 0, hi = avail, best = base;
  while (hi - lo > 1 / 64) {
    const mid = Math.round(((lo + hi) / 2) * 64) / 64;
    const r = greedy(m, mid, opts);
    if (r.ends.length <= n) { hi = mid; best = { ...r, minGap: base.minGap }; } else lo = mid;
    if (mid === hi && mid === lo) break;
  }
  return { ...best, boxWidth: hi };
}

/** Predict lines for one string in one slot. `margin` shrinks the width (safety margin, px). */
export function predict(slot, markup, { margin = 0, tol = 0, mode, width } = {}) {
  const s = SLOTS[slot];
  const m = measure(s, markup);
  const prefix = prefixOf(m), bps = breaks(m.text);
  const avail = (width ?? s.width) - margin;
  if ((mode ?? s.wrap) === "nowrap") {
    const w = snap64(lineWidth(m, prefix, 0, m.text.length));
    return { lines: w <= avail + tol ? 1 : 2, width: w, minGap: Math.abs(avail - w), lineTexts: [m.text] };
  }
  const r = (mode ?? s.wrap) === "balance" ? balance(m, avail, { tol, prefix, bps }) : greedy(m, avail, { tol, prefix, bps });
  const lineTexts = r.ends.map((e, k) => m.text.slice(k ? r.ends[k - 1] : 0, e));
  return { lines: r.ends.length, width: r.width, minGap: r.minGap, lineTexts, boxWidth: r.boxWidth ?? avail };
}

/* The balanced box width for a slot: narrowest width (in layout units) that keeps the greedy line count, plus slack.
   `slack` (px) keeps every line clear of the edge, where Chrome's float sums and ours can round differently. */
export const balancedWidth = (slot, markup, slack = options.balanceSlack) =>
  Math.min(SLOTS[slot].width, predict(slot, markup, { mode: "balance" }).boxWidth + slack);
