import { describe as card, MENU, OFFERED } from "../slides/schema.js";
import { BLOCK_STARTERS } from "../starters/index.js";
import { FIGURE_KINDS, type FigureKind } from "../docs/types.js";
import { CALLOUT_FIELDS } from "../docs/validate.js";
import { exampleFor } from "../agent/prompts.js";
import type { Style, TemplateId } from "../types.js";
import { docGuideText, guideText } from "./guide-text.js";
import { READ, ToolError, tool } from "./types.js";

const STYLE = { type: "string", enum: ["consulting", "pitch", "doc"], description: "The deck's style (get_deck shows it), or \"doc\" for writing docs." } as const;
const TEMPLATE = { type: "string", enum: [...OFFERED, "callout"], description: "A template id from list_templates (a figure kind, with style \"doc\")." } as const;
const DOC_HEAD = ["title", "subtitle", "kicker", "talk"];

/** A figure kind's card for a doc: the slide card without the slide's head, the doc's table limit, and an example from the figure starters. */
function docCard(kind: FigureKind): { card: unknown; example: unknown } {
  const example = BLOCK_STARTERS.find((b) => b.kind === kind)?.body ?? null;
  if (kind === "callout") return { card: { template: "callout", summary: "A boxed note: what a reader must not miss.", fields: Object.fromEntries(Object.entries(CALLOUT_FIELDS).map(([k, v]) => [k, { type: v.type, description: v.desc, required: !!v.required, ...(v.values ? { values: v.values } : {}), ...(v.max ? { maxChars: v.max } : {}) }])), rules: ["A callout has no caption, source or notes."] }, example };
  const c = card(kind as Parameters<typeof card>[0], "consulting");
  return { card: { ...c, fields: Object.fromEntries(Object.entries(c.fields).filter(([k]) => !DOC_HEAD.includes(k))), rules: [...c.rules, ...(kind === "table" ? ["In a doc a table may run to 20 rows."] : []), "In a doc the figure has no title: its caption says what it shows."] }, example };
}

export const guideTools = [
  tool<{ style: Style | "doc" }>({ name: "get_guide", title: "Writing guide", group: "guide", scope: "account", annotations: READ,
    description: "The rules for writing Occam slides in one style: hard rules on figures, starting plain, when to ask the user, how to write slide JSON and patches, and the style. Read it once per style before your first write.",
    input: { type: "object", additionalProperties: false, required: ["style"], properties: { style: STYLE } },
    run: async (_ctx, { style }) => ({ result: { style, guide: style === "doc" ? docGuideText() : guideText(style as Style) } }) }),
  tool<{ style: Style | "doc" }>({ name: "list_templates", title: "List templates", group: "guide", scope: "account", annotations: READ,
    description: "Every slide template you can use, with what it is for. Use it to choose a template yourself, or call suggest_template to have Occam choose from the content.",
    input: { type: "object", additionalProperties: false, required: ["style"], properties: { style: STYLE } },
    run: async (_ctx, { style }) => style === "doc"
      ? { result: { templates: FIGURE_KINDS.map((id) => ({ template: id, summary: id === "callout" ? "A boxed note." : MENU[id].summary, use: id === "callout" ? "What a reader must not miss: a decision, a risk, context." : MENU[id].use })), next: "get_template with style \"doc\" for the one you pick." } }
      : { result: { templates: OFFERED.map((id) => ({ template: id, summary: MENU[id].summary, use: MENU[id].use })), next: "get_template for the one you pick; suggest_template to have Occam choose from the content." } } }),
  tool<{ template: TemplateId | FigureKind; style: Style | "doc" }>({ name: "get_template", title: "Template card", group: "guide", scope: "account", annotations: READ,
    description: "One template's card (every field with its type, limits and description, the template's rules, and its capabilities and shapes: marks, icons, notes… and when to use each) and a worked example. Fetch it once per template before writing or reviewing that kind of slide; cards don't change within a session.",
    input: { type: "object", additionalProperties: false, required: ["template", "style"], properties: { template: TEMPLATE, style: STYLE } },
    run: async (_ctx, { template, style }) => {
      if (style === "doc") return { result: docCard(template as FigureKind) };
      if (template === "callout") throw new ToolError("bad_input", "template: callout is for docs.", "Use style \"doc\".");
      const ex = exampleFor(template as TemplateId, style);
      return { result: { card: card(template as TemplateId, style), example: ex === "(none)" ? null : JSON.parse(ex) } };
    } }),
];
