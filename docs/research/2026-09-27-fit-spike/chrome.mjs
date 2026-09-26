/* Chrome ground truth: renders every string in its slot with the same TTFs and reads lines from Range rects. */
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { SLOTS, toHTML } from "./fit.mjs";

const here = new URL(".", import.meta.url);
const ORIGIN = "http://spike.test/";

function slotCSS(id, s, mode) {
  return `.${id}.m-${mode} { font-family: ${s.family === "archivo" ? "Archivo" : "Geist"}; font-weight: ${s.weight}; font-stretch: ${s.stretch}%;
    font-size: ${s.size}px; line-height: ${s.lh}px; letter-spacing: ${s.ls}em; word-spacing: ${s.ws}em; width: ${s.width}px;
    text-transform: ${s.upper ? "uppercase" : "none"}; ${mode === "nowrap" ? "white-space: nowrap;" : mode === "measure" ? "white-space: nowrap; width: max-content;" : `text-wrap: ${mode};`} }`;
}

export const MODES = {
  "consulting-title": ["balance", "wrap"],
  "pitch-title": ["nowrap"],
  "pitch-title-wrap": ["wrap"],
  "pitch-subtitle": ["pretty", "wrap", "balance"],
  "note-p": ["pretty", "wrap"],
  "card-p": ["pretty", "wrap"],
};

const PAGE = () => `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face { font-family: "Archivo"; src: url(fonts/Archivo-VF.ttf) format("truetype"); font-weight: 100 900; font-stretch: 62% 125%; font-display: block; }
@font-face { font-family: "Geist"; src: url(fonts/Geist-VF.ttf) format("truetype"); font-weight: 100 900; font-display: block; }
html, body { margin: 0; background: #fff; }
.wrap { transform-origin: 0 0; }
.t { margin: 0 0 40px; padding: 0; box-sizing: border-box; overflow: visible; hyphens: manual; overflow-wrap: normal;
  font-kerning: normal; font-variant-ligatures: none; font-synthesis: none; -webkit-text-size-adjust: none; -webkit-font-smoothing: antialiased; }
.t strong { font-weight: 700; }
.hl-focus { color: #c28a12; }
${Object.entries(MODES).flatMap(([id, ms]) => [...ms, "measure"].map((m) => slotCSS(id, SLOTS[id], m))).join("\n")}
</style></head><body><div class="wrap" id="w"></div></body></html>`;

/** In-page: lay out a batch and read lines per element. */
function readBatch({ items, scale }) {
  const w = document.getElementById("w");
  w.style.transform = scale === 1 ? "" : `scale(${scale})`;
  w.innerHTML = items.map((it) => `<div class="t ${it.slot} m-${it.mode}" data-lh="${it.lh}">${it.html}</div>`).join("");
  const out = [];
  for (const el of w.children) {
    const lh = +el.dataset.lh;
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const range = document.createRange();
    const lines = []; // { top, text, left, right }
    let cur = null;
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const t = n.data;
      for (let i = 0; i < t.length; i++) {
        const c = t[i];
        range.setStart(n, i); range.setEnd(n, i + 1);
        const rects = range.getClientRects();
        const r = rects[0];
        if (c === " " || !r || r.width === 0 && c === " ") { if (cur) cur.text += c; continue; }
        const top = r.top / scale;
        if (!cur || top > cur.top + lh / 2) { cur = { top, text: "", left: r.left / scale, right: r.right / scale }; lines.push(cur); }
        cur.text += c; cur.right = Math.max(cur.right, r.right / scale); cur.left = Math.min(cur.left, r.left / scale);
      }
    }
    range.selectNodeContents(el);
    const box = el.getBoundingClientRect();
    out.push({
      lines: lines.length,
      byHeight: Math.round(box.height / scale / lh),
      lineTexts: lines.map((l) => l.text),
      lineWidths: lines.map((l) => l.right - l.left),
      inkWidth: range.getBoundingClientRect().width / scale,
      overflow: el.scrollWidth > el.clientWidth,
    });
  }
  return out;
}

/** In-page: time one layout per string (set content, force layout, read height). */
function timeLayouts({ items }) {
  const w = document.getElementById("w");
  w.style.transform = "";
  w.innerHTML = `<div class="t ${items[0].slot} m-${items[0].mode}"></div>`;
  const el = w.firstChild;
  let sink = 0;
  const t0 = performance.now();
  for (const it of items) { el.innerHTML = it.html; sink += el.getBoundingClientRect().height; }
  return { ms: (performance.now() - t0) / items.length, sink };
}

export async function launch() {
  const browser = await chromium.launch();
  return {
    browser,
    async page({ dpr }) {
      const ctx = await browser.newContext({ deviceScaleFactor: dpr, viewport: { width: 1920, height: 1080 } });
      const page = await ctx.newPage();
      await page.route(`${ORIGIN}**`, (route) => {
        const path = route.request().url().slice(ORIGIN.length);
        if (path === "" || path === "index.html") return route.fulfill({ contentType: "text/html", body: PAGE() });
        return route.fulfill({ contentType: "font/ttf", body: readFileSync(new URL(path, here)) });
      });
      await page.goto(ORIGIN);
      await page.evaluate(() => Promise.all(["800 74px Archivo", "400 25px Geist"].map((f) => document.fonts.load(f))));
      const ok = await page.evaluate(() => document.fonts.check("800 74px Archivo") && document.fonts.check("400 25px Geist"));
      if (!ok) throw new Error("fonts did not load");
      return {
        page,
        chromeVersion: browser.version(),
        async read(slot, mode, strings, scale = 1) {
          const lh = SLOTS[slot].lh, all = [];
          for (let i = 0; i < strings.length; i += 250) {
            const items = strings.slice(i, i + 250).map((s) => ({ slot, mode, lh, html: toHTML(s) }));
            all.push(...(await page.evaluate(readBatch, { items, scale })));
          }
          return all;
        },
        async time(slot, mode, strings) {
          const items = strings.map((s) => ({ slot, mode, html: toHTML(s) }));
          await page.evaluate(timeLayouts, { items }); // warm-up
          return (await page.evaluate(timeLayouts, { items })).ms;
        },
        close: () => ctx.close(),
      };
    },
  };
}
