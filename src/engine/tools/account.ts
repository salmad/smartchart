import { READ, tool } from "./types.js";

export const CONTRACT = "2026-10-01";

export const accountTools = [
  tool<Record<string, never>>({ name: "whoami", title: "Who am I", group: "account", scope: "account", annotations: READ,
    description: "The signed-in Occam user, how many model calls are left today, and the contract version. Call it to check the connection.",
    input: { type: "object", additionalProperties: false, properties: {} },
    run: async (ctx) => ({ result: { email: ctx.port.email, callsLeftToday: await ctx.port.callsLeftToday(), contract: CONTRACT } }) }),
  tool<Record<string, never>>({ name: "list_workspaces", title: "List workspaces", group: "account", scope: "account", annotations: READ,
    description: "The workspaces the user belongs to, most recently used first, with their role in each (owner, editor, viewer; a viewer can only read). Decks live in a workspace; list_decks and create_deck use the first one unless given a workspaceId.",
    input: { type: "object", additionalProperties: false, properties: {} },
    run: async (ctx) => ({ result: { workspaces: await ctx.port.workspaces() } }) }),
];
