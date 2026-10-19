/* Accounts in the browser: Neon Auth through /api/auth on this origin (first-party cookies).
   Continue with Google, or an emailed 6-digit code. The session is a cookie, so API calls need no token. */
import { useSyncExternalStore } from 'react'
import type { VanillaBetterAuthClient } from '@neondatabase/auth'

export interface Account { id: string; email: string; name: string; image: string | null }
/** `undefined` while the first session check runs; `null` when signed out. */
export type SessionState = Account | null | undefined

// The auth library is large (~400 kB): it loads only when someone signs in or out, not on every page.
let client: Promise<VanillaBetterAuthClient> | null = null
const auth = (): Promise<VanillaBetterAuthClient> => (client ??= Promise.all([import('@neondatabase/auth'), import('@neondatabase/auth/vanilla/adapters')])
  .then(([{ createAuthClient }, { BetterAuthVanillaAdapter }]) => createAuthClient(`${location.origin}/api/auth`, { adapter: BetterAuthVanillaAdapter() })))

const VERIFIER = 'neon_auth_session_verifier'

// The last account seen is kept in this browser so the signed-in app paints at once; the session check below
// still runs and has the last word. Storage can be blocked or hold junk: both read as no cache.
const CACHE = 'occam.account.v1'
function readCached(): Account | undefined {
  try {
    const a: unknown = JSON.parse(localStorage.getItem(CACHE) ?? 'null')
    if (a && typeof a === 'object' && 'id' in a && typeof a.id === 'string' && a.id) {
      const { id, email, name, image } = a as Partial<Account> & { id: string }
      return { id, email: typeof email === 'string' ? email : '', name: typeof name === 'string' ? name : '', image: typeof image === 'string' ? image : null }
    }
  } catch { /* blocked or corrupt */ }
  return undefined
}
function writeCached(a: Account | null) {
  try { if (a) localStorage.setItem(CACHE, JSON.stringify(a)); else localStorage.removeItem(CACHE) } catch { /* blocked or full */ }
}
const same = (a: SessionState, b: SessionState) => !!a && !!b && a.id === b.id && a.email === b.email && a.name === b.name && a.image === b.image

let current: SessionState = readCached()
// Whether the first check has been started: the cached account must not stand in for it.
let started = false
const listeners = new Set<() => void>()
const publish = (s: SessionState) => {
  if (same(current, s)) return
  current = s; listeners.forEach((fn) => fn())
}

interface SessionBody { user?: { id?: string; email?: string; name?: string | null; image?: string | null } }

const getSession = async (query = ''): Promise<Response> => fetch(`/api/auth/get-session${query}`, { credentials: 'same-origin' })

// One check at a time: calls made while one runs share its answer.
let checking: Promise<SessionState> | null = null

/** Asks the server who is signed in; safe to call again after signing in or out. */
export function refreshSession(): Promise<SessionState> {
  return (checking ??= check().finally(() => { checking = null }))
}

async function check(): Promise<SessionState> {
  // A plain request: Better Auth's get-session answers { user, session }, or null when signed out.
  // Back from Google, the URL carries a one-time verifier; get-session must pass it on to create the session.
  // It works once, so it leaves the URL before the request; if it fails anyway, the session cookie decides.
  try {
    const here = new URL(location.href), verifier = here.searchParams.get(VERIFIER)
    if (verifier) { here.searchParams.delete(VERIFIER); history.replaceState(history.state, '', here.href) }
    let r = await getSession(verifier ? `?${VERIFIER}=${encodeURIComponent(verifier)}` : '')
    if (!r.ok && verifier) r = await getSession()
    // Only a definite answer changes who is signed in; a server error or a dropped connection keeps what is shown.
    if (!r.ok && r.status !== 401) { if (current === undefined) publish(null); return current }
    const u = r.ok ? ((await r.json()) as SessionBody | null)?.user : undefined
    const account = u?.id ? { id: u.id, email: u.email ?? '', name: u.name ?? '', image: u.image ?? null } : null
    writeCached(account)
    publish(account)
  } catch { if (current === undefined) publish(null) }
  return current
}

export const sessionSnapshot = (): SessionState => current

export function subscribeSession(fn: () => void): () => void {
  listeners.add(fn)
  if (!started) { started = true; void refreshSession() }
  return () => { listeners.delete(fn) }
}

export function useSession(): SessionState {
  return useSyncExternalStore(subscribeSession, sessionSnapshot)
}

/** Leaves for Google and comes back to `returnTo` (a path on this site). */
export async function signInWithGoogle(returnTo: string): Promise<string | null> {
  const { error } = await (await auth()).signIn.social({ provider: 'google', callbackURL: `${location.origin}${returnTo}` })
  return error ? message(error) : null
}

export async function sendCode(email: string): Promise<string | null> {
  const { error } = await (await auth()).emailOtp.sendVerificationOtp({ email, type: 'sign-in' })
  return error ? message(error) : null
}

export async function verifyCode(email: string, otp: string): Promise<string | null> {
  const { error } = await (await auth()).signIn.emailOtp({ email, otp })
  if (error) return message(error)
  await refreshSession()
  return null
}

export async function signOut() {
  await (await auth()).signOut().catch(() => undefined)
  writeCached(null)
  publish(null)
}

function message(e: { message?: string; status?: number }): string {
  if (e.status === 503) return 'Accounts aren’t set up on this server yet.'
  if (e.status === 429) return 'Too many tries. Wait a minute and try again.'
  return e.message || 'That didn’t work. Try again.'
}
