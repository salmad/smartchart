/* One slide at full 1920×1080 from the review page, for checking a slide at full size.
   Usage: node full.mjs "only=7&style=consulting[&stress=1][&theme=paper]" shots/out.png */
import { chromium } from "playwright";
const [q, out] = process.argv.slice(2);
const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
await p.goto(`http://localhost:8787/v5/review.html?${q}&full=1`);
await p.waitForFunction(() => window.__fit);
await (await p.$(".frame")).screenshot({ path: out });
await b.close();
