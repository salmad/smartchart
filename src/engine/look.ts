import type { Theme } from './types.js'

/** App shell: Dark / Light / System (follows the OS). Independent of Ink/Paper on decks and docs. */
export type Chrome = 'dark' | 'light' | 'system'
export type ResolvedChrome = 'dark' | 'light'

/** Ink/Paper, accent, and app chrome: a per-user preference, not stored on decks or docs. */
export interface UserLook { theme: Theme; accent: string | null; chrome: Chrome }

export const DEFAULT_USER_LOOK: UserLook = { theme: 'ink', accent: null, chrome: 'dark' }

export function resolveChrome(chrome: Chrome, prefersDark: boolean): ResolvedChrome {
  if (chrome === 'system') return prefersDark ? 'dark' : 'light'
  return chrome
}

export function parseUserLook(raw: unknown): UserLook | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as { theme?: unknown; accent?: unknown; chrome?: unknown }
  const theme = o.theme === 'ink' ? 'ink' : o.theme === 'paper' ? 'paper' : null
  const accent = o.accent === null || o.accent === undefined ? null : typeof o.accent === 'string' && /^#[0-9a-f]{6}$/i.test(o.accent) ? o.accent : null
  const chrome = o.chrome === 'light' || o.chrome === 'system' || o.chrome === 'dark' ? o.chrome : null
  if (!theme && accent === null && !chrome) return null
  return {
    theme: theme ?? DEFAULT_USER_LOOK.theme,
    accent,
    chrome: chrome ?? DEFAULT_USER_LOOK.chrome,
  }
}

export function userLookOf(raw: unknown): UserLook {
  return parseUserLook(raw) ?? DEFAULT_USER_LOOK
}
