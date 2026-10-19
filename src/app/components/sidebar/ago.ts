/** "just now", "5 min ago", "2 h ago", "yesterday", "3 days ago", then the date. */
export function ago(ms: number, now = Date.now()): string {
  const m = Math.round((now - ms) / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h} h ago`
  const d = Math.round(h / 24)
  if (d === 1) return 'yesterday'
  if (d < 7) return `${d} days ago`
  return new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: now - ms > 31536e6 ? 'numeric' : undefined })
}
