import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { expect, it } from 'vitest'

/* Vercel runs api/ as Node ES modules, where a relative import needs its file extension. The engine is shared with
   Vite (which does not), so a missing extension only fails in production: this catches it here. */
const files = (dir: string): string[] => readdirSync(dir).flatMap((n) => {
  const p = path.join(dir, n)
  return statSync(p).isDirectory() ? files(p) : p.endsWith('.ts') ? [p] : []
})

it('every relative import in src/engine and api names its file extension', () => {
  const bad: string[] = []
  for (const f of [...files('src/engine'), ...files('api')]) {
    for (const m of readFileSync(f, 'utf8').matchAll(/(?:from|import)\s*\(?\s*['"](\.{1,2}\/[^'"]*)['"]/g)) {
      if (!/\.(js|json)$/.test(m[1])) bad.push(`${f}: ${m[1]}`)
    }
  }
  expect(bad).toEqual([])
})
