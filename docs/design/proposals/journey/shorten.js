/* Fast repair (spec 9.4): text that is over its limit is shortened by one small GLM call per field, with no
   deck context, instead of another agent step. A rewrite is kept only if it fits and keeps every figure;
   otherwise the issue goes back to the agent as before. */
import { plain } from "../v5/schema.js";
import { parsePath } from "./patch.js";

const SYSTEM = `You shorten one piece of slide text. Reply with the new text only: no quotes, no notes.
- Stay at or under the character limit; markup does not count.
- Keep every number, unit, name and date exactly as written.
- Keep the meaning and the language. Cut filler words first, then rephrase.
- Keep markup ([[…]], **…**, [-…-], [+…+]) around the same words when they stay.`;

const HEDGE_MS = 2500;
const get = (slide, path) => parsePath(path)?.reduce((v, k) => (v == null ? v : v[k]), slide);
const figures = (s) => plain(s).match(/\d[\d.,]*/g) || [];

/** Over-long text fields named by write issues: [{ path, text, max }]. */
export function targets(issues, slide) {
  const out = new Map();
  const add = (path, max) => {
    const text = get(slide, path);
    if (typeof text === "string" && max > 8) out.set(path, { path, text, max: Math.min(max, out.get(path)?.max ?? max) });
  };
  for (const issue of issues) {
    let m, path, max;
    // A total over several fields (notes' text, a card's bullets): each shrinks by the same share.
    if ((m = issue.match(/^(notes\[\]\.text|cards\[\d+\]\.bullets): (\d+) characters in total; .*?(?:limit is|at most) (\d+)/))) {
      const share = Number(m[3]) / Number(m[2]) * 0.95;
      const paths = m[1] === "notes[].text" ? (slide.notes || []).map((n, i) => n?.text && `notes[${i}].text`) : (get(slide, m[1]) || []).map((_, j) => `${m[1]}[${j}]`);
      paths.filter(Boolean).forEach((p) => add(p, Math.floor(plain(get(slide, p)).length * share)));
      continue;
    }
    if ((m = issue.match(/^([\w.[\]]+): (\d+) characters(?:, limit (\d+)|; .*?(?:at most|allow) (\d+))/))) [path, max] = [m[1], Number(m[3] || m[4])];
    else if ((m = issue.match(/^([\w.[\]]+): limit is (\d+) characters/))) [path, max] = [m[1], Number(m[2])];
    else if ((m = issue.match(/^(title|subtitle|takeaway) wraps to (\d+) lines(?: \(max (\d+)\))?/))) {
      path = m[1];
      const len = plain(get(slide, path) || "").length, lines = Number(m[2]), limit = Number(m[3] || 1);
      max = Math.floor((len * limit) / lines * 0.9);
    }
    if (path) add(path, max);
  }
  return [...out.values()];
}

/** Shorten each target in parallel; returns { set, ms } with only the rewrites that pass. A figure may
    leave a field only when it still appears elsewhere on the slide. */
export async function shorten(list, style, agentStep, slide) {
  const t0 = performance.now();
  const rest = (text) => JSON.stringify(slide).replace(JSON.stringify(text), "");
  const attempt = async ({ path, text, max }) => {
    const { message } = await agentStep({ messages: [{ role: "system", content: SYSTEM },
      { role: "user", content: `Deck style: ${style}. Field: ${path}. Limit: ${max} characters (now ${plain(text).length}).\n\n${text}` }] });
    const next = String(message.content || "").trim().replace(/^["“](.*)["”]$/s, "$1");
    const kept = figures(text).every((f) => plain(next).includes(f) || rest(text).includes(f));
    if (!next || plain(next).length > max || !kept) throw new Error("rejected");
    return [path, next];
  };
  // Hedged: a second call starts if the first has not answered in 2.5 s; the first rewrite that passes wins.
  const hedged = (t) => new Promise((resolve) => {
    let started = 0, pending = 0, done = false, timer;
    const start = () => {
      started++; pending++;
      attempt(t).then((r) => { if (!done) { done = true; clearTimeout(timer); resolve(r); } }, () => {
        pending--;
        if (done) return;
        if (started < 2) { clearTimeout(timer); start(); } else if (!pending) resolve(null);
      });
    };
    start();
    timer = setTimeout(() => { if (!done && started < 2) start(); }, HEDGE_MS);
  });
  const results = await Promise.all(list.map(hedged));
  return { set: Object.fromEntries(results.filter(Boolean)), ms: Math.round(performance.now() - t0) };
}
