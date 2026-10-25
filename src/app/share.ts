/* Share links (/api/share): the owner turns a deck's or doc's link on and off; anyone with the link reads it. */
import { parseDoc } from '@/engine/docs/parse'
import { plainOf } from '@/engine/slides/markup'
import { plain, upgrade } from '@/engine/slides/schema'
import type { Deck, Slide } from '@/engine/types'

export const shareUrl = (token: string) => `${location.origin}/s/${token}`

async function shareCall(query: string, on?: boolean, fetcher: typeof fetch = (...a) => fetch(...a)): Promise<string | null> {
  const r = await fetcher(`/api/share?${query}`, { method: on === undefined ? 'GET' : on ? 'POST' : 'DELETE', credentials: 'same-origin' })
    .catch(() => { throw new Error('You’re offline, or the server can’t be reached.') })
  if (r.status === 404) throw new Error('This is still saving. Try again in a moment.')
  if (!r.ok) throw new Error(r.status === 401 ? 'Your session ended. Sign in again to share.' : 'Sharing isn’t available right now.')
  const { share: token } = (await r.json()) as { share?: unknown }
  return typeof token === 'string' ? token : null
}

/** The deck's link token (null when it isn't shared); `on` makes or drops it. Throws with a sentence when it can't. */
export async function shareDeck(id: string, on?: boolean, fetcher: typeof fetch = (...a) => fetch(...a)): Promise<string | null> {
  return shareCall(`id=${encodeURIComponent(id)}`, on, fetcher)
}

/** The doc's link token; same rules as a deck. */
export async function shareDoc(id: string, on?: boolean, fetcher: typeof fetch = (...a) => fetch(...a)): Promise<string | null> {
  return shareCall(`doc=${encodeURIComponent(id)}`, on, fetcher)
}

/** @deprecated Use shareDeck */
export const share = shareDeck

export interface SharedDeck { kind: 'deck'; name: string; deck: Deck; rev: number; ids: string[] }
export interface SharedDoc { kind: 'doc'; name: string; text: string; rev: number }
export type Shared = SharedDeck | SharedDoc

/** A deck or doc by its link: null when the link is off or never existed. */
export async function loadShared(token: string, fetcher: typeof fetch = (...a) => fetch(...a)): Promise<Shared | null> {
  const r = await fetcher(`/api/share?s=${encodeURIComponent(token)}`)
  if (r.status === 404) return null
  if (!r.ok) throw new Error(`share: ${r.status}`)
  const d = (await r.json()) as { kind?: unknown; name?: unknown; style?: unknown; theme?: unknown; accent?: unknown; slides?: unknown; rev?: unknown; ids?: unknown; text?: unknown }
  if (d.kind === 'doc') {
    const text = typeof d.text === 'string' ? d.text : ''
    const name = typeof d.name === 'string' && d.name ? d.name : plainOf(parseDoc(text).doc.title).trim() || 'Untitled doc'
    return { kind: 'doc', name, text, rev: typeof d.rev === 'number' ? d.rev : 0 }
  }
  const slides = Array.isArray(d.slides) ? (d.slides as Slide[]).map(upgrade) : []
  const cover = slides.find((s) => s.template === 'cover')
  const ids = Array.isArray(d.ids) ? d.ids.filter((x): x is string => typeof x === 'string') : []
  return {
    kind: 'deck', rev: typeof d.rev === 'number' ? d.rev : 0, ids,
    name: typeof d.name === 'string' && d.name ? d.name : 'Untitled deck',
    deck: {
      style: d.style === 'pitch' ? 'pitch' : 'consulting', theme: d.theme === 'paper' ? 'paper' : 'ink',
      accent: typeof d.accent === 'string' ? d.accent : null, footer: cover ? plain(cover.title) : '', slides, ids,
    },
  }
}
