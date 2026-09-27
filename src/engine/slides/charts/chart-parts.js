/* Shared drawing helpers for every chart kind: SVG shapes, HTML labels, plot-pixel geometry. */
export { esc } from "../render.js";

/** An HTML label at a point; `a` is the anchor (bc = bottom centre, tc, mc, tl, br, ml, tc0). */
export const lbl = (cls, x, y, a, html, attrs = "") => `<span class="lbl a-${a} ${cls}" style="left:${x}px;top:${y}px"${attrs}>${html}</span>`;
export const topRounded = (x, y, w, h, r) => { r = Math.min(r, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`; };

/** Label placement runs on the rendered plot, in plot pixels (the slide itself is scaled). */
export function plotRects(box) {
  const B = box.getBoundingClientRect(), k = B.width / box.clientWidth;
  return (el) => { const r = el.getBoundingClientRect();
    return { l: (r.left - B.left) / k, r: (r.right - B.left) / k, t: (r.top - B.top) / k, b: (r.bottom - B.top) / k }; };
}
export const hits = (a, b, gap) => a.l < b.r + gap && b.l < a.r + gap && a.t < b.b + gap && b.t < a.b + gap;

/** Category labels: show every k-th one counting back from the last, with the smallest k that keeps a clear gap. */
export function thinCategories(box) {
  const cats = [...box.querySelectorAll(".cat")], rect = plotRects(box), rs = cats.map(rect);
  for (let k = 1; k < cats.length; k++) {
    const shown = (i) => (cats.length - 1 - i) % k === 0, kept = cats.map((_, i) => i).filter(shown);
    if (kept.every((i, j) => !j || rs[i].l >= rs[kept[j - 1]].r + 28)) { cats.forEach((c, i) => { if (!shown(i)) c.remove(); }); return; }
  }
}

/** Move each element down (dir 1) or up (dir -1) until it clears the rects placed before it. */
export function settle(box, els, gap, dir = -1, placed = []) {
  const rect = plotRects(box);
  for (const el of els) {
    let r = rect(el);
    for (let n = 0; n < 40; n++) {
      const hit = placed.find((o) => hits(r, o, gap));
      if (!hit) break;
      const d = dir < 0 ? r.b - hit.t + gap : hit.b - r.t + gap;
      el.style.top = `${parseFloat(el.style.top) + dir * d}px`; r = { ...r, t: r.t + dir * d, b: r.b + dir * d };
    }
    placed.push(r);
  }
  return placed;
}
