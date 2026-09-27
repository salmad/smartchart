// The app calls this to learn whether the models are reachable (both keys present).
export function GET(): Response {
  return Response.json({ ok: true, live: !!(process.env.GLM_API_KEY && process.env.OPENROUTER_API_KEY) })
}
