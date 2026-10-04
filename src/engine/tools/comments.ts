/* resolve_comment: an agent marks a comment it addressed as done, with a reply saying what it did. */
import { MAX_COMMENT, resolveComment } from "../comments.js";
import { ToolError, WRITE, tool, type DeckDoc } from "./types.js";

export const commentTools = [
  tool<{ deckId: string; commentId: string; reply: string }>({ name: "resolve_comment", title: "Resolve a comment", group: "comments", scope: "deck", annotations: WRITE,
    description: "Mark a comment (commentId from get_deck or read_slide) as done once you addressed it, with a one-line reply saying what you changed, or why you changed nothing. Only for comments the user asked you to address.",
    input: { type: "object", additionalProperties: false, required: ["deckId", "commentId", "reply"], properties: {
      deckId: { type: "string", description: "The deck id." }, commentId: { type: "string", description: "A comment id, e.g. c_a1b2." },
      reply: { type: "string", description: `What you did about it, in one line (at most ${MAX_COMMENT} characters).` } } },
    run: async (ctx, { commentId, reply }) => {
      const doc = structuredClone(ctx.deck as DeckDoc), by = ctx.client ?? "An agent";
      const next = resolveComment(doc.comments, commentId, by, reply, ctx.now());
      if (typeof next === "string") throw new ToolError(next.includes("already") ? "refused" : "not_found", next, "get_deck lists the open comments.");
      doc.comments = next;
      const c = next.find((x) => x.id === commentId);
      return { result: { resolved: commentId, slideId: c?.slideId ?? null }, deck: doc, events: [{ slideId: c?.slideId ?? null, what: "comment", paths: [commentId] }] };
    } }),
];
