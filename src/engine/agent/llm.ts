/* Model client: GLM agent steps and Jev, through the proxy (server.mjs locally, api/ on Vercel). */

export const FLASH = "glm-5.3-flash";

export interface ToolCall { id: string; type: "function"; function: { name: string; arguments: string } }
export interface ChatMessage { role: "system" | "user" | "assistant" | "tool"; content: string | null; tool_calls?: ToolCall[]; tool_call_id?: string }
export interface AgentStepArgs { messages: ChatMessage[]; tools?: unknown[]; toolChoice?: unknown; model?: string }
export interface AgentStepResult { message: ChatMessage; ms: number; tokens?: number; tokensIn?: number; tokensOut?: number }
export type AgentStepFn = (a: AgentStepArgs) => Promise<AgentStepResult>;

/** A Jev question as callers write it: option value → description. */
export interface JevQuestion { instructions: string; options: Record<string, string> }
export interface JevAnswer { choice: string; p: number; probabilities: Record<string, number> }
export type JevResult = Record<string, JevAnswer> & { _ms: number; _cost?: number };
export type JevFn = (state: string, questions: Record<string, JevQuestion>) => Promise<JevResult>;

interface Usage { total_tokens?: number; prompt_tokens?: number; completion_tokens?: number; cost?: number }
interface GlmResponse { choices?: { message?: { content?: string | null; tool_calls?: ToolCall[] } }[]; usage?: Usage }
interface JevResponse { answers?: Record<string, { choice: string; probabilities: Record<string, number> }>; usage?: Usage }

async function post<T>(path: string, payload: unknown): Promise<{ j: T; ms: number }> {
  for (let attempt = 0; ; attempt++) {
    const t0 = performance.now();
    try {
      const r = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const j: T & { error?: unknown } = await r.json();
      if (!r.ok || j.error) throw new Error(typeof j.error === "string" ? j.error : JSON.stringify(j.error ?? j).slice(0, 300));
      return { j, ms: Math.round(performance.now() - t0) };
    } catch (e) {
      if (attempt >= 2) throw e;
      await new Promise((ok) => setTimeout(ok, 1200 * (attempt + 1)));
    }
  }
}

/** One agent step: GLM 5.3 Flash with tools. Returns the assistant message (content and/or tool_calls). */
export const agentStep: AgentStepFn = async ({ messages, tools, toolChoice = "auto", model = FLASH }) => {
  const { j, ms } = await post<GlmResponse>("/api/glm", { model, messages, tools, tool_choice: toolChoice, temperature: 0.3, max_tokens: 8000 });
  const m = j.choices?.[0]?.message || {};
  const message: ChatMessage = { role: "assistant", content: m.content || "", ...(m.tool_calls?.length ? { tool_calls: m.tool_calls } : {}) };
  return { message, ms, tokens: j.usage?.total_tokens ?? 0, tokensIn: j.usage?.prompt_tokens ?? 0, tokensOut: j.usage?.completion_tokens ?? 0 };
};

/** A plain completion (no tools): GLM 5.3 Flash with thinking off. Returns the text. */
export async function complete({ messages, model = FLASH, temperature = 0.3, max_tokens = 1000 }: { messages: ChatMessage[]; model?: string; temperature?: number; max_tokens?: number }): Promise<string> {
  const { j } = await post<GlmResponse>("/api/glm", { model, messages, temperature, max_tokens });
  return j.choices?.[0]?.message?.content || "";
}

/* Jev option keys must be plain identifiers; map anything else and back. */
const keyOf = (s: string) => s.replace(/[^A-Za-z0-9_]/g, "_");

/**
 * Jev: several closed-set decisions in one call.
 * questions: { id: { instructions, options: { value: description } } }
 * returns   { id: { choice, p, probabilities } } with the original option values.
 */
export const jev: JevFn = async (state, questions) => {
  const back: Record<string, Record<string, string>> = {};
  const qs = Object.fromEntries(Object.entries(questions).map(([id, q]) => {
    back[id] = Object.fromEntries(Object.keys(q.options).map((v) => [keyOf(v), v]));
    return [id, { type: "choice", instructions: q.instructions, criteria: Object.fromEntries(Object.entries(q.options).map(([v, d]) => [keyOf(v), d])) }];
  }));
  const { j, ms } = await post<JevResponse>("/api/jev", { state, questions: qs });
  const answers: Record<string, JevAnswer> = {};
  for (const [id, a] of Object.entries(j.answers || {})) {
    const probabilities = Object.fromEntries(Object.entries(a.probabilities).map(([k, v]) => [back[id][k] ?? k, v]));
    answers[id] = { choice: back[id][a.choice] ?? a.choice, p: probabilities[back[id][a.choice] ?? a.choice] ?? 0, probabilities };
  }
  return Object.assign(answers, { _ms: ms, _cost: j.usage?.cost ?? 0 });
};
