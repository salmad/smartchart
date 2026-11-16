import type { Sprint } from '@/engine/roadmaps/sprints'

/** "2 Nov", or "2 Nov 2027" outside today's year. Dates are ISO days (YYYY-MM-DD), read as UTC so no zone shifts them. */
export function shortDate(iso: string, today: string): string {
  const d = new Date(`${iso}T00:00:00Z`)
  const day = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
  return iso.slice(0, 4) === today.slice(0, 4) ? day : `${day} ${iso.slice(0, 4)}`
}

export const isoOf = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export const dateOf = (iso: string): Date => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export const todayIso = (): string => isoOf(new Date())

const dayNumber = (iso: string): number => Math.round(Date.parse(`${iso}T00:00:00Z`) / 86_400_000)

/** "Sprint 14 · 23 Nov – 6 Dec · 9 days left"; a sprint to come says when it starts, one that is over only its dates. */
export function sprintHeading(s: Sprint, today: string): string {
  const title = `Sprint ${s.n}`
  if (s.start > today) return `${title} · starts ${shortDate(s.start, today)}`
  const range = `${title} · ${shortDate(s.start, today)} – ${shortDate(s.end, today)}`
  if (s.end < today) return range
  const left = dayNumber(s.end) - dayNumber(today)
  return `${range} · ${left === 0 ? 'Last day' : `${left} ${left === 1 ? 'day' : 'days'} left`}`
}
