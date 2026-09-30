import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import type { Plugin } from 'vite'
import { loadEnv } from 'vite'
import type { IncomingMessage, ServerResponse } from 'node:http'

type Handler = (r: Request) => Promise<Response> | Response
type Method = 'GET' | 'POST' | 'PUT' | 'DELETE'
type Module = Partial<Record<Method, Handler>>

/** Vercel's rewrites that point into /api: the paths each one matches, and where it sends them.
    Only `/:name*` sources are translated (all vercel.json has today); another path-to-regexp form needs this extended. */
function apiRewrites(root: string): { match: RegExp; to: string }[] {
  const { rewrites = [] } = JSON.parse(readFileSync(path.join(root, 'vercel.json'), 'utf8')) as { rewrites?: { source: string; destination: string }[] }
  return rewrites.filter((r) => r.destination.startsWith('/api/'))
    .map((r) => ({ match: new RegExp(`^${r.source.replace(/\/:\w+\*/g, '(?:\\/.*)?')}$`), to: r.destination }))
}

/** The api/ file that serves a request path, the way Vercel resolves it: a rewrite first, then api/<path>.ts.
    Folders and files starting with _ are private, as on Vercel. */
export function routeFor(pathname: string, root = process.cwd()): string | undefined {
  const target = apiRewrites(root).find((r) => r.match.test(pathname))?.to ?? pathname
  if (!target.startsWith('/api/')) return undefined
  const parts = target.slice('/api/'.length).split('/')
  if (parts.some((s) => s === '' || s === '..' || s.startsWith('_'))) return undefined
  const file = path.join(root, 'api', `${parts.join('/')}.ts`)
  return existsSync(file) ? file : undefined
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
  r.headers.forEach((v, k) => { if (k !== 'set-cookie') res.setHeader(k, v) })
  // Auth answers with several cookies; setHeader per value would keep only the last.
  const cookies = r.headers.getSetCookie()
  if (cookies.length) res.setHeader('set-cookie', cookies)
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
        const pathname = (req.url ?? '').split('?')[0]
        const file = routeFor(pathname)
        // An /api path with no function is a 404, as on Vercel, never source code or the app's page.
        if (!file) return pathname.startsWith('/api/') ? send(res, Response.json({ error: 'not found' }, { status: 404 })) : next()
        if (pathname.startsWith('/api/glm') || pathname.startsWith('/api/jev')) if (++calls > cap) return send(res, Response.json({ error: `call cap of ${cap} reached; restart the dev server` }, { status: 429 }))
        // A handler that throws (upstream unreachable) answers 502 instead of leaving the request hanging.
        try {
          const handler = ((await server.ssrLoadModule(file)) as Module)[(req.method ?? 'GET') as Method]
          if (!handler) return send(res, Response.json({ error: 'method not allowed' }, { status: 405 }))
          await send(res, await handler(toWebRequest(req, await readBody(req))))
        } catch (e) {
          await send(res, Response.json({ error: `dev api: ${e instanceof Error ? e.message : String(e)}` }, { status: 502 }))
        }
      })
    },
  }
}
