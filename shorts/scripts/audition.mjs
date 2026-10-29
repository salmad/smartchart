/* Hear candidate voices on the lines that matter most (the hook and the turn) before voicing the whole episode.

     npm run audition -- <slug> [scene numbers, default 0 1]

   Writes voice/audition/<name>.mp3 for each voice below with the episode's model. Pick one, put its id in short.json. */
import { createHash } from 'node:crypto'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { die, episode, ff, getEnv, spoken } from './lib.mjs'

// ElevenLabs premade voices suited to an expert explaining something to a peer. Ids, not names: a name falls back to
// the default voice without an error.
const VOICES = {
  chris: ['iP95p4xoKVk53GoZ742B', 'casual, down-to-earth American'],
  eric: ['cjVigY5qzO86Huf0OWal', 'smooth, trustworthy American'],
  brian: ['nPczCjzI2devNBz1zQrb', 'deep, resonant American narrator'],
  daniel: ['onwK4e9ZLuTAKqWW03F9', 'authoritative British'],
  george: ['JBFqnCBsd6RMkjVDRZzb', 'warm British storyteller'],
  alice: ['Xb7hH8MSUJpSbSDYk0k2', 'clear, engaging British educator'],
  matilda: ['XrExE9yKIg1WjnnlVkGX', 'friendly, knowledgeable American'],
  jessica: ['cgSgspJ2msm6clMCkdW9', 'expressive, young American'],
}

const key = getEnv('OPENROUTER_API_KEY')
if (!key) die('OPENROUTER_API_KEY is not set')
const [slug, ...nums] = process.argv.slice(2)
const ep = episode(slug)
const picks = (nums.length ? nums.map(Number) : [0, 1]).map((i) => ep.spec.scenes[i] ?? die(`no scene ${i}`))
const text = picks.map((s) => spoken(s.say)).join(' ')
const model = ep.spec.voice?.model ?? 'elevenlabs/eleven-v4'
const dir = path.join(ep.dir, 'voice', 'audition')
rmSync(dir, { recursive: true, force: true })
mkdirSync(dir, { recursive: true })

const seen = new Map()
await Promise.all(Object.entries(VOICES).map(async ([name, [id, about]]) => {
  const r = await fetch('https://openrouter.ai/api/v1/audio/speech', { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, voice: id, input: text, response_format: 'mp3' }) })
  if (!r.ok) return console.log(`✗ ${name}: ${r.status}`)
  const buf = Buffer.from(await r.arrayBuffer()), raw = path.join(dir, `${name}.raw.mp3`), file = path.join(dir, `${name}.mp3`)
  writeFileSync(raw, buf)
  ff('-i', raw, '-af', 'loudnorm=I=-16', '-c:a', 'libmp3lame', '-q:a', '2', file)
  rmSync(raw)
  const h = createHash('sha1').update(buf).digest('hex')
  if (seen.has(h)) console.log(`! ${name} sounds identical to ${seen.get(h)}: the id may have fallen back to a default`)
  seen.set(h, name)
  console.log(`${name.padEnd(7)} ${id}  ${about}`)
}))
console.log(`\n${text.length} characters × ${Object.keys(VOICES).length} voices. Listen: ${path.relative(process.cwd(), dir)}/`)
