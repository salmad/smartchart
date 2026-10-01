/* Every tool, once. The in-app agent, MCP and REST read this list; their views are derived here. */
import { accountTools } from "./account.js";
import { checkTools } from "./checks.js";
import { choiceTools } from "./choice.js";
import { deckTools } from "./decks.js";
import { guideTools } from "./guide.js";
import { slideTools } from "./slides.js";
import type { AnyTool } from "./types.js";

export const TOOLS: readonly AnyTool[] = [...accountTools, ...guideTools, ...deckTools, ...choiceTools, ...slideTools, ...checkTools];
const BY_NAME = new Map(TOOLS.map((t) => [t.name, t]));
export const toolByName = (name: string): AnyTool | undefined => BY_NAME.get(name);

export const openAiView = (t: AnyTool) => ({ type: "function" as const, function: { name: t.name, description: t.description, parameters: t.input } });
export const mcpView = (t: AnyTool) => ({ name: t.name, title: t.title, description: t.description, inputSchema: t.input, annotations: { title: t.title, ...t.annotations } });
export * from "./types.js";
