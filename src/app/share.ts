/* Share links (/api/share): the owner turns a deck's link on and off; anyone with the link reads the deck. */
import { plain, upgrade } from '@/engine/slides/schema'
import type { Deck, Slide } from '@/engine/types'

export const shareUrl = (token: string) => `${location.origin}/s/${token}`

/** The deck's link token (null when it isn't shared); `on` makes or drops it. Throws with a sentence when it can't. */
export async function share(id: string, on?: boolean, fetcher: typeof fetch = (...a) => fetch(...a)): Promise<string | null> {
  const r = await fetcher(`/api/share?id=${encodeURIComponent(id)}`, { method: on === undefined ? 'GET' : on ? 'POST' : 'DELETE', credentials: 'same-origin' })
    .catch(() => { throw new Error('You’re offline, or the server can’t be reached.') })
  // A deck made a moment ago may not have reached the account yet.
  if (r.status === 404) throw new Error('This deck is still saving. Try again in a moment.')
  if (!r.ok) throw new Error(r.status === 401 ? 'Your session ended. Sign in again to share.' : 'Sharing isn’t available right now.')
  const { share: token } = (await r.json()) as { share?: unknown }
  return typeof token === 'string' ? token : null
}

export interface Shared { name: string; deck: Deck; rev: number; ids: string[] }

/** A deck by its link: null when the link is off or never existed. */
export async function loadShared(token: string, fetcher: typeof fetch = (...a) => fetch(...a)): Promise<Shared | null> {
  const r = await fetcher(`/api/share?s=${encodeURIComponent(token)}`)
  if (r.status === 404) return null
  if (!r.ok) throw new Error(`share: ${r.status}`)
  const d = (await r.json()) as { name?: unknown; style?: unknown; theme?: unknown; accent?: unknown; slides?: unknown; rev?: unknown; ids?: unknown }
  // Slides saved under an older schema read as the editor would open them.
  const slides = Array.isArray(d.slides) ? (d.slides as Slide[]).map(upgrade) : []
  // The footer is the cover's title, as in the editor.
  const cover = slides.find((s) => s.template === 'cover')
  return {
    rev: typeof d.rev === 'number' ? d.rev : 0, ids: Array.isArray(d.ids) ? d.ids.filter((x): x is string => typeof x === 'string') : [],
    name: typeof d.name === 'string' && d.name ? d.name : 'Untitled deck',
    deck: {
      style: d.style === 'pitch' ? 'pitch' : 'consulting', theme: d.theme === 'paper' ? 'paper' : 'ink',
      accent: typeof d.accent === 'string' ? d.accent : null, footer: cover ? plain(cover.title) : '', slides,
    },
  }
}
