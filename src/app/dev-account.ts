/* Dev only, never in a build: a local account whose decks live in this browser, so `npm run dev` without accounts
   set up, and the browser tests, can use the editor. On with VITE_DEV_ACCOUNT=1 or localStorage smartchart.devAccount = 1. */
import type { Account } from './auth'

export const DEV_ACCOUNT: Account = { id: 'dev', email: 'dev@localhost', name: 'Dev', image: null }

export function devAccount(): Account | null {
  if (!import.meta.env.DEV) return null
  if (import.meta.env.VITE_DEV_ACCOUNT === '1') return DEV_ACCOUNT
  try { return localStorage.getItem('smartchart.devAccount') === '1' ? DEV_ACCOUNT : null } catch { return null }
}
