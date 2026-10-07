/* The first-run tour's content and geometry. Started from the account menu (or the one-time nudge), never on its own;
   it ends at Connect an agent. Targets are elements marked data-tour="<id>". */

/** `show`: what the step puts on screen while it is shown (and takes away again); `target`: the element to light, when it
    is not data-tour="<id>"; `via`: the control the step "clicked", marked with its own ring. */
export type TourShow = 'chat' | 'grid' | 'comments'
export interface TourStep { id: string; title: string; body: string; show?: TourShow; target?: string; via?: string }

export const TOUR: readonly TourStep[] = [
  { id: 'chat', show: 'chat', title: 'Say what the slide should say', body: 'Paste your numbers or notes, or drop in a doc, and say what the room should take away. SmartChart picks the slide and writes it.' },
  { id: 'stage', title: 'Your slide, always in shape', body: 'Code draws every slide, so it always fits and always matches. Press E to edit it by hand, F to present.' },
  { id: 'checks', title: 'Checked like a partner would', body: 'Every slide is checked: does the title make a point, does the chart prove it, do the figures add up. Click to see what to look at.' },
  { id: 'comments', show: 'comments', target: 'comments-panel', via: 'comments', title: 'Leave notes for any agent', body: 'Write “this number is from Q2, update it” on a slide. Ask SmartChart, or any connected agent, to address the notes: it fixes each one and replies.' },
  { id: 'views', show: 'grid', target: 'grid', via: 'views', title: 'The whole deck', body: 'Drag slides to reorder them. Grid shows every slide at once; Storyline reads the titles as the room will, and checks the argument.' },
  { id: 'share', title: 'Share it', body: 'A read-only link that stays up to date as the deck changes, or a PDF.' },
  { id: 'account', title: 'Connect an agent', body: 'An agent is an AI assistant, like Claude Code or Cursor, that can do work for you. Connect one, and it builds and edits your decks here by the same rules, while you watch.' },
]

export const SEEN_KEY = 'smartchart.tour'
export function seen(storage?: Pick<Storage, 'getItem'>): boolean {
  try { return (storage ?? localStorage).getItem(SEEN_KEY) === '1' } catch { return true }
}
export function markSeen(storage?: Pick<Storage, 'setItem'>): void {
  try { (storage ?? localStorage).setItem(SEEN_KEY, '1') } catch { /* storage blocked: the nudge may show again */ }
}

interface Box { top: number; left: number; width: number; height: number }
const GAP = 12, EDGE = 16

/** Where the card goes: below the target, or above it when there is no room below, kept inside the viewport.
    No target: the centre. */
export function place(target: Box | null, card: { width: number; height: number }, view: { width: number; height: number }): { top: number; left: number; side: 'below' | 'above' | 'center' } {
  const clampX = (x: number) => Math.max(EDGE, Math.min(x, view.width - card.width - EDGE))
  const clampY = (y: number) => Math.max(EDGE, Math.min(y, view.height - card.height - EDGE))
  if (!target) return { top: clampY((view.height - card.height) / 2), left: clampX((view.width - card.width) / 2), side: 'center' }
  const left = clampX(target.left + target.width / 2 - card.width / 2)
  const below = target.top + target.height + GAP
  if (below + card.height <= view.height - EDGE) return { top: below, left, side: 'below' }
  const above = target.top - GAP - card.height
  if (above >= EDGE) return { top: above, left, side: 'above' }
  // A target as tall as the screen (the chat): beside it, else over its lower part.
  const right = target.left + target.width + GAP
  if (right + card.width <= view.width - EDGE) return { top: clampY(target.top + target.height / 2 - card.height / 2), left: right, side: 'below' }
  return { top: clampY(view.height - card.height - EDGE), left, side: 'below' }
}
