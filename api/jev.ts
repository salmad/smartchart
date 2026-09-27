// Jev proxy for the app. OpenRouter only ever receives the Jev decision model.
import { userFrom } from './_lib/auth'
import { getDb } from './_lib/db'
import { modelGate } from './_lib/quota'

const JEV_URL = 'https://openrouter.ai/api/alpha/decisions'
const JEV_MODEL = '~typesafe/jev-latest'

export async function POST(request: Request): Promise<Response> {
  const blocked = await modelGate(request, { userFrom, db: getDb(), salt: process.env.NEON_AUTH_COOKIE_SECRET ?? 'dev' })
  if (blocked) return blocked
  const p = (await request.json().catch(() => ({}))) as { state?: unknown; questions?: unknown }
  const t0 = performance.now()
  // An unreachable or hung upstream answers JSON, which the app turns into a plain sentence.
  let r: Response
  try {
    r = await fetch(JEV_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: JEV_MODEL, state: p.state, questions: p.questions }),
      signal: AbortSignal.timeout(55_000),
    })
  } catch {
    return Response.json({ error: 'The model service is unreachable.' }, { status: 502 })
  }
  const ms = Math.round(performance.now() - t0)
  return new Response(await r.text(), { status: r.status, headers: { 'Content-Type': 'application/json', 'X-Upstream-Ms': String(ms) } })
}
