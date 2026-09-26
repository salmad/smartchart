/* Compares the predictor with chrome.json. Writes results.json and disagreements.json, prints a summary. */
import { writeFileSync } from "node:fs";
import { predict, SLOTS, options, measure, breaks } from "./fit.mjs";
import STRINGS from "./strings.json" with { type: "json" };
import CH from "./chrome.json" with { type: "json" };

const VARIANTS = {
  final: { exactAdvances: true, rules: "chrome", lineEndReshape: true },
  "no line-end reshape": { exactAdvances: true, rules: "chrome", lineEndReshape: false },
  "hb-advances": { exactAdvances: false, rules: "chrome", lineEndReshape: true },
  "uax14-rules": { exactAdvances: true, rules: "uax14", lineEndReshape: true },
  "naive (spec as written)": { exactAdvances: false, rules: "uax14", lineEndReshape: false },
};
const MARGINS = [0, 0.02, 0.05, 0.1, 0.25, 0.5, 1, 2, 3, 4];
const snap64 = (x) => Math.round(x * 64) / 64;
const norm = (slot, lines) => lines.map((l) => { l = l.replace(/ +$/, ""); return SLOTS[slot].upper ? l.toUpperCase() : l; }).join("|");
const pct = (a, n) => `${((100 * a) / n).toFixed(1)}%`;
const q = (arr, p) => { const s = [...arr].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p * (s.length - 1)))]; };

const results = { chrome: CH.chrome, slots: {} };
const disagreements = [];

for (const slot of Object.keys(STRINGS)) {
  const S = SLOTS[slot], strings = STRINGS[slot], mode = S.wrap, n = strings.length;
  const R = { n, mode, width: S.width, configs: {} };
  const truthOf = (cfg) => CH.configs[cfg][slot][mode];

  // Chrome self-consistency: DPR and transform scale do not change layout
  const sig = (cfg) => truthOf(cfg).map((r) => `${r.lines}:${norm(slot, r.lineTexts)}`);
  const base = sig("dpr1");
  R.chromeSame = Object.fromEntries(Object.keys(CH.configs).map((c) => [c, sig(c).filter((x, i) => x === base[i]).length]));
  if (mode === "nowrap") {
    const w1 = truthOf("dpr1").map((r) => r.inkWidth);
    R.chromeWidthSame = Object.fromEntries(Object.keys(CH.configs).map((c) => [c, truthOf(c).filter((r, i) => Math.abs(r.inkWidth - w1[i]) < 1e-6).length]));
  }
  // balance / pretty never change the line count?
  if (mode === "balance" || mode === "pretty") {
    const a = CH.configs.dpr1[slot][mode], w = CH.configs.dpr1[slot].wrap;
    R.modeKeepsCount = a.filter((r, i) => r.lines === w[i].lines).length;
    R.modeKeepsBreaks = a.filter((r, i) => norm(slot, r.lineTexts) === norm(slot, w[i].lineTexts)).length;
  }
  if (slot === "pitch-subtitle") {
    const a = CH.configs.dpr1[slot].balance, w = CH.configs.dpr1[slot].wrap;
    R.balanceKeepsCount = a.filter((r, i) => r.lines === w[i].lines).length;
  }

  // shaping accuracy: whole string on one line, predicted vs Chrome width
  for (const [vname, v] of [["final", VARIANTS.final], ["hb-advances", VARIANTS["hb-advances"]]]) {
    Object.assign(options, v);
    const d = strings.map((s, i) => snap64(predict(slot, s, { mode: "nowrap" }).width) - CH.configs.dpr1[slot].measure[i].inkWidth);
    R[`widthError ${vname}`] = { min: q(d, 0), p50: q(d, 0.5), max: q(d, 1), maxAbs: Math.max(...d.map(Math.abs)) };
  }

  // agreement per variant and config
  R.variants = {};
  for (const [vname, v] of Object.entries(VARIANTS)) {
    Object.assign(options, v);
    const preds = strings.map((s) => predict(slot, s));
    const out = {};
    for (const cfg of Object.keys(CH.configs)) {
      const truth = truthOf(cfg);
      let count = 0, fit = 0, under = 0, over = 0;
      preds.forEach((p, i) => {
        const c = mode === "nowrap" ? (truth[i].inkWidth <= S.width ? 1 : 2) : truth[i].lines;
        count += p.lines === c; under += p.lines < c; over += p.lines > c;
        fit += (p.lines <= S.maxLines) === (c <= S.maxLines);
      });
      out[cfg] = { count, fit, under, over };
    }
    R.variants[vname] = out;
  }

  // final variant: break positions and disagreement categories
  Object.assign(options, VARIANTS.final);
  const wrapTruth = CH.configs.dpr1[slot][mode === "nowrap" ? "nowrap" : mode === "balance" || mode === "pretty" ? "wrap" : mode];
  let greedySame = 0, modeSame = 0, greedyCount = 0;
  const cats = {};
  strings.forEach((s, i) => {
    const t = truthOf("dpr1")[i];
    if (mode !== "nowrap") {
      const g = predict(slot, s, { mode: "wrap" });
      if (norm(slot, g.lineTexts) === norm(slot, wrapTruth[i].lineTexts)) greedySame++;
      if (g.lines === wrapTruth[i].lines) greedyCount++;
      const pm = predict(slot, s);
      if (norm(slot, pm.lineTexts) === norm(slot, t.lineTexts)) modeSame++;
    }
    const p = predict(slot, s);
    const c = mode === "nowrap" ? (t.inkWidth <= S.width ? 1 : 2) : t.lines;
    if (p.lines === c) return;
    let cat;
    const wt = wrapTruth[i];
    if (mode !== "nowrap" && wt.lines !== t.lines) cat = `${mode} changed the count in Chrome`;
    else if (p.minGap < 0.5) cat = "within 0.5 px of the width";
    else if (mode !== "nowrap" && norm(slot, predict(slot, s, { mode: "wrap" }).lineTexts) !== norm(slot, wt.lineTexts)) cat = "different break position";
    else cat = "other";
    cats[cat] = (cats[cat] ?? 0) + 1;
    disagreements.push({ slot, cat, s, predicted: p.lines, chrome: c, minGap: +p.minGap.toFixed(4), pLines: p.lineTexts, cLines: t.lineTexts, cWrapLines: wt?.lineTexts });
  });
  R.greedyCountSame = greedyCount; R.greedyBreaksSame = greedySame; R.modeBreaksSame = modeSame; R.categories = cats;

  // margin sweep: predict against width − m; when do under-predictions (unsafe) vanish, and at what false-reject cost?
  R.margins = MARGINS.map((m) => {
    let under = 0, over = 0, falseReject = 0, unsafeFit = 0;
    strings.forEach((s, i) => {
      const p = predict(slot, s, { margin: m });
      const t = truthOf("dpr1")[i];
      const c = mode === "nowrap" ? (t.inkWidth <= S.width ? 1 : 2) : t.lines;
      under += p.lines < c; over += p.lines > c;
      falseReject += p.lines > S.maxLines && c <= S.maxLines;
      unsafeFit += p.lines <= S.maxLines && c > S.maxLines;
    });
    return { margin: m, under, over, unsafeFit, falseReject };
  });

  // timing: Node predictor per string vs Chrome layout per string
  for (let k = 0; k < 2; k++) strings.forEach((s) => predict(slot, s)); // warm-up
  const t0 = performance.now();
  for (let k = 0; k < 3; k++) strings.forEach((s) => predict(slot, s));
  R.timing = { nodeMs: (performance.now() - t0) / (3 * n), chromeLayoutMs: CH.timing[slot] };
  results.slots[slot] = R;
}

