// Map the 100 labelled prompts from the 9-entry menu (2026-09-26 bake-off) to the 7-entry menu.
// Usage: node map.mjs   (writes prompts.json)
import { readFileSync, writeFileSync } from "node:fs";

const dir = new URL(".", import.meta.url).pathname;
const old = JSON.parse(readFileSync(dir + "../2026-09-26-routing-bakeoff/prompts.json", "utf8"));

const TO7 = {
  "split/chart+notes": "chart", "full/chart": "chart",
  "split/table+notes": "table", "full/table": "table",
  "split/text+number": "number", "full/steps": "steps", "row/cards": "cards",
  cover: "cover", section: "section",
};
// Boundaries that were only "with notes or without" are no longer a routing decision.
const COLLAPSED = new Set(["chart-notes", "table-notes"]);

const items = old.map((it) => {
  const gold = TO7[it.gold];
  const acceptable = [...new Set(it.acceptable.map((a) => TO7[a]))].filter((a) => a !== gold);
  return {
    id: it.id, style: it.style, prompt: it.prompt, gold, acceptable,
    boundary: COLLAPSED.has(it.boundary) ? null : it.boundary,
    gold9: it.gold, boundary9: it.boundary, why: it.why,
  };
});
writeFileSync(dir + "prompts.json", JSON.stringify(items, null, 2) + "\n");
const count = (f) => Object.entries(items.reduce((m, i) => ((m[f(i)] = (m[f(i)] ?? 0) + 1), m), {}));
console.log("gold:", count((i) => i.gold));
console.log("boundary:", count((i) => i.boundary));
console.log("acceptable:", items.filter((i) => i.acceptable.length).map((i) => `${i.id} ${i.gold} ~ ${i.acceptable}`));
