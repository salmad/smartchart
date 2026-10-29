import type { Placed } from './types'

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9%$]/g, '')
const STOP = new Set(['a', 'an', 'the', 'to', 'of', 'and', 'or', 'in', 'on', 'for', 'with', 'your', 'you', 'is', 'it', 'its', 'this', 'that'])

/** Seconds (from scene start) at which each item appears. `cues` entries win: a number is seconds, a string is the
 *  spoken word to land on. Otherwise an item lands when the narration first says its first meaningful word (in order),
 *  else items spread evenly through the scene. */
export function cueTimes(scene: Placed, items: string[]): number[] {
  const words = scene.words.map((w) => ({ n: norm(w.text), t: w.start - scene.from }))
  const lo = 0.12 * scene.dur, hi = 0.72 * scene.dur
  const even = (i: number) => items.length === 1 ? lo : lo + ((hi - lo) * i) / (items.length - 1)
  let from = 0, last = 0
  return items.map((item, i) => {
    const cue = scene.cues?.[i]
    const keys = typeof cue === 'string' ? [norm(cue)] : item.replace(/\*/g, '').split(/\s+/).map(norm).filter((k) => k && !STOP.has(k)).slice(0, 2)
    const at = typeof cue === 'number' ? -1 : keys.length ? words.findIndex((w, j) => j >= from && keys.includes(w.n)) : -1
    const t = typeof cue === 'number' ? cue : at >= 0 ? words[at].t : even(i)
    if (at >= 0) from = at + 1
    last = Math.max(t, i === 0 ? 0 : last + 0.25)
    return Math.min(last, scene.dur - 0.4)
  })
}
