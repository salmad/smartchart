/* Path patches (spec 9.5): { "cards[2].title": "…", "notes[1]": null } applied to a slide, all or nothing.
   Paths refer to the slide before the patch; removals run last, highest index first. */
const VALID = /^[A-Za-z_]\w*(\.[A-Za-z_]\w*|\[\d+\])*$/;
const show = (keys) => keys.map((k, i) => (typeof k === "number" ? `[${k}]` : i ? `.${k}` : k)).join("");

/** "chart.series[1].values[3]" → ["chart", "series", 1, "values", 3]; null when malformed. */
export function parsePath(path) {
  if (typeof path !== "string" || !VALID.test(path)) return null;
  return [...path.matchAll(/([A-Za-z_]\w*)|\[(\d+)\]/g)].map((m) => (m[1] !== undefined ? m[1] : Number(m[2])));
}

export function applyPatch(slide, set) {
  if (!set || typeof set !== "object" || Array.isArray(set) || !Object.keys(set).length) return { errors: ["set: give at least one { path: value }."] };
  const out = structuredClone(slide), errors = [], removals = [];
  for (const [path, value] of Object.entries(set)) {
    const keys = parsePath(path);
    if (!keys) { errors.push(`${path}: not a valid path. Use dots and [index], e.g. cards[2].title.`); continue; }
    if (keys[0] === "template") { errors.push("template: change the template with create_slide and replace."); continue; }
    let parent = out;
    for (let i = 0; i < keys.length - 1; i++) {
      const k = keys[i], listNext = typeof keys[i + 1] === "number";
      // A missing optional field is created on the way; a missing list item is not.
      if (parent[k] === undefined && typeof k === "string") parent[k] = listNext ? [] : {};
      const v = parent[k];
      if (v === null || typeof v !== "object") {
        const at = show(keys.slice(0, i + 1));
        errors.push(v !== undefined ? `${path}: ${at} is not a ${listNext ? "list" : "object"}.`
          : Array.isArray(parent) ? `${path}: index ${k} is past the end; the list has ${parent.length} items (0–${parent.length - 1}), so ${at} does not exist.`
          : `${path}: ${at} does not exist.`);
        parent = null; break;
      }
      parent = v;
    }
    if (!parent) continue;
    const last = keys.at(-1);
    if (typeof last === "number") {
      if (!Array.isArray(parent)) { errors.push(`${path}: not a list.`); continue; }
      if (last > parent.length || (value === null && last === parent.length)) { errors.push(`${path}: index ${last} is past the end; the list has ${parent.length} items (0–${parent.length - 1}, or ${parent.length} to append).`); continue; }
      if (value === null) removals.push([parent, last]); else parent[last] = value;
    } else if (Array.isArray(parent)) errors.push(`${path}: a list is indexed with [n].`);
    else if (value === null) delete parent[last];
    else parent[last] = value;
  }
  if (errors.length) return { errors };
  removals.sort((a, b) => b[1] - a[1]).forEach(([list, i]) => list.splice(i, 1));
  return { slide: out, changed: Object.keys(set) };
}
