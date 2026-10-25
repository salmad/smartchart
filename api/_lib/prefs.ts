import type { UserFrom } from './auth.js'
import type { Db } from './db.js'

const err = (status: number, error: string) => Response.json({ error }, { status })

export function prefsHandler(deps: { userFrom: UserFrom; db: () => Db | null }) {
  return async (request: Request): Promise<Response> => {
    const db = deps.db()
    if (!db) return err(503, 'Preferences are not set up on this server.')
    const user = await deps.userFrom(request)
    if (!user) return err(401, 'Sign in to save your preferences.')
    if (request.method === 'GET') {
      const look = await db.getUserLook(user.id)
      const agent = await db.agentConnectState(user.id)
      const theme = look && typeof look === 'object' && (look as { theme?: unknown }).theme === 'ink' ? 'ink' : 'paper'
      const raw = look && typeof look === 'object' ? (look as { accent?: unknown }).accent : null
      const accent = raw === null || raw === undefined ? null : typeof raw === 'string' && /^#[0-9a-f]{6}$/i.test(raw) ? raw : null
      return Response.json({
        theme,
        accent,
        agentNudgeDismissed: agent.dismissed,
        agentConnectDone: agent.done,
        showAgentNudge: !agent.dismissed && !agent.done,
      })
    }
    if (request.method !== 'PUT') return err(405, 'method not allowed')
    const b = (await request.json().catch(() => ({}))) as { theme?: unknown; accent?: unknown; dismissAgentNudge?: unknown }
    if (b.dismissAgentNudge === true) await db.dismissAgentNudge(user.id)
    const theme = b.theme === 'ink' ? 'ink' : b.theme === 'paper' ? 'paper' : null
    let accentPut: string | null | undefined
    if (theme) {
      const raw = b.accent
      const accent = raw === null || raw === undefined ? null : typeof raw === 'string' && /^#[0-9a-f]{6}$/i.test(raw) ? raw : null
      if (raw !== null && raw !== undefined && accent === null) return err(400, 'Accent is a colour as #RRGGBB, or none.')
      accentPut = accent
      await db.setUserLook(user.id, { theme, accent })
    }
    if (!theme && b.dismissAgentNudge !== true) return err(400, 'Palette is Ink or Paper, or dismiss the agent nudge.')
    const agent = await db.agentConnectState(user.id)
    const look = await db.getUserLook(user.id)
    const savedTheme = look && typeof look === 'object' && (look as { theme?: unknown }).theme === 'ink' ? 'ink' : 'paper'
    const savedAccent = look && typeof look === 'object' ? (look as { accent?: unknown }).accent : null
    const accentOut = savedAccent === null || savedAccent === undefined ? null : typeof savedAccent === 'string' && /^#[0-9a-f]{6}$/i.test(savedAccent) ? savedAccent : null
    return Response.json({
      theme: theme ?? savedTheme,
      accent: theme ? (accentPut ?? null) : accentOut,
      agentNudgeDismissed: agent.dismissed,
      agentConnectDone: agent.done,
      showAgentNudge: !agent.dismissed && !agent.done,
    })
  }
}
