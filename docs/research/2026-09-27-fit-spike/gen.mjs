/* Seeded string sets, weighted toward the wrap boundary. Writes strings.json.
   Per slot: 60% with the closest greedy decision within 2 px of the width, 20% within 2–10 px, 20% any length.
   Run: node gen.mjs [perSlot=1000] [seed=20260927] */
import { writeFileSync } from "node:fs";
import { predict, SLOTS } from "./fit.mjs";

const PER = +(process.argv[2] ?? 1000), SEED = +(process.argv[3] ?? 20260927);
function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const NB = " ";

const WORDS = `revenue margin growth churn retention pipeline pricing customers market share costs forecast quarter region
teams product launch expansion demand supply capacity payments interchange merchants volume conversion onboarding
subscriptions renewal budget headcount hiring enterprise segment partners channel acquisition payback efficiency
the a of in and to for with across while as than our their every more less faster slower higher lower stronger
we now still only already because despite after before since against over under between within nearly almost
grew fell doubled halved rose dropped slowed recovered outpaced lagged overtook reached crossed widened narrowed
catches up holds steady turns positive breaks even pulls ahead falls behind keeps pace stays flat
international wholesale operational infrastructure transformation reconciliation implementation accountability
UK EU US EMEA APAC LATAM SaaS ARR MRR NPS CAC LTV B2B B2C AI API KPI Q1 Q2 Q3 Q4 H1 H2 FY24 FY25
naïve café façade Zürich Straße Größe déjà`.split(/\s+/);
const HYPH = ["cost-to-serve", "year-on-year", "month-over-month", "end-to-end", "self-serve", "best-in-class", "go-to-market",
  "e-commerce", "re-price", "co-op", "mid-market", "two-thirds", "long-term", "high-value", "pay-as-you-go", "COVID-19", "state-of-the-art"];
const SLASH = ["and/or", "EMEA/APAC", "price/volume", "24/7", "B2B/B2C", "in/out", "Q3/Q4", "sales/marketing", "1/3", "/month", "per user/month"];
const NUM = () => {
  const r = Math.random;
  const n = [(r() * 99).toFixed(1), Math.round(r() * 999), (r() * 9).toFixed(1), Math.round(r() * 9999).toLocaleString("en-GB")][Math.floor(r() * 4)];
  return [
    `£${n}m`, `€${n}k`, `$${n}bn`, `${Math.round(r() * 99)}%`, `+${Math.round(r() * 60)}%`, `-${Math.round(r() * 30)}%`, `−${Math.round(r() * 30)}%`,
    `£${n}${NB}m`, `${n}${NB}%`, `${n}${NB}pts`, `Q${1 + Math.floor(r() * 4)}${NB}2025`, `${2019 + Math.floor(r() * 5)}–${2025 + Math.floor(r() * 4)}`,
    `${2019 + Math.floor(r() * 5)}-${2025 + Math.floor(r() * 4)}`, `${n}×`, `(${n}%)`, `${n}`, `€${n}`, `£${n}`, `${Math.round(r() * 60)}-${Math.round(60 + r() * 40)}%`,
  ][Math.floor(r() * 19)];
};
const DASH = [" — ", " – ", "—", "–", " - "];
const PUNCT = [",", ".", ":", ";", "?", "!", ""];

function sentence(r, nWords, { upper }) {
  const toks = [];
  const pick = (a) => a[Math.floor(r() * a.length)];
  for (let i = 0; i < nWords; i++) {
    const x = r();
    let w = x < 0.62 ? pick(WORDS) : x < 0.72 ? pick(HYPH) : x < 0.8 ? pick(SLASH) : x < 0.93 ? NUM() : pick(WORDS);
    if (!upper && i === 0) w = w[0].toUpperCase() + w.slice(1);
    toks.push(w);
    if (i < nWords - 1) {
      const y = r();
      toks.push(y < 0.07 ? pick(DASH) : y < 0.15 ? pick(PUNCT) + " " : y < 0.17 ? NB : " ");
    }
  }
  return toks.join("").replace(/ +/g, " ").replace(/ ([,.:;?!])/g, "$1");
}

/** Wrap a random run of 1–3 words in **…** or [[…]]. */
function markup(r, s, { bold, focus }) {
  const words = s.split(" ");
  const apply = (open, close) => {
    const i = Math.floor(r() * words.length), n = 1 + Math.floor(r() * 3), j = Math.min(words.length, i + n) - 1;
    if (words.slice(i, j + 1).some((w) => /\*\*|\[\[|\]\]/.test(w))) return;
    words[i] = open + words[i]; words[j] = words[j] + close;
  };
  if (focus && r() < 0.35) apply("[[", "]]");
  if (bold && r() < 0.45) apply("**", "**");
  if (bold && r() < 0.15) apply("**", "**");
  return words.join(" ");
}

const SHAPE = {
  "consulting-title": { words: [3, 26], bold: false, focus: true, upper: false },
  "pitch-title": { words: [1, 7], bold: false, focus: true, upper: true },
  "pitch-title-wrap": { words: [2, 14], bold: false, focus: true, upper: true },
  "pitch-subtitle": { words: [4, 36], bold: true, focus: true, upper: false },
  "note-p": { words: [3, 55], bold: true, focus: true, upper: false },
  "card-p": { words: [3, 50], bold: true, focus: true, upper: false },
};

const out = {};
for (const [slot, sh] of Object.entries(SHAPE)) {
  const r = rng(SEED + slot.length * 7919 + slot.charCodeAt(0));
  const orig = Math.random; Math.random = r; // NUM() uses Math.random; keep it seeded
  const want = { near: Math.round(PER * 0.6), mid: Math.round(PER * 0.2), any: PER - Math.round(PER * 0.6) - Math.round(PER * 0.2) };
  const got = { near: [], mid: [], any: [] }, seen = new Set();
  for (let tries = 0; tries < 2000000 && (got.near.length < want.near || got.mid.length < want.mid || got.any.length < want.any); tries++) {
    const n = sh.words[0] + Math.floor(r() * (sh.words[1] - sh.words[0] + 1));
    let s = markup(r, sentence(r, n, sh), sh);
    if (sh.upper && r() < 0.3) s = s.toLowerCase(); // lowercase source: the transform must do the work
    if (seen.has(s)) continue;
    const p = predict(slot, s);
    if (p.lines > SLOTS[slot].maxLines + 1 && slot !== "pitch-title") continue;
    const bucket = p.minGap < 2 ? "near" : p.minGap < 10 ? "mid" : "any";
    const b = got[bucket].length < want[bucket] ? bucket : got.any.length < want.any ? "any" : null;
    if (!b) continue;
    seen.add(s); got[b].push(s);
  }
  Math.random = orig;
  out[slot] = [...got.near, ...got.mid, ...got.any];
  console.log(slot, Object.fromEntries(Object.entries(got).map(([k, v]) => [k, v.length])));
}
writeFileSync(new URL("strings.json", import.meta.url), JSON.stringify(out, null, 1));
