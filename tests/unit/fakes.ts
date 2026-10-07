/* Test doubles for the model calls. */
import type { AgentStepArgs, AgentStepFn, ChatMessage, JevAnswer, JevFn, JevQuestion } from "../../src/engine/agent/llm";

export type FakeJev = JevFn & { calls: { state: string; questions: Record<string, JevQuestion> }[] };
export type FakeAgent = AgentStepFn & { calls: ChatMessage[][] };
export type Step = ChatMessage | ((messages: ChatMessage[], tools?: AgentStepArgs["tools"]) => ChatMessage);

/** A Jev double: answers[questionId] = [choice, p]; unanswered questions take their first option at p 0.9. */
export function fakeJev(answers: Record<string, [string, number]> = {}): FakeJev {
  const calls: FakeJev["calls"] = [];
  const jev: JevFn = async (state, questions) => {
    calls.push({ state, questions });
    const out: Record<string, JevAnswer> = {};
    for (const [id, q] of Object.entries(questions)) {
      const [choice, p] = answers[id] || [Object.keys(q.options)[0], 0.9];
      out[id] = { choice, p, probabilities: { [choice]: p } };
    }
    return Object.assign(out, { _ms: 0 });
  };
  return Object.assign(jev, { calls });
}

/** A GLM agent-step double: each step is a message, or a function of the messages that returns one. */
export function fakeAgent(steps: Step[]): FakeAgent {
  const calls: ChatMessage[][] = [];
  const agentStep: AgentStepFn = async ({ messages, tools }) => {
    calls.push(messages);
    const step = steps.shift();
    if (!step) throw new Error("the agent was called more times than scripted");
    return { message: typeof step === "function" ? step(messages, tools) : step, ms: 1 };
  };
  return Object.assign(agentStep, { calls });
}

let n = 0;
export const toolCall = (name: string, args: unknown): ChatMessage => ({ role: "assistant", content: "", tool_calls: [{ id: `call_${++n}`, type: "function", function: { name, arguments: JSON.stringify(args) } }] });
export const say = (content: string): ChatMessage => ({ role: "assistant", content });
