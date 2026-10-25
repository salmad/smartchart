import { runDocTurn } from '@/engine/agent/doc-agent'
import type { ChatMessage } from '@/engine/agent/llm'
import { callAppTool } from './call-tool'
import type { Message } from './store'

export interface DocTurnDeps {
  docId: string
  getHistory: () => ChatMessage[]
  setHistory: (h: ChatMessage[]) => void
  setMessages: (fn: (m: Message[]) => Message[]) => void
  onDone: () => void
}

export async function sendDocTurn(text: string, deps: DocTurnDeps): Promise<void> {
  const ask = text.trim()
  if (!ask) return
  deps.setMessages((m) => [...m, { kind: 'user', text: ask }, { kind: 'bot', text: '', sub: 'Working…' }])
  const history = deps.getHistory()
  history.push({ role: 'user', content: ask })
  try {
    const r = await runDocTurn({ text: ask, docId: deps.docId, history, runTool: (name, input) => callAppTool(name, input) })
    history.push({ role: 'assistant', content: r.reply })
    deps.setHistory(history)
    const secs = (r.ms / 1000).toFixed(1)
    const sub = `${r.modelCalls} model call${r.modelCalls === 1 ? '' : 's'} · ${r.toolCalls} tool call${r.toolCalls === 1 ? '' : 's'} · ${secs}s`
    deps.setMessages((m) => { const out = m.slice(); out[out.length - 1] = { kind: 'bot', text: r.reply, sub }; return out })
    deps.onDone()
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Something went wrong.'
    deps.setMessages((m) => { const out = m.slice(); out[out.length - 1] = { kind: 'bot', text: msg, sub: '' }; return out })
  }
}
