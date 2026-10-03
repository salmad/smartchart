/* The eval measures slides on the same fixture the lint tests use: a gallery table is clean, an overlong title is flagged. */
import { expect, test } from '@playwright/test'
import { STARTERS } from '@/engine/starters'
import { openMeasurer } from '../mcp-eval/measure'

test('measures a gallery table clean and flags an overlong title', async ({ baseURL }, info) => {
  const scoring = STARTERS.find((x) => x.id === 'scoring')?.consulting
  if (!scoring) throw new Error('No scoring starter')
  const m = await openMeasurer(String(baseURL))
  try {
    const ok = await m.measure('s1', scoring, 'consulting', info.outputPath('ok.png'))
    expect([...ok.fit, ...ok.issues]).toEqual([])
    const bad = await m.measure('s2', { ...scoring, title: 'An action title that runs on and on '.repeat(6) }, 'consulting', info.outputPath('bad.png'))
    expect(bad.fit.some((f) => f.startsWith('title wraps'))).toBe(true)
  } finally { await m.close() }
})
