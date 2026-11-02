/* Social scheduling through PostProxy (Instagram only by default). Key: postproxy_api_key in repo .env.
   TikTok and X are off unless POSTPROXY_EXTRA_PLATFORMS=tiktok,twitter (low site traffic). Disconnect those
   profiles in the PostProxy dashboard when pausing them.

     npm run postproxy -- profiles
     npm run postproxy -- schedule <slug>              Instagram Reel from instagram.json
     npm run postproxy -- schedule-all                 pending instagram.json only
     npm run postproxy -- cadence                      every 2 days, 5 PM Gulf on IG (reels 2–12)
     npm run postproxy -- cancel-secondary             delete scheduled TikTok/X posts in PostProxy + clear ids
     npm run postproxy -- schedule-tiktok <slug>       (needs POSTPROXY_EXTRA_PLATFORMS)
     … schedule-tiktok-all, sync-tiktok-dates, schedule-twitter*, publish-twitter*, sync-twitter-dates
     npm run postproxy -- update-copy [slug]          push regenerated captions/comments to scheduled posts
     npm run postproxy -- replace-media <slug>        swap a re-cut video onto its scheduled IG post */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { ROOT, die, episode, getEnv } from './lib.mjs'

const API = 'https://api.postproxy.dev/api'
const apiKey = getEnv('POSTPROXY_API_KEY') ?? getEnv('postproxy_api_key')
if (!apiKey) die('postproxy_api_key is not set in the repo .env')

