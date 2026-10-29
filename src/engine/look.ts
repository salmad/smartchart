import type { Theme } from './types.js'

/** Ink/Paper and accent: a per-user preference, not stored on decks or docs. */
export interface UserLook { theme: Theme; accent: string | null }

export const DEFAULT_USER_LOOK: UserLook = { theme: 'ink', accent: null }

export function parseUserLook(raw: unknown): UserLook | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as { theme?: unknown; accent?: unknown }
  const theme = o.theme === 'ink' ? 'ink' : o.theme === 'paper' ? 'paper' : null
  const accent = o.accent === null || o.accent === undefined ? null : typeof o.accent === 'string' && /^#[0-9a-f]{6}$/i.test(o.accent) ? o.accent : null
  if (!theme && accent === null) return null
  return { theme: theme ?? DEFAULT_USER_LOOK.theme, accent }
}

export function userLookOf(raw: unknown): UserLook {
  return parseUserLook(raw) ?? DEFAULT_USER_LOOK
}
