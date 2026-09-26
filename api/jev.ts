// Jev proxy for the journey prototype. OpenRouter only ever receives the Jev decision model.
const JEV_URL = 'https://openrouter.ai/api/alpha/decisions'
const JEV_MODEL = '~typesafe/jev-latest'

export async function POST(request: Request): Promise<Response> {
  const p = (await request.json().catch(() => ({}))) as { state?: unknown; questions?: unknown }
  const t0 = performance.now()
  const r = await fetch(JEV_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: JEV_MODEL, state: p.state, questions: p.questions }),
  })
  const ms = Math.round(performance.now() - t0)
  return new Response(await r.text(), { status: r.status, headers: { 'Content-Type': 'application/json', 'X-Upstream-Ms': String(ms) } })
}
