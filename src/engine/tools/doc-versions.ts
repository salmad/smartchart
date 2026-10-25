/* Doc list_versions / restore_version: same idea as decks, with docId and block blobs. */
import { describeDocDiff, docFrom } from "../docs/versions.js";
import { identify } from "../docs/ops.js";
import { READ, ToolError, WRITE, tool } from "./types.js";

const DOC = { type: "string", description: "The doc id from list_docs or create_doc." } as const;

export const docVersionTools = [
  tool<{ docId: string; limit?: number }>({ name: "list_doc_versions", title: "List doc versions", group: "versions", scope: "doc", annotations: READ,
    description: "Every saved state of the doc, newest first: its number, who wrote it, the request in the user's words, what changed and when. The first is the doc as it is now.",
    input: { type: "object", additionalProperties: false, required: ["docId"], properties: { docId: DOC, limit: { type: "integer", minimum: 1, maximum: 100 } } },
    run: async (ctx, { docId, limit = 20 }) => {
      const list = await ctx.port.docVersions(docId);
      return { result: { versions: list.slice(0, limit).map((v, i) => ({ version: v.n, by: v.by, ...(v.label ? { request: v.label } : {}), changed: describeDocDiff(list[i + 1]?.tree ?? null, v.tree) || "nothing visible", at: new Date(v.at).toISOString(), blocks: v.tree.blocks.length, ...(i === 0 ? { current: true } : {}) })) } };
    } }),

  tool<{ docId: string; version: number }>({ name: "restore_doc_version", title: "Restore a doc version", group: "versions", scope: "doc", annotations: WRITE,
    description: "Put the doc back as it was at an earlier version (from list_doc_versions). Saved as a new version on top. Only when the user asked to undo or go back.",
    input: { type: "object", additionalProperties: false, required: ["docId", "version"], properties: { docId: DOC, version: { type: "integer", minimum: 1 } } },
    run: async (ctx, { docId, version }) => {
      const list = await ctx.port.docVersions(docId), v = list.find((x) => x.n === version);
      if (!v) throw new ToolError("not_found", `No version ${version}.`, `list_doc_versions shows them (newest: ${list[0]?.n ?? "none"}).`);
      if (v === list[0]) throw new ToolError("refused", `Version ${version} is the doc as it is now.`, "Pick an earlier version from list_doc_versions.");
      const hashes = [...new Set(v.tree.blocks)];
      const blobs = new Map((await ctx.port.docBlobs(docId, hashes)).map((b) => [b.hash, b.block]));
      const doc = docFrom(v.tree, Object.fromEntries(blobs));
      if (!doc) throw new ToolError("not_found", `Version ${version}'s blocks are no longer stored.`, "Pick another version.");
      const file = { id: docId, name: ctx.file?.name ?? doc.title, doc };
      return { result: { restored: version, blocks: identify(doc).map(({ id, block }) => ({ blockId: id, type: block.type })), rev: ctx.rev }, file, what: `Restored version ${version}` };
    } }),
];
