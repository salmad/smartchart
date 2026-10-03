// MCP over Streamable HTTP, stateless: one POST endpoint, JSON responses, no sessions. Tools come from the registry;
// guide and template cards are also resources. Conformance is tested with the official SDK client.
import { describe as card, OFFERED } from '../../src/engine/slides/schema.js'
import { exampleFor } from '../../src/engine/agent/prompts.js'
import { TOOLS, mcpView } from '../../src/engine/tools/index.js'
import { guideText } from '../../src/engine/tools/guide-text.js'
import { CONTRACT } from '../../src/engine/tools/account.js'
import { INSTRUCTIONS } from '../../src/engine/tools/instructions.js'
import type { JevFn } from '../../src/engine/agent/llm.js'
import type { Style, TemplateId } from '../../src/engine/types.js'
import type { UserFrom } from './auth.js'
import type { Db } from './db.js'
import { runTool } from './deck-service.js'

const VERSIONS = ['2025-06-18', '2025-03-26']
const STYLES: Style[] = ['consulting', 'pitch']
interface RpcRequest { jsonrpc: '2.0'; id?: string | number; method: string; params?: Record<string, unknown> }

const rpc = (id: RpcRequest['id'], result: unknown) => Response.json({ jsonrpc: '2.0', id, result })
const rpcError = (id: RpcRequest['id'] | null, code: number, message: string) => Response.json({ jsonrpc: '2.0', id: id ?? null, error: { code, message } })

function resources() {
  return [
    ...STYLES.map((s) => ({ uri: `smartchart://guide/${s}`, name: `Writing guide (${s})`, mimeType: 'text/markdown' })),
    ...STYLES.flatMap((s) => OFFERED.map((t) => ({ uri: `smartchart://template/${s}/${t}`, name: `${t} template (${s})`, mimeType: 'application/json' }))),
  ]
}
function readResource(uri: string): { uri: string; mimeType: string; text: string } | null {
  const g = /^smartchart:\/\/guide\/(consulting|pitch)$/.exec(uri)
  if (g) return { uri, mimeType: 'text/markdown', text: guideText(g[1] as Style) }
  const t = /^smartchart:\/\/template\/(consulting|pitch)\/(\w+)$/.exec(uri)
  if (t && OFFERED.includes(t[2] as TemplateId)) {
    const ex = exampleFor(t[2] as TemplateId, t[1] as Style)
    return { uri, mimeType: 'application/json', text: JSON.stringify({ card: card(t[2] as TemplateId, t[1] as Style), example: ex === '(none)' ? null : JSON.parse(ex) }) }
  }
  return null
}


export function mcpHandler(deps: { userFrom: UserFrom; db: () => Db | null; jev?: JevFn; allowedOrigins?: string[] }) {
  return async (request: Request): Promise<Response> => {
    if (request.method !== 'POST') return new Response(null, { status: 405, headers: { Allow: 'POST' } })
    const url = new URL(request.url), origin = request.headers.get('origin')
    if (origin && !(deps.allowedOrigins ?? [url.origin]).includes(origin)) return new Response('Forbidden origin', { status: 403 })
    const db = deps.db()
    if (!db) return new Response('Not set up on this server.', { status: 503 })
    const user = await deps.userFrom(request)
    if (!user) return Response.json({ error: 'Send Authorization: Bearer <your SmartChart agent key>.' }, { status: 401, headers: { 'WWW-Authenticate': 'Bearer' } })

    const msg = (await request.json().catch(() => null)) as RpcRequest | null
    if (!msg || Array.isArray(msg) || msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') return rpcError(null, -32600, 'Invalid request')
    if (msg.id === undefined) return new Response(null, { status: 202 })      // a notification
    const p = msg.params ?? {}

    switch (msg.method) {
      case 'initialize': {
        const asked = String(p.protocolVersion ?? '')
        return rpc(msg.id, { protocolVersion: VERSIONS.includes(asked) ? asked : VERSIONS[0], capabilities: { tools: { listChanged: false }, resources: { listChanged: false } },
          serverInfo: { name: 'smartchart', title: 'SmartChart', version: CONTRACT }, instructions: INSTRUCTIONS })
      }
      case 'ping': return rpc(msg.id, {})
      case 'tools/list': return rpc(msg.id, { tools: TOOLS.map(mcpView) })
      case 'resources/list': return rpc(msg.id, { resources: resources() })
      case 'resources/read': {
        const r = readResource(String(p.uri ?? ''))
        return r ? rpc(msg.id, { contents: [r] }) : rpcError(msg.id, -32602, `Unknown resource ${String(p.uri)}`)
      }
      case 'tools/call': {
        const name = String(p.name ?? '')
        if (!TOOLS.some((t) => t.name === name)) return rpcError(msg.id, -32602, `Unknown tool ${name}`)
        const client = request.headers.get('x-client') ?? 'Claude Code'
        const reply = await runTool(name, p.arguments ?? {}, { user, client, key: user.id }, { db, origin: url.origin, jev: deps.jev })
        // The text block is the whole result as JSON (MCP: structured results are also sent serialized), so a client
        // that reads only text sees every slide id and field, never a cut-off preview.
        if (reply.ok) return rpc(msg.id, { content: [{ type: 'text', text: JSON.stringify(reply.result) }], structuredContent: reply.result })
        const e = reply.error
        return rpc(msg.id, { isError: true, content: [{ type: 'text', text: `${e.code}: ${e.message}${e.fix ? ` ${e.fix}` : ''}` }], structuredContent: { error: e } })
      }
      default: return rpcError(msg.id, -32601, `Method not found: ${msg.method}`)
    }
  }
}
