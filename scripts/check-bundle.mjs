/* Fails the build check when the entry chunk (the one index.html loads) grows past its budget. Run after `npm run build`. */
import { readFileSync, statSync } from 'node:fs'

const BUDGET_KB = 275 // the entry was 266 kB after the route split; kB here are 1000 bytes, as in the build output
const html = readFileSync('dist/index.html', 'utf8')
const entry = html.match(/assets\/[^"']+\.js/)?.[0]
if (!entry) { console.error('check-bundle: no entry script in dist/index.html (run npm run build first)'); process.exit(1) }
const kb = statSync(`dist/${entry}`).size / 1000
if (kb > BUDGET_KB) { console.error(`check-bundle: ${entry} is ${kb.toFixed(1)} kB, over the ${BUDGET_KB} kB budget`); process.exit(1) }
console.log(`check-bundle: ${entry} is ${kb.toFixed(1)} kB (budget ${BUDGET_KB} kB)`)
