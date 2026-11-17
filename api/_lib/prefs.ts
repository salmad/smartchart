import { userLookOf, type Chrome } from '../../src/engine/look.js'
import type { UserFrom } from './auth.js'
import type { Db } from './db.js'

const err = (status: number, error: string) => Response.json({ error }, { status })

const chromeOf = (v: unknown): Chrome | null =>
  v === 'dark' || v === 'light' || v === 'system' ? v : null

export function prefsHandler(deps: { userFrom: UserFrom; db: () => Db | null }) {
  return async (request: Request): Promise<Response> => {
    const db = deps.db()
    if (!db) return err(503, 'Preferences are not set up on this server.')
    const user = await deps.userFrom(request)
    if (!user) return err(401, 'Sign in to save your preferences.')
    if (request.method === 'GET') {
      const look = userLookOf(await db.getUserLook(user.id))
      const agent = await db.agentConnectState(user.id)
      return Response.json({
        theme: look.theme,
        accent: look.accent,
        chrome: look.chrome,
        agentNudgeDismissed: agent.dismissed,
        agentConnectDone: agent.done,
        showAgentNudge: !agent.dismissed && !agent.done,
      })
    }
    if (request.method !== 'PUT') return err(405, 'method not allowed')
    const b = (await request.json().catch(() => ({}))) as { theme?: unknown; accent?: unknown; chrome?: unknown; dismissAgentNudge?: unknown }
    if (b.dismissAgentNudge === true) await db.dismissAgentNudge(user.id)
    const theme = b.theme === 'ink' ? 'ink' : b.theme === 'paper' ? 'paper' : null
    const chrome = chromeOf(b.chrome)
    let accentPut: string | null | undefined
    if (theme) {
      const raw = b.accent
      const accent = raw === null || raw === undefined ? null : typeof raw === 'string' && /^#[0-9a-f]{6}$/i.test(raw) ? raw : null
      if (raw !== null && raw !== undefined && accent === null) return err(400, 'Accent is a colour as #RRGGBB, or none.')
      accentPut = accent
    }
    if (!theme && !chrome && b.dismissAgentNudge !== true) {
      return err(400, 'Set App (Dark, Light or System), Slides (Ink or Paper), or dismiss the agent nudge.')
    }
    const saved = userLookOf(await db.getUserLook(user.id))
    const next = {
      theme: theme ?? saved.theme,
      accent: theme ? (accentPut ?? null) : saved.accent,
      chrome: chrome ?? saved.chrome,
    }
    if (theme || chrome) await db.setUserLook(user.id, next)
    const agent = await db.agentConnectState(user.id)
    return Response.json({
      theme: next.theme,
      accent: next.accent,
      chrome: next.chrome,
      agentNudgeDismissed: agent.dismissed,
      agentConnectDone: agent.done,
      showAgentNudge: !agent.dismissed && !agent.done,
    })
  }
}