/** Instagram Reels only unless POSTPROXY_EXTRA_PLATFORMS lists tiktok and/or twitter. */
const EXTRA_PLATFORMS = new Set(
  (getEnv('POSTPROXY_EXTRA_PLATFORMS') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
)
function extraEnabled(platform) {
  if (EXTRA_PLATFORMS.has(platform)) return true
  die(`${platform} is off — Instagram only (POSTPROXY_EXTRA_PLATFORMS to re-enable). Disconnect @occamstudio on TikTok/X in the PostProxy dashboard.`)
}

async function api(pathname, init = {}) {
  const r = await fetch(`${API}${pathname}`, {
    ...init,
    headers: { Authorization: `Bearer ${apiKey}`, ...init.headers },
  })
  const text = await r.text()
  let body
  try { body = text ? JSON.parse(text) : null } catch { body = text }
  if (!r.ok) die(`${pathname} ${r.status}: ${typeof body === 'string' ? body : JSON.stringify(body)}`)
  return body
}

async function instagramProfileId() {
  const override = getEnv('POSTPROXY_INSTAGRAM_PROFILE')
  if (override) return override
  const { data = [] } = await api('/profiles')
  const ig = data.find((p) => p.platform === 'instagram' && p.status === 'active')
  if (!ig) die('no active Instagram profile on PostProxy — connect @occamlabs in the PostProxy dashboard')
  return ig.id
}

async function twitterProfileId() {
  const override = getEnv('POSTPROXY_TWITTER_PROFILE')
  if (override) return override
  const { data = [] } = await api('/profiles')
  const tw = data.find((p) => p.platform === 'twitter' && p.status === 'active')
  if (!tw) die('no active X profile on PostProxy — connect @occamstudio in the PostProxy dashboard')
  return tw.id
}

async function tiktokProfileId() {
  const override = getEnv('POSTPROXY_TIKTOK_PROFILE')
  if (override) return override
  const { data = [] } = await api('/profiles')
  const tt = data.find((p) => p.platform === 'tiktok' && p.status === 'active')
  if (!tt) die('no active TikTok profile on PostProxy — connect @occamstudio in the PostProxy dashboard')
  return tt.id
}

function appendTikTokPost(fd, meta, { schedule = true } = {}) {
  fd.append('post[body]', meta.caption)
  if (schedule && meta.publishAt) fd.append('post[scheduled_at]', meta.publishAt)
  fd.append('platforms', JSON.stringify({
    tiktok: {
      format: 'video',
      privacy_status: 'PUBLIC_TO_EVERYONE',
      disable_comment: false,
      disable_duet: false,
      disable_stitch: false,
    },
  }))
}

function metaPath(ep, platform = 'instagram') {
  return path.join(ep.out, `${platform}.json`)
}

function loadMeta(ep, platform = 'instagram') {
  const file = metaPath(ep, platform)
  if (!existsSync(file)) die(`missing ${path.relative(ROOT, file)} — npm run social -- ${platform} ${ep.slug} --write`)
  return { file, ...JSON.parse(readFileSync(file, 'utf8')) }
}

async function scheduleSlug(slug, profileId) {
  const ep = episode(slug)
  const { file: _metaFile, ...meta } = loadMeta(ep)
  if (meta.postproxyId && !process.argv.includes('--again')) {
    console.log(`${slug}: already scheduled (${meta.postproxyId})`)
    return meta
  }
  if (meta.via && meta.via !== 'pending' && !process.argv.includes('--again')) {
    console.log(`${slug}: skipped (via ${meta.via})`)
    return meta
  }
  const video = meta.video ?? path.join(ep.out, `${ep.slug}.mp4`)
  if (!existsSync(video)) die(`no video at ${video}`)

  const fd = new FormData()
  fd.append('post[body]', meta.caption)
  if (meta.publishAt) fd.append('post[scheduled_at]', meta.publishAt)
  fd.append('profiles[]', profileId)
  fd.append('media[]', new Blob([readFileSync(video)], { type: 'video/mp4' }), path.basename(video))
  fd.append('platforms[instagram][format]', 'reel')
  if (meta.pinnedComment) fd.append('platforms[instagram][first_comment]', meta.pinnedComment)

  console.log(`\nScheduling ${slug} for ${meta.publishAt ?? 'now'} → @occamlabs`)
  const post = await api('/posts', { method: 'POST', body: fd })
  const updated = {
    ...meta,
    via: 'postproxy',
    postproxyId: post.id,
    scheduledAt: post.scheduled_at,
    video,
  }
  writeFileSync(metaPath(ep), JSON.stringify(updated, null, 2) + '\n')
  console.log(`  post ${post.id} · status ${post.status}`)
  return updated
}

async function scheduleTwitterSlug(slug, profileId) {
  const ep = episode(slug)
  const { file: _metaFile, ...meta } = loadMeta(ep, 'twitter')
  if (meta.postproxyId && !process.argv.includes('--again')) {
    console.log(`${slug}: already scheduled on X (${meta.postproxyId})`)
    return meta
  }
  const video = meta.video ?? path.join(ep.out, `${ep.slug}.mp4`)
  if (!existsSync(video)) die(`no video at ${video}`)

  const fd = new FormData()
  fd.append('post[body]', meta.text)
  if (meta.publishAt) fd.append('post[scheduled_at]', meta.publishAt)
  fd.append('profiles[]', profileId)
  fd.append('media[]', new Blob([readFileSync(video)], { type: 'video/mp4' }), path.basename(video))
  if (meta.linkReply) fd.append('thread[0][body]', meta.linkReply)

  console.log(`\nScheduling ${slug} on X for ${meta.publishAt ?? 'now'} → @occamstudio`)
  const post = await api('/posts', { method: 'POST', body: fd })
  const updated = {
    ...meta,
    via: 'postproxy',
    postproxyId: post.id,
    scheduledAt: post.scheduled_at,
    video,
  }
  writeFileSync(metaPath(ep, 'twitter'), JSON.stringify(updated, null, 2) + '\n')
  console.log(`  post ${post.id} · status ${post.status} · ${meta.text.length} chars`)
  return updated
}

async function scheduleTikTokSlug(slug, profileId) {
  const ep = episode(slug)
  const { file: _metaFile, ...meta } = loadMeta(ep, 'tiktok')
  if (meta.postproxyId && !process.argv.includes('--again')) {
    console.log(`${slug}: already scheduled on TikTok (${meta.postproxyId})`)
    return meta
  }
  const video = meta.video ?? path.join(ep.out, `${ep.slug}.mp4`)
  if (!existsSync(video)) die(`no video at ${video}`)

  const fd = new FormData()
  appendTikTokPost(fd, meta)
  fd.append('profiles[]', profileId)
  fd.append('media[]', new Blob([readFileSync(video)], { type: 'video/mp4' }), path.basename(video))

  console.log(`\nScheduling ${slug} on TikTok for ${meta.publishAt ?? 'now'} → @occamstudio`)
  const post = await api('/posts', { method: 'POST', body: fd })
  const updated = { ...meta, via: 'postproxy', postproxyId: post.id, scheduledAt: post.scheduled_at, video }
  writeFileSync(metaPath(ep, 'tiktok'), JSON.stringify(updated, null, 2) + '\n')
  console.log(`  post ${post.id} · status ${post.status}`)
  return updated
}

async function publishTikTokSlug(slug, profileId) {
  const ep = episode(slug)
  const { file: _metaFile, ...meta } = loadMeta(ep, 'tiktok')
  const video = meta.video ?? path.join(ep.out, `${ep.slug}.mp4`)
  if (!existsSync(video)) die(`no video at ${video}`)

  const fd = new FormData()
  appendTikTokPost(fd, meta, { schedule: false })
  fd.append('profiles[]', profileId)
  fd.append('media[]', new Blob([readFileSync(video)], { type: 'video/mp4' }), path.basename(video))

  console.log(`\nPublishing ${slug} on TikTok now → @occamstudio`)
  const post = await api('/posts', { method: 'POST', body: fd })
  const updated = {
    ...meta, publishAt: null, via: 'postproxy', postproxyId: post.id,
    scheduledAt: post.scheduled_at, publishedAt: new Date().toISOString(), video,
  }
  writeFileSync(metaPath(ep, 'tiktok'), JSON.stringify(updated, null, 2) + '\n')
  console.log(`  post ${post.id} · status ${post.status} (TikTok may take 1–5 min to process)`)
  return updated
}

function syncTikTokDates() {
  for (const slug of TIKTOK_SCHEDULE_SLUGS) {
    const ep = episode(slug)
    const igFile = metaPath(ep, 'instagram')
    const ttFile = metaPath(ep, 'tiktok')
    if (!existsSync(igFile) || !existsSync(ttFile)) continue
    const tt = JSON.parse(readFileSync(ttFile, 'utf8'))
    if (tt.postproxyId) continue
    const ig = JSON.parse(readFileSync(igFile, 'utf8'))
    writeFileSync(ttFile, JSON.stringify({ ...tt, publishAt: ig.publishAt }, null, 2) + '\n')
    console.log(`${slug}\t${ig.publishAt?.slice(0, 10) ?? '-'}`)
  }
}

async function publishTwitterSlug(slug, profileId) {
  const ep = episode(slug)
  const { file: _metaFile, ...meta } = loadMeta(ep, 'twitter')
  const video = meta.video ?? path.join(ep.out, `${ep.slug}.mp4`)
  if (!existsSync(video)) die(`no video at ${video}`)

  const fd = new FormData()
  fd.append('post[body]', meta.text)
  fd.append('profiles[]', profileId)
  fd.append('media[]', new Blob([readFileSync(video)], { type: 'video/mp4' }), path.basename(video))
  if (meta.linkReply) fd.append('thread[0][body]', meta.linkReply)

  console.log(`\nPublishing ${slug} on X now → @occamstudio`)
  const post = await api('/posts', { method: 'POST', body: fd })
  const updated = {
    ...meta,
    publishAt: null,
    via: 'postproxy',
    postproxyId: post.id,
    scheduledAt: post.scheduled_at,
    publishedAt: new Date().toISOString(),
    video,
  }
  writeFileSync(metaPath(ep, 'twitter'), JSON.stringify(updated, null, 2) + '\n')
  console.log(`  post ${post.id} · status ${post.status} (X may take ~30s to process video)`)
  return updated
}

function syncTwitterDates() {
  for (const slug of TWITTER_SLUGS) {
    const ep = episode(slug)
    const igFile = metaPath(ep, 'instagram')
    const twFile = metaPath(ep, 'twitter')
    if (!existsSync(igFile) || !existsSync(twFile)) continue
    const tw = JSON.parse(readFileSync(twFile, 'utf8'))
    if (tw.postproxyId) continue
    const ig = JSON.parse(readFileSync(igFile, 'utf8'))
    writeFileSync(twFile, JSON.stringify({ ...tw, publishAt: ig.publishAt }, null, 2) + '\n')
    console.log(`${slug}\t${ig.publishAt?.slice(0, 10) ?? '-'}`)
  }
}

/** Reels 2–12: one every two days at 17:00 Gulf, first slot from today (Gulf calendar). */
const IG_EVERY_DAYS = 2
const SERIES_SLUGS = [
  'answer-first', 'too-many-words', 'make-it-pop', 'whats-the-so-what', 'due-in-ten',
  'intern-vs-partner', 'ai-deck-tell', 'so-what-test', 'walk-me-through-it',
  'action-titles', 'action-titles-b',
]

const TWITTER_SLUGS = ['one-color', ...SERIES_SLUGS]
const TIKTOK_SCHEDULE_SLUGS = [...SERIES_SLUGS]
const TIKTOK_PUBLISH_SLUGS = ['one-color']

function gulfCalendarDay(iso) {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dubai', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(iso))
  const get = (t) => p.find((x) => x.type === t).value
  return `${get('year')}-${get('month')}-${get('day')}`
}

function gulfWeekday(iso) {
  return new Date(new Date(iso).toLocaleString('en-US', { timeZone: 'Asia/Dubai' })).getDay()
}

function everyNDaysPublishAts(n, count, from = new Date()) {
  const out = []
  const cur = new Date(from)
  cur.setHours(12, 0, 0, 0)
  while (out.length < count) {
    const day = gulfCalendarDay(cur)
    out.push(`${day}T17:00:00+04:00`)
    cur.setDate(cur.getDate() + n)
  }
  return out
}

async function patchSchedule(postId, publishAt) {
  const post = await api(`/posts/${postId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ post: { scheduled_at: publishAt } }),
  })
  return post
}

async function tryPatchSchedule(postId, publishAt) {
  const r = await fetch(`${API}/posts/${postId}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ post: { scheduled_at: publishAt } }),
  })
  const text = await r.text()
  let body
  try { body = text ? JSON.parse(text) : null } catch { body = text }
  if (!r.ok) return { ok: false, error: typeof body === 'object' && body?.error ? String(body.error) : `${r.status}` }
  return { ok: true, post: body?.data ?? body }
}

