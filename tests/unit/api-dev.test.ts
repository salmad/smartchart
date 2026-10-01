import { test, expect } from 'vitest'
import { Readable } from 'node:stream'
import type { IncomingMessage } from 'node:http'
import { routeFor, toWebRequest } from '../../vite/api-dev'

test('turns a node request into a web Request with body and headers', async () => {
  const req = Object.assign(Readable.from([]), { method: 'POST', url: '/api/glm', headers: { host: 'localhost:5173', 'content-type': 'application/json' } }) as unknown as IncomingMessage
  const r = toWebRequest(req, Buffer.from('{"model":"glm-5.3-flash"}'))
  expect(r.method).toBe('POST')
  expect(new URL(r.url).pathname).toBe('/api/glm')
  expect(await r.json()).toEqual({ model: 'glm-5.3-flash' })
})

test('the agent REST route resolves to api/v1.ts', () => {
  expect(routeFor('/api/v1/whoami')).toMatch(/api\/v1\.ts$/)
})
