/* Start an episode from the template.   npm run new -- <slug> */
import { cpSync, existsSync } from 'node:fs'
import path from 'node:path'
import { ROOT, die } from './lib.mjs'

const slug = process.argv[2]
if (!slug || !/^[a-z0-9-]+$/.test(slug)) die('usage: npm run new -- <slug>   (lowercase, digits, hyphens)')
const dir = path.join(ROOT, 'public', 'episodes', slug)
if (existsSync(dir)) die(`${path.relative(ROOT, dir)} already exists`)
cpSync(path.join(ROOT, 'template'), dir, { recursive: true })
console.log(`${path.relative(ROOT, dir)}/short.json and notes.md are ready to fill`)
