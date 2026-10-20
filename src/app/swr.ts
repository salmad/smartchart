/* Show what this browser stored, then what the server says. The fresh answer always wins: a stored value read
   after it is dropped. A fetch that fails leaves what was shown. */
import { cacheGet, cacheSet } from './cache'

/** Resolves true when the fresh answer arrived (and was stored), false when the fetch failed. `onData` gets the stored
    value first when there is one that passes `accept`, then the fresh one. */
export async function showThenFetch<T>(account: string, name: string, fetchFresh: () => Promise<T>, accept: (v: unknown) => v is T, onData: (v: T, cached: boolean) => void): Promise<boolean> {
  let fresh = false
  const stored = cacheGet<unknown>(account, name).then((v) => { if (!fresh && accept(v)) onData(v, true) })
  try {
    const v = await fetchFresh()
    fresh = true
    onData(v, false)
    void cacheSet(account, name, v)
    return true
  } catch {
    // Offline: what is stored is all there is, so it must have been shown before this says the fetch failed.
    await stored
    return false
  }
}
