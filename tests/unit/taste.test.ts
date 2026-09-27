import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { CHECK_COUNT, TASTE } from '@/app/components/landing/taste'

const checks = readFileSync('src/engine/agent/checks.ts', 'utf8')
const lints = readFileSync('src/engine/slides/lints.ts', 'utf8')

describe('the site’s taste sheet', () => {
  it('counts the engine’s rule and judgment checks', () => {
    const ids = new Set([...checks.matchAll(/add\("([RJ]\d+)"/g)].map((m) => m[1]))
    expect(ids.size).toBe(CHECK_COUNT)
  })
  it('names only checks the engine runs', () => {
    for (const r of TASTE) for (const id of r.ids) {
      const src = id.startsWith('L') ? lints : checks
      expect(src.includes(id.startsWith('L') ? `(${id})` : `add("${id}"`), `${r.value}: ${id}`).toBe(true)
    }
  })
})
