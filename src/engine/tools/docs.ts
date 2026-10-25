/* The doc tools: list, create, read, change and check a doc. Blocks are addressed by blockId (see docs/ops.ts); every write
   returns the doc's blocks again, because a text block's id changes when its words do. Edits are pure functions of the doc:
   the service saves what they return. */
import { checkDoc } from "../docs/checks.js";
import { FIGURE_KINDS, type Block, type Doc, type FigureBody, type FigureKind } from "../docs/types.js";
import { createFigure, createText, deleteBlock, identify, moveBlock, setLook, updateFigure, writeText, type Edit } from "../docs/ops.js";
import { textsOf } from "../docs/nest.js";
import { serializeDoc } from "../docs/serialize.js";
import { validateDoc } from "../docs/validate.js";
import { plain } from "../slides/schema.js";
import { pageArg, pageSchema, type PageArg } from "./pages.js";
import { DESTRUCTIVE, IDEMPOTENT, READ, ToolError, WRITE, tool, type DocFile, type HandlerOut, type ToolContext } from "./types.js";

const DOC_ID = { type: "string", description: "The doc id from list_docs or create_doc." } as const;
const BLOCK_ID = { type: "string", description: "A blockId from get_doc: a heading's or figure's own id, or a text block's t_… id. Read the doc again after any write." } as const;
const AFTER = { type: "string", description: "A blockId, \"start\" or \"end\"." } as const;
const WORKSPACE_ID = { type: "string", description: "A workspaceId from list_workspaces. Leave it out for the workspace the user opened most recently." } as const;

const preview = (b: Block): string => {
  switch (b.type) {
    case "figure": return plain(String(b.body.caption ?? b.body.text ?? "")).slice(0, 80);
    case "bullets": case "numbered": return plain(textsOf(b).join("; ")).slice(0, 80);
    case "divider": return "";
    default: return plain(b.text).slice(0, 80);
  }
};
const blocksOf = (doc: Doc) => identify(doc).map(({ id, block }) => ({ blockId: id, type: block.type, ...(block.type === "figure" ? { kind: block.kind } : {}), ...(block.type === "heading" ? { level: block.level } : {}), preview: preview(block) }));

function docView(ctx: ToolContext, file: DocFile, rev: number): Record<string, unknown> {
  const doc = file.doc, editing = ctx.docPresence.editing && ctx.docPresence.editing.until > ctx.now() ? ctx.docPresence.editing : null;
  const { theme, accent } = ctx.userLook;
  return { docId: file.id, title: doc.title, ...(doc.subtitle !== undefined ? { subtitle: doc.subtitle } : {}), theme, ...(accent ? { accent } : {}), rev,
    links: { edit: ctx.links?.edit ?? "" }, ...(editing ? { presence: { editing } } : {}),
    outline: identify(doc).flatMap(({ id, block }) => (block.type === "heading" ? [{ blockId: id, level: block.level, text: plain(block.text) }] : [])),
    blocks: blocksOf(doc), markdown: serializeDoc(doc) };
}

