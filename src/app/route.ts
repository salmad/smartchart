/* Five routes on the History API: the site or your decks at /, the site for everyone at /home, a new deck at /new,
   a saved deck at /d/:id, and a deck shared by link at /s/:token (for anyone, signed in or not). */
import { useSyncExternalStore } from 'react'

export type Route = { name: 'home' } | { name: 'site' } | { name: 'new' } | { name: 'deck'; id: string } | { name: 'shared'; token: string }

export function parseRoute(path: string): Route {
  if (path === '/new') return { name: 'new' }
  if (path === '/home') return { name: 'site' }
  const shared = /^\/s\/([\w-]+)$/.exec(path)
  if (shared) return { name: 'shared', token: shared[1] }
  const m = /^\/d\/([\w-]+)$/.exec(path)
  return m ? { name: 'deck', id: m[1] } : { name: 'home' }
}

const listeners = new Set<() => void>()
const notify = () => listeners.forEach((fn) => fn())
if (typeof window !== 'undefined') window.addEventListener('popstate', notify)

/** Moves to a path; `replace` swaps the history entry (a new deck becoming /d/:id). */
export function go(path: string, { replace = false } = {}) {
  if (path === location.pathname) return
  if (replace) history.replaceState(null, '', path)
  else history.pushState(null, '', path)
  notify()
}

const subscribe = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn) } }

export function useRoute(): Route {
  const path = useSyncExternalStore(subscribe, () => location.pathname)
  return parseRoute(path)
}

/** A prompt typed on the site, carried to the editor across the navigation (and a sign-in redirect). */
const PENDING = 'smartchart.pendingPrompt'
export function setPendingPrompt(text: string) { try { sessionStorage.setItem(PENDING, text) } catch { /* storage blocked */ } }
export function takePendingPrompt(): string | null {
  try { const t = sessionStorage.getItem(PENDING); sessionStorage.removeItem(PENDING); return t } catch { return null }
}
