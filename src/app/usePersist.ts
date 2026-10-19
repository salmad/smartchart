/* Saving the open deck: a failed save keeps a copy in this browser and tries again, waiting longer each time; the copy
   goes once a save succeeds. One chat warning per run of failures, saying why. */
import { useCallback, useEffect, useRef, type MutableRefObject } from 'react'
import { config } from './config'
import { STALE } from './remote'
import { editKey, toSaved } from './state'
import type { DeckRepo, SaveMeta, SavedDeck } from './store'
import type { AppStore } from './useAppState'

const notSaved = (why: string) => `Couldn’t save. ${why} Retrying; a copy is kept in this browser until it saves.`

interface Deps {
  app: AppStore
  repo: DeckRepo
  /** Where a copy waits while saves fail; null when the decks already live in this browser. */
  backup: DeckRepo | null
  /** Reads the deck changed elsewhere and merges it in. */
  syncNow: () => Promise<unknown>
  /** Who wrote the next save, for its version; cleared once that save lands. */
  author: MutableRefObject<SaveMeta | null>
  /** The deck as last saved: a save happens only when this changes. */
  savedKey: MutableRefObject<string | null>
  onSaved: () => void
}

export function usePersist({ app, repo, backup, syncNow, author, savedKey, onSaved }: Deps): (saved: SavedDeck) => Promise<void> {
  const retry = useRef({ timer: 0, wait: 0 }), warned = useRef(false)
  const saved = useRef(onSaved)
  saved.current = onSaved
  const persist = useCallback(async (deck: SavedDeck) => {
    const r = retry.current
    clearTimeout(r.timer)
    const meta = author.current ?? undefined
    const why = await repo.save(deck, meta)
    if (!why) {
      if (author.current === meta) author.current = null
      saved.current()
      savedKey.current = editKey(deck)
      if (r.wait) void backup?.remove(deck.id)
      r.wait = 0; warned.current = false
      return
    }
    // The deck was changed elsewhere: read it, merge by slide id and save the merge (the autosave does that once the
    // state changes). Not copied to this browser, where the copy would win over the newer deck the next time this one is opened.
    if (why === STALE) { void syncNow(); return }
    if (!warned.current) { warned.current = true; app.dispatch({ type: 'message', message: { kind: 'error', text: backup ? notSaved(why) : `Couldn’t save. ${why}` } }) }
    if (!backup) return
    void backup.save(deck)
    r.wait = Math.min(config.saveRetryMaxMs, r.wait ? r.wait * 2 : config.saveRetryMs)
    r.timer = window.setTimeout(() => { const now = toSaved(app.getState()); if (now) void persist(now) }, r.wait)
  }, [app, repo, backup, syncNow, author, savedKey])
  useEffect(() => () => clearTimeout(retry.current.timer), [])
  return persist
}