const fileOf = (ctx: ToolContext): DocFile => { if (!ctx.file) throw new ToolError("bad_input", "No doc.", "Pass docId."); return ctx.file; };
const refuse = (m: string) => (m.startsWith("No block") ? new ToolError("not_found", m, "get_doc shows the blocks.") : new ToolError("bad_input", m, "Fix it and call again; nothing was changed."));
const object = (v: unknown, what: string): Record<string, unknown> => {
  const x = typeof v === "string" && /^\s*\{/.test(v) ? (() => { try { return JSON.parse(v) as unknown; } catch { return v; } })() : v;
  if (!x || typeof x !== "object" || Array.isArray(x)) throw new ToolError("bad_input", `${what}: must be a JSON object, not a string.`);
  return x as Record<string, unknown>;
};

/** What a write returns: the new blocks, which ones it made or changed, the doc's warnings, and what to do next. */
function written(ctx: ToolContext, file: DocFile, e: Edit, extra: Record<string, unknown> = {}): HandlerOut {
  if (typeof e === "string") throw refuse(e);
  const warnings = validateDoc(e.doc).warnings, next = file.doc.blocks.length < 2 && e.doc.blocks.length < 2 ? "" : "When the doc says what the user asked, check_doc judges it.";
  return { result: { applied: true, rev: ctx.rev, changed: e.ids, blocks: blocksOf(e.doc), ...(warnings.length ? { warnings } : {}), ...extra, ...(next ? { next } : {}) }, file: { ...file, doc: e.doc } };
}

export const docTools = [
  tool<{ limit?: number; cursor?: number; workspaceId?: string }>({ name: "list_docs", title: "List docs", group: "docs", scope: "account", annotations: READ,
    description: "A workspace's docs, newest first: id, name, last change and parent (the page it sits under, a doc or a deck, or null at the top level). Open one with get_doc. Without workspaceId: the workspace the user opened most recently (list_workspaces shows the others).",
    input: { type: "object", additionalProperties: false, properties: { limit: { type: "integer", minimum: 1, maximum: 100 }, cursor: { type: "integer", minimum: 0 }, workspaceId: WORKSPACE_ID } },
    run: async (ctx, { limit = 25, cursor = 0, workspaceId }) => ({ result: await ctx.port.listDocs(limit, cursor, workspaceId) }) }),

  tool<{ title: string; subtitle?: string; workspaceId?: string; parent?: PageArg }>({ name: "create_doc", title: "Create a doc", group: "docs", scope: "createDoc", annotations: WRITE,
    description: "Start a new, empty doc: a title (it is the doc's name) and an optional subtitle. It goes into workspaceId, else the workspace the user opened most recently. With parent (a doc or a deck) it goes last under that page, in that page's workspace; without it, at the top level. Returns the doc with its editor link: give it to the user so they can watch. Then add sections and figures with create_block.",
    input: { type: "object", additionalProperties: false, required: ["title"], properties: { title: { type: "string" }, subtitle: { type: "string" }, workspaceId: WORKSPACE_ID, parent: pageSchema("Put the doc under this page.") } },
    run: async (ctx, { title, subtitle, workspaceId, parent }) => {
      const under = parent === undefined ? undefined : pageArg(parent, "parent");
      const doc: Doc = { title: title.trim(), ...(subtitle?.trim() ? { subtitle: subtitle.trim() } : {}), blocks: [] };
      const bad = validateDoc(doc).errors[0];
      if (bad) throw new ToolError("bad_input", bad, "Fix it and call again.");
      const file = { id: ctx.port.newDocId(), name: doc.title, doc };
      return { result: { ...docView(ctx, file, 1), parent: under ?? null }, file, workspaceId, ...(under ? { parent: under } : {}) };
    } }),

  tool<{ docId: string }>({ name: "get_doc", title: "Open a doc", group: "docs", scope: "doc", annotations: READ,
    description: "A doc's title, editor link, outline and every block (its blockId, type and the first words), and the doc as Markdown. Palette and accent come from the user's Look settings. Use blockIds from here in every block call, and read the doc again after a write: a text block's id changes when its words do.",
    input: { type: "object", additionalProperties: false, required: ["docId"], properties: { docId: DOC_ID } },
    run: async (ctx) => ({ result: docView(ctx, fileOf(ctx), ctx.rev) }) }),

  tool<{ docId: string; title?: string; subtitle?: string | null }>({ name: "update_doc", title: "Rename a doc", group: "docs", scope: "doc", annotations: IDEMPOTENT,
    description: "Rename the doc (its title is its name) or set or clear its subtitle (null clears).",
    input: { type: "object", additionalProperties: false, required: ["docId"], properties: { docId: DOC_ID, title: { type: "string" }, subtitle: { oneOf: [{ type: "string" }, { type: "null" }], description: "text, or null to clear" } } },
    run: async (ctx, { docId: _id, ...look }) => written(ctx, fileOf(ctx), setLook(fileOf(ctx).doc, look)) }),

  tool<{ docId: string; blockId: string; markdown: string }>({ name: "write_doc_text", title: "Rewrite a text block", group: "docs", scope: "doc", annotations: DESTRUCTIVE,
    description: "Replace one text block (a paragraph, list, quote, heading or code block) with Markdown: it becomes the block or blocks the Markdown is. A line starting `## ` is a heading, `- ` a list, `> ` a quote; start a line with \\ to keep such words as plain text. Figures are not text: use update_block. Only the block named changes.",
    input: { type: "object", additionalProperties: false, required: ["docId", "blockId", "markdown"], properties: { docId: DOC_ID, blockId: BLOCK_ID, markdown: { type: "string" } } },
    run: async (ctx, { blockId, markdown }) => written(ctx, fileOf(ctx), writeText(fileOf(ctx).doc, blockId, markdown)) }),

  tool<{ docId: string; after: string; markdown?: string; figure?: { kind: FigureKind; body: FigureBody; id?: string } }>({ name: "create_block", title: "Add a block", group: "docs", scope: "doc", annotations: WRITE,
    description: "Add text or a figure after a block (or at the start or end). Text: give markdown. A figure: give figure { kind, body, id? } where body is the fields of that kind's card (get_template with style \"doc\") and holds everything: the caption, source, notes and takeaway go inside body, not beside it. Exactly one of markdown and figure. A new heading or figure gets its id from its words or kind.",
    input: { type: "object", additionalProperties: false, required: ["docId", "after"], properties: { docId: DOC_ID, after: AFTER, markdown: { type: "string" },
      figure: { type: "object", additionalProperties: false, required: ["kind", "body"], properties: { kind: { type: "string", enum: [...FIGURE_KINDS] }, body: { description: "The figure's fields, as the card gives them." }, id: { type: "string" } } } } },
    run: async (ctx, { after, markdown, figure }) => {
      if ((markdown === undefined) === (figure === undefined)) throw new ToolError("bad_input", "Give exactly one of markdown (text) and figure (a component).", "Text: markdown. A chart, table, cards…: figure.");
      const file = fileOf(ctx);
      return written(ctx, file, figure ? createFigure(file.doc, after, figure.kind, object(figure.body, "figure.body") as FigureBody, figure.id) : createText(file.doc, after, markdown ?? ""));
    } }),

  tool<{ docId: string; blockId: string; set: Record<string, unknown> }>({ name: "update_block", title: "Edit a figure", group: "docs", scope: "doc", annotations: DESTRUCTIVE,
    description: "Change parts of a figure at exact paths; everything else stays. { \"caption\": \"…\", \"chart.series[1].values[3]\": 42, \"cards[2]\": null } — a value replaces, null removes an item, the next index appends. All or nothing. Text blocks are changed with write_doc_text.",
    input: { type: "object", additionalProperties: false, required: ["docId", "blockId", "set"], properties: { docId: DOC_ID, blockId: BLOCK_ID, set: { type: "object", additionalProperties: true, description: "{ path: value }" } } },
    run: async (ctx, { blockId, set }) => written(ctx, fileOf(ctx), updateFigure(fileOf(ctx).doc, blockId, object(set, "set"))) }),

  tool<{ docId: string; blockId: string; after: string }>({ name: "move_block", title: "Move a block", group: "docs", scope: "doc", annotations: IDEMPOTENT,
    description: "Move one block to just after another, or to the start or end. A heading moves alone, not its section.",
    input: { type: "object", additionalProperties: false, required: ["docId", "blockId", "after"], properties: { docId: DOC_ID, blockId: BLOCK_ID, after: AFTER } },
    run: async (ctx, { blockId, after }) => written(ctx, fileOf(ctx), moveBlock(fileOf(ctx).doc, blockId, after)) }),

  tool<{ docId: string; blockId: string }>({ name: "delete_block", title: "Delete a block", group: "docs", scope: "doc", annotations: DESTRUCTIVE,
    description: "Remove one block. Only when the user asked to remove it. A heading goes alone; the text under it stays.",
    input: { type: "object", additionalProperties: false, required: ["docId", "blockId"], properties: { docId: DOC_ID, blockId: BLOCK_ID } },
    run: async (ctx, { blockId }) => { const file = fileOf(ctx), b = identify(file.doc).find((x) => x.id === blockId)?.block; return written(ctx, file, deleteBlock(file.doc, blockId), b ? { deleted: { blockId, preview: preview(b) } } : {}); } }),

  tool<{ docId: string }>({ name: "check_doc", title: "Check the doc", group: "checks", scope: "doc", annotations: READ,
    description: "Judge the doc's figures: units, sources, one focus, sorted bars, figures the caption claims, table judgements that read faster as marks, a figure with no caption, an empty section. By blockId, failed checks first. Advice only: fix what a small edit fixes and tell the user about the rest; never invent a source or a figure to clear a check. Writes nothing. One model call when the doc has tables.",
    input: { type: "object", additionalProperties: false, required: ["docId"], properties: { docId: DOC_ID } },
    run: async (ctx) => {
      const all = await checkDoc(fileOf(ctx).doc, ctx.jev), soft = all.filter((c) => /^S\d/.test(c.id)), checks = all.filter((c) => !/^S\d/.test(c.id)).sort((a, b) => Number(a.ok) - Number(b.ok));
      return { result: { checks, ...(soft.length ? { suggestions: soft.map((c) => `${c.blockId}: ${c.msg}`) } : {}) } };
    } }),
];
