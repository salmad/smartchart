/* Pictures on slides. A picture is always an Occam picture: copied into our Blob store by add_image, or bundled with
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

/** A logo this wide is a wordmark: it spells the name, so it can stand in for it. */
export const isWordmark = (aspect: number) => aspect >= 2.4;

/** A JSON replacer that reads a picture as words ("[logo]", "[screenshot: The Acme app…]"): checks and models that cannot
    see it read what it shows, never its file name (whose hash and size would read as figures). */
export function pictureAsWords(_key: string, v: unknown): unknown {
  if (!v || typeof v !== "object" || Array.isArray(v) || typeof (v as ImageRef).src !== "string") return v;
  const ref = v as ImageRef, kind = imageMeta(ref.src)?.kind ?? "picture";
  return ref.alt ? `[${kind}: ${ref.alt}]` : `[${kind}]`;
}
