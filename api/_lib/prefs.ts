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
      return Response.json(look ?? { theme: 'paper', accent: null })
    }
    if (request.method !== 'PUT') return err(405, 'method not allowed')
    const b = (await request.json().catch(() => ({}))) as { theme?: unknown; accent?: unknown }
    const theme = b.theme === 'ink' ? 'ink' : b.theme === 'paper' ? 'paper' : null
    if (!theme) return err(400, 'Palette is Ink or Paper.')
    const raw = b.accent
    const accent = raw === null || raw === undefined ? null : typeof raw === 'string' && /^#[0-9a-f]{6}$/i.test(raw) ? raw : null
    if (raw !== null && raw !== undefined && accent === null) return err(400, 'Accent is a colour as #RRGGBB, or none.')
    await db.setUserLook(user.id, { theme, accent })
    return Response.json({ ok: true })
  }
}
