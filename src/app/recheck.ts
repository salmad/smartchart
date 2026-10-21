/* A deck that has just opened shows its open slide first: only that slide's rule checks are run at once (see openDeck).
   The others keep the checks stored with them and are rechecked here, a few at a time when the browser is idle, so
   drawing the page is not held up by measuring slides nobody is looking at. */
import { ruleChecks, type Check } from '@/engine/agent/checks'
import type { Measurer } from './measure'
import { deckOf, locked, type Action, type AppState } from './state'

interface Store { getState(): AppState; dispatch(a: Action): void }

const later = (fn: () => void) => { if ('requestIdleCallback' in window) window.requestIdleCallback(fn, { timeout: 600 }); else setTimeout(fn, 40) }

/** Rechecks every slide of `deckId` except `skip` (already done). Stops when another deck is open or the deck is busy (a
    turn or an edit runs its own recheck), and only ever replaces a slide's checks, never the slide itself. */
export function recheckInIdle({ app, measurer, deckId, skip, idle = later, batch = 3 }:
  { app: Store; measurer: () => Measurer; deckId: string | null; skip: string | null; idle?: (fn: () => void) => void; batch?: number }): void {
  const done = new Set<string>(skip ? [skip] : [])
  const step = () => {
    const s = app.getState()
    if (s.deckId !== deckId || locked(s)) return
    const todo = s.items.map((it, i) => ({ it, i })).filter(({ it }) => !done.has(it.id)).slice(0, batch)
    if (!todo.length) return
    const d = deckOf(s), m = measurer(), fresh = new Map<string, Check[]>()
    for (const { it, i } of todo) {
      done.add(it.id)
      m.measure(it.slide, d, i)
      fresh.set(it.id, [...ruleChecks(it.slide, s.style, m.lines), ...(it.checks || []).filter((c) => c.id.startsWith('J'))])
    }
    app.dispatch({ type: 'items', items: app.getState().items.map((it) => (fresh.has(it.id) ? { ...it, checks: fresh.get(it.id) ?? it.checks } : it)) })
    if (s.items.some((it) => !done.has(it.id))) idle(step)
  }
  idle(step)
}
