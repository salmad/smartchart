/* Pictures on slides. A picture is always a SmartChart picture: copied into our Blob store by add_image, or bundled with
   the starters. Its file name carries its kind and pixel size (`<hash>-<kind>-<w>x<h>.<ext>`), so a slide renders and
   validates without loading it, and the same picture added twice is one file. */

export const IMAGE_KINDS = ["photo", "screenshot", "logo"] as const;
export type ImageKind = (typeof IMAGE_KINDS)[number];
export interface ImageRef { src: string; alt?: string }
export interface ImageMeta { kind: ImageKind; w: number; h: number; aspect: number }

const TAIL = String.raw`-(photo|screenshot|logo)-([1-9]\d{0,4})x([1-9]\d{0,4})\.(?:png|webp|jpg)`;
const STORED = new RegExp(String.raw`^https://[a-z0-9]+\.public\.blob\.vercel-storage\.com/img/[0-9a-f]{16}${TAIL}$`);
const STARTER = new RegExp(String.raw`^/starters/img/[a-z0-9]+(?:-[a-z0-9]+)*?${TAIL}$`);

export function imageMeta(src: unknown): ImageMeta | null {
  if (typeof src !== "string") return null;
  const m = STORED.exec(src) ?? STARTER.exec(src);
  if (!m) return null;
  const w = Number(m[2]), h = Number(m[3]);
  return { kind: m[1] as ImageKind, w, h, aspect: w / h };
}
export const isImageSrc = (src: unknown): src is string => imageMeta(src) !== null;

/** Where add_image stores a picture: its content hash (16 hex), kind and size. */
export const imageName = (hash: string, kind: ImageKind, w: number, h: number, ext: "png" | "webp" | "jpg") =>
  `img/${hash.slice(0, 16)}-${kind}-${w}x${h}.${ext}`;

/** Optical size: every logo covers the same area as a square `base` wide, so a wordmark and a symbol weigh the same;
    then scaled down whole to fit the box. */
export function logoSize(aspect: number, box: { base: number; maxW: number; maxH: number }): { w: number; h: number } {
  let h = box.base / Math.sqrt(aspect), w = h * aspect;
  const k = Math.min(1, box.maxW / w, box.maxH / h);
  w *= k; h *= k;
  return { w: Math.round(w * 100) / 100, h: Math.round(h * 100) / 100 };
}

/** A logo this wide is a wordmark: it spells the name, so it can stand in for it. */
export const isWordmark = (aspect: number) => aspect >= 2.4;
