import { test, expect, vi, afterEach } from 'vitest'
import { POST as glm } from '../../api/glm'
import { POST as jev } from '../../api/jev'

afterEach(() => vi.unstubAllGlobals())
const req = (body: unknown) => new Request('http://x/api', { method: 'POST', body: JSON.stringify(body) })

test('an unreachable model service answers 502 with a JSON error, for GLM and Jev', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('fetch failed') }))
  for (const r of [await glm(req({ model: 'glm-5.3-flash', messages: [] })), await jev(req({ state: 's', questions: {} }))]) {
    expect(r.status).toBe(502)
    expect(await r.json()).toEqual({ error: 'The model service is unreachable.' })
  }
})
test('upstream calls carry a timeout signal', async () => {
  const fetch = vi.fn(async (_url: string, _init?: RequestInit) => Response.json({}))
  vi.stubGlobal('fetch', fetch)
  await glm(req({ model: 'glm-5.3-flash', messages: [] }))
  expect(fetch.mock.calls[0]?.[1]?.signal).toBeInstanceOf(AbortSignal)
})
