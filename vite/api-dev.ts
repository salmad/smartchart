import type { Plugin } from 'vite'
import { loadEnv } from 'vite'
import type { IncomingMessage, ServerResponse } from 'node:http'

type Handler = (r: Request) => Promise<Response> | Response
const ROUTES: Record<string, { method: 'GET' | 'POST'; load: () => Promise<Handler> }> = {
  '/api/glm': { method: 'POST', load: async () => (await import('../api/glm')).POST },
  '/api/jev': { method: 'POST', load: async () => (await import('../api/jev')).POST },
  '/api/health': { method: 'GET', load: async () => (await import('../api/health')).GET },
}

export function toWebRequest(req: IncomingMessage, body: Buffer): Request {
  const headers = new Headers()
  for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v)
  const url = `http://${req.headers.host ?? 'localhost'}${req.url ?? '/'}`
  return new Request(url, { method: req.method, headers, body: req.method === 'GET' ? undefined : new Uint8Array(body) })
}

const readBody = (req: IncomingMessage) => new Promise<Buffer>((ok, fail) => {
  const parts: Buffer[] = []
  req.on('data', (c: Buffer) => parts.push(c)).on('end', () => ok(Buffer.concat(parts))).on('error', fail)
})

async function send(res: ServerResponse, r: Response) {
  res.statusCode = r.status
  r.headers.forEach((v, k) => res.setHeader(k, v))
  res.end(Buffer.from(await r.arrayBuffer()))
}

/** Dev only: serves api/*.ts like Vercel does, with a per-run call cap as a local spend guard. */
export function apiDev(opts: { cap?: number } = {}): Plugin {
  let calls = 0
  return {
    name: 'api-dev',
    apply: 'serve',
    configureServer(server) {
      Object.assign(process.env, loadEnv(server.config.mode, process.cwd(), ''))
      const cap = opts.cap ?? (Number(process.env.CALL_CAP) || 2000)
      server.middlewares.use(async (req, res, next) => {
        const path = (req.url ?? '').split('?')[0]
        const route = ROUTES[path]
        if (!route) return next()
        if (req.method !== route.method) return send(res, Response.json({ error: 'method not allowed' }, { status: 405 }))
        if (route.method === 'POST' && ++calls > cap) return send(res, Response.json({ error: `call cap of ${cap} reached; restart the dev server` }, { status: 429 }))
        // A handler that throws (upstream unreachable) answers 502 instead of leaving the request hanging.
        try {
          const handler = await route.load()
          await send(res, await handler(toWebRequest(req, await readBody(req))))
        } catch (e) {
          await send(res, Response.json({ error: `dev api: ${e instanceof Error ? e.message : String(e)}` }, { status: 502 }))
        }
      })
    },
  }
}
