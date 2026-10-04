/* Present and the presenter view talk over one BroadcastChannel (same origin, any tab or window). The presenting window
   owns the deck and the slide shown; the presenter view asks for them, shows them, and moves the slide when the maker
   presses a key there. */
import type { Deck } from '@/engine/types'

export type PresenterMsg =
  | { type: 'hello' }
  | { type: 'state'; deck: Deck; index: number }
  | { type: 'go'; index: number }
  | { type: 'end' }

export const presenterChannel = () => new BroadcastChannel('occam-presenter')

/** Opens the presenter view in its own window (P while presenting); it finds the presentation over the channel. */
export const openPresenter = () => window.open('/presenter', 'occam-presenter', 'popup,width=1280,height=820')
