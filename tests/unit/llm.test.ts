import { test, expect, vi, afterEach } from 'vitest'
import { agentStep } from '@/engine/agent/llm'

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers() })

test('a non-JSON server error becomes a plain error, not a JSON parse message', async () => {
  vi.useFakeTimers()
  vi.stubGlobal('fetch', vi.fn(async () => new Response('A server error has occurred', { status: 500 })))
  const p = agentStep({ messages: [{ role: 'user', content: 'hi' }] }).catch((e: unknown) => e)
  await vi.runAllTimersAsync()
  const e = await p
  expect(e).toBeInstanceOf(Error)
  expect((e as Error).message).toBe('The model service is not responding (HTTP 500).')
})

test('model calls carry a timeout signal', async () => {
  const fetch = vi.fn(async (_url: string, _init?: RequestInit) => Response.json({ choices: [{ message: { content: 'ok' } }] }))
  vi.stubGlobal('fetch', fetch)
  await agentStep({ messages: [{ role: 'user', content: 'hi' }] })
  const init = fetch.mock.calls[0]?.[1]
  expect(init?.signal).toBeInstanceOf(AbortSignal)
})

test('a caller over the daily limit, or signed out, is not retried (each retry would count as a call)', async () => {
  for (const code of ['limit', 'signin']) {
    const fetch = vi.fn(async (_url: string, _init?: RequestInit) => Response.json({ error: `no (${code})`, code }, { status: code === 'limit' ? 429 : 401 }))
    vi.stubGlobal('fetch', fetch)
    await expect(agentStep({ messages: [{ role: 'user', content: 'hi' }] })).rejects.toThrow(`no (${code})`)
    expect(fetch).toHaveBeenCalledTimes(1)
  }
})
