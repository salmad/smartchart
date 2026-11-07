/* Visits from Occam's emails arrive at /em/<email>/<rest>?r=<ref>. Before the app routes, the address becomes /<rest>
   (the ref dropped), and the original path is sent to Vercel Web Analytics as its own page view, so Pages shows visits
   per email (/em/1-connect…). Path-based like the shorts' /ig/<slug>, since UTM breakdowns need a paid plan.
   /em/<email>/watch/<id> is a short video: counted the same way, then forwarded to it.
   The click is also posted to /api/email-click with the ref, so it is recorded against the person (or, without a ref,
   against whoever is signed in). */
export interface EmailEntry { path: string; email: string; video: string | null }

export function takeEmailEntry(): EmailEntry | null {
  const m = /^\/em\/([\w-]+)(\/.*)?$/.exec(location.pathname)
  if (!m) return null
  const email = m[1], rest = m[2] ?? '/', video = /^\/watch\/([\w-]+)$/.exec(rest)?.[1] ?? null
  const params = new URLSearchParams(location.search), ref = params.get('r') ?? ''
  params.delete('r')
  const search = params.size ? `?${params}` : ''
  // A video page stays at /em/<email>, which analytics counts on its own; anything else moves on to its page.
  history.replaceState(history.state, '', video ? `/em/${email}` : rest + search + location.hash)
  void fetch('/api/email-click', { method: 'POST', keepalive: true, credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, r: ref }) }).catch(() => {})
  return { path: `/em/${email}`, email, video }
}
