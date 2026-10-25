/** Run one MCP registry tool with the signed-in session (in-app agent). */
export async function callAppTool(name: string, input: Record<string, unknown>): Promise<Record<string, unknown>> {
  const r = await fetch('/api/tool', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, input }) })
  const j = (await r.json().catch(() => ({}))) as { error?: { message?: string } | string }
  if (!r.ok) {
    const e = j.error
    throw new Error(typeof e === 'string' ? e : e?.message ? e.message : `Tool failed (${r.status}).`)
  }
  return j as Record<string, unknown>
}
