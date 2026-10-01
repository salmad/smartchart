import { headline } from "../slides/schema.js";
import { GUIDE, MENU_OPTIONS, STYLE_STATE } from "../agent/prompts.js";
import { LEADS, LEAD_Q, P_LEAD } from "../agent/pre.js";
import { insertIndex } from "./doc.js";
import { READ, tool, type DeckDoc } from "./types.js";

export const choiceTools = [
  tool<{ deckId: string; about: string; after?: string }>({ name: "suggest_template", title: "Suggest a template", group: "choice", scope: "deck", annotations: READ,
    description: "Have SmartChart pick the template for some content (the user's words and figures). Returns the template, the probabilities of each, and values already decided (for cards: how they lead). Then get_template and create_slide. Costs one model call.",
    input: { type: "object", additionalProperties: false, required: ["deckId", "about"], properties: {
      deckId: { type: "string" }, about: { type: "string", description: "The slide's content, in the user's words, with every figure." },
      after: { type: "string", description: "Where it would go: a slide id, \"start\" or \"end\"." } } },
    run: async (ctx, { about, after }) => {
      const doc = ctx.deck as DeckDoc;
      insertIndex(doc, after);   // validates the id
      const titles = doc.slides.map((s, i) => `${i + 1}. [${s.slide.template}] ${headline(s.slide)}`).join("\n");
      const r = await ctx.jev(`Deck style: ${STYLE_STATE[doc.style]}.\n${titles ? `Slides already in the deck:\n${titles}` : "The deck is empty."}\nContent for the slide: ${about}`,
        { template: { instructions: `Which slide template best fits this content?\n${GUIDE}`, options: MENU_OPTIONS }, lead: { instructions: LEAD_Q, options: LEADS } });
      const template = r.template.choice, lead = r.lead.p >= P_LEAD ? r.lead.choice : null;
      return { result: { template, probabilities: r.template.probabilities, decided: template === "cards" && lead ? { "cards.lead": lead } : {}, after: after ?? "end" } };
    } }),
];
