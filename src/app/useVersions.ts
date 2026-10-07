/* Restore a version and Undo an agent turn. Both write the old slides and look as a new version on top: nothing is
   lost, and Versions keeps the state before. The agent hears which slides changed, as after a hand edit. */
import { useCallback, useMemo, type MutableRefObject } from 'react'
import type { Style, Theme } from '@/engine/types'
import type { Version } from '@/engine/versions'
import { locked, type Action, type AppState } from './state'
import type { DeckRepo, Item, SaveMeta } from './store'
import { itemsOf, timeOf, undoTarget } from './versions'

interface Deps {
  app: { getState(): AppState; dispatch(a: Action): void }
  repo: DeckRepo
  /** Who wrote the next save; a restore sets it so its version stands alone. */
  author: MutableRefObject<SaveMeta | null>
  /** Saves the deck now if it has unsaved changes. */
  flush: () => Promise<void>
  recheck: () => void
  say: (text: string) => void
}

/** What the Versions panel works with; null when the decks' store keeps no versions. */
export interface VersionsApi {
  list(): Promise<Version[]>
  items(v: Version): Promise<Item[] | null>
  restore(v: Version, items: Item[]): void
}

export function useVersions({ app, repo, author, flush, recheck, say }: Deps) {
  const restore = useCallback((items: Item[], look: { style: Style; theme: Theme; accent: string | null }, label: string, said: string) => {
    if (locked(app.getState())) return
    const was = new Map(app.getState().items.map((it) => [it.id, JSON.stringify(it.slide)]))
    const changed = items.filter((it) => was.get(it.id) !== JSON.stringify(it.slide)).map((it) => it.id)
    author.current = { by: 'you', turn: `restore:${Date.now().toString(36)}`, label }
    app.dispatch({ type: 'items', items })
    app.dispatch({ type: 'set', patch: { style: look.style, theme: look.theme, accent: look.accent, view: items.length ? 'editor' : 'landing', removed: null,
      edited: [...new Set([...app.getState().edited, ...changed])] } })
    recheck()
    say(said)
  }, [app, author, recheck, say])

  const versions = useMemo((): VersionsApi | null => repo.versions && repo.blobs ? {
    list: async () => { const id = app.getState().deckId; return id && repo.versions ? repo.versions(id) : [] },
    items: async (v) => { const id = app.getState().deckId; return id ? itemsOf(repo, id, v.tree) : null },
    restore: (v, items) => {
      const at = timeOf(v.at)
      restore(items, v.tree, `Restored the version from ${at}`, `Restored the version from ${at}. The one before it is still in Versions.`)
    },
  } : null, [app, repo, restore])

  const undoTurn = useCallback(async (turn: string) => {
    const id = app.getState().deckId
    if (!id || !repo.versions || locked(app.getState())) return
    await flush()
    const t = undoTarget(await repo.versions(id).catch(() => []), turn)
    const items = t && (t.before ? await itemsOf(repo, id, t.before) : [])
    if (!t || !items) { say('Couldn’t find the deck as it was before that request. Versions has every saved state.'); return }
    const s = app.getState(), look = t.before ?? { style: s.style, theme: s.theme, accent: s.accent }
    const ask = t.label ? `“${t.label}”` : 'that request'
    const later = t.later ? ` That also undid ${t.later === 1 ? 'the change' : `the ${t.later} changes`} made after it; Versions still has ${t.later === 1 ? 'it' : 'them'}.` : ''
    restore(items, look, `Undid ${ask}`, `Undid ${ask}. The slides are back to how they were before it.${later}`)
    app.dispatch({ type: 'set', patch: { messages: app.getState().messages.map((m) => (m.turn === turn ? { ...m, undone: true } : m)) } })
  }, [app, repo, flush, restore, say])

  return { versions: repo.versions ? versions : null, undoTurn: repo.versions ? undoTurn : null }
}
