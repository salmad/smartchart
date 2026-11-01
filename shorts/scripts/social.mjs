#!/usr/bin/env node
/** Caption, pinned comment and story link for Reels / TikTok from episode notes.md.
    Every short gets its own path per platform (occamslides.com/ig/<slug>, /tt/<slug>, /x/<slug>, /yt/<slug>). The site
    serves the home page there and keeps the path, so Vercel Web Analytics' Pages panel counts visits per short and
    platform; UTM parameters need a paid plan. Captions and comments are not clickable on Instagram or TikTok, so the
    typed path is named there, and the clickable routes are the story sticker (same path) and the bio (/ig, /tt). */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { episode, die } from './lib.mjs'

const platform = process.argv[2]
const slug = process.argv[3]
if (!platform || !slug) die('usage: node scripts/social.mjs <instagram|tiktok|twitter> <slug> [--write]')

const CODE = { instagram: 'ig', tiktok: 'tt', twitter: 'x', youtube: 'yt' }

/** The short's own path on this platform, as typed (no scheme). */
const shortPath = (platform, slug) => `occamslides.com/${CODE[platform]}/${slug}`
const shortLink = (platform, slug) => `https://www.${shortPath(platform, slug)}`

/** X: hook + takeaway (no URL); link goes in the first thread reply (PostProxy rule). */
function tweetCopy({ title, desc, hashtags }, slug) {
  const hook = title.split('|')[0].trim()
  const body = hashtags ? desc.replace(/(\s+#[\w-]+)+\s*$/, '').trim() : desc
  const takeaway = (body.split(/\n/)[0] || body).split(/(?<=[.!?])\s+/)[0].trim()
  const link = shortLink('twitter', slug)
  const trim = (text, max) => (text.length <= max ? text : `${text.slice(0, max - 1).trim()}…`)
  let text = `${hook}\n\n${takeaway}`
  if (text.length > 280) text = `${hook}\n\n${trim(takeaway, 280 - hook.length - 2)}`
  if (text.length > 280) text = trim(hook, 280)
  const linkReply = `Made in Occam · first slide free: ${link}`
  if (linkReply.length > 280) die(`link reply for ${slug} is ${linkReply.length} chars`)
  return { text, link, linkReply }
}

/** Same field parsing as youtube.mjs (Title, Description continuations, Hashtags). */
function parsePost(notes) {
  const field = (name) => {
    const m = new RegExp(`^- ${name}[^:]*:(.*(?:\\n {2,}\\S.*)*)`, 'm').exec(notes)
    return m ? m[1].split('\n').map((l) => l.trim()).filter(Boolean).join('\n').trim() : ''
  }
  return { title: field('Title'), desc: field('Description'), hashtags: field('Hashtags') }
}

function caption({ title, desc, hashtags }) {
  const parts = [title.split('|')[0].trim()]
  // notes.md descriptions end with YouTube's inline hashtags; the caption carries its own line of them.
  const body = hashtags ? desc.replace(/(\s+#[\w-]+)+\s*$/, '').trim() : desc
  if (body) parts.push(body)
  parts.push(`Made in Occam · ${shortPath(platform, slug)} (link in bio)`)
  if (hashtags) parts.push(hashtags)
  return parts.join('\n\n')
}

const pinnedComment = platform === 'twitter'
  ? null
  : `Made in Occam. First slide free: ${shortPath(platform, slug)} (link in bio)`
const storyLink = platform === 'twitter' ? null : shortLink(platform, slug)

const { dir, out } = episode(slug)
const post = parsePost(readFileSync(path.join(dir, 'notes.md'), 'utf8'))

// A file already written keeps its own schedule and posting state; the copy is regenerated.
const file = path.join(out, `${platform}.json`)
const prev = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {}
const yt = path.join(out, 'youtube.json')
const ig = path.join(out, 'instagram.json')
const publishAt = prev.publishAt
  ?? (existsSync(ig) ? JSON.parse(readFileSync(ig, 'utf8')).publishAt ?? null : null)
  ?? (existsSync(yt) ? JSON.parse(readFileSync(yt, 'utf8')).publishAt ?? null : null)

const payload = platform === 'twitter'
  ? {
      slug, platform, account: prev.account ?? 'occamstudio',
      ...tweetCopy(post, slug),
      publishAt, video: path.join(out, `${slug}.mp4`),
    }
  : {
      slug, platform, account: prev.account ?? (platform === 'tiktok' ? 'occamstudio' : 'occam'),
      caption: caption(post), pinnedComment, storyLink,
      publishAt, video: path.join(out, `${slug}.mp4`),
    }

if (process.argv.includes('--write')) {
  writeFileSync(file, JSON.stringify({ ...prev, ...payload, via: prev.via ?? 'pending' }, null, 2) + '\n')
}

console.log(JSON.stringify(payload, null, 2))
