/* Test doubles for the model calls. */

/** A Jev double: answers[questionId] = [choice, p]; unanswered questions take their first option at p 0.9. */
export function fakeJev(answers = {}) {
  const calls = [];
  const jev = async (state, questions) => {
    calls.push({ state, questions });
    const out = { _ms: 0 };
    for (const [id, q] of Object.entries(questions)) {
      const [choice, p] = answers[id] || [Object.keys(q.options)[0], 0.9];
      out[id] = { choice, p, probabilities: { [choice]: p } };
    }
    return out;
  };
  jev.calls = calls;
  return jev;
}

/** A GLM agent-step double: each step is a message, or a function of the messages that returns one. */
export function fakeAgent(steps) {
  const calls = [];
  const agentStep = async ({ messages }) => {
    calls.push(messages);
    const step = steps.shift();
    if (!step) throw new Error("the agent was called more times than scripted");
    return { message: typeof step === "function" ? step(messages) : step, ms: 1 };
  };
  agentStep.calls = calls;
  return agentStep;
}

let n = 0;
export const toolCall = (name, args) => ({ role: "assistant", content: "", tool_calls: [{ id: `call_${++n}`, type: "function", function: { name, arguments: JSON.stringify(args) } }] });
export const say = (content) => ({ role: "assistant", content });
