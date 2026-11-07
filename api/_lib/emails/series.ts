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

/** Seven slots, by day since the maker started. Slot 4 is one of two emails. */
export const SLOTS: { slot: number; day: number }[] = [
  { slot: 1, day: 0 }, { slot: 2, day: 2 }, { slot: 3, day: 4 }, { slot: 4, day: 6 }, { slot: 5, day: 8 }, { slot: 6, day: 11 }, { slot: 7, day: 14 },
]

/** At most one email every two days, whatever the schedule says. */
export const GAP_DAYS = 2
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

/** The next step for one maker: slots already due but not wanted are skipped, then the first wanted one is sent,
    unless an email went out less than GAP_DAYS ago. Calendar days in UTC, so a 9:00 run counts whole days. */
export function decide(started: Date, now: Date, done: Done[], f: Facts): Decision {
  const days = Math.floor((utcDay(now) - utcDay(started)) / DAY)
  const handled = new Set(done.map((d) => d.slot))
  const lastSent = done.filter((d) => d.sent).reduce<number | null>((m, d) => Math.max(m ?? 0, utcDay(d.at)), null)
  const skipped: number[] = []
  for (const { slot, day } of SLOTS) {
    if (handled.has(slot)) continue
    if (day > days) return { kind: 'wait', skipped }
    const key = emailFor(slot, f)
    if (!key) { skipped.push(slot); continue }
    if (lastSent !== null && (utcDay(now) - lastSent) / DAY < GAP_DAYS) return { kind: 'wait', skipped }
    return { kind: 'send', slot, key, skipped }
  }
  return skipped.length ? { kind: 'wait', skipped } : { kind: 'done' }
}

const utcDay = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
