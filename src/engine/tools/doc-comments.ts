/* resolve_doc_comment: an agent marks a doc comment done after addressing it. */
import { MAX_COMMENT, type DocComment } from "../comments.js";
import { ToolError, WRITE, tool } from "./types.js";

const DOC = { type: "string", description: "The doc id." } as const;

const open = (list: DocComment[]) => list.filter((c) => !c.done).map((c) => ({ commentId: c.id, anchor: c.anchor, text: c.text, by: c.by, at: c.at, ...(c.quote ? { quote: c.quote } : {}) }));

export const docCommentTools = [
  tool<{ docId: string }>({ name: "list_doc_comments", title: "List open doc comments", group: "comments", scope: "doc", annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    description: "Open comments on the doc (notes on a section or figure). Act on them only when the user asks.",
    input: { type: "object", additionalProperties: false, required: ["docId"], properties: { docId: DOC } },
    run: async (ctx) => {
      if (!ctx.file) throw new ToolError("bad_input", "No doc.", "Open the doc with get_doc.");
      const o = open(await ctx.port.docComments(ctx.file.id));
      return { result: { comments: o.length ? o : undefined } };
    } }),

  tool<{ docId: string; commentId: string; reply: string }>({ name: "resolve_doc_comment", title: "Resolve a doc comment", group: "comments", scope: "doc", annotations: WRITE,
    description: "Mark a doc comment (from list_doc_comments) as done once you addressed it, with a one-line reply. Only when the user asked you to address comments.",
    input: { type: "object", additionalProperties: false, required: ["docId", "commentId", "reply"], properties: {
      docId: DOC, commentId: { type: "string" }, reply: { type: "string", description: `What you did, in one line (at most ${MAX_COMMENT} characters).` } } },
    run: async (ctx, { commentId, reply }) => {
      if (!ctx.file) throw new ToolError("bad_input", "No doc.", "Open the doc with get_doc.");
      const by = ctx.client ?? "An agent";
      const next = await ctx.port.docComment(ctx.file.id, { resolve: { id: commentId, reply } }, by, ctx.now());
      if (typeof next === "string") throw new ToolError(next.includes("already") ? "refused" : "not_found", next, "list_doc_comments lists open comments.");
      return { result: { resolved: commentId, anchor: next.find((x) => x.id === commentId)?.anchor ?? null } };
    } }),
];
