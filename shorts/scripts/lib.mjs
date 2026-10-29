// Shared by the shorts scripts: paths, the repo .env, ffmpeg, and the episode spec.
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))

const envFile = path.join(ROOT, '..', '.env')
const env = existsSync(envFile) ? Object.fromEntries(readFileSync(envFile, 'utf8').split('\n')
  .map((l) => /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(l)).filter(Boolean).map(([, k, v]) => [k, v.replace(/^"|"$/g, '')])) : {}
export const getEnv = (k) => process.env[k] ?? env[k] ?? env[k.toLowerCase()]

export function episode(slug) {
  if (!slug) die('usage: npm run <step> -- <slug>')
  const dir = path.join(ROOT, 'public', 'episodes', slug)
  const file = path.join(dir, 'short.json')
  if (!existsSync(file)) die(`no episode at ${path.relative(ROOT, file)} (npm run new -- ${slug})`)
  return { slug, dir, base: `episodes/${slug}`, out: path.join(ROOT, 'out', slug), spec: JSON.parse(readFileSync(file, 'utf8')) }
}

export const ff = (...args) => execFileSync('ffmpeg', ['-y', '-v', 'error', ...args], { stdio: 'inherit' })
export const duration = (file) => Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]).toString().trim())

/** The narration text without *emphasis* marks; `spoken` keeps [audio tags] for the voice model. */
export const spoken = (say) => say.replace(/\*/g, '').trim()
export const shown = (say) => spoken(say).replace(/\[[^\]]*\]\s*/g, '').trim()

/** Seconds of speech for a line at a typical short-form pace. */
export const estimate = (say, pace = 1) => shown(say).split(/\s+/).filter(Boolean).length / (2.7 * pace)

export function die(msg) { console.error(msg); process.exit(1) }
