// GLM proxy for the app: only the two GLM 5.3 models are allowed, and the key never reaches the browser.
// Served by Vercel in production and by vite/api-dev.ts in dev.
import { userFrom } from './_lib/auth'
import { getDb } from './_lib/db'
import { modelGate } from './_lib/quota'

const GLM_URL = 'https://api.z.ai/api/coding/paas/v4/chat/completions'
const GLM_MODELS = new Set(['glm-5.3-flash', 'glm-5.3'])

interface GlmRequest {
  model?: string
  messages?: unknown
  thinking?: boolean
  temperature?: number
  max_tokens?: number
  response_format?: unknown
  tools?: unknown
  tool_choice?: unknown
}

export async function POST(request: Request): Promise<Response> {
  const blocked = await modelGate(request, { userFrom, db: getDb() })
  if (blocked) return blocked
  const p = (await request.json().catch(() => ({}))) as GlmRequest
  if (!p.model || !GLM_MODELS.has(p.model)) return Response.json({ error: `model ${p.model} is not allowed` }, { status: 400 })
  const { model, messages, thinking = false, temperature = 0.3, max_tokens = 4000, response_format, tools, tool_choice } = p
  const t0 = performance.now()
  // An unreachable or hung upstream answers JSON, which the app turns into a plain sentence.
  let r: Response
  try {
    r = await fetch(GLM_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.GLM_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model, messages, temperature, max_tokens, thinking: { type: thinking ? 'enabled' : 'disabled' },
        ...(response_format ? { response_format } : {}), ...(tools ? { tools, tool_choice } : {}),
      }),
      signal: AbortSignal.timeout(55_000),
    })
  } catch {
    return Response.json({ error: 'The model service is unreachable.' }, { status: 502 })
  }
  const ms = Math.round(performance.now() - t0)
  return new Response(await r.text(), { status: r.status, headers: { 'Content-Type': 'application/json', 'X-Upstream-Ms': String(ms) } })
}
