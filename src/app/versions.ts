/* Versions in the app: a version's slides back as items (fetching only the blobs not seen yet), and which version
   Undo on an agent turn goes back to. The rule for recording versions lives in src/engine/versions.ts. */
import type { Slide } from '@/engine/types'
import { missingBlobs, slidesOf, type Tree, type Version } from '@/engine/versions'
import type { DeckRepo, Item } from './store'

/** Blobs seen per deck: a slide's JSON never changes under its hash, so they are kept for the session. */
const seen = new Map<string, Map<string, Slide>>()

/** A tree's slides as items, ready for the stage; null when the server no longer has a slide it names. */
export async function itemsOf(repo: DeckRepo, deckId: string, tree: Tree): Promise<Item[] | null> {
  const known = seen.get(deckId) ?? new Map<string, Slide>()
  seen.set(deckId, known)
  const want = missingBlobs(tree, known)
  if (want.length && repo.blobs) for (const b of await repo.blobs(deckId, want)) known.set(b.hash, b.slide)
  const slides = slidesOf(tree, known)
  return slides && slides.map(({ id, slide }) => ({ id, slide, status: 'ok', errors: [], warnings: [], checks: [] }))
}

/** Undo for an agent turn: the version just before the turn's (newest first), and how many versions came after the
    turn (their changes are undone too). `before` is null when the turn made the deck: back to no slides. */
export function undoTarget(list: Version[], turn: string): { before: Tree | null; later: number; label: string | null } | null {
  const at = list.findIndex((v) => v.turn === turn)
  if (at < 0) return null
  return { before: list[at + 1]?.tree ?? null, later: at, label: list[at].label }
}

/** "14:32" today, "Yesterday", or "3 Oct". */
export function dayOf(at: number, now = Date.now()): string {
  const d = new Date(at), n = new Date(now), start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const days = Math.round((start(n) - start(d)) / 86_400_000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', ...(d.getFullYear() !== n.getFullYear() ? { year: 'numeric' } : {}) })
}
export const timeOf = (at: number) => new Date(at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
