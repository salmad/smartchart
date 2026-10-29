/* Lay the voiced episode on a timeline and render it.

     npm run render -- <slug> [--draft]     draft: half size, fast, for review
     npm run studio -- <slug>               live preview in Remotion Studio

   Writes out/<slug>/: props.json, sheet.jpg (first frame + the middle of every scene, for review), and either
   draft.mp4 or <slug>.mp4 (full size, loudness-normalised for the feeds) with cover.jpg. */
import { execFileSync, spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { ROOT, die, duration, episode, ff } from './lib.mjs'

const LEAD = 0.08

const args = process.argv.slice(2), draft = args.includes('--draft'), studio = args.includes('--studio')
const ep = episode(args.find((a) => !a.startsWith('--')))
const timelineFile = path.join(ep.dir, 'voice', 'timeline.json')
if (!existsSync(timelineFile)) die(`not voiced yet: npm run voice -- ${ep.slug}`)
const timeline = JSON.parse(readFileSync(timelineFile, 'utf8'))
if (timeline.scenes?.length !== ep.spec.scenes.length) die(`the voice is out of date: npm run voice -- ${ep.slug}`)

// Each scene cuts in just before its first word and runs until the next one does.
const starts = timeline.scenes.map((w, i) => (i === 0 ? 0 : Math.max(0, w[0].start - LEAD)))
const scenes = ep.spec.scenes.map((scene, i) => {
  const end = starts[i + 1] ?? timeline.dur + 0.3
  return { ...scene, from: starts[i], dur: end - starts[i], words: timeline.scenes[i] }
})
const hook = ep.spec.scenes[0]
const props = { scenes, base: ep.base, voice: timeline.audio, pinned: ep.spec.pinHook !== false && hook?.type === 'hook' ? hook.text : undefined,
  music: ep.spec.music && { src: ep.spec.music.src, volume: ep.spec.music.volume ?? 0.08 } }

mkdirSync(ep.out, { recursive: true })
const propsFile = path.join(ep.out, 'props.json')
writeFileSync(propsFile, JSON.stringify(props, null, 1))

const remotion = (...a) => ['remotion', ...a, '--props', propsFile]
if (studio) {
  spawn('npx', remotion('studio', 'src/index.ts'), { cwd: ROOT, stdio: 'inherit' })
} else {
  const file = path.join(ep.out, draft ? 'draft.mp4' : 'master.mp4')
  execFileSync('npx', [...remotion('render', 'src/index.ts', 'Short', file), '--codec', 'h264', '--crf', draft ? '23' : '16',
    ...(draft ? ['--scale', '0.5'] : []), '--log', 'error'], { cwd: ROOT, stdio: 'inherit' })

  const sheetDir = path.join(ep.out, 'sheet')
  rmSync(sheetDir, { recursive: true, force: true })
  mkdirSync(sheetDir)
  const at = [0, ...scenes.map((s) => s.from + s.dur * 0.85)]
  at.forEach((sec, i) => ff('-ss', sec.toFixed(2), '-i', file, '-frames:v', '1', '-vf', 'scale=360:-2', path.join(sheetDir, `${String(i).padStart(2, '0')}.jpg`)))
  const cols = Math.min(at.length, 6)
  ff('-framerate', '1', '-i', path.join(sheetDir, '%02d.jpg'), '-vf', `tile=${cols}x${Math.ceil(at.length / cols)}:padding=8:color=0x333333`, '-frames:v', '1', path.join(ep.out, 'sheet.jpg'))
  rmSync(sheetDir, { recursive: true })

  let final = file
  if (!draft) {
    final = path.join(ep.out, `${ep.slug}.mp4`)
    ff('-i', file, '-c:v', 'copy', '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11', '-ar', '48000', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', final)
    ff('-i', file, '-frames:v', '1', '-q:v', '2', path.join(ep.out, 'cover.jpg'))
  }
  console.log(`${path.relative(process.cwd(), final)}  ${duration(final).toFixed(1)}s\n${path.relative(process.cwd(), path.join(ep.out, 'sheet.jpg'))}`)
}
