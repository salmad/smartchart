// Summarise results.json into report.md.
import { readFileSync, writeFileSync } from "node:fs";

const dir = new URL(".", import.meta.url).pathname;
const { items, results } = JSON.parse(readFileSync(dir + "results.json", "utf8"));
const byId = Object.fromEntries(items.map((it) => [it.id, it]));
const ok = (r) => !!r && !r.err && r.pick === byId[r.id].gold;
const okLenient = (r) => ok(r) || (!r.err && (byId[r.id].acceptable ?? []).includes(r.pick));
const pct = (a, b) => (b ? `${Math.round((100 * a) / b)}%` : "–");
const q = (xs, p) => { const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p * s.length))] ?? 0; };
const sec = (ms) => `${(ms / 1000).toFixed(1)} s`;
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / (xs.length || 1);
const lines = [];
const L = (s = "") => lines.push(s);
const names = Object.keys(results);
const jevNames = names.filter((n) => n.startsWith("jev"));
const glmThink = Object.fromEntries((results["glm-flash-think"] ?? []).map((r) => [r.id, r]));

L("# Routing bake-off on the 7-entry menu");
L();
L(`${items.length} labelled prompts (${items.filter((i) => i.style === "consulting").length} consulting, ${items.filter((i) => i.style === "pitch").length} pitch). ${items.filter((i) => i.boundary).length} sit on a boundary between two entries; ${items.filter((i) => ["chart-notes", "table-notes"].includes(i.boundary9)).length} more were "notes or not" boundaries on the 9-entry menu and are now plain chart or table items.`);
L();
L("| Contestant | Strict | Lenient | Consulting | Pitch | Boundary items | Former notes items | Errors | p50 | p95 | Cost |");
L("|---|---|---|---|---|---|---|---|---|---|---|");
for (const [name, rs] of Object.entries(results)) {
  const good = rs.filter((r) => !r.err);
  const sub = (f) => { const s = rs.filter((r) => f(byId[r.id])); return pct(s.filter(ok).length, s.length); };
  const cost = rs.reduce((a, r) => a + (r.cost ?? 0), 0);
  L(`| ${name} | ${pct(rs.filter(ok).length, rs.length)} | ${pct(rs.filter(okLenient).length, rs.length)} | ${sub((i) => i.style === "consulting")} | ${sub((i) => i.style === "pitch")} | ${sub((i) => i.boundary)} | ${sub((i) => ["chart-notes", "table-notes"].includes(i.boundary9))} | ${rs.length - good.length} | ${sec(q(good.map((r) => r.ms), 0.5))} | ${sec(q(good.map((r) => r.ms), 0.95))} | ${cost ? "$" + cost.toFixed(4) : "subscription"} |`);
}

L();
L("## Accuracy by boundary (strict)");
L();
const bounds = [...new Set(items.map((i) => i.boundary).filter(Boolean))];
L(`| Boundary | n | ${names.join(" | ")} |`);
L(`|---|---|${names.map(() => "---").join("|")}|`);
const rowFor = (label, f) => {
  const n = items.filter(f).length;
  L(`| ${label} | ${n} | ${Object.values(results).map((rs) => { const s = rs.filter((r) => f(byId[r.id])); return pct(s.filter(ok).length, s.length); }).join(" | ")} |`);
};
for (const b of bounds) rowFor(b, (i) => i.boundary === b);
rowFor("(former) chart-notes", (i) => i.boundary9 === "chart-notes");
rowFor("(former) table-notes", (i) => i.boundary9 === "table-notes");
rowFor("no boundary", (i) => !i.boundary9);

L();
L("## Accuracy by gold entry (strict)");
L();
L(`| Gold | n | ${names.join(" | ")} |`);
L(`|---|---|${names.map(() => "---").join("|")}|`);
for (const g of [...new Set(items.map((i) => i.gold))]) rowFor(g, (i) => i.gold === g);

L();
L("## Most common mistakes (gold → picked)");
for (const [name, rs] of Object.entries(results)) {
  const m = {};
  for (const r of rs) if (!ok(r) && !r.err) { const k = `${byId[r.id].gold} → ${r.pick}`; m[k] = (m[k] ?? 0) + 1; }
  const top = Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 6);
  L();
  L(`**${name}:** ${top.map(([k, v]) => `${k} (${v})`).join(" · ") || "none"}`);
}

