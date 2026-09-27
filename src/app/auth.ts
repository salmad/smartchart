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

let current: SessionState = undefined
const listeners = new Set<() => void>()
const publish = (s: SessionState) => { current = s; listeners.forEach((fn) => fn()) }

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
    const u = r.ok ? ((await r.json()) as SessionBody | null)?.user : undefined
    publish(u?.id ? { id: u.id, email: u.email ?? '', name: u.name ?? '', image: u.image ?? null } : null)
  } catch { publish(null) }
  return current
}

export function useSession(): SessionState {
  return useSyncExternalStore((fn) => {
    listeners.add(fn)
    if (current === undefined && listeners.size === 1) void refreshSession()
    return () => { listeners.delete(fn) }
  }, () => current)
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
  publish(null)
}

function message(e: { message?: string; status?: number }): string {
  if (e.status === 503) return 'Accounts aren’t set up on this server yet.'
  if (e.status === 429) return 'Too many tries. Wait a minute and try again.'
  return e.message || 'That didn’t work. Try again.'
}
