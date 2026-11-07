/* Visits from Occam's emails arrive at /em/<email>/<rest>. Before the app routes, the address becomes /<rest>, and the
   original path is sent to Vercel Web Analytics as its own page view, so Pages shows visits per email (/em/1-connect…).
   Path-based like the shorts' /ig/<slug>, since UTM breakdowns need a paid plan.
   /em/<email>/watch/<id> is a short video: counted the same way, then forwarded to it. */
export interface EmailEntry { path: string; video: string | null }

export function takeEmailEntry(): EmailEntry | null {
  const m = /^\/em\/([\w-]+)(\/.*)?$/.exec(location.pathname)
  if (!m) return null
  const rest = m[2] ?? '/', video = /^\/watch\/([\w-]+)$/.exec(rest)?.[1] ?? null
  // A video page stays at /em/<email>, which analytics counts on its own; anything else moves on to its page.
  history.replaceState(history.state, '', video ? `/em/${m[1]}` : rest + location.search + location.hash)
  return { path: `/em/${m[1]}`, video }
}
