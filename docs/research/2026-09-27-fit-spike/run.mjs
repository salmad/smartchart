/* Chrome ground truth for every string, slot, mode and device config. Writes chrome.json.
   Run: node gen.mjs && node run.mjs && node analyze.mjs */
import { writeFileSync } from "node:fs";
import { launch, MODES } from "./chrome.mjs";
import STRINGS from "./strings.json" with { type: "json" };

export const CONFIGS = [
  { id: "dpr1", dpr: 1, scale: 1 },
  { id: "dpr2", dpr: 2, scale: 1 },
  { id: "dpr2-scaled", dpr: 2, scale: 0.5 }, // the app: 1920×1080 canvas under transform: scale()
];

const c = await launch();
const out = { chrome: c.browser.version(), configs: {}, timing: {} };
for (const cfg of CONFIGS) {
  const p = await c.page(cfg);
  const res = {};
  for (const [slot, modes] of Object.entries(MODES)) {
    res[slot] = {};
    for (const mode of [...modes, "measure"]) {
      if (mode === "measure" && cfg.scale !== 1) continue;
      const t0 = Date.now();
      res[slot][mode] = await p.read(slot, mode, STRINGS[slot], cfg.scale);
      console.log(cfg.id, slot, mode, `${Date.now() - t0} ms`);
    }
    if (cfg.id === "dpr1") out.timing[slot] = await p.time(slot, modes[0], STRINGS[slot]);
  }
  out.configs[cfg.id] = res;
  await p.close();
}
await c.browser.close();
writeFileSync(new URL("chrome.json", import.meta.url), JSON.stringify(out));
