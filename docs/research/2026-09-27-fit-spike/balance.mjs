/* Alternative to CSS text-wrap: balance. The calculator bisects the narrowest width that keeps the greedy
   line count (Blink's own fallback algorithm), and the renderer lays out with plain wrapping at that width.
   Checks that Chrome then matches the prediction exactly. Writes balance.json. */
import { writeFileSync } from "node:fs";
import { launch } from "./chrome.mjs";
import { predict, balancedWidth, SLOTS, toHTML } from "./fit.mjs";
import STRINGS from "./strings.json" with { type: "json" };

const slot = "consulting-title", S = SLOTS[slot], strings = STRINGS[slot];
const norm = (lines) => lines.map((l) => l.replace(/ +$/, "")).join("|");
const c = await launch();
const out = {};
for (const dpr of [1, 2]) {
  const p = await c.page({ dpr });
  const items = strings.map((s) => ({ s, w: balancedWidth(slot, s) }));
  const res = await p.page.evaluate(({ items, lh }) => {
    const host = document.getElementById("w");
    host.innerHTML = items.map((it) => `<div class="t consulting-title m-wrap" style="width:${it.w}px">${it.html}</div>`).join("");
    const range = document.createRange();
    return [...host.children].map((el) => {
      const lines = []; let cur = null;
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) for (let i = 0; i < n.data.length; i++) {
        range.setStart(n, i); range.setEnd(n, i + 1);
        const r = range.getClientRects()[0];
        if (n.data[i] === " " || !r) { if (cur) cur.t += n.data[i]; continue; }
        if (!cur || r.top > cur.top + lh / 2) { cur = { top: r.top, t: "" }; lines.push(cur); }
        cur.t += n.data[i];
      }
      return lines.map((l) => l.t);
    });
  }, { items: items.map((it) => ({ w: it.w, html: toHTML(it.s) })), lh: S.lh });
  let count = 0, same = 0, keeps = 0;
  items.forEach((it, i) => {
    const pb = predict(slot, it.s, { mode: "wrap", width: it.w }), g = predict(slot, it.s, { mode: "wrap" });
    count += pb.lines === res[i].length; same += norm(pb.lineTexts) === norm(res[i]); keeps += res[i].length === g.lines;
  });
  out[`dpr${dpr}`] = { n: strings.length, countAgrees: count, breaksAgree: same, keepsGreedyCount: keeps };
  console.log(`dpr${dpr}`, out[`dpr${dpr}`]);
  await p.close();
}
await c.browser.close();
writeFileSync(new URL("balance.json", import.meta.url), JSON.stringify(out, null, 1));
