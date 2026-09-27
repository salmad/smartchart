import { test } from "vitest";
import assert from "node:assert/strict";
import { parseSuggestions, suggestMessages } from "../../src/engine/agent/suggest";
import type { Slide } from "../../src/engine/types";

const BOOK: Slide = { template: "chart", title: "The book grows to [[£120m]] by 2030", chart: { categories: ["2026", "2030"], format: "£{v}m",
  series: [{ name: "Loan book", mark: "bar", color: "focus", values: [10, 120] }] } };

test("the prompt asks for the slide's message and carries the slide, conversation and failed checks", () => {
  const [sys, user] = suggestMessages({ slide: BOOK, style: "consulting", history: [{ role: "user", content: "For the board" }, { role: "tool", content: "tool-output" }],
    checks: [{ ok: false, msg: "Figures have no source" }, { ok: true, msg: "fine" }] }).map((m) => ({ ...m, content: m.content ?? "" }));
  assert.ok(sys.content.includes("message the slide is trying to convey"));
  assert.ok(user.content.includes('"Loan book"') && user.content.includes("User: For the board"));
  assert.ok(!user.content.includes("tool-output"));
  assert.ok(user.content.includes("Figures have no source") && !user.content.includes("fine"));
});

test("parse: JSON inside prose, at most 4 pills; nothing on bad output", () => {
  const list = Array.from({ length: 6 }, (_, i) => ({ label: `Step ${i}`, prompt: `Do ${i}` }));
  const r = parseSuggestions(`Sure:\n${JSON.stringify({ message: "Growth beats plan.", suggestions: list })}`);
  assert.equal(r.message, "Growth beats plan.");
  assert.equal(r.pills.length, 4);
  assert.deepEqual(parseSuggestions("no json").pills, []);
  assert.deepEqual(parseSuggestions('{"suggestions": [{"label": 3}]}').pills, []);
});
