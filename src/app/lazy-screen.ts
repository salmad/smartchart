/* A screen loaded on first use, which can also be loaded ahead. React.lazy shows its fallback for a frame on first render
   even when the module is already here; loaded ahead, the screen renders at once instead. Once the lazy one has been drawn
   it stays the one returned, so a mounted screen never changes type (and loses its state) when its code arrives. */
import { lazy, type ComponentType } from 'react'

export function lazyScreen<P extends object>(load: () => Promise<ComponentType<P>>) {
  let ready: ComponentType<P> | null = null, drawn = false
  const preload = () => load().then((c) => { ready = c; return c })
  const Lazy = lazy(() => { drawn = true; return preload().then((c) => ({ default: c })) })
  return { preload, get: () => (drawn || !ready ? Lazy : ready) }
}

/** Runs `f` when the browser is idle (soon, where it can't tell). */
export const whenIdle = (f: () => void) => { if (window.requestIdleCallback) window.requestIdleCallback(f); else window.setTimeout(f, 1) }
