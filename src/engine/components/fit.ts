/* Fitters: they measure a mounted component and set what CSS cannot know (column widths, icon stacking, picture sizes,
   shrinking values, the floor two halves share). `root` is what holds the components (a slide, or a doc figure's canvas);
   `k` is its scale, its drawn width over its design width, so measurements read in design pixels. */
import { createElement, icons } from "lucide";

/* Icons: lucide's createIcons scans the whole document; this does the same replacement (same
   attributes and classes) for the components just mounted only. */
const pascal = (name: string) => name.replace(/(\w)(\w*)(_|-|\s*)/g, (_m, a: string, b: string) => a.toUpperCase() + b.toLowerCase());
export function drawIcons(root: HTMLElement): void {
  root.querySelectorAll("i[data-lucide]").forEach((el) => {
    const name = el.getAttribute("data-lucide") ?? "", node = icons[pascal(name) as keyof typeof icons];
    if (!node) return;
    const [tag, attrs, children] = node;
    el.replaceWith(createElement([tag, { ...attrs, "data-lucide": name, "stroke-width": 1.5, class: `lucide lucide-${name}` }, children]));
  });
}

/* L1: the label column takes its natural width within 20–40%; fixed layout splits the rest equally. A column of
   bullets takes a double share. Where equal columns would wrap a cell or heading, the widths lean towards fewer
   lines, a preference rather than a rule (rows of two lines are fine, they only cost height): a column that fits on
   one line in less than its share takes just that, and the room goes to the columns that wrap; when every column
   fits on one line, each takes its width plus an even part of what is left (class fitted). Every table in the root
   (a pair can have two).
   Group rows span the table, so they are not measured. A group column comes first and takes its longest heading on
   one line. */
export function sizeTable(root: HTMLElement, k: number): void {
  root.querySelectorAll<HTMLElement>(".tbl").forEach((tbl) => {
    const cols = [...tbl.querySelectorAll<HTMLElement>("col")], grp = tbl.classList.contains("by-group") ? 1 : 0, col = cols[grp];
    if (!col) return;
    // A fit can run more than once: widths from the last one would measure as content.
    cols.forEach((c) => { c.style.width = ""; });
    tbl.classList.remove("fitted");
    const g = grp ? (Math.max(0, ...[...tbl.querySelectorAll("td.grp > span")].map((el) => el.getBoundingClientRect().width / k)) + 28) / tbl.clientWidth : 0;
    if (grp) cols[0].style.width = `${(g * 100).toFixed(2)}%`;
    tbl.classList.add("measuring");
    const natural = Math.max(...[...tbl.querySelectorAll(`tr:not(.group) > :nth-child(${grp + 1})`)].map((c) => c.scrollWidth));
    // Every column on one line, unconstrained: its heading's cell is as wide as the column.
    tbl.classList.add("line-measure");
    const line = [...tbl.querySelectorAll("thead th")].map((th) => th.getBoundingClientRect().width / k);
    tbl.classList.remove("measuring", "line-measure");
    const w = tbl.clientWidth;
    // +2px: at exactly its natural width, subpixel rounding can wrap the label.
    const share = Math.min(.4, Math.max(.2, (natural + 2) / w));
    col.style.width = `${(share * 100).toFixed(2)}%`;
    // A column of bullets explains positions: it takes a double share of the rest, so its bullets keep to a line or two.
    const data = cols.slice(grp + 1), bul = new Set([...tbl.querySelectorAll("td.has-bul")].map((td) => (td as HTMLTableCellElement).cellIndex - grp - 1));
    // Pitch hides bullets, so its columns stay equal.
    const shares = data.map((_, j) => (bul.has(j) && !root.classList.contains("style-pitch") ? 2 : 1)), total = shares.reduce((a, b) => a + b, 0);
    const room = 1 - g - share, need = data.map((_, j) => (line[grp + 1 + j] ?? 0) + 2);
    const fits = data.map((_, j) => need[j] <= room * w * shares[j] / total);
    if (!bul.size && fits.some((f) => !f)) {
      tbl.classList.add("fitted");
      const spare = room * w - need.reduce((a, b) => a + b, 0);
      // Every column on one line: each its width and an even part of the rest.
      if (spare >= 0) { data.forEach((c, j) => { c.style.width = `${((need[j] + spare / data.length) / w * 100).toFixed(2)}%`; }); return; }
      // Some text wraps anyway: the short columns take their one-line width, the wrapping ones share the rest evenly.
      const short = data.reduce((a, _, j) => a + (fits[j] ? need[j] : 0), 0), wrapping = fits.filter((f) => !f).length;
      data.forEach((c, j) => { c.style.width = `${((fits[j] ? need[j] : (room * w - short) / wrapping) / w * 100).toFixed(2)}%`; });
      return;
    }
    if (!grp && total === data.length) return;
    data.forEach((c, j) => { c.style.width = `${(room * shares[j] / total * 100).toFixed(2)}%`; });
  });
}

