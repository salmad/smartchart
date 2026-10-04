/* The tour's state: started from the account menu or the nudge after the first slide, never on its own. On an empty
   deck it first puts in three gallery slides, so every step has something to point at. */
import { useCallback, useState } from 'react'
import { STARTERS, starterSlide } from '@/engine/starters'
import { locked, type Action, type AppState } from './state'
import { newDeckId } from './store'
import { markSeen, seen } from './tour'

export function useTour(app: { getState(): AppState; dispatch(a: Action): void }, recheck: () => void) {
  const [touring, setTouring] = useState(false), [nudge, setNudge] = useState(false)
  const start = useCallback(() => {
    const s = app.getState()
    if (locked(s)) return
    setNudge(false)
    if (!s.items.length) {
      const [first, ...rest] = STARTERS.slice(0, 3)
      app.dispatch({ type: 'pickStarter', slide: starterSlide(first, s.style), id: `s_${newDeckId()}` })
      for (const st of rest) app.dispatch({ type: 'insertStarter', slide: starterSlide(st, s.style), id: `s_${newDeckId()}` })
      app.dispatch({ type: 'select', index: 0 })
      recheck()
    }
    if (app.getState().view !== 'editor') app.dispatch({ type: 'set', patch: { view: 'editor' } })
    setTouring(true)
  }, [app, recheck])
  const stop = useCallback(() => { setTouring(false); markSeen() }, [])
  /** After a turn: the first slide someone makes is the moment to offer the tour, once. */
  const offer = useCallback(() => { if (!seen()) { setNudge(true); markSeen() } }, [])
  const dismiss = useCallback(() => { setNudge(false); markSeen() }, [])
  return { touring, start, stop, nudge, offer, dismiss }
}