async function applyCadence() {
  const dates = everyNDaysPublishAts(IG_EVERY_DAYS, SERIES_SLUGS.length)
  for (let i = 0; i < SERIES_SLUGS.length; i++) {
    const slug = SERIES_SLUGS[i]
    const publishAt = dates[i]
    const ep = episode(slug)
    const { file: _metaFile, ...meta } = loadMeta(ep)
    if (!meta.postproxyId) {
      console.log(`${slug}: no postproxyId — npm run postproxy -- schedule ${slug}`)
      continue
    }
    try {
      const r = await tryPatchSchedule(meta.postproxyId, publishAt)
      if (!r.ok) {
        console.log(`${slug}: skipped (${r.error})`)
        continue
      }
      const post = r.post
      const updated = { ...meta, publishAt, scheduledAt: post.scheduled_at, via: 'postproxy' }
      writeFileSync(metaPath(ep), JSON.stringify(updated, null, 2) + '\n')
      console.log(`${publishAt.slice(0, 10)} (${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][gulfWeekday(publishAt)]})  ${slug}  ${meta.postproxyId}`)
    } catch (e) {
      console.log(`${slug}: skipped (${e instanceof Error ? e.message : e})`)
    }
  }
}

function postproxyPlatforms() {
  return ['instagram', ...['tiktok', 'twitter'].filter((p) => EXTRA_PLATFORMS.has(p))]
}

