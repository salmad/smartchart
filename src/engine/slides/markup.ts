/* A markup field as characters with marks (spec 4.1): hand editing works in plain-text offsets and writes the
   markup string back, so the string stays the truth and the marks keep their place around the text that changed. */
export type Mark = "b" | "f" | "neg" | "pos";
export interface Char { ch: string; marks: Mark[] }

const ORDER: Mark[] = ["b", "f", "neg", "pos"];
const TOKENS: Record<Mark, [string, string]> = { b: ["**", "**"], f: ["[[", "]]"], neg: ["[-", "-]"], pos: ["[+", "+]"] };
// The same pairs md() draws, so a string means the same thing here and on the slide.
const PAIRS: [Mark, RegExp][] = [["b", /\*\*(.+?)\*\*/g], ["f", /\[\[(.+?)\]\]/g], ["neg", /\[-(.+?)-\]/g], ["pos", /\[\+(.+?)\+\]/g]];

export function parse(markup: string): Char[] {
  const token = new Array<boolean>(markup.length).fill(false);
  const marks = Array.from({ length: markup.length }, () => new Set<Mark>());
  for (const [mark, re] of PAIRS) for (const m of markup.matchAll(re)) {
    const start = m.index ?? 0, end = start + m[0].length, open = TOKENS[mark][0].length, close = TOKENS[mark][1].length;
    for (let i = start; i < start + open; i++) token[i] = true;
    for (let i = end - close; i < end; i++) token[i] = true;
    for (let i = start + open; i < end - close; i++) marks[i].add(mark);
  }
  const out: Char[] = [];
  for (let i = 0; i < markup.length; i++) if (!token[i]) out.push({ ch: markup[i], marks: ORDER.filter((m) => marks[i].has(m)) });
  return out;
}

/** Characters back to markup: a mark opens where a run starts having it and closes where it stops. */
export function serialize(chars: Char[]): string {
  let out = "";
  const open: Mark[] = [];
  const closeTo = (keep: number) => { while (open.length > keep) out += TOKENS[open.pop() as Mark][1]; };
  for (const c of chars) {
    let k = 0;
    while (k < open.length && c.marks.includes(open[k])) k++;
    closeTo(k);
    for (const m of c.marks) if (!open.includes(m)) { out += TOKENS[m][0]; open.push(m); }
    out += c.ch;
  }
  closeTo(0);
  return out;
}

export const plainOf = (markup: string): string => parse(markup).map((c) => c.ch).join("");

/** The field's new plain text written into its markup: the changed span takes the marks of the character before it
    (or after it, at the start), the rest keep theirs. */
export function applyText(markup: string, next: string): string {
  const chars = parse(markup), prev = chars.map((c) => c.ch).join("");
  if (prev === next) return markup;
  let p = 0;
  while (p < prev.length && p < next.length && prev[p] === next[p]) p++;
  let s = 0;
  while (s < prev.length - p && s < next.length - p && prev[prev.length - 1 - s] === next[next.length - 1 - s]) s++;
  const inherit = (p > 0 ? chars[p - 1] : chars[prev.length - s])?.marks ?? [];
  const inserted = next.slice(p, next.length - s).split("").map((ch) => ({ ch, marks: inherit.slice() }));
  return serialize([...chars.slice(0, p), ...inserted, ...chars.slice(prev.length - s)]);
}

export function hasMark(markup: string, from: number, to: number, mark: Mark): boolean {
  const [a, b] = from <= to ? [from, to] : [to, from], chars = parse(markup).slice(a, b);
  return chars.length > 0 && chars.every((c) => c.marks.includes(mark));
}

/** Bold or Focus over a plain-text range: on unless every character already has it. */
export function toggle(markup: string, from: number, to: number, mark: Mark): string {
  const [a, b] = from <= to ? [from, to] : [to, from];
  if (a === b) return markup;
  const on = !hasMark(markup, a, b, mark);
  return serialize(parse(markup).map((c, i) => (i < a || i >= b ? c : { ch: c.ch, marks: ORDER.filter((m) => (m === mark ? on : c.marks.includes(m))) })));
}
