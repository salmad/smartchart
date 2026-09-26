/* Measurements on a rendered slide: fit issues and layout lints. */

/* ═════════════ Fit check (prototype): measures the rendered slide at 1920×1080 ═════════════ */
export function fitIssues(slide, style) {
  const R = slide.getBoundingClientRect(), k = R.width / 1920, cs = getComputedStyle(slide);
  const box = (el) => { const r = el.getBoundingClientRect(); return { l: (r.left - R.left) / k, r: (r.right - R.left) / k, t: (r.top - R.top) / k, b: (r.bottom - R.top) / k }; };
  const name = (el) => (el.className.baseVal !== undefined ? el.tagName : (el.className || el.tagName).split(" ")[0]);
  const lines = (el, pad = 0) => Math.round((el.clientHeight - pad) / parseFloat(getComputedStyle(el).lineHeight));
  const bottom = 1080 - parseFloat(cs.paddingBottom), right = 1920 - parseFloat(cs.paddingRight), out = [];
  for (const el of slide.children) {
    if (el.classList.contains("rail")) continue;
    const b = box(el);
    if (b.b > bottom + 1) { out.push(`${name(el)} runs ${Math.round(b.b - bottom)}px into the bottom margin; shorten the body or drop the takeaway`); break; }
    if (b.r > right + 1) out.push(`${name(el)} runs ${Math.round(b.r - right)}px into the right margin`);
  }
  slide.querySelectorAll(".notes, .cards.framed .card, .card, .hero > div, .sec-n, .hero-v, .cards .v, .title").forEach((el) => {
    if (el.scrollHeight > el.clientHeight + 1 && getComputedStyle(el).overflow !== "visible") out.push(`${name(el)} content is taller than its box`);
    if (el.scrollWidth > el.clientWidth + 1) out.push(`${name(el)} “${el.textContent.trim().slice(0, 24)}” is wider than its column`);
  });
  slide.querySelectorAll(".notes, .cards.framed .card").forEach((el) => { const last = el.lastElementChild, pb = parseFloat(getComputedStyle(el).paddingBottom);
    if (last && box(last).b > box(el).b - pb + 1) out.push(`${name(el)} content runs ${Math.round(box(last).b - box(el).b + pb)}px past its box`); });
  const title = slide.querySelector("h2.title, h1.title");
  // Section titles hold one line so the section number sits still across dividers.
  const maxTitle = slide.matches(".t-section") || (style === "pitch" && !slide.matches(".t-cover")) ? 1 : 2;
  if (title && lines(title) > maxTitle) out.push(`title wraps to ${lines(title)} lines (max ${maxTitle}); shorten it`);
  const sub = slide.querySelector(".subtitle");
  if (sub && lines(sub) > 2) out.push(`subtitle wraps to ${lines(sub)} lines (max 2); shorten it`);
  const tk = slide.querySelector(".takeaway");
  if (tk && lines(tk, 12) > 1) out.push(`takeaway wraps to ${lines(tk, 12)} lines; it must fit on one`);
  const fn = slide.querySelector(".rail .fn");
  if (fn && fn.textContent && box(fn).t < 1080 - 48 - 2 * 24 - 2) out.push("footnote + source take more than two lines");
  return out;
}

/* Layout lints (spec 3.6), measured on the rendered slide in slide pixels. Messages start with the
   part of the slide they are about and end with the rule id. L5 (body fill) is a warning: some approved
   slides leave room on purpose. */
export function layoutLints(slide, style) {
  const R = slide.getBoundingClientRect(), k = R.width / 1920, out = [], warnings = [];
  const box = (el) => { const r = el.getBoundingClientRect(); return { t: (r.top - R.top) / k, b: (r.bottom - R.top) / k, w: r.width / k, h: r.height / k }; };
  const spread = (xs) => (xs.length > 1 ? Math.max(...xs) - Math.min(...xs) : 0);

  const tbl = slide.querySelector(".tbl");
  if (tbl) {
    const ths = [...tbl.querySelectorAll("thead th")].map((th) => box(th).w), d = spread(ths.slice(1));
    if (d > 1) out.push(`table: data columns differ by ${Math.round(d)}px; they must be equal (L1)`);
    const share = ths[0] / box(tbl).w;
    if (share < .195 || share > .405) out.push(`table: the label column is ${Math.round(share * 100)}% of the table; it must be 20–40% (L1)`);
  }

  // L3: the body starts on one line per style: top padding + the head's reserved height + the gap.
  const head = slide.querySelector(":scope > .head"), body = head?.nextElementSibling;
  if (body && !body.matches(".spacer, .rail")) {
    const cs = getComputedStyle(slide), line = parseFloat(cs.paddingTop) + parseFloat(getComputedStyle(head).minHeight) + parseFloat(cs.getPropertyValue("--body-gap"));
    if (Math.abs(box(body).t - line) > 2) out.push(`body: starts at ${Math.round(box(body).t)}px; it must start at ${Math.round(line)}px (L3). Shorten the title or subtitle.`);
  }

  const main = slide.querySelector(".t-table.v-full > .tbl, :scope > .cards:not(.framed), :scope > .steps")
    || (slide.matches(".t-table.v-full") ? slide.querySelector(":scope > .tbl") : null);
  if (main) {
    const bottom = 1080 - parseFloat(getComputedStyle(slide).paddingBottom), tk = slide.querySelector(".takeaway");
    const end = tk ? box(tk).t - 40 : bottom, b = box(main), fill = b.h / (end - b.t);
    const what = main.matches(".tbl") ? "table" : main.matches(".steps") ? "steps" : "cards";
    if (fill < .6) warnings.push(`body: ${Math.round((1 - fill) * 100)}% empty below the ${what}; add content or a takeaway, or use another template (L5)`);
  }

  const cards = [...slide.querySelectorAll(".cards > .card")].map((c) => box(c).h);
  if (spread(cards) > 1) out.push(`cards: heights differ by ${Math.round(spread(cards))}px; parallel cards share one size (L6)`);
  const steps = [...slide.querySelectorAll(".steps > .d")].map((d) => box(d).h);
  if (spread(steps) > 1) out.push(`steps: row heights differ by ${Math.round(spread(steps))}px (L6)`);
  return { issues: out, warnings };
}
