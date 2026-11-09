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
