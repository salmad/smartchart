/* The open deck follows writes made elsewhere (an agent over MCP, another tab): every 3 s while the tab is visible,
   and on focus, read the revision; when it moved on, fetch the deck, merge by slide id, and tell the agent which
   slides changed. Never while a turn runs or a slide is being edited by hand. */
import { useCallback, useEffect, useRef } from 'react'
import { mergeDecks, type DeckRepo } from './store'
import { locked, toSaved, type Action, type AppState } from './state'

export const POLL_MS = 3000
interface AppStore { getState(): AppState; dispatch(a: Action): void }

export function useLiveDeck({ app, repo, onMerged }: { app: AppStore; repo: DeckRepo; onMerged(changed: string[], by: string[]): void }) {
  const running = useRef(false)
  const syncNow = useCallback(async () => {
    const s = app.getState(), id = s.deckId
    if (!id || running.current || locked(s) || !repo.rev || !repo.known || !repo.base) return
    running.current = true
    try {
      const head = await repo.rev(id), known = repo.known(id)
      if (!head || head.rev <= known) return
      // The common ancestor is read before the fetch: `get` replaces it with the server's copy.
      const base = repo.base(id)
      const [server, events] = await Promise.all([repo.get(id), repo.events ? repo.events(id, known) : Promise.resolve([])])
      const local = toSaved(app.getState())
      if (!server || !local || locked(app.getState()) || app.getState().deckId !== id) return
      const { deck, changed } = mergeDecks(local, server, base)
      app.dispatch({ type: 'items', items: deck.items, focusId: changed.at(-1) })
      app.dispatch({ type: 'set', patch: { style: deck.style, theme: deck.theme, accent: deck.accent } })
      onMerged(changed, [...new Set(events.map((e) => e.by))])
    } finally { running.current = false }
  }, [app, repo, onMerged])

  useEffect(() => {
    const tick = () => { if (document.visibilityState === 'visible') void syncNow() }
    const t = window.setInterval(tick, POLL_MS)
    window.addEventListener('focus', tick)
    return () => { window.clearInterval(t); window.removeEventListener('focus', tick) }
  }, [syncNow])
  return syncNow
}
