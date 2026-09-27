import { afterEach, test, expect, vi } from 'vitest'

const USER = { user: { id: 'u1', email: 'a@b.co', name: 'A', image: null }, session: { id: 's1' } }

/** A browser back from Google: the URL carries Neon's one-time verifier, which works for the first call only. */
function backFromGoogle() {
  let href = 'http://localhost:5173/d/abc?neon_auth_session_verifier=v1'
  const calls: string[] = []
  let used = false, cookie = false
  vi.stubGlobal('location', { get href() { return href } })
  vi.stubGlobal('history', { state: null, replaceState: (_s: unknown, _t: string, url: string) => { href = url } })
  vi.stubGlobal('fetch', async (input: string) => {
    calls.push(input)
    await new Promise((r) => setTimeout(r, 5))
    if (input.includes('verifier')) {
      if (used) return Response.json({ code: 'INVALID_VERIFIER' }, { status: 400 })
      used = true; cookie = true
      return Response.json(USER)
    }
    return Response.json(cookie ? USER : null)
  })
  return { calls, href: () => href }
}

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules() })

test('the verifier is sent once even when the session is checked twice at once (StrictMode)', async () => {
  const b = backFromGoogle()
  const { refreshSession } = await import('@/app/auth')
  const [a, c] = await Promise.all([refreshSession(), refreshSession()])
  expect(b.calls.filter((u) => u.includes('verifier'))).toHaveLength(1)
  expect(a?.id).toBe('u1')
  expect(c?.id).toBe('u1')
  expect(b.href()).toBe('http://localhost:5173/d/abc')
})

test('a verifier that no longer works falls back to the session cookie', async () => {
  const b = backFromGoogle()
  const { refreshSession } = await import('@/app/auth')
  await refreshSession()
  // Back on the same URL (reload before the verifier was stripped): the verifier fails, the cookie still signs in.
  vi.stubGlobal('location', { href: 'http://localhost:5173/d/abc?neon_auth_session_verifier=v1' })
  expect((await refreshSession())?.id).toBe('u1')
  expect(b.calls.at(-1)).toBe('/api/auth/get-session')
})