/** Pushes the copy in each short's instagram.json (and optional tiktok/twitter) to its scheduled PostProxy post. */
async function updateCopy(only) {
  const soon = Date.now() + 6 * 60_000
  const slugs = only ? [only] : readdirSync(path.join(ROOT, 'out'), { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort()
  for (const s of slugs) {
    for (const platform of postproxyPlatforms()) {
      const file = path.join(ROOT, 'out', s, `${platform}.json`)
      if (!existsSync(file)) continue
      const meta = JSON.parse(readFileSync(file, 'utf8'))
      if (!meta.postproxyId) continue
      const { data: post } = await api(`/posts/${meta.postproxyId}`).then((b) => ({ data: b.data ?? b }))
      if (post.status !== 'scheduled' || new Date(post.scheduled_at).getTime() < soon) {
        console.log(`${s}\t${platform}\tskipped (${post.status})`)
        continue
      }
      const body = platform === 'twitter'
        ? { post: { body: meta.text }, thread: [{ body: meta.linkReply }] }
        : { post: { body: meta.caption }, ...(platform === 'instagram' ? { platforms: { instagram: { first_comment: meta.pinnedComment } } } : {}) }
      await api(`/posts/${meta.postproxyId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      console.log(`${s}\t${platform}\tupdated`)
    }
  }
}

/** Swaps the video on a short's scheduled PostProxy post(s) for the current render (a re-cut). */
async function replaceMedia(slug) {
  const ep = episode(slug)
  const video = path.join(ep.out, `${ep.slug}.mp4`)
  if (!existsSync(video)) die(`no video at ${video}`)
  for (const platform of postproxyPlatforms()) {
    const file = metaPath(ep, platform)
    if (!existsSync(file)) continue
    const meta = JSON.parse(readFileSync(file, 'utf8'))
    if (!meta.postproxyId) continue
    const post = await api(`/posts/${meta.postproxyId}`).then((b) => b.data ?? b)
    if (post.status !== 'scheduled' || new Date(post.scheduled_at).getTime() < Date.now() + 6 * 60_000) {
      console.log(`${slug}\t${platform}\tskipped (${post.status})`)
      continue
    }
    const fd = new FormData()
    fd.append('media[]', new Blob([readFileSync(video)], { type: 'video/mp4' }), path.basename(video))
    await api(`/posts/${meta.postproxyId}`, { method: 'PATCH', body: fd })
    console.log(`${slug}\t${platform}\tmedia replaced`)
  }
}

/** Drops scheduled TikTok and X posts from PostProxy; clears postproxyId in each short's tiktok.json and twitter.json. */
async function cancelSecondary() {
  const outDir = path.join(ROOT, 'out')
  if (!existsSync(outDir)) { console.log('no out/ — nothing to cancel'); return }
  for (const slug of readdirSync(outDir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort()) {
    for (const platform of ['tiktok', 'twitter']) {
      const file = path.join(outDir, slug, `${platform}.json`)
      if (!existsSync(file)) continue
      const meta = JSON.parse(readFileSync(file, 'utf8'))
      if (!meta.postproxyId) continue
      let post
      try { post = await api(`/posts/${meta.postproxyId}`).then((b) => b.data ?? b) } catch { post = null }
      if (post?.status === 'scheduled') {
        await api(`/posts/${meta.postproxyId}`, { method: 'DELETE' })
        console.log(`${slug}\t${platform}\tcancelled ${meta.postproxyId}`)
      } else console.log(`${slug}\t${platform}\tskipped (${post?.status ?? 'missing'})`)
      if (post?.status === 'scheduled' || post?.status === 'draft') {
        const { postproxyId: _id, scheduledAt: _at, ...rest } = meta
        writeFileSync(file, JSON.stringify({ ...rest, via: 'off' }, null, 2) + '\n')
      }
    }
  }
}

const [cmd, slug] = process.argv.slice(2)

if (cmd === 'profiles') {
  const { data = [] } = await api('/profiles')
  for (const p of data) console.log(`${p.id}\t${p.platform}\t${p.username ?? p.name}\t${p.status}`)
} else if (cmd === 'schedule') {
  if (!slug) die('usage: npm run postproxy -- schedule <slug>')
  await scheduleSlug(slug, await instagramProfileId())
} else if (cmd === 'schedule-all') {
  const profileId = await instagramProfileId()
  const slugs = readdirSync(path.join(ROOT, 'out'), { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .filter((s) => existsSync(path.join(ROOT, 'out', s, 'instagram.json')))
    .sort()
  for (const s of slugs) await scheduleSlug(s, profileId)
} else if (cmd === 'cadence') {
  await applyCadence()
} else if (cmd === 'cancel-secondary') {
  await cancelSecondary()
} else if (cmd === 'schedule-twitter') {
  extraEnabled('twitter')
  if (!slug) die('usage: npm run postproxy -- schedule-twitter <slug>')
  await scheduleTwitterSlug(slug, await twitterProfileId())
} else if (cmd === 'publish-twitter') {
  extraEnabled('twitter')
  if (!slug) die('usage: npm run postproxy -- publish-twitter <slug>')
  await publishTwitterSlug(slug, await twitterProfileId())
} else if (cmd === 'schedule-twitter-all') {
  extraEnabled('twitter')
  const profileId = await twitterProfileId()
  for (const s of TWITTER_SLUGS) await scheduleTwitterSlug(s, profileId)
} else if (cmd === 'sync-twitter-dates') {
  extraEnabled('twitter')
  syncTwitterDates()
} else if (cmd === 'schedule-tiktok') {
  extraEnabled('tiktok')
  if (!slug) die('usage: npm run postproxy -- schedule-tiktok <slug>')
  await scheduleTikTokSlug(slug, await tiktokProfileId())
} else if (cmd === 'publish-tiktok') {
  extraEnabled('tiktok')
  if (!slug) die('usage: npm run postproxy -- publish-tiktok <slug>')
  await publishTikTokSlug(slug, await tiktokProfileId())
} else if (cmd === 'schedule-tiktok-all') {
  extraEnabled('tiktok')
  const profileId = await tiktokProfileId()
  for (const s of TIKTOK_PUBLISH_SLUGS) await publishTikTokSlug(s, profileId)
  for (const s of TIKTOK_SCHEDULE_SLUGS) await scheduleTikTokSlug(s, profileId)
} else if (cmd === 'sync-tiktok-dates') {
  extraEnabled('tiktok')
  syncTikTokDates()
} else if (cmd === 'update-copy') {
  await updateCopy(slug)
} else if (cmd === 'replace-media') {
  if (!slug) die('usage: npm run postproxy -- replace-media <slug>')
  await replaceMedia(slug)
} else die('usage: npm run postproxy -- profiles | schedule | schedule-all | cadence | cancel-secondary | update-copy | replace-media | …tiktok/twitter (POSTPROXY_EXTRA_PLATFORMS)')
