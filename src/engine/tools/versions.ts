/* list_versions and restore_version: an agent can see every change to a deck (by the user, SmartChart or an agent)
   and put an earlier state back. A restore is a new version on top; nothing is lost. */
import { describeDiff, diffTrees, slidesOf } from "../versions.js";
import { READ, ToolError, WRITE, tool, type DeckDoc } from "./types.js";
import { storylineRows } from "./doc.js";

const DECK = { type: "string", description: "The deck id." } as const;

export const versionTools = [
  tool<{ deckId: string; limit?: number }>({ name: "list_versions", title: "List versions", group: "versions", scope: "deck", annotations: READ,
    description: "Every saved state of the deck, newest first: its number, who wrote it (the user, SmartChart or an agent), the request in the user's words, what changed and when. The first is the deck as it is now.",
    input: { type: "object", additionalProperties: false, required: ["deckId"], properties: { deckId: DECK, limit: { type: "integer", minimum: 1, maximum: 100 } } },
    run: async (ctx, { deckId, limit = 20 }) => {
      const list = await ctx.port.versions(deckId);
      return { result: { versions: list.slice(0, limit).map((v, i) => ({ version: v.n, by: v.by, ...(v.label ? { request: v.label } : {}), changed: describeDiff(diffTrees(list[i + 1]?.tree ?? null, v.tree)) || "nothing visible", at: new Date(v.at).toISOString(), slides: v.tree.slides.length, ...(i === 0 ? { current: true } : {}) })) } };
    } }),

  tool<{ deckId: string; version: number }>({ name: "restore_version", title: "Restore a version", group: "versions", scope: "deck", annotations: WRITE,
    description: "Put the deck back as it was at an earlier version (from list_versions): its slides, order and look. Saved as a new version on top, so the state before stays in the list. Only when the user asked to undo or go back.",
    input: { type: "object", additionalProperties: false, required: ["deckId", "version"], properties: { deckId: DECK, version: { type: "integer", minimum: 1 } } },
    run: async (ctx, { deckId, version }) => {
      const list = await ctx.port.versions(deckId), v = list.find((x) => x.n === version);
      if (!v) throw new ToolError("not_found", `No version ${version}.`, `list_versions shows them (newest: ${list[0]?.n ?? "none"}).`);
      if (v === list[0]) throw new ToolError("refused", `Version ${version} is the deck as it is now.`, "Pick an earlier version from list_versions.");
      const hashes = [...new Set(v.tree.slides.map(([, h]) => h))];
      const slides = slidesOf(v.tree, new Map((await ctx.port.blobs(deckId, hashes)).map((b) => [b.hash, b.slide])));
      if (!slides) throw new ToolError("not_found", `Version ${version}'s slides are no longer stored.`, "Pick another version.");
      const doc: DeckDoc = { ...structuredClone(ctx.deck as DeckDoc), style: v.tree.style, theme: v.tree.theme, accent: v.tree.accent,
        slides: slides.map((s) => ({ id: s.id, slide: s.slide, issues: [], warnings: [], checks: [] })) };
      return { result: { restored: version, slides: storylineRows(doc), rev: ctx.rev }, deck: doc, label: `Restored version ${version}`, events: [{ slideId: null, what: "deck", paths: ["restored"] }] };
    } }),
];
