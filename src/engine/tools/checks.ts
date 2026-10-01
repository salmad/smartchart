import { judgmentChecks, ruleChecks } from "../agent/checks";
import { storyChecks } from "../agent/story";
import { slideAt } from "./doc";
import { estimate } from "./estimate";
import { READ, tool, type DeckDoc } from "./types";

export const checkTools = [
  tool<{ deckId: string; slideId: string }>({ name: "check_slide", title: "Check a slide", group: "checks", scope: "deck", annotations: READ,
    description: "Judge a finished slide: the rule checks (title length, highlight, chart guide…) and the judgment checks (does the body prove the title, are the items MECE, is this the right template). Advice only: act when a small edit fixes it. One model call.",
    input: { type: "object", additionalProperties: false, required: ["deckId", "slideId"], properties: { deckId: { type: "string" }, slideId: { type: "string" } } },
    run: async (ctx, { slideId }) => {
      const doc = ctx.deck as DeckDoc, { item } = slideAt(doc, slideId);
      const rules = ruleChecks(item.slide, doc.style, estimate(doc.style)(item.slide).lines);
      const judged = await judgmentChecks(item.slide, doc.style, ctx.jev);
      return { result: { checks: [...rules, ...judged.checks].map(({ id, ok, msg }) => ({ id, ok, msg })) } };
    } }),
  tool<{ deckId: string }>({ name: "check_storyline", title: "Check the storyline", group: "checks", scope: "deck", annotations: READ,
    description: "Judge the deck as the room skims it (titles in order): one main answer, one argument, no repeats, nothing off-case, ends on what to do (or the ask, for pitch). A fix of kind \"ask\" is an instruction for you. Needs 2+ content slides. One model call.",
    input: { type: "object", additionalProperties: false, required: ["deckId"], properties: { deckId: { type: "string" } } },
    run: async (ctx) => {
      const doc = ctx.deck as DeckDoc;
      const r = await storyChecks(doc.slides.map((s) => ({ id: s.id, slide: s.slide })), doc.style, ctx.jev);
      return { result: { checks: r.checks.map(({ id, ok, msg, slideId, fix }) => ({ id, ok, msg, ...(slideId ? { slideId } : {}), ...(fix ? { fix } : {}) })) } };
    } }),
];