L();
L("## Jev run-to-run noise");
L();
L("| Pair | Same pick | Accuracy run 1 / run 2 | Mean abs. change in top p | Items that cross 0.7 |");
L("|---|---|---|---|---|");
for (const base of ["jev-guide", "jev-bare"]) {
  const a = results[base], b = results[base + "-2"];
  if (!a || !b) continue;
  const bb = Object.fromEntries(b.map((r) => [r.id, r]));
  const both = a.filter((r) => !r.err && bb[r.id] && !bb[r.id].err);
  const same = both.filter((r) => r.pick === bb[r.id].pick).length;
  const dp = mean(both.map((r) => Math.abs(r.p - bb[r.id].p)));
  const cross = both.filter((r) => (r.p >= 0.7) !== (bb[r.id].p >= 0.7)).length;
  L(`| ${base} vs ${base}-2 | ${same}/${both.length} | ${pct(a.filter(ok).length, a.length)} / ${pct(b.filter(ok).length, b.length)} | ${dp.toFixed(3)} | ${cross} |`);
}

const BANDS = [["≥ 0.9", 0.9, 1.01], ["0.7–0.9", 0.7, 0.9], ["0.5–0.7", 0.5, 0.7], ["< 0.5", 0, 0.5]];
for (const name of jevNames) {
  const rs = results[name].filter((r) => !r.err);
  L();
  L(`## Calibration and combined policy: ${name}`);
  L();
  L("| Top probability | n | Accuracy |");
  L("|---|---|---|");
  for (const [label, lo, hi] of BANDS) {
    const s = rs.filter((r) => r.p >= lo && r.p < hi);
    L(`| ${label} | ${s.length} | ${pct(s.filter(ok).length, s.length)} |`);
  }
  L();
  L(`Policy: ${name} picks if its top p ≥ T, otherwise GLM 5.3 Flash with thinking picks (Jev always runs first, so a GLM pick costs Jev + GLM time).`);
  L();
  L("| T | Accuracy | Lenient | Sent to GLM | Jev accuracy where it decides | Mean latency | p95 latency |");
  L("|---|---|---|---|---|---|---|");
  const policy = (t) => results[name].map((r) => {
    const g = glmThink[r.id];
    const toGlm = r.err || r.p < t;
    return { pick: toGlm ? g?.pick : r.pick, id: r.id, ms: (r.ms ?? 0) + (toGlm ? g?.ms ?? 0 : 0), toGlm };
  });
  const row = (label, ps) => {
    const hi = ps.filter((p) => !p.toGlm);
    L(`| ${label} | ${pct(ps.filter(ok).length, ps.length)} | ${pct(ps.filter(okLenient).length, ps.length)} | ${pct(ps.filter((p) => p.toGlm).length, ps.length)} | ${pct(hi.filter(ok).length, hi.length)} | ${sec(mean(ps.map((p) => p.ms)))} | ${sec(q(ps.map((p) => p.ms), 0.95))} |`);
  };
  row("Jev alone", policy(0));
  for (const t of [0.5, 0.6, 0.7, 0.8, 0.9]) row(String(t), policy(t));
  row("GLM alone", policy(2));
}

const pre = results["jev-guide"];
if (pre?.[0]?.intent) {
  L();
  L("## Side note: PRE intent (jev-guide)");
  L();
  const m = {};
  for (const r of pre.filter((r) => !r.err)) { const k = `${r.intent}${r.pIntent >= 0.7 ? "" : " (p < 0.7)"}`; m[k] = (m[k] ?? 0) + 1; }
  L(Object.entries(m).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}: ${v}`).join(" · "));
  L();
  L("Every prompt asks for one new slide. PRE acts only on `new_slide` at p ≥ 0.7; any other answer leaves the template to the agent.");
}

L();
L("## Items most contestants got wrong");
L();
for (const it of items) {
  const all = names.map((n) => results[n].find((r) => r.id === it.id));
  const wrong = all.filter((r) => !ok(r)).length;
  if (wrong >= Math.ceil(names.length / 2)) L(`- **${it.id}** (${it.style}, gold ${it.gold}${it.acceptable.length ? ", also ok " + it.acceptable.join("/") : ""}; wrong ${wrong}/${names.length}): ${it.prompt.slice(0, 170).replace(/\n/g, " ")} → ${all.map((r, i) => `${names[i]} ${r?.pick ?? "err"}${r?.p !== undefined ? ` (${r.p.toFixed(2)})` : ""}`).join(", ")}`);
}
writeFileSync(dir + "report.md", lines.join("\n") + "\n");
console.log(lines.join("\n"));
