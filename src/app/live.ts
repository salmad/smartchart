/* The open deck merges in writes made elsewhere (an agent over MCP, another tab) when a save of ours is refused as stale:
   fetch the deck, merge by slide id, and tell the agent which slides changed. Nothing polls and nothing checks on focus; a
   reload shows the latest. Never while a turn runs or a slide is being edited by hand. */
import { useCallback, useRef } from 'react'
import { mergeDecks, type DeckRepo } from './store'
import { locked, toSaved, type Action, type AppState } from './state'

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
      app.dispatch({ type: 'set', patch: { name: deck.name ?? null, style: deck.style, theme: deck.theme, accent: deck.accent, comments: deck.comments ?? [] } })
      onMerged(changed, [...new Set(events.map((e) => e.by))])
    } finally { running.current = false }
  }, [app, repo, onMerged])

  return syncNow
}
