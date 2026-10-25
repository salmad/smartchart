import type { Style } from "../types.js";
import { getAt } from "../slides/edit.js";
import { openComments } from "../comments.js";
import { deckLook, storylineRows } from "./doc.js";
import { pageArg, pageSchema, type PageArg } from "./pages.js";
import { IDEMPOTENT, READ, ToolError, WRITE, tool, type DeckDoc, type ToolContext } from "./types.js";

const DECK_ID = { type: "string", description: "The deck id from list_decks or create_deck." } as const;
const WORKSPACE_ID = { type: "string", description: "A workspaceId from list_workspaces. Leave it out for the workspace the user opened most recently." } as const;
const STYLE = { type: "string", enum: ["consulting", "pitch"] } as const;

export function deckView(ctx: ToolContext, doc: DeckDoc, rev: number): Record<string, unknown> {
  const links = ctx.links ?? { edit: "", share: null };
  const { theme, accent } = ctx.userLook;
  return { deckId: doc.id, name: doc.name, style: doc.style, theme, ...(accent ? { accent } : {}), rev,
    links: links.share ? links : { edit: links.edit }, ...(ctx.presence.busy || ctx.presence.editing ? { presence: ctx.presence } : {}),
    slides: storylineRows(doc), ...commentsView(doc) };
}

/** Open comments, as an agent reads them; left out when there are none. */
export function commentsView(doc: DeckDoc, slideId?: string): { comments?: { commentId: string; slideId: string; text: string; by: string; at: number; path?: string; quote?: string; partGone?: true }[] } {
  const open = openComments(doc.comments, slideId);
  const gone = (c: (typeof open)[number]) => { const sl = doc.slides.find((s) => s.id === c.slideId)?.slide; return !!c.path && !!sl && getAt(sl, c.path) === undefined; };
  return open.length ? { comments: open.map((c) => ({ commentId: c.id, slideId: c.slideId, text: c.text, by: c.by, at: c.at, ...(c.path ? { path: c.path } : {}), ...(c.quote ? { quote: c.quote } : {}), ...(gone(c) ? { partGone: true as const } : {}) })) } : {};
}

export const deckTools = [
  tool<{ limit?: number; cursor?: number; workspaceId?: string }>({ name: "list_decks", title: "List decks", group: "decks", scope: "account", annotations: READ,
    description: "A workspace's decks, newest first: id, name, style, number of slides, last change, whether a share link is on and parent (the page it sits under, a doc or a deck, or null at the top level). Start here, then open one with get_deck. Without workspaceId: the workspace the user opened most recently (list_workspaces shows the others).",
    input: { type: "object", additionalProperties: false, properties: { limit: { type: "integer", minimum: 1, maximum: 100 }, cursor: { type: "integer", minimum: 0 }, workspaceId: WORKSPACE_ID } },
    run: async (ctx, { limit = 25, cursor = 0, workspaceId }) => ({ result: await ctx.port.listDecks(limit, cursor, workspaceId) }) }),

  tool<{ style: Style; name?: string; workspaceId?: string; parent?: PageArg }>({ name: "create_deck", title: "Create a deck", group: "decks", scope: "create", annotations: WRITE,
    description: "Start a new, empty deck. Style is consulting (action titles, dense evidence) or pitch (topic titles, big numbers) and is fixed once the deck has slides. It goes into workspaceId, else the workspace the user opened most recently. With parent (a doc or a deck) it goes last under that page, in that page's workspace; without it, at the top level. Returns the deck with its editor link: give it to the user so they can watch.",
    input: { type: "object", additionalProperties: false, required: ["style"], properties: { style: STYLE, name: { type: "string" }, workspaceId: WORKSPACE_ID, parent: pageSchema("Put the deck under this page.") } },
    run: async (ctx, { style, name, workspaceId, parent }) => {
      const under = parent === undefined ? undefined : pageArg(parent, "parent");
      const doc = deckLook({ id: ctx.port.newDeckId(), name: name?.trim().slice(0, 200) || "Untitled deck", style, theme: ctx.userLook.theme, accent: ctx.userLook.accent, slides: [], comments: [] }, ctx.userLook);
      return { result: { ...deckView(ctx, doc, 1), parent: under ?? null }, deck: doc, named: !!name, workspaceId, ...(under ? { parent: under } : {}), events: [{ slideId: null, what: "deck", paths: ["created"] }] };
    } }),

  tool<{ deckId: string }>({ name: "get_deck", title: "Open a deck", group: "decks", scope: "deck", annotations: READ,
    description: "A deck's style, links and storyline: every slide's id, position, template, title and open issue count, in order, and the open comments people left on slides. Palette and accent come from the user's Look settings, not the deck file. Use slide ids from here in every slide call.",
    input: { type: "object", additionalProperties: false, required: ["deckId"], properties: { deckId: DECK_ID } },
    run: async (ctx) => ({ result: deckView(ctx, ctx.deck as DeckDoc, ctx.rev) }) }),

  tool<{ deckId: string; name?: string; style?: Style }>({ name: "update_deck", title: "Rename a deck", group: "decks", scope: "deck", annotations: IDEMPOTENT,
    description: "Rename the deck. Style can change only while the deck has no slides. Palette and accent are user preferences (Look in the app), not stored on the deck.",
    input: { type: "object", additionalProperties: false, required: ["deckId"], properties: { deckId: DECK_ID, name: { type: "string" }, style: STYLE } },
    run: async (ctx, { name, style }) => {
      const doc = structuredClone(ctx.deck as DeckDoc), paths: string[] = [];
      if (style && style !== doc.style) { if (doc.slides.length) throw new ToolError("refused", "style: fixed once the deck has slides (text limits differ per style).", "Create a new deck in the other style."); doc.style = style; paths.push("style"); }
      if (name !== undefined) { doc.name = name.trim().slice(0, 200) || doc.name; paths.push("name"); }
      return { result: deckView(ctx, deckLook(doc, ctx.userLook), ctx.rev), deck: deckLook(doc, ctx.userLook), named: name !== undefined, events: paths.length ? [{ slideId: null, what: "deck", paths }] : [] };
    } }),

  tool<{ deckId: string; on: boolean }>({ name: "share_deck", title: "Share link", group: "decks", scope: "account", annotations: IDEMPOTENT,
    description: "Turn the deck's read-only share link on or off. The link stays the same while sharing is on and shows changes live. Only for when the user wants others to see the deck; the user watches their own deck through the editor link.",
    input: { type: "object", additionalProperties: false, required: ["deckId", "on"], properties: { deckId: DECK_ID, on: { type: "boolean" } } },
    run: async (ctx, { deckId, on }) => ({ result: { share: await ctx.port.share(deckId, on) } }) }),
];
