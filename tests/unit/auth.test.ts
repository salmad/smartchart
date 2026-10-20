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

/* The cached account: the signed-in shell paints from it, and the real check still runs and has the last word. */
const CACHE = 'occam.account.v1'
const A = { id: 'u1', email: 'a@b.co', name: 'A', image: null }
const B = { id: 'u2', email: 'b@b.co', name: 'B', image: null }

function storage(initial?: string | (() => never)) {
  const map = new Map<string, string>()
  if (typeof initial === 'string') map.set(CACHE, initial)
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => { if (typeof initial === 'function') initial(); return map.get(k) ?? null },
    setItem: (k: string, v: string) => { if (typeof initial === 'function') initial(); map.set(k, v) },
    removeItem: (k: string) => { map.delete(k) },
  })
  return map
}
const answer = (status: number, body: unknown) => vi.stubGlobal('fetch', async () => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }))
const settle = (ms = 20) => new Promise((r) => setTimeout(r, ms))
const noLocation = () => { vi.stubGlobal('location', { href: 'http://localhost:5173/' }); vi.stubGlobal('history', { state: null, replaceState: () => undefined }) }

test('the first snapshot is the cached account, and subscribing still runs the real check once (StrictMode too)', async () => {
  storage(JSON.stringify(A)); noLocation()
  let calls = 0
  vi.stubGlobal('fetch', async () => { calls++; return Response.json({ user: A }) })
  const { sessionSnapshot, subscribeSession } = await import('@/app/auth')
  expect(sessionSnapshot()).toEqual(A)
  const off1 = subscribeSession(() => undefined), off2 = subscribeSession(() => undefined)
  await settle()
  expect(calls).toBe(1)
  off1(); off2()
})

test('a confirmed session keeps the same account object, so nothing re-renders', async () => {
  storage(JSON.stringify(A)); noLocation(); answer(200, { user: A })
  const { sessionSnapshot, subscribeSession } = await import('@/app/auth')
  const before = sessionSnapshot(); let woken = 0
  subscribeSession(() => { woken++ }); await settle()
  expect(sessionSnapshot()).toBe(before)
  expect(woken).toBe(0)
})

test('a confirmed session writes the cache', async () => {
  const map = storage(); noLocation(); answer(200, { user: A })
  const { refreshSession } = await import('@/app/auth')
  await refreshSession()
  expect(JSON.parse(map.get(CACHE) ?? 'null')).toEqual(A)
})

test.each([[200, null], [401, { error: 'no' }]])('a signed-out answer (%i) clears the cache and signs out', async (status, body) => {
  const map = storage(JSON.stringify(A)); noLocation(); answer(status, body)
  const { refreshSession } = await import('@/app/auth')
  expect(await refreshSession()).toBeNull()
  expect(map.has(CACHE)).toBe(false)
})

test('a different user replaces the cached one', async () => {
  const map = storage(JSON.stringify(A)); noLocation(); answer(200, { user: B })
  const { refreshSession } = await import('@/app/auth')
  expect((await refreshSession())?.id).toBe('u2')
  expect(JSON.parse(map.get(CACHE) ?? 'null').id).toBe('u2')
})

test('a thrown fetch or a 500 keeps the cached account', async () => {
  const map = storage(JSON.stringify(A)); noLocation()
  vi.stubGlobal('fetch', async () => { throw new Error('offline') })
  const { refreshSession } = await import('@/app/auth')
  expect((await refreshSession())?.id).toBe('u1')
  answer(500, {})
  expect((await refreshSession())?.id).toBe('u1')
  expect(map.has(CACHE)).toBe(true)
})

test('with no cache, a thrown fetch still ends in signed out', async () => {
  storage(); noLocation()
  vi.stubGlobal('fetch', async () => { throw new Error('offline') })
  const { refreshSession } = await import('@/app/auth')
  expect(await refreshSession()).toBeNull()
})

test.each([['corrupt JSON', '{nope'], ['a non-object', '"x"'], ['an object without an id', '{"email":"a"}']])('%s reads as no cache', async (_n, raw) => {
  storage(raw); noLocation()
  const { sessionSnapshot } = await import('@/app/auth')
  expect(sessionSnapshot()).toBeUndefined()
})

test('storage that throws reads as no cache and does not break the check', async () => {
  storage(() => { throw new Error('blocked') }); noLocation(); answer(200, { user: A })
  const { sessionSnapshot, refreshSession } = await import('@/app/auth')
  expect(sessionSnapshot()).toBeUndefined()
  expect((await refreshSession())?.id).toBe('u1')
})

test('signing out clears the cache', async () => {
  const map = storage(JSON.stringify(A)); noLocation()
  vi.stubGlobal('fetch', async () => Response.json(null))
  vi.doMock('@neondatabase/auth', () => ({ createAuthClient: () => ({ signOut: async () => undefined }) }))
  vi.doMock('@neondatabase/auth/vanilla/adapters', () => ({ BetterAuthVanillaAdapter: () => ({}) }))
  const { signOut } = await import('@/app/auth')
  await signOut()
  expect(map.has(CACHE)).toBe(false)
})

test('signing out also forgets the account’s cached lists', async () => {
  storage(JSON.stringify(A)); noLocation()
  vi.stubGlobal('fetch', async () => Response.json(null))
  vi.doMock('@neondatabase/auth', () => ({ createAuthClient: () => ({ signOut: async () => undefined }) }))
  vi.doMock('@neondatabase/auth/vanilla/adapters', () => ({ BetterAuthVanillaAdapter: () => ({}) }))
  const { cacheGet, cacheSet } = await import('@/app/cache')
  await cacheSet(A.id, 'workspaces', [{ id: 'w' }]); await cacheSet('someone-else', 'workspaces', [{ id: 'x' }])
  const { signOut } = await import('@/app/auth')
  await signOut()
  expect(await cacheGet(A.id, 'workspaces')).toBeUndefined()
  expect(await cacheGet('someone-else', 'workspaces')).toEqual([{ id: 'x' }])
})
