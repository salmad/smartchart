/* Model client: GLM agent steps and Jev, through the api/ proxy (Vercel in production, vite/api-dev.ts in dev). */

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
export interface JevResponse { answers?: Record<string, { choice: string; probabilities: Record<string, number> }>; usage?: Usage }

/** A model call that takes longer than this is abandoned (then retried). */
const TIMEOUT_MS = 60_000;

/** A refusal that retrying cannot change (over the daily limit, signed out): every retry would count as another call. */
class Final extends Error {}

/** `signal` cancels the call (a background call giving way to a chat turn); a cancelled call is not retried. */
async function post<T>(path: string, payload: unknown, signal?: AbortSignal): Promise<{ j: T; ms: number }> {
  for (let attempt = 0; ; attempt++) {
    const t0 = performance.now();
    try {
      const timeout = AbortSignal.timeout(TIMEOUT_MS);
      const r = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), signal: signal ? AbortSignal.any([signal, timeout]) : timeout });
      // A platform error page is text, not JSON: report the status, not a parse error.
      const text = await r.text();
      let j: T & { error?: unknown };
      try { j = JSON.parse(text); } catch { throw new Error(`The model service is not responding (HTTP ${r.status}).`); }
      if (!r.ok || j.error) {
        const msg = typeof j.error === "string" ? j.error : JSON.stringify(j.error ?? j).slice(0, 300), code = (j as { code?: unknown }).code;
        throw code === "limit" || code === "signin" ? new Final(msg) : new Error(msg);
      }
      return { j, ms: Math.round(performance.now() - t0) };
    } catch (e) {
      if (e instanceof Final || attempt >= 2 || signal?.aborted) throw e;
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
export async function complete({ messages, model = FLASH, temperature = 0.3, max_tokens = 1000, signal }: { messages: ChatMessage[]; model?: string; temperature?: number; max_tokens?: number; signal?: AbortSignal }): Promise<string> {
  const { j } = await post<GlmResponse>("/api/glm", { model, messages, temperature, max_tokens }, signal);
  return j.choices?.[0]?.message?.content || "";
}

/* Jev option keys must be plain identifiers; map anything else and back. */
const keyOf = (s: string) => s.replace(/[^A-Za-z0-9_]/g, "_");

/** Jev's wire format: option keys must be plain identifiers. */
export function jevRequest(questions: Record<string, JevQuestion>): { qs: Record<string, unknown>; back: Record<string, Record<string, string>> } {
  const back: Record<string, Record<string, string>> = {};
  const qs = Object.fromEntries(Object.entries(questions).map(([id, q]) => {
    back[id] = Object.fromEntries(Object.keys(q.options).map((v) => [keyOf(v), v]));
    return [id, { type: "choice", instructions: q.instructions, criteria: Object.fromEntries(Object.entries(q.options).map(([v, d]) => [keyOf(v), d])) }];
  }));
  return { qs, back };
}
export function jevAnswers(j: JevResponse, back: Record<string, Record<string, string>>): Record<string, JevAnswer> {
  const answers: Record<string, JevAnswer> = {};
  for (const [id, a] of Object.entries(j.answers || {})) {
    const probabilities = Object.fromEntries(Object.entries(a.probabilities).map(([k, v]) => [back[id]?.[k] ?? k, v]));
    const choice = back[id]?.[a.choice] ?? a.choice;
    answers[id] = { choice, p: probabilities[choice] ?? 0, probabilities };
  }
  return answers;
}

/**
 * Jev: several closed-set decisions in one call.
 * questions: { id: { instructions, options: { value: description } } }
 * returns   { id: { choice, p, probabilities } } with the original option values.
 */
export const jev: JevFn = async (state, questions) => {
  const { qs, back } = jevRequest(questions);
  const { j, ms } = await post<JevResponse>("/api/jev", { state, questions: qs });
  return Object.assign(jevAnswers(j, back), { _ms: ms, _cost: j.usage?.cost ?? 0 });
};
