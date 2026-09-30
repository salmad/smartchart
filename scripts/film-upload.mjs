/* Publish a cut of the landing film to Vercel Blob, where the site reads it (src/app/components/landing/Film.tsx).

     npm run film:upload -- <master.mp4> [--poster <seconds>] [--captions <file.vtt>]

   From the master it encodes the web versions (1080p, and 720p for phones) and a poster frame, then uploads them, and the
   captions if given, under fixed names. The names never change, so a new cut needs no code change and no deploy: browsers
   and the CDN pick it up within CACHE seconds. Needs ffmpeg, and BLOB_READ_WRITE_TOKEN in .env. */
import { put } from '@vercel/blob'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

const CACHE = 600
const [master, ...rest] = process.argv.slice(2)
const opt = (name) => { const i = rest.indexOf(name); return i < 0 ? undefined : rest[i + 1] }
if (!master) { console.error('usage: npm run film:upload -- <master.mp4> [--poster <seconds>] [--captions <file.vtt>]'); process.exit(1) }

const env = Object.fromEntries(readFileSync(new URL('../.env', import.meta.url), 'utf8').split('\n')
  .map((l) => /^([A-Z_]+)=(.*)$/.exec(l)).filter(Boolean).map(([, k, v]) => [k, v.replace(/^"|"$/g, '')]))
const token = process.env.BLOB_READ_WRITE_TOKEN ?? env.BLOB_READ_WRITE_TOKEN
if (!token) { console.error('BLOB_READ_WRITE_TOKEN is not set'); process.exit(1) }

const dir = mkdtempSync(path.join(tmpdir(), 'film-'))
const ff = (...args) => execFileSync('ffmpeg', ['-y', '-v', 'error', ...args], { stdio: 'inherit' })
const web = ['-c:v', 'libx264', '-preset', 'slow', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-c:a', 'aac']
ff('-i', master, ...web, '-crf', '26', '-b:a', '128k', `${dir}/occam-1080.mp4`)
ff('-i', master, '-vf', 'scale=1280:-2', ...web, '-crf', '25', '-b:a', '112k', `${dir}/occam-720.mp4`)
ff('-ss', opt('--poster') ?? '0', '-i', master, '-frames:v', '1', '-q:v', '3', `${dir}/occam-poster.jpg`)

const files = [['occam-1080.mp4', 'video/mp4'], ['occam-720.mp4', 'video/mp4'], ['occam-poster.jpg', 'image/jpeg']]
  .map(([name, type]) => [`${dir}/${name}`, name, type])
if (opt('--captions')) files.push([opt('--captions'), 'occam-en.vtt', 'text/vtt'])

for (const [file, name, contentType] of files) {
  const { url } = await put(`film/${name}`, readFileSync(file), { access: 'public', token, contentType,
    addRandomSuffix: false, allowOverwrite: true, cacheControlMaxAge: CACHE })
  console.log(url)
}
rmSync(dir, { recursive: true, force: true })
