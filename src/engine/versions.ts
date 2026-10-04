/* Deck versions, on git's object model (not git): each slide's JSON is a blob stored once under its hash, and a
   version is a tree (the look plus the ordered slide ids and blob hashes). An unchanged slide is never stored again,
   a version costs a few hundred bytes, and two versions diff by comparing hashes. Restoring reads a tree and its
   blobs; there is no patch chain to replay. Framework-free: the server and the in-browser dev account share it. */
import type { Slide, Style, Theme } from "./types.js";

export interface Tree { style: Style; theme: Theme; accent: string | null; slides: [id: string, hash: string][] }
/** A version as a list shows it. `by` is who wrote it (You, SmartChart, or an agent's client name); `turn` groups the
    saves of one agent turn or one request; `label` is the request in the user's words, when there was one. */
export interface Version { n: number; rev: number; by: string; turn: string | null; label: string | null; at: number; tree: Tree }
/** `hashes`: the slide blobs the head names, already stored, so a save sends only new ones. */
export interface VersionHead { n: number; by: string; turn: string | null; at: number; key: string; hashes?: string[] }
/** Who is saving and why, sent with a save. */
export interface VersionMeta { by: string; turn: string | null; label: string | null }

/** Saves by the same writer for the same turn, this close together, become one version (as Google Docs groups edits). */
export const GROUP_MS = 10 * 60_000;
/** Versions kept per deck; older ones go. */
export const KEEP = 100;

/** cyrb53: a fast 53-bit string hash, plenty to tell one deck's slides apart. */
export function hash(s: string): string {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36) + s.length.toString(36);
}

interface SavedData { style?: Style; theme?: Theme; accent?: string | null; items?: { id: string; slide: Slide }[] }

/** A saved deck as a tree, its blobs (hash → slide) and its key (the tree's own hash: equal keys, equal decks). */
export function treeOf(data: unknown): { tree: Tree; blobs: Map<string, Slide>; key: string } {
  const d = (data && typeof data === "object" ? data : {}) as SavedData, blobs = new Map<string, Slide>();
  const slides = (d.items ?? []).map((it): [string, string] => {
    const h = hash(JSON.stringify(it.slide));
    blobs.set(h, it.slide);
    return [it.id, h];
  });
  const tree: Tree = { style: d.style === "pitch" ? "pitch" : "consulting", theme: d.theme === "paper" ? "paper" : "ink", accent: d.accent ?? null, slides };
  return { tree, blobs, key: hash(JSON.stringify(tree)) };
}

/** Skip a save that changed nothing a version shows; fold it into the last version when the same writer is still on
    the same turn; otherwise start a new version. The last version always equals the deck as saved. */
export function nextStep(head: VersionHead | null, meta: VersionMeta, key: string, now: number): "skip" | "replace" | "add" {
  if (head?.key === key) return "skip";
  if (head && head.by === meta.by && head.turn === meta.turn && now - head.at < GROUP_MS) return "replace";
  return "add";
}

export interface TreeDiff { added: string[]; removed: string[]; changed: string[]; moved: boolean; look: boolean }

/** What changed from `a` to `b`, by slide id and blob hash. */
export function diffTrees(a: Tree | null, b: Tree): TreeDiff {
  const A = new Map(a?.slides ?? []), B = new Map(b.slides);
  const added = b.slides.filter(([id]) => !A.has(id)).map(([id]) => id);
  const removed = (a?.slides ?? []).filter(([id]) => !B.has(id)).map(([id]) => id);
  const changed = b.slides.filter(([id, h]) => A.has(id) && A.get(id) !== h).map(([id]) => id);
  const kept = (t: Tree | null, other: Map<string, string>) => (t?.slides ?? []).map(([id]) => id).filter((id) => other.has(id)).join();
  return { added, removed, changed, moved: kept(a, B) !== kept(b, A), look: !!a && (a.style !== b.style || a.theme !== b.theme || a.accent !== b.accent) };
}

const count = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;

/** The diff in a few words: "Added 1 slide, changed 2". Empty when nothing a reader would see changed. */
export function describeDiff(d: TreeDiff): string {
  const parts = [
    d.added.length && `added ${count(d.added.length, "slide")}`,
    d.changed.length && `changed ${count(d.changed.length, "slide")}`,
    d.removed.length && `removed ${count(d.removed.length, "slide")}`,
    !d.added.length && !d.removed.length && d.moved && "reordered slides",
    d.look && "changed the look",
  ].filter((p): p is string => !!p);
  // "slide" is said once when the parts run together: "added 1 slide, changed 2".
  const counted = (p: string) => /^(?:added|changed|removed) \d+ slides?$/.test(p);
  const text = parts.map((p, i) => (i && counted(parts[0]) && counted(p) ? p.replace(/ slides?$/, "") : p)).join(", ");
  return text ? text[0].toUpperCase() + text.slice(1) : "";
}

/** The hashes a tree needs that are not already known. */
export const missingBlobs = (tree: Tree, known: Map<string, Slide>) => [...new Set(tree.slides.map(([, h]) => h))].filter((h) => !known.has(h));

/** A tree and its blobs back as slides, in order; null when a blob is missing. */
export function slidesOf(tree: Tree, blobs: Map<string, Slide>): { id: string; slide: Slide }[] | null {
  const out: { id: string; slide: Slide }[] = [];
  for (const [id, h] of tree.slides) {
    const slide = blobs.get(h);
    if (!slide) return null;
    out.push({ id, slide: structuredClone(slide) });
  }
  return out;
}

/** The one rule every store follows: given the head, write a save's version (or skip it). */
export interface VersionStore {
  head(): Promise<VersionHead | null>;
  write(step: "replace" | "add", v: { replace: number | null; rev: number; meta: VersionMeta; tree: Tree; key: string; blobs: Map<string, Slide>; at: number }): Promise<void>;
}
export async function record(store: VersionStore, data: unknown, meta: VersionMeta, rev: number, now: number): Promise<"skip" | "replace" | "add"> {
  const head = await store.head(), { tree, blobs, key } = treeOf(data), step = nextStep(head, meta, key, now);
  const stored = new Set(head?.hashes ?? []), fresh = new Map([...blobs].filter(([h]) => !stored.has(h)));
  if (step !== "skip") await store.write(step, { replace: step === "replace" ? (head as VersionHead).n : null, rev, meta, tree, key, blobs: fresh, at: now });
  return step;
}