/* Header icons sit inline; if any icon and its label do not fit across their column, every icon in that table goes
   above its label (one look per table). */
export function stackIcons(root: HTMLElement, k: number): void {
  root.querySelectorAll<HTMLElement>(".tbl").forEach((tbl) => {
    // Icons are drawn later (drawIcons), so an icon counts as its fixed 22px and 10px gap; the label is measured.
    const over = (th: HTMLElement) => { const cs = getComputedStyle(th), room = th.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      return (th.querySelector(":scope > span")?.getBoundingClientRect().width ?? 0) / k + 32 > room + 1; };
    if ([...tbl.querySelectorAll<HTMLElement>("thead th.has-ic")].some(over)) tbl.classList.add("ic-above");
  });
}

/* L5 in a pair: the two halves share one floor, the chart's plot bottom (its baseline) when a half is a chart, else the
   bottom of the taller half. Every other half meets it: a table's rows grow, points become equal bands, a number sits on
   it. A half never shrinks below its natural height (the fit checks report that). Runs after the charts are drawn. */
export function alignHalves(root: HTMLElement, k: number): void {
  const pair = root.querySelector<HTMLElement>(":scope > .pair");
  if (!pair) return;
  const R = root.getBoundingClientRect(), y = (v: number) => (v - R.top) / k;
  const halves = [...pair.querySelectorAll<HTMLElement>(":scope > .half")];
  const body = (h: HTMLElement) => h.querySelector<HTMLElement>(":scope > .tbl, :scope > .bullets.points, :scope > .half-num");
  // A chart's floor is its baseline (the horizontal base line), not the plot box, which also holds the category labels.
  const baseline = (plot: HTMLElement) => {
    const line = [...plot.querySelectorAll<SVGLineElement>("line.base")].find((l) => l.getAttribute("y1") === l.getAttribute("y2"));
    return y((line ?? plot).getBoundingClientRect().bottom);
  };
  const plots = halves.map((h) => h.querySelector<HTMLElement>(".plot")).filter((p): p is HTMLElement => !!p);
  // Without a chart: the taller half's bottom, grown by up to half its height towards the body's bottom (L5, as a table).
  const bodies = halves.map(body).filter((b): b is HTMLElement => !!b), tallest = Math.max(0, ...bodies.map((b) => b.getBoundingClientRect().height / k));
  const floor = plots.length ? Math.max(...plots.map(baseline))
    : Math.min(y(pair.getBoundingClientRect().bottom), Math.max(...bodies.map((b) => y(b.getBoundingClientRect().top))) + tallest * 1.5);
  for (const h of halves) {
    const b = body(h);
    if (!b || h.querySelector(".plot")) continue;
    const top = y(b.getBoundingClientRect().top), natural = b.getBoundingClientRect().height / k;
    if (floor - top > natural + 1) b.style.height = `${floor - top}px`;
  }
}

/* A screenshot is never cropped: it is fitted whole inside its area (its aspect is in the file name, so this needs no
   load), at the top of the area like a chart; centred across a full-width slide, from the left beside notes. */
export function fitPictures(root: HTMLElement, k: number): void {
  root.querySelectorAll<HTMLElement>(".pic.k-screenshot").forEach((fig) => {
    const area = fig.getBoundingClientRect(), a = parseFloat(fig.style.getPropertyValue("--a")) || 1.6;
    const W = area.width / k, H = area.height / k, w = Math.min(W, H * a);
    const img = fig.querySelector("img");
    if (img) { img.style.width = `${w}px`; img.style.height = `${w / a}px`; }
  });
}

/* Big values in a row shrink together (to 75% at most) so the widest fits. */
export function fitValues(root: HTMLElement): void {
  for (const sel of [".cards.value .v", ".big-v"]) {
    const els = [...root.querySelectorAll<HTMLElement>(sel)];
    const k = Math.min(1, ...els.map((e) => e.clientWidth / e.scrollWidth));
    if (k < 1) els.forEach((e) => { e.style.fontSize = `${parseFloat(getComputedStyle(e).fontSize) * Math.max(k, .75)}px`; });
  }
}
