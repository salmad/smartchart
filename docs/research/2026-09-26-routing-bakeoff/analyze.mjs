// Summarise results.json into report.md.
import { readFileSync, writeFileSync } from "node:fs";

const dir = new URL(".", import.meta.url).pathname;
const { items, results } = JSON.parse(readFileSync(dir + "results.json", "utf8"));
const byId = Object.fromEntries(items.map((it) => [it.id, it]));
const ok = (r) => r.pick === byId[r.id].gold;
const okLenient = (r) => ok(r) || (byId[r.id].acceptable ?? []).includes(r.pick);
const pct = (a, b) => (b ? `${Math.round((100 * a) / b)}%` : "–");
const q = (xs, p) => { const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p * s.length))] ?? 0; };
const lines = [];
const L = (s = "") => lines.push(s);

L("# Routing bake-off: Jev vs GLM 5.3 Flash");
L();
L(`${items.length} labelled prompts (${items.filter((i) => i.style === "consulting").length} consulting, ${items.filter((i) => i.style === "pitch").length} pitch), ${items.filter((i) => i.boundary).length} on a boundary between two templates.`);
L();
L("| Contestant | Strict | Lenient | Consulting | Pitch | Boundary items | Errors | p50 ms | p95 ms | Cost |");
L("|---|---|---|---|---|---|---|---|---|---|");
for (const [name, rs] of Object.entries(results)) {
  const good = rs.filter((r) => !r.err);
  const sub = (f) => { const s = rs.filter((r) => f(byId[r.id])); return pct(s.filter(ok).length, s.length); };
  const cost = rs.reduce((a, r) => a + (r.cost ?? 0), 0);
  L(`| ${name} | ${pct(rs.filter(ok).length, rs.length)} | ${pct(rs.filter(okLenient).length, rs.length)} | ${sub((i) => i.style === "consulting")} | ${sub((i) => i.style === "pitch")} | ${sub((i) => i.boundary)} | ${rs.length - good.length} | ${Math.round(q(good.map((r) => r.ms), 0.5))} | ${Math.round(q(good.map((r) => r.ms), 0.95))} | ${cost ? "$" + cost.toFixed(4) : "subscription"} |`);
}

L();
L("## Accuracy by boundary (strict)");
L();
const bounds = [...new Set(items.map((i) => i.boundary).filter(Boolean))];
L(`| Boundary | n | ${Object.keys(results).join(" | ")} |`);
L(`|---|---|${Object.keys(results).map(() => "---").join("|")}|`);
for (const b of bounds) {
  const n = items.filter((i) => i.boundary === b).length;
  L(`| ${b} | ${n} | ${Object.values(results).map((rs) => { const s = rs.filter((r) => byId[r.id].boundary === b); return pct(s.filter(ok).length, s.length); }).join(" | ")} |`);
}

L();
L("## Most common mistakes (gold → picked)");
for (const [name, rs] of Object.entries(results)) {
  const m = {};
  for (const r of rs) if (!ok(r) && !r.err) { const k = `${byId[r.id].gold} → ${r.pick}`; m[k] = (m[k] ?? 0) + 1; }
  const top = Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 6);
  L();
  L(`**${name}:** ${top.map(([k, v]) => `${k} (${v})`).join(" · ") || "none"}`);
}

for (const name of Object.keys(results).filter((n) => n.startsWith("jev"))) {
  const rs = results[name].filter((r) => !r.err);
  L();
  L(`## Calibration: ${name}`);
  L();
  L("| Top-choice probability | n | Accuracy |");
  L("|---|---|---|");
  for (const [lo, hi] of [[0, 0.5], [0.5, 0.6], [0.6, 0.7], [0.7, 0.8], [0.8, 0.9], [0.9, 1.01]]) {
    const s = rs.filter((r) => r.p >= lo && r.p < hi);
    L(`| ${lo.toFixed(1)}–${Math.min(hi, 1).toFixed(1)} | ${s.length} | ${pct(s.filter(ok).length, s.length)} |`);
  }
  L();
  L("| Threshold | Jev decides | Jev accuracy there | Hybrid accuracy (below threshold → glm-flash) |");
  L("|---|---|---|---|");
  const glmBy = Object.fromEntries((results["glm-flash"] ?? []).map((r) => [r.id, r]));
  for (const t of [0.5, 0.6, 0.7, 0.8, 0.9]) {
    const hi = rs.filter((r) => r.p >= t);
    const hybrid = results[name].map((r) => (!r.err && r.p >= t ? r : glmBy[r.id] ?? r));
    L(`| ${t} | ${pct(hi.length, results[name].length)} | ${pct(hi.filter(ok).length, hi.length)} | ${pct(hybrid.filter(ok).length, hybrid.length)} |`);
  }
}

L();
L("## Items every contestant got wrong");
L();
for (const it of items) {
  const all = Object.values(results).map((rs) => rs.find((r) => r.id === it.id));
  if (all.every((r) => !ok(r))) L(`- **${it.id}** (${it.style}, gold ${it.gold}): ${it.prompt.slice(0, 160).replace(/\n/g, " ")} → ${all.map((r) => r.pick ?? "err").join(", ")}`);
}
writeFileSync(dir + "report.md", lines.join("\n") + "\n");
console.log(lines.join("\n"));
