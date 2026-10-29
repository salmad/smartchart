/* Checks that warn, never rewrite.

     npm run lint -- <slug>    the script, before any money is spent on voice
     npm run check -- <slug>   the finished file, before it is posted

   Exits 1 on errors (the video would break or miss the feed); warnings are craft calls for the writer. */
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { die, episode, estimate, shown } from './lib.mjs'

const [mode, slug] = process.argv.slice(2)
const ep = episode(slug)
const errors = [], warnings = []
const words = (s = '') => shown(s).split(/\s+/).filter(Boolean).length

if (mode === 'spec') {
  const { scenes = [], voice } = ep.spec
  const pace = voice?.pace ?? 1
  const TYPES = ['hook', 'statement', 'list', 'stat', 'terminal', 'prompt', 'shot', 'compare', 'recap', 'slide', 'deck']
  const SHOWN = ['stat', 'terminal', 'prompt', 'shot', 'slide', 'deck']
  const BEATS = ['list', 'recap', 'terminal', 'compare', 'slide', 'deck']
  const beats = (s) => s.type === 'slide' ? (s.retitle || s.before ? 1 : 0) + (s.checks?.length ?? 0)
    : s.type === 'deck' && s.reorder ? 1 : (s.items ?? s.steps ?? s.titles ?? (s.type === 'compare' ? [0, 1] : [s.caption])).length
  if (!voice?.model || !voice?.voice) errors.push('voice needs "model" and "voice"')
  if (scenes.length < 3) errors.push('fewer than three scenes: hook, at least one beat, a close')
  if (scenes[0]?.type !== 'hook') errors.push('the first scene must be the hook')
  scenes.forEach((s, i) => {
    const at = `scene ${i} (${s.type})`
    if (!TYPES.includes(s.type)) errors.push(`${at}: unknown type`)
    if (!s.say?.trim()) errors.push(`${at}: no "say"`)
    if (s.type === 'shot' && !existsSync(path.join(ep.dir, s.src ?? ''))) errors.push(`${at}: image ${s.src} is not in the episode folder`)
    if (/\b(let me know|comment below|link in (the )?bio|sign up|subscribe|smash|don'?t forget to)\b/i.test(s.say ?? '')) warnings.push(`${at}: engagement bait reads as an ad and ends videos early; close on the recap instead`)
    const limit = BEATS.includes(s.type) ? 10 : 7
    if (estimate(s.say ?? '', pace) > limit) warnings.push(`${at}: ~${estimate(s.say, pace).toFixed(1)}s on one picture; split it, a visual change every 2–4s holds attention`)
    for (const item of [...(s.items ?? [])]) if (words(item) > 7) warnings.push(`${at}: "${item}" is long for a glance; 2–6 words`)
    if ((s.items?.length ?? 0) > 5) warnings.push(`${at}: ${s.items.length} items; three lands, five is the most`)
    if (s.cues && s.cues.length !== beats(s)) warnings.push(`${at}: ${s.cues.length} cues for ${beats(s)} beats; the extra or missing ones fall back to the narration`)
  })
  const body = scenes.slice(1, -1)
  if (body.length && body.filter((s) => SHOWN.includes(s.type)).length < body.length / 2)
    warnings.push(`text-heavy: ${body.filter((s) => !SHOWN.includes(s.type)).length} of ${body.length} middle scenes are words on a background; show the thing (slide, deck, shot, terminal, prompt, stat)`)
  if (/^elevenlabs\//.test(voice?.model ?? '') && !scenes.some((s) => /\[[^\]]+\]/.test(s.say ?? '')))
    warnings.push('no delivery tags: the read will be even and flat; set the hook\'s tone and mark the turn, e.g. [knowing], [beat], [emphatic]')
  const hook = scenes[0]
  if (hook?.type === 'hook') {
    if (words(hook.text) > 9) warnings.push(`hook text is ${words(hook.text)} words; the feed gives it a second, keep it to 9`)
    if (estimate(hook.say ?? '', pace) > 3.5) warnings.push(`hook narration is ~${estimate(hook.say, pace).toFixed(1)}s; land the promise inside 3s`)
    if (/^(hi|hey|hello|so,?|today|in this video|welcome|let'?s talk)\b/i.test(shown(hook.say ?? ''))) warnings.push('hook opens with a warm-up; start on the problem, the result or the surprise')
    if (/\b(occam|smartchart)\b/i.test(`${hook.text} ${hook.say}`)) warnings.push('hook names the product; lead with the pain or the payoff, the tool comes later')
  }
  const last = scenes.at(-1)
  if (last && last.type !== 'recap' && !last.loop) warnings.push('no recap at the end; a recap or a line that loops to the hook outperforms a sign-off')
  const total = scenes.reduce((s, sc) => s + estimate(sc.say ?? '', pace) + 0.14, 0)
  if (total > 58) errors.push(`~${total.toFixed(0)}s of speech; cut to under 58s (aim 25–45s)`)
  else if (total > 45) warnings.push(`~${total.toFixed(0)}s of speech; 25–45s is the sweet spot for tool tips`)
  console.log(`~${total.toFixed(0)}s, ${scenes.length} scenes`)
} else if (mode === 'video') {
  const file = path.join(ep.out, `${ep.slug}.mp4`)
  if (!existsSync(file)) die(`no final render: npm run render -- ${ep.slug}`)
  const probe = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_streams', '-show_format', file]).toString())
  const v = probe.streams.find((s) => s.codec_type === 'video'), a = probe.streams.find((s) => s.codec_type === 'audio')
  const dur = Number(probe.format.duration)
  if (v?.width !== 1080 || v?.height !== 1920) errors.push(`frame is ${v?.width}×${v?.height}; Shorts, Reels and TikTok need 1080×1920 (9:16)`)
  if (v?.r_frame_rate !== '30/1') warnings.push(`frame rate ${v?.r_frame_rate}, expected 30`)
  if (!a) errors.push('no audio track')
  if (dur > 60) errors.push(`${dur.toFixed(1)}s; over 60s leaves the Shorts/Reels sweet spot and TikTok's short tier`)
  else if (dur < 12) warnings.push(`${dur.toFixed(1)}s is very short; make sure the one point fully lands`)
  const ebur = spawnSync('ffmpeg', ['-nostats', '-i', file, '-af', 'ebur128=peak=true', '-f', 'null', '-']).stderr.toString()
  const lufs = Number(/I:\s+(-?[\d.]+) LUFS/.exec(ebur.slice(ebur.lastIndexOf('Summary')))?.[1])
  const peak = Number(/Peak:\s+(-?[\d.]+) dBFS/.exec(ebur.slice(ebur.lastIndexOf('Summary')))?.[1])
  if (Math.abs(lufs + 14) > 1.5) warnings.push(`loudness ${lufs} LUFS; the feeds expect about -14`)
  if (peak > -1) warnings.push(`true peak ${peak} dBFS; keep it under -1 so the platform's encoder doesn't clip`)
  if (!existsSync(path.join(ep.out, 'cover.jpg'))) warnings.push('no cover.jpg')
  console.log(`${path.relative(process.cwd(), file)}: ${v?.width}×${v?.height} ${dur.toFixed(1)}s ${lufs} LUFS, peak ${peak} dBFS`)
} else die('usage: node scripts/check.mjs spec|video <slug>')

for (const e of errors) console.log(`✗ ${e}`)
for (const w of warnings) console.log(`! ${w}`)
if (!errors.length && !warnings.length) console.log('✓ clean')
process.exit(errors.length ? 1 : 0)
