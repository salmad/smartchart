/* Pages in the workspace tree: how a tool names one (a doc or a deck, by kind and id, since the two can share an id) and
   the check that what an agent sent is one. Everything else (a cycle, depth, a missing parent, a viewer) is the server's. */
import { ToolError, type JsonSchema } from "./types.js";

export interface PageArg { kind: "doc" | "deck"; id: string }

/** The input schema of a page; `what` says which page it is. */
export const pageSchema = (what: string): JsonSchema => ({ type: "object", additionalProperties: false, required: ["kind", "id"], description: what,
  properties: { kind: { type: "string", enum: ["doc", "deck"] }, id: { type: "string", description: "The docId or deckId." } } });

/** The page an agent named, or a bad_input error that says how to name one. */
export function pageArg(v: unknown, field: string): PageArg {
  const o = (v && typeof v === "object" ? v : {}) as { kind?: unknown; id?: unknown };
  if ((o.kind !== "doc" && o.kind !== "deck") || typeof o.id !== "string" || !/^[\w-]{1,64}$/.test(o.id))
    throw new ToolError("bad_input", `${field}: must be { kind: "doc" or "deck", id }.`, "Use the docId or deckId from list_docs, list_decks or the create call.");
  return { kind: o.kind, id: o.id };
}
