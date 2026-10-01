import { describe as card, MENU, OFFERED } from "../slides/schema.js";
import { exampleFor } from "../agent/prompts.js";
import type { Style, TemplateId } from "../types.js";
import { guideText } from "./guide-text.js";
import { READ, tool } from "./types.js";

const STYLE = { type: "string", enum: ["consulting", "pitch"], description: "The deck's style (get_deck shows it)." } as const;
const TEMPLATE = { type: "string", enum: [...OFFERED], description: "A template id from list_templates." } as const;

export const guideTools = [
  tool<{ style: Style }>({ name: "get_guide", title: "Writing guide", group: "guide", scope: "account", annotations: READ,
    description: "The rules for writing SmartChart slides in one style: hard rules on figures, starting plain, when to ask the user, how to write slide JSON and patches, and the style. Read it once per style before your first write.",
    input: { type: "object", additionalProperties: false, required: ["style"], properties: { style: STYLE } },
    run: async (_ctx, { style }) => ({ result: { style, guide: guideText(style) } }) }),
  tool<{ style: Style }>({ name: "list_templates", title: "List templates", group: "guide", scope: "account", annotations: READ,
    description: "Every slide template you can use, with what it is for. Use it to choose a template yourself, or call suggest_template to have SmartChart choose from the content.",
    input: { type: "object", additionalProperties: false, required: ["style"], properties: { style: STYLE } },
    run: async () => ({ result: { templates: OFFERED.map((id) => ({ template: id, summary: MENU[id].summary, use: MENU[id].use })), next: "get_template for the one you pick; suggest_template to have SmartChart choose from the content." } }) }),
  tool<{ template: TemplateId; style: Style }>({ name: "get_template", title: "Template card", group: "guide", scope: "account", annotations: READ,
    description: "One template's card (every field with its type, limits and description, and the template's rules) and a worked example. Fetch it once per template before writing that kind of slide; cards don't change within a session.",
    input: { type: "object", additionalProperties: false, required: ["template", "style"], properties: { template: TEMPLATE, style: STYLE } },
    run: async (_ctx, { template, style }) => {
      const ex = exampleFor(template, style);
      return { result: { card: card(template, style), example: ex === "(none)" ? null : JSON.parse(ex) } };
    } }),
];
