/* Pages in the workspace tree: how a tool names one (a doc or a deck, by kind and id, since the two can share an id) and
   the check that what an agent sent is one. Everything else (a cycle, depth, a missing parent, a viewer) is the server's. */
import { NO_EDIT, NO_PAGE } from "../pages/tree.js";
import { IDEMPOTENT, ToolError, tool, type JsonSchema } from "./types.js";

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

const MOVE_FIX = "Pick another parent, or another place among its subpages.";

export const pageTools = [
  tool<{ page: PageArg; parent: PageArg | null; before?: PageArg; after?: PageArg }>({ name: "move_page", title: "Move a page", group: "pages", scope: "account", annotations: IDEMPOTENT,
    description: "Move a doc or a deck to another place in the workspace tree: under a parent (a doc or a deck), or to the top level with parent null. It goes last among that parent's subpages unless before or after names one of them (a sibling under the same parent). Its own subpages move with it. Both pages must be in the same workspace. A move is not a version: it changes where the page sits, not what it says. list_docs and list_decks show each page's parent.",
    input: { type: "object", additionalProperties: false, required: ["page", "parent"], properties: { page: pageSchema("The page to move."),
      parent: { oneOf: [pageSchema("The page it goes under."), { type: "null" }], description: "The page it goes under, or null for the top level." },
      before: pageSchema("Put it just before this sibling."), after: pageSchema("Put it just after this sibling.") } },
    run: async (ctx, input) => {
      const page = pageArg(input.page, "page"), parent = input.parent === null ? null : pageArg(input.parent, "parent");
      const before = input.before === undefined ? undefined : pageArg(input.before, "before"), after = input.after === undefined ? undefined : pageArg(input.after, "after");
      if (before && after) throw new ToolError("bad_input", "before and after: give one, not both.", "Name the sibling it should sit next to.");
      const said = await ctx.port.movePage(page, { parent, ...(before ? { before } : {}), ...(after ? { after } : {}) });
      if (said === "ok") return { result: { moved: true, page, parent } };
      // A page the user can't read is no such page (a move can't be used to probe other people's pages); a viewer is told so.
      if (said === "foreign") throw new ToolError("not_found", NO_PAGE, "list_docs and list_decks show your pages.");
      throw new ToolError("refused", said, said === NO_EDIT ? "Ask an owner of the workspace to make you an editor." : MOVE_FIX);
    } }),
];
