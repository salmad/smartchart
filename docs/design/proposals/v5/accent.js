/* User accent: replaces the palette's `focus` colour. Code keeps it legible: the accent is moved towards
   white (dark palette) or black (light palette) until it has 4.5:1 contrast with the slide background,
   and text on accent fills takes whichever of white or near-black reads better. */

const rgb = (hex) => { const n = parseInt(hex.replace("#", ""), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
const toHex = (c) => `#${c.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`.toUpperCase();
const lum = (c) => { const [r, g, b] = c.map((v) => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }); return .2126 * r + .7152 * g + .0722 * b; };
export const contrast = (a, b) => { const [x, y] = [lum(rgb(a)), lum(rgb(b))].sort((m, n) => n - m); return (x + .05) / (y + .05); };
const mix = (a, b, t) => rgb(a).map((v, i) => v + (rgb(b)[i] - v) * t);

/** The accent as drawn on a background: { focus, onFocus }. */
export function accentOn(hex, bg) {
  const toward = lum(rgb(bg)) < .5 ? "#FFFFFF" : "#000000";
  let focus = hex.toUpperCase();
  for (let t = .05; contrast(focus, bg) < 4.5 && t <= 1; t += .05) focus = toHex(mix(hex, toward, t));
  const onFocus = contrast("#FFFFFF", focus) >= contrast("#0B0A09", focus) ? "#FFFFFF" : "#0B0A09";
  return { focus, onFocus };
}

/** "neg" or "pos" when the accent's hue reads as the palette's problem red or gain green; else null. */
export function semanticClash(hex) {
  const [r, g, b] = rgb(hex).map((v) => v / 255), max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  if (d / (1 - Math.abs(max + min - 1) || 1) < .35 || d < .15) return null; // greys and pastels carry no meaning
  const h = (max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4) * 60;
  return h < 18 || h > 342 ? "neg" : h > 95 && h < 160 ? "pos" : null;
}

/** Set the accent on a mounted slide; the palette's own focus stays when there is none. */
export function applyAccent(slide, hex) {
  if (!/^#[0-9a-f]{6}$/i.test(hex || "")) return;
  const { focus, onFocus } = accentOn(hex, getComputedStyle(slide).getPropertyValue("--bg").trim());
  slide.style.setProperty("--focus", focus);
  slide.style.setProperty("--on-focus", onFocus);
}
