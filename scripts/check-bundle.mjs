/* Fails the build check when the entry chunk (the one index.html loads) or the editor chunk (loaded when the app starts)
   grows past its budget. Run after `npm run build`. kB here are 1000 bytes, as in the build output. */
import { readFileSync, readdirSync, statSync } from 'node:fs'

const ENTRY_BUDGET_KB = 275 // 268 kB after the route split
const EDITOR_BUDGET_KB = 525 // 499 kB after the icons were cut to the curated set (it was 1,166 kB with every icon in)

const html = readFileSync('dist/index.html', 'utf8')
const entry = html.match(/<script[^>]*type="module"[^>]*src="\/?(assets\/[^"]+\.js)"/)?.[1]
if (!entry) { console.error('check-bundle: no entry script in dist/index.html (run npm run build first)'); process.exit(1) }
const editor = readdirSync('dist/assets').find((f) => /^App-.*\.js$/.test(f))
if (!editor) { console.error('check-bundle: no editor chunk (App-*.js) in dist/assets'); process.exit(1) }

let failed = false
for (const [label, file, budget] of [['entry', entry, ENTRY_BUDGET_KB], ['editor', `assets/${editor}`, EDITOR_BUDGET_KB]]) {
  const kb = statSync(`dist/${file}`).size / 1000
  if (kb > budget) { console.error(`check-bundle: the ${label} chunk ${file} is ${kb.toFixed(1)} kB, over the ${budget} kB budget`); failed = true }
  else console.log(`check-bundle: the ${label} chunk ${file} is ${kb.toFixed(1)} kB (budget ${budget} kB)`)
}
if (failed) process.exit(1)
