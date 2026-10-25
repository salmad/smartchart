/* In-app doc agent: GLM with doc MCP tools only, each executed on the server. */
import { agentStep, type ChatMessage } from './llm.js'
import { openAiView, toolByName, TOOLS } from '../tools/index.js'
import { docGuideText } from '../tools/guide-text.js'

const DOC_TOOLS = new Set([
  'get_guide', 'get_template', 'add_image',
  'list_docs', 'create_doc', 'get_doc', 'update_doc', 'write_doc_text', 'create_block', 'update_block', 'move_block', 'delete_block', 'check_doc',
  'list_doc_versions', 'restore_doc_version', 'list_doc_comments', 'resolve_doc_comment',
])

const views = TOOLS.filter((t) => DOC_TOOLS.has(t.name)).map(openAiView)
const MAX = 12

export interface DocTurnArgs { text: string; docId: string; history: ChatMessage[]; runTool(name: string, input: Record<string, unknown>): Promise<Record<string, unknown>> }
export interface DocTurnResult { reply: string; modelCalls: number; toolCalls: number; ms: number }

export async function runDocTurn({ text, docId, history, runTool }: DocTurnArgs): Promise<DocTurnResult> {
  const system = `${docGuideText()}\n\nYou edit one doc at a time. The open doc id is ${docId}. Start with get_doc if you need its blocks. Use blockIds from the last result; read again after each write. End with check_doc when the doc matches what the user asked.`
  const messages: ChatMessage[] = [{ role: 'system', content: system }, ...history, { role: 'user', content: text }]
  let modelCalls = 0, toolCalls = 0, t0 = performance.now(), reply = ''
  for (let step = 0; step < MAX; step++) {
    const { message, ms } = await agentStep({ messages, tools: views, model: undefined })
    modelCalls++; t0 += ms
    if (message.tool_calls?.length) {
      messages.push(message)
      for (const c of message.tool_calls) {
        toolCalls++
        const name = c.function.name, args = JSON.parse(c.function.arguments || '{}') as Record<string, unknown>
        if (!toolByName(name) || !DOC_TOOLS.has(name)) {
          messages.push({ role: 'tool', tool_call_id: c.id, content: JSON.stringify({ error: `Tool ${name} is not available in the doc editor.` }) })
          continue
        }
        const input = { ...args, docId: typeof args.docId === 'string' ? args.docId : docId }
        try {
          const result = await runTool(name, input)
          messages.push({ role: 'tool', tool_call_id: c.id, content: JSON.stringify(result) })
        } catch (e) {
          messages.push({ role: 'tool', tool_call_id: c.id, content: JSON.stringify({ error: e instanceof Error ? e.message : String(e) }) })
        }
      }
      continue
    }
    reply = message.content?.trim() || 'Done.'
    break
  }
  if (!reply) reply = 'I hit the step limit. Say what to do next and I’ll continue.'
  return { reply, modelCalls, toolCalls, ms: Math.round(performance.now() - t0) }
}
