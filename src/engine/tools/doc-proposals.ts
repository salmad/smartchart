/* propose_block: agents leave a checked suggestion for the user to approve in the editor. */
import { checkProposal, type DocProposal, type ProposalMode } from "../docs/proposals.js";
import { FIGURE_KINDS, type FigureBody, type FigureKind } from "../docs/types.js";
import { ToolError, WRITE, tool } from "./types.js";

const DOC = { type: "string", description: "The doc id." } as const;
const BLOCK_IDS = { type: "array", items: { type: "string" }, minItems: 1, description: "Adjacent blockIds to replace or insert before." } as const;

export const docProposalTools = [
  tool<{ docId: string; blockIds: string[]; mode: ProposalMode; figure?: { kind: FigureKind; body: FigureBody }; markdown?: string; label: string; why: string }>({
    name: "propose_block",
    title: "Propose a doc change",
    group: "docs",
    scope: "doc",
    annotations: WRITE,
    description: "Leave a suggestion on adjacent blocks for the user to approve in place. Use when a restructure would replace their own words. Checked before it is stored; nothing applies until they approve.",
    input: {
      type: "object",
      additionalProperties: false,
      required: ["docId", "blockIds", "mode", "label", "why"],
      properties: {
        docId: DOC,
        blockIds: BLOCK_IDS,
        mode: { type: "string", enum: ["replace", "insert"] },
        markdown: { type: "string" },
        figure: {
          type: "object",
          additionalProperties: false,
          required: ["kind", "body"],
          properties: { kind: { type: "string", enum: [...FIGURE_KINDS] }, body: { description: "The figure's fields, as get_template gives them." } },
        },
        label: { type: "string", description: "Short button label (at most 40 characters)." },
        why: { type: "string", description: "One sentence on why (at most 160 characters)." },
      },
    },
    run: async (ctx, { blockIds, mode, figure, markdown, label, why }) => {
      if (!ctx.file) throw new ToolError("bad_input", "No doc.", "Open the doc with get_doc.");
      const draft: DocProposal = {
        id: "pending",
        blockIds,
        mode,
        ...(figure ? { figure } : {}),
        ...(markdown !== undefined ? { markdown } : {}),
        label: label.trim(),
        why: why.trim(),
        by: ctx.client ?? "An agent",
        at: ctx.now(),
        rev: ctx.rev,
      };
      const checked = checkProposal(ctx.file.doc, draft);
      if (!checked.ok) throw new ToolError("bad_input", checked.error, "Fix the proposal and call again.");
      const by = ctx.client ?? "An agent";
      const next = await ctx.port.docProposal(ctx.file.id, { add: { ...draft, mode: checked.mode } }, by, ctx.now());
      if (typeof next === "string") throw new ToolError(next.includes("too many") ? "refused" : "refused", next, "Dismiss an old suggestion or ask an editor.");
      const proposed = next.at(-1)?.id;
      if (!proposed) throw new ToolError("refused", "The suggestion did not save.", "Try again.");
      return { result: { proposed, keeps: checked.keeps.keeps, mode: checked.mode } };
    },
  }),
];
