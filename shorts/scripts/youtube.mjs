/* YouTube through Composio. The channel's token stays with Composio; the key is composio_api_key in the repo .env.
   Composio's managed connection shares one Google project's daily upload cap across all its customers, so `publish`
   can fail with "Video Uploads per day" through no use of ours; then upload in Studio (create-shorts skill, step 5).
   `stats` and `privacy` cost almost nothing and usually work.

     npm run youtube -- connect                          once: link the channel (opens Google's consent page)
     npm run youtube -- publish <slug> [--public|--private]   default unlisted
     npm run youtube -- privacy <slug> public|unlisted|private
     npm run youtube -- stats <slug>

   publish refuses a video that fails `npm run check`, takes Title, Description and Hashtags from notes.md, and records
   the upload in out/<slug>/youtube.json and a row in ledger.md. A vertical file under 3 minutes is a Short; there is
   no Shorts flag. */
import { Composio } from '@composio/core'
import { execFileSync, spawn } from 'node:child_process'
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { ROOT, die, duration, episode, getEnv } from './lib.mjs'

const USER = 'occam-shorts', EDUCATION = '27'
const apiKey = getEnv('COMPOSIO_API_KEY')
if (!apiKey) die('composio_api_key is not set in the repo .env')
const composio = new Composio({ apiKey, dangerouslyAllowAutoUploadDownloadFiles: true, fileUploadDirs: [path.join(ROOT, 'out')] })

async function run(action, args) {
  const r = await composio.tools.execute(action, { userId: USER, arguments: args, dangerouslySkipVersionCheck: true })
  if (!r.successful) die(`${action} failed: ${typeof r.error === 'string' ? r.error : JSON.stringify(r.error)}`)
  return typeof r.data === 'string' ? JSON.parse(r.data) : r.data
}

/** The first value under `key` anywhere in a response; Composio wraps the YouTube payload differently per action. */
function find(obj, key) {
  if (!obj || typeof obj !== 'object') return undefined
  if (key in obj && obj[key] !== undefined) return obj[key]
  for (const v of Object.values(obj)) { const f = find(v, key); if (f !== undefined) return f }
}

async function channel() {
  const data = await run('YOUTUBE_LIST_CHANNELS', { mine: true, part: 'snippet,statistics' })
  const item = find(data, 'items')?.[0]
  return item ? `${item.snippet?.title} (${item.snippet?.customUrl ?? item.id}, ${item.statistics?.subscriberCount ?? '?'} subscribers)` : 'unknown channel'
}

/** Title, Description (with its indented continuation lines) and Hashtags from the Post section of notes.md. */
function post(ep) {
  const notes = readFileSync(path.join(ep.dir, 'notes.md'), 'utf8')
  const field = (name) => {
    const m = new RegExp(`^- ${name}[^:]*:(.*(?:\\n {2,}\\S.*)*)`, 'm').exec(notes)
    return m ? m[1].split('\n').map((l) => l.trim()).filter(Boolean).join('\n').trim() : ''
  }
  const title = field('Title'), description = field('Description'), hashtags = field('Hashtags').match(/#\w+/g) ?? []
  if (!title || !description) die(`fill Title and Description in the Post section of ${path.relative(process.cwd(), ep.dir)}/notes.md`)
  if (title.length > 100) die(`title is ${title.length} characters; YouTube allows 100`)
  return { title, description: `${description}\n\n${hashtags.join(' ')}`, tags: hashtags.map((t) => t.slice(1)), format: field('Format') }
}

const record = (ep) => path.join(ep.out, 'youtube.json')
const uploaded = (ep) => existsSync(record(ep)) ? JSON.parse(readFileSync(record(ep), 'utf8')) : die(`not published yet: npm run youtube -- publish ${ep.slug}`)

const [cmd, slug, ...rest] = process.argv.slice(2)

if (cmd === 'connect') {
  const { items = [] } = await composio.connectedAccounts.list({ userIds: [USER], toolkitSlugs: ['youtube'], statuses: ['ACTIVE'] })
  if (!items.length) {
    const req = await composio.toolkits.authorize(USER, 'youtube')
    console.log(`Sign in with the Google account that owns the channel, and pick the channel:\n${req.redirectUrl}`)
    spawn('open', [req.redirectUrl], { stdio: 'ignore', detached: true }).unref()
    await req.waitForConnection(300_000)
  }
  console.log(`Connected: ${await channel()}`)
} else if (cmd === 'publish') {
  const ep = episode(slug)
  const privacy = rest.includes('--public') ? 'public' : rest.includes('--private') ? 'private' : 'unlisted'
  if (existsSync(record(ep)) && !rest.includes('--again')) die(`already published: ${uploaded(ep).url} (--again to upload a second copy)`)
  execFileSync('node', [path.join(ROOT, 'scripts', 'check.mjs'), 'video', ep.slug], { stdio: 'inherit' })
  const file = path.join(ep.out, `${ep.slug}.mp4`), meta = post(ep)
  console.log(`\nUploading to ${await channel()} as ${privacy}:\n  ${meta.title}`)
  const data = await run('YOUTUBE_UPLOAD_VIDEO', { title: meta.title, description: meta.description, tags: meta.tags, categoryId: EDUCATION, privacyStatus: privacy, videoFilePath: file })
  const id = find(data, 'id')
  if (typeof id !== 'string') die(`uploaded, but no video id in the response: ${JSON.stringify(data).slice(0, 400)}`)
  const url = `https://youtube.com/shorts/${id}`
  writeFileSync(record(ep), JSON.stringify({ id, url, privacy, title: meta.title, at: new Date().toISOString() }, null, 1))
  appendFileSync(path.join(ROOT, 'ledger.md'), `| ${new Date().toISOString().slice(0, 10)} | [${ep.slug}](${url}) | ${meta.format} | ${meta.title} | ${duration(file).toFixed(0)}s | | | | | | |\n`)
  console.log(`${url}\nCheck it in YouTube Studio: if it shows "Locked as private", uploads through this connection can't be public.`)
} else if (cmd === 'privacy') {
  const ep = episode(slug), to = rest[0]
  if (!['public', 'unlisted', 'private'].includes(to)) die('usage: npm run youtube -- privacy <slug> public|unlisted|private')
  const rec = uploaded(ep)
  await run('YOUTUBE_UPDATE_VIDEO', { video_id: rec.id, privacy_status: to })
  writeFileSync(record(ep), JSON.stringify({ ...rec, privacy: to }, null, 1))
  console.log(`${rec.url} is now ${to}`)
} else if (cmd === 'stats') {
  const rec = uploaded(episode(slug))
  const v = find(await run('YOUTUBE_GET_VIDEO_DETAILS_BATCH', { id: [rec.id], parts: ['statistics', 'status'] }), 'items')?.[0]
  if (!v) die(`no details for ${rec.url} yet (still processing?)`)
  const s = v.statistics ?? {}
  console.log(`${rec.url}  ${v.status?.privacyStatus} (${v.status?.uploadStatus})\nviews ${s.viewCount ?? 0} · likes ${s.likeCount ?? 0} · comments ${s.commentCount ?? 0}\n` +
    'Viewed vs swiped away and average % viewed are in YouTube Studio → the Short → Analytics.')
} else die('usage: npm run youtube -- connect | publish <slug> | privacy <slug> <status> | stats <slug>')
