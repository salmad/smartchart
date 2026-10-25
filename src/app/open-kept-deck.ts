/* Open a deck from this browser's copy first (memory, then storage), before the network. */
import { readCachedDeck } from './cached-decks'
import { findDeck } from './remote'
import type { DeckRepo, KeptDeck, SavedDeck } from './store'

/** The kept deck, seeded into the repo; null when there is none to trust or backup wins. */
export async function keptDeck(
  repo: DeckRepo,
  account: string | undefined,
  id: string | undefined,
  backup: DeckRepo | null,
): Promise<KeptDeck | null> {
  const kept = repo.kept ? await repo.kept(id) : (account ? await readCachedDeck(account, id) : null)
  if (!kept || (backup && (await backup.get(kept.deck.id)))) return null
  repo.seed?.(kept.deck, kept.rev, kept.role)
  return kept
}

/** Opens from peek or kept; returns true when the deck was opened from cache. */
export async function openKeptDeck(
  repo: DeckRepo,
  account: string | undefined,
  backup: DeckRepo | null,
  id: string,
  open: (deck: SavedDeck) => void,
  afterOpen?: (id: string) => void,
): Promise<boolean> {
  const warm = repo.peek?.(id)
  if (warm && !(backup && (await backup.get(warm.deck.id)))) {
    repo.seed?.(warm.deck, warm.rev, warm.role)
    open(warm.deck)
    afterOpen?.(id)
    return true
  }
  const kept = await keptDeck(repo, account, id, backup)
  if (!kept) return false
  open(kept.deck)
  afterOpen?.(id)
  return true
}

/** Network read when cache missed; backup merge matches `findDeck`. */
export async function openDeckFromServer(
  id: string,
  repo: DeckRepo,
  backup: DeckRepo | null,
  open: (deck: SavedDeck) => void,
): Promise<SavedDeck | null> {
  const d = await findDeck(id, repo, backup)
  if (d) open(d)
  return d
}
