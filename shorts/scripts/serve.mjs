/* Serve out/ to YouTube Studio in the browser panel, which can't attach local files: the page fetches the render from
   here and hands it to its own upload input. CORS and Private Network Access headers let an https page read it.

     npm run serve      (keep it running in the background while uploading, stop it after) */
import { createReadStream, statSync } from 'node:fs'
import { createServer } from 'node:http'
import path from 'node:path'
import { ROOT } from './lib.mjs'

const PORT = 8765, out = path.join(ROOT, 'out')
createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Private-Network', 'true')
  res.setHeader('Access-Control-Allow-Headers', '*')
  if (req.method === 'OPTIONS') return res.end()
  const file = path.join(out, decodeURIComponent(req.url.split('?')[0]))
  if (!file.startsWith(out + path.sep)) return res.writeHead(403).end()
  const stat = statSync(file, { throwIfNoEntry: false })
  if (!stat?.isFile()) return res.writeHead(404).end()
  res.writeHead(200, { 'Content-Type': 'video/mp4', 'Content-Length': stat.size })
  createReadStream(file).on('error', () => res.destroy()).pipe(res)
}).listen(PORT, '127.0.0.1', () => console.log(`serving out/ on http://127.0.0.1:${PORT}`))
