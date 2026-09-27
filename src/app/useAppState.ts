/* The app state as an external store: dispatch applies the reducer at once, so a turn that dispatches
   and then reads (sendTurn) sees its own change before React re-renders. */
import { useRef, useSyncExternalStore } from 'react'
import { initialState, reducer, type Action, type AppState } from './state'

export interface AppStore { getState: () => AppState; dispatch: (a: Action) => void; subscribe: (fn: () => void) => () => void }

function createAppStore(): AppStore {
  let state = initialState()
  const listeners = new Set<() => void>()
  return {
    getState: () => state,
    dispatch: (a) => { state = reducer(state, a); listeners.forEach((fn) => fn()) },
    subscribe: (fn) => { listeners.add(fn); return () => listeners.delete(fn) },
  }
}

export function useAppState(): [AppState, AppStore] {
  const store = useRef<AppStore | null>(null)
  store.current ??= createAppStore()
  const s = store.current
  return [useSyncExternalStore(s.subscribe, s.getState), s]
}
