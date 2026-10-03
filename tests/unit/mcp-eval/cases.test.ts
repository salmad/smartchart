import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { OFFERED } from '@/engine/slides/schema'
import { figures, requestText } from '../../mcp-eval/checks'
import type { Case } from '../../mcp-eval/types'

const dir = path.resolve(__dirname, '../../mcp-eval')
const cases = JSON.parse(readFileSync(path.join(dir, 'cases.json'), 'utf8')) as Case[]

describe('eval cases', () => {
  it('25 cases with unique ids, in the spec’s groups', () => {
    expect(cases).toHaveLength(25)
    expect(new Set(cases.map((c) => c.id)).size).toBe(cases.length)
    const count = (g: string) => cases.filter((c) => c.group === g).length
    expect([count('criteria'), count('figures'), count('positions'), count('actions'), count('stress'), count('near-miss'), count('ask')]).toEqual([4, 4, 2, 2, 5, 6, 2])
  })
  it.each(cases.map((c) => [c.id, c] as const))('%s is honest', (_id, c) => {
    for (const f of c.files) expect(existsSync(path.join(dir, 'files', f)), f).toBe(true)
    const request = requestText(c, path.join(dir, 'files')), asked = new Set(figures(request).map((f) => f.key))
    for (const n of c.facts.numbers) for (const f of figures(n)) expect(asked.has(f.key), `${n} is not in the request`).toBe(true)
    for (const n of c.facts.names) expect(request.toLowerCase(), `${n} is not in the request`).toContain(n.toLowerCase())
    if (c.ask) { expect(c.gold).toBeNull(); return }
    expect(c.gold && OFFERED.includes(c.gold)).toBe(true)
    for (const t of c.acceptable) expect(OFFERED).toContain(t)
    expect(c.questions.some((q) => q.must)).toBe(true)
  })
})
