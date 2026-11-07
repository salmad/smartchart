/* Visits from Occam's emails arrive at /em/<email>/<rest>. Before the app routes, the address becomes /<rest>, and the
   original path is sent to Vercel Web Analytics as its own page view, so Pages shows visits per email (/em/1-connect…).
   Path-based like the shorts' /ig/<slug>, since UTM breakdowns need a paid plan. */
export function takeEmailEntry(): string | null {
  const m = /^\/em\/([\w-]+)(\/.*)?$/.exec(location.pathname)
  if (!m) return null
  history.replaceState(history.state, '', (m[2] ?? '/') + location.search + location.hash)
  return `/em/${m[1]}`
}
