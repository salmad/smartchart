import { READ, tool } from "./types";

export const CONTRACT = "2026-10-01";

export const accountTools = [
  tool<Record<string, never>>({ name: "whoami", title: "Who am I", group: "account", scope: "account", annotations: READ,
    description: "The signed-in SmartChart user, how many model calls are left today, and the contract version. Call it to check the connection.",
    input: { type: "object", additionalProperties: false, properties: {} },
    run: async (ctx) => ({ result: { email: ctx.port.email, callsLeftToday: await ctx.port.callsLeftToday(), contract: CONTRACT } }) }),
];
