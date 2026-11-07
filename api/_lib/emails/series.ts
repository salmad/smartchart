// Which engagement email a maker gets next (FUTURE #31). Pure: the cron gives it the facts, it gives back one decision.
import type { EmailKey } from './templates.js'

/** What the maker has done, read from the database on the day. */
export interface Facts {
  /** Has an agent key, or an agent has written to one of their decks. */
  connected: boolean
  /** Distinct slide templates across their decks. */
  templates: number
  docs: number
}

export interface Done { slot: number; at: Date; sent: boolean }

/** Seven slots in order. `gap` is the days to wait after the previous email that was sent: the series follows the
    maker's stage, not the calendar, so a slot they don't need is skipped and the next one moves up. */
export const SLOTS: { slot: number; gap: number }[] = [
  { slot: 1, gap: 0 }, { slot: 2, gap: 2 }, { slot: 3, gap: 2 }, { slot: 4, gap: 2 }, { slot: 5, gap: 2 }, { slot: 6, gap: 3 }, { slot: 7, gap: 3 },
]

const DAY = 86_400_000

/** The email a slot sends for these facts, or null when the maker has already done what it asks. */
export function emailFor(slot: number, f: Facts): EmailKey | null {
  switch (slot) {
    case 1: return f.connected ? null : '1-connect'
    case 2: return '2-line'
    case 3: return f.templates >= 3 ? null : '3-templates'
    case 4: return f.connected ? '4b-so-what' : '4-connect-again'
    case 5: return '5-cagr'
    case 6: return f.docs > 0 ? null : '6-docs'
    case 7: return '7-partner'
    default: return null
  }
}

export type Decision =
  | { kind: 'send'; slot: number; key: EmailKey; skipped: number[] }
  | { kind: 'wait'; skipped: number[] }
  | { kind: 'done' }

/** The next step for one maker: slots they don't need are skipped, then the first one they do is sent once its gap
    since the last email has passed (at once if nothing has been sent yet). Whole UTC days, so a 9:00 run counts days.
    `started` keeps a maker out until their start day. */
export function decide(started: Date, now: Date, done: Done[], f: Facts): Decision {
  if (utcDay(now) < utcDay(started)) return { kind: 'wait', skipped: [] }
  const handled = new Set(done.map((d) => d.slot))
  const lastSent = done.filter((d) => d.sent).reduce<number | null>((m, d) => Math.max(m ?? 0, utcDay(d.at)), null)
  const skipped: number[] = []
  for (const { slot, gap } of SLOTS) {
    if (handled.has(slot)) continue
    const key = emailFor(slot, f)
    if (!key) { skipped.push(slot); continue }
    if (lastSent !== null && (utcDay(now) - lastSent) / DAY < gap) return { kind: 'wait', skipped }
    return { kind: 'send', slot, key, skipped }
  }
  return skipped.length ? { kind: 'wait', skipped } : { kind: 'done' }
}

const utcDay = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
