/* window.__journey: the prototype's debug contract, read by the agent harness and the browser tests. */
import type { Slide, Style } from '@/engine/types'
import type { Item } from './store'
import type { TurnRecord } from './turn'

export interface JourneyDebug {
  live: boolean; items: Item[]; current: number; turns: TurnRecord[]
  send(text: string): Promise<TurnRecord | undefined>; setStyle(style: Style): void; load(slides: Slide[], style: Style): void
}

declare global {
  interface Window { __journey?: JourneyDebug }
}

/** Called from an effect on every render, so the fields are always current. */
export function installDebug(d: JourneyDebug): void {
  window.__journey = d
}