writeFileSync(new URL("results.json", import.meta.url), JSON.stringify(results, null, 1));
writeFileSync(new URL("disagreements.json", import.meta.url), JSON.stringify(disagreements, null, 1));

// summary
console.log(`Chrome ${CH.chrome}`);
for (const [slot, R] of Object.entries(results.slots)) {
  console.log(`\n${slot} (${R.mode}, n=${R.n})  chromeSame=${JSON.stringify(R.chromeSame)}${R.chromeWidthSame ? " widthSame=" + JSON.stringify(R.chromeWidthSame) : ""}`);
  if (R.modeKeepsCount !== undefined) console.log(`  Chrome ${R.mode} keeps the wrap count: ${R.modeKeepsCount}/${R.n}, same breaks: ${R.modeKeepsBreaks}/${R.n}${R.balanceKeepsCount !== undefined ? `, balance keeps count ${R.balanceKeepsCount}` : ""}`);
  console.log(`  width error final ${JSON.stringify(R["widthError final"])}  hb ${JSON.stringify(R["widthError hb-advances"])}`);
  for (const [v, o] of Object.entries(R.variants)) console.log(`  ${v.padEnd(24)} ` + Object.entries(o).map(([c, x]) => `${c}: count ${pct(x.count, R.n)} fit ${pct(x.fit, R.n)} under ${x.under} over ${x.over}`).join(" | "));
  console.log(`  greedy count = Chrome wrap: ${R.greedyCountSame}/${R.n}; greedy breaks = Chrome wrap: ${R.greedyBreaksSame}/${R.n}; ${R.mode} breaks = Chrome ${R.mode}: ${R.modeBreaksSame}/${R.n}`);
  console.log(`  categories ${JSON.stringify(R.categories)}`);
  console.log(`  margins ${R.margins.map((m) => `${m.margin}:u${m.under}/o${m.over}/fr${m.falseReject}`).join(" ")}`);
  console.log(`  timing node ${R.timing.nodeMs.toFixed(3)} ms, chrome layout ${R.timing.chromeLayoutMs.toFixed(3)} ms`);
}
