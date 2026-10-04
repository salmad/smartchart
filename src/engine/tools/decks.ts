import { resolveAccent } from "../slides/colours.js";
import type { Style, Theme } from "../types.js";
import { openComments } from "../comments.js";
import { storylineRows } from "./doc.js";
import { IDEMPOTENT, READ, ToolError, WRITE, tool, type DeckDoc, type ToolContext } from "./types.js";

const DECK_ID = { type: "string", description: "The deck id from list_decks or create_deck." } as const;
const STYLE = { type: "string", enum: ["consulting", "pitch"] } as const;
const THEME = { type: "string", enum: ["ink", "paper"], description: "ink: dark slides; paper: light slides." } as const;
const ACCENT = { type: "string", description: "The highlight colour as #rrggbb. Code checks it stands out and doesn't read as loss or gain." } as const;

export function deckView(ctx: ToolContext, doc: DeckDoc, rev: number): Record<string, unknown> {
  const links = ctx.links ?? { edit: "", share: null };
  return { deckId: doc.id, name: doc.name, style: doc.style, theme: doc.theme, accent: doc.accent, rev,
    links: links.share ? links : { edit: links.edit }, ...(ctx.presence.busy || ctx.presence.editing ? { presence: ctx.presence } : {}),
    slides: storylineRows(doc), ...commentsView(doc) };
}

/** Open comments, as an agent reads them; left out when there are none. */
export function commentsView(doc: DeckDoc, slideId?: string): { comments?: { commentId: string; slideId: string; text: string; by: string; at: number }[] } {
  const open = openComments(doc.comments, slideId);
  return open.length ? { comments: open.map((c) => ({ commentId: c.id, slideId: c.slideId, text: c.text, by: c.by, at: c.at })) } : {};
}

function checkAccent(theme: Theme, accent: string | null | undefined) {
  if (accent === undefined || accent === null) return;
  if (!/^#[0-9a-f]{6}$/i.test(accent)) throw new ToolError("bad_input", "accent: must be a colour as #rrggbb.");
  const m = resolveAccent(theme, accent);
  if (m.error) throw new ToolError("bad_input", `accent: ${m.error}`, "Pick a more saturated colour away from red and green, or leave the accent out.");
}

export const deckTools = [
  tool<{ limit?: number; cursor?: number }>({ name: "list_decks", title: "List decks", group: "decks", scope: "account", annotations: READ,
    description: "The user's decks, newest first: id, name, style, number of slides, last change and whether a share link is on. Start here, then open one with get_deck.",
    input: { type: "object", additionalProperties: false, properties: { limit: { type: "integer", minimum: 1, maximum: 100 }, cursor: { type: "integer", minimum: 0 } } },
    run: async (ctx, { limit = 25, cursor = 0 }) => ({ result: await ctx.port.listDecks(limit, cursor) }) }),

  tool<{ style: Style; name?: string; theme?: Theme; accent?: string }>({ name: "create_deck", title: "Create a deck", group: "decks", scope: "create", annotations: WRITE,
    description: "Start a new, empty deck. Style is consulting (action titles, dense evidence) or pitch (topic titles, big numbers) and is fixed once the deck has slides. Returns the deck with its editor link: give it to the user so they can watch.",
    input: { type: "object", additionalProperties: false, required: ["style"], properties: { style: STYLE, name: { type: "string" }, theme: THEME, accent: ACCENT } },
    run: async (ctx, { style, name, theme = "ink", accent }) => {
      checkAccent(theme, accent);
      const doc: DeckDoc = { id: ctx.port.newDeckId(), name: name?.trim().slice(0, 200) || "Untitled deck", style, theme, accent: accent ?? null, slides: [], comments: [] };
      return { result: deckView(ctx, doc, 1), deck: doc, named: !!name, events: [{ slideId: null, what: "deck", paths: ["created"] }] };
    } }),

  tool<{ deckId: string }>({ name: "get_deck", title: "Open a deck", group: "decks", scope: "deck", annotations: READ,
    description: "A deck's look, links and storyline: every slide's id, position, template, title and open issue count, in order, and the open comments people left on slides. Use slide ids from here in every slide call.",
    input: { type: "object", additionalProperties: false, required: ["deckId"], properties: { deckId: DECK_ID } },
    run: async (ctx) => ({ result: deckView(ctx, ctx.deck as DeckDoc, ctx.rev) }) }),

  tool<{ deckId: string; name?: string; theme?: Theme; accent?: string | null; style?: Style }>({ name: "update_deck", title: "Change the deck's look", group: "decks", scope: "deck", annotations: IDEMPOTENT,
    description: "Rename the deck or change its theme or accent colour. Style can change only while the deck has no slides.",
    input: { type: "object", additionalProperties: false, required: ["deckId"], properties: { deckId: DECK_ID, name: { type: "string" }, theme: THEME, accent: { oneOf: [ACCENT, { type: "null" }], description: "#rrggbb, or null for the default" }, style: STYLE } },
    run: async (ctx, { name, theme, accent, style }) => {
      const doc = structuredClone(ctx.deck as DeckDoc), paths: string[] = [];
      if (style && style !== doc.style) { if (doc.slides.length) throw new ToolError("refused", "style: fixed once the deck has slides (text limits differ per style).", "Create a new deck in the other style."); doc.style = style; paths.push("style"); }
      if (theme) { doc.theme = theme; paths.push("theme"); }
      if (accent !== undefined) { checkAccent(doc.theme, accent); doc.accent = accent; paths.push("accent"); }
      if (name !== undefined) { doc.name = name.trim().slice(0, 200) || doc.name; paths.push("name"); }
      return { result: deckView(ctx, doc, ctx.rev), deck: doc, named: name !== undefined, events: [{ slideId: null, what: "deck", paths }] };
    } }),

  tool<{ deckId: string; on: boolean }>({ name: "share_deck", title: "Share link", group: "decks", scope: "account", annotations: IDEMPOTENT,
    description: "Turn the deck's read-only share link on or off. The link stays the same while sharing is on and shows changes live. Only for when the user wants others to see the deck; the user watches their own deck through the editor link.",
    input: { type: "object", additionalProperties: false, required: ["deckId", "on"], properties: { deckId: DECK_ID, on: { type: "boolean" } } },
    run: async (ctx, { deckId, on }) => ({ result: { share: await ctx.port.share(deckId, on) } }) }),
];
