/* Voice an episode through OpenRouter as one continuous take, then time every word so scenes and captions follow it.

     npm run voice -- <slug>

   One take keeps the delivery flowing like a single speaker; scene boundaries come from the word timings, not from
   splicing. The take is cached by its text and voice settings. Writes voice/<hash>.mp3 and voice/timeline.json in the
   episode folder. Needs OPENROUTER_API_KEY in the repo .env. */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { die, duration, episode, ff, getEnv, shown, spoken } from './lib.mjs'

const API = 'https://openrouter.ai/api/v1', STT = 'openai/whisper-1'
const key = getEnv('OPENROUTER_API_KEY')
if (!key) die('OPENROUTER_API_KEY is not set')

const ep = episode(process.argv[2])
const { model, voice, pace = 1, instructions } = ep.spec.voice ?? die('short.json needs "voice": { "model", "voice" }')
const dir = path.join(ep.dir, 'voice')
mkdirSync(dir, { recursive: true })

async function tts(text, file) {
  const pcm = /^google\//.test(model)
  const r = await fetch(`${API}/audio/speech`, { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, voice, input: text, response_format: pcm ? 'pcm' : 'mp3', ...(instructions && { instructions }) }) })
  if (!r.ok) die(`speech ${r.status}: ${(await r.text()).slice(0, 300)}`)
  const raw = `${file}.raw`
  writeFileSync(raw, Buffer.from(await r.arrayBuffer()))
  const trim = 'silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.04'
  const tempo = pace === 1 ? [] : [`atempo=${pace}`]
  ff(...(pcm ? ['-f', 's16le', '-ar', '24000', '-ac', '1'] : []), '-i', raw,
    '-af', [trim, 'areverse', trim, 'areverse', ...tempo].join(','), '-ar', '44100', '-ac', '1', '-c:a', 'libmp3lame', '-q:a', '2', file)
  rmSync(raw)
}

async function transcribe(file) {
  const r = await fetch(`${API}/audio/transcriptions`, { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: STT, input_audio: { data: readFileSync(file).toString('base64'), format: 'mp3' }, language: 'en',
      response_format: 'verbose_json', timestamp_granularities: ['word'] }) })
  if (!r.ok) die(`transcription ${r.status}: ${(await r.text()).slice(0, 300)}`)
  return (await r.json()).words ?? []
}

/** The script's own words (right spelling, numbers as written) on the transcript's clock. Unmatched words share the
 *  time between their matched neighbours by length. */
/** A word reduced to compare script and transcript: case, punctuation and UK/US spelling (the transcriber writes US). */
const canon = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '').replace(/^grey/, 'gray').replace(/our(s?)$/, 'or$1').replace(/ise(s|d)?$/, 'ize$1')

function align(tokens, heard, dur) {
  const n = canon
  const at = tokens.map(() => null)
  let j = 0
  tokens.forEach((tok, i) => {
    for (let k = j; k < Math.min(j + 4, heard.length); k++) {
      if (n(tok) && n(heard[k].word) === n(tok)) { at[i] = [heard[k].start, heard[k].end]; j = k + 1; break }
    }
  })
  const out = []
  for (let i = 0; i < tokens.length;) {
    if (at[i]) { out.push({ text: tokens[i], start: at[i][0], end: at[i][1] }); i++; continue }
    let k = i
    while (k < tokens.length && !at[k]) k++
    const a = i ? out[i - 1].end : (heard[0]?.start ?? 0), b = k < tokens.length ? at[k][0] : (heard.at(-1)?.end ?? dur)
    const run = tokens.slice(i, k), total = run.reduce((s, t) => s + t.length, 0)
    let t = a
    for (const tok of run) { const d = ((b - a) * tok.length) / total; out.push({ text: tok, start: t, end: t + d }); t += d }
    i = k
  }
  return out
}

const scenes = ep.spec.scenes
scenes.forEach((s, i) => { if (!spoken(s.say ?? '')) die(`scene ${i} has no "say"`) })
const text = scenes.map((s) => spoken(s.say)).join(' ')
const hash = createHash('sha1').update(JSON.stringify([model, voice, pace, instructions ?? '', text])).digest('hex').slice(0, 10)
const mp3 = path.join(dir, `${hash}.mp3`), wordsFile = path.join(dir, `${hash}.words.json`)
const fresh = !existsSync(mp3)
if (fresh) {
  for (const f of readdirSync(dir)) if (/^[0-9a-f]{10}\.(mp3|words\.json)$/.test(f)) rmSync(path.join(dir, f))
  await tts(text, mp3)
}
if (!existsSync(wordsFile)) writeFileSync(wordsFile, JSON.stringify(await transcribe(mp3)))
const dur = duration(mp3)

const perScene = scenes.map((s) => shown(s.say).split(/\s+/).filter(Boolean))
const words = align(perScene.flat(), JSON.parse(readFileSync(wordsFile, 'utf8')), dur)
let k = 0
const timeline = { audio: `voice/${hash}.mp3`, dur, scenes: perScene.map((toks) => { const w = words.slice(k, k + toks.length); k += toks.length; return w }) }
writeFileSync(path.join(dir, 'timeline.json'), JSON.stringify(timeline, null, 1))

// Warn when the take isn't the script: a delivery tag read aloud, or words skipped or added.
const norm = canon
const scripted = new Set(perScene.flat().map(norm))
const tagWords = new Set(text.match(/\[[^\]]+\]/g)?.flatMap((t) => t.slice(1, -1).split(/[\s,]+/).map(norm)) ?? [])
const heard = JSON.parse(readFileSync(wordsFile, 'utf8')).map((w) => norm(w.word)).filter(Boolean)
const spokenTags = [...new Set(heard.filter((w) => tagWords.has(w) && !scripted.has(w)))]
const extra = heard.filter((w) => !scripted.has(w))
if (spokenTags.length) console.log(`! a delivery tag was read aloud (${spokenTags.join(', ')}); reword or move that tag`)
if (extra.length > 2 || heard.length < perScene.flat().length * 0.85)
  console.log(`! the take differs from the script (${extra.length} unexpected words${extra.length ? `: ${extra.slice(0, 6).join(' ')}` : ''}); listen before rendering`)

timeline.scenes.forEach((w, i) => console.log(`${String(i).padStart(2)} ${scenes[i].type.padEnd(9)} ${w[0].start.toFixed(2)}s  ${shown(scenes[i].say).slice(0, 70)}`))
console.log(`\n${fresh ? `New take, ${text.length} characters voiced.` : 'Cached take.'} Speech: ${dur.toFixed(1)}s.\nListen: ${path.relative(process.cwd(), mp3)}`)
