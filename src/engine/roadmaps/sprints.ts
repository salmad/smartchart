import { isIsoDate } from './fields.js'
import type { SprintRhythm } from './types.js'

export const MAX_SPRINT_WEEKS = 8

export interface Sprint {
  n: number
  start: string
  /** The last day, inclusive. */
  end: string
}

const DAY = 86_400_000

const toDay = (iso: string): number => {
  const [y, m, d] = iso.split('-').map(Number)
  return Math.round(Date.UTC(y, m - 1, d) / DAY)
}
const fromDay = (day: number): string => new Date(day * DAY).toISOString().slice(0, 10)

export function checkRhythm(r: { start: string; weeks: number }): 'ok' | string {
  if (typeof r.start !== 'string' || !isIsoDate(r.start)) return 'Sprints start on a date, YYYY-MM-DD.'
  if (!Number.isInteger(r.weeks) || r.weeks < 1 || r.weeks > MAX_SPRINT_WEEKS) return `Sprints are 1 to ${MAX_SPRINT_WEEKS} weeks long.`
  return 'ok'
}

/** Sprint number `n` (from 1) of the rhythm. */
export function sprintAt(r: SprintRhythm, n: number): Sprint | null {
  if (!Number.isInteger(n) || n < 1) return null
  const len = r.weeks * 7
  const start = toDay(r.start) + (n - 1) * len
  return { n, start: fromDay(start), end: fromDay(start + len - 1) }
}

/** The sprint that contains `date`; null before the first day. */
export function sprintOf(r: SprintRhythm, date: string): Sprint | null {
  const offset = toDay(date) - toDay(r.start)
  if (offset < 0) return null
  return sprintAt(r, Math.floor(offset / (r.weeks * 7)) + 1)
}

export const currentSprint = (r: SprintRhythm, today: string): Sprint | null => sprintOf(r, today)

/** The sprint after the current one; Sprint 1 while the rhythm has not started. */
export function nextSprint(r: SprintRhythm, today: string): Sprint {
  const cur = currentSprint(r, today)
  return sprintAt(r, cur ? cur.n + 1 : 1) as Sprint
}

/** True when the sprint holding `date` finished before today. A date before the rhythm is in no sprint, so not ended. */
export function sprintEnded(r: SprintRhythm, date: string, today: string): boolean {
  const s = sprintOf(r, date)
  return s !== null && s.end < today
}

export const sprintLabel = (s: Sprint): string => `Sprint ${s.n}`

/** The sprints work can still be put in: the current one and the seven after it (Sprint 1 onwards before the rhythm starts). */
export function openSprints(r: SprintRhythm, today: string): Sprint[] {
  const first = currentSprint(r, today)?.n ?? 1
  return Array.from({ length: 8 }, (_, i) => sprintAt(r, first + i) as Sprint)
}

/** "Sprint 14" for the sprint holding `date` under this rhythm; empty when no sprint holds it. */
export function sprintName(r: SprintRhythm, date: string): string {
  const s = sprintOf(r, date)
  return s ? sprintLabel(s) : ''
}

export interface SprintChoice {
  /** The sprint's first day: what an issue stores. */
  id: string
  name: string
}

/** What a sprint picker offers: the current sprint, the next, and the six after it. */
export function sprintChoices(r: SprintRhythm, today: string): SprintChoice[] {
  const current = currentSprint(r, today)
  return openSprints(r, today).map((s, i) => {
    const tag = current ? (i === 0 ? ' · Current' : i === 1 ? ' · Next' : '') : (i === 0 ? ' · Next' : '')
    return { id: s.start, name: `${sprintLabel(s)}${tag}` }
  })
}
