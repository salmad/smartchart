// Rendering and lints are the existing dev fixture's (src/dev/fixture.html): the same fit issues and layout lints the
// app reports, at 1920×1080, plus a PNG for the judge and the gallery. One page, one slide at a time.
import { chromium } from '@playwright/test'
import type { LintResult } from '@/dev/fixture'
import type { Slide, Style } from '@/engine/types'
import type { Measured } from './types'

export interface Measurer { measure(slideId: string, slide: Slide, style: Style, png: string): Promise<Measured>; close(): Promise<void> }

export async function openMeasurer(app: string): Promise<Measurer> {
  const browser = await chromium.launch(), page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
  await page.goto(`${app}/src/dev/fixture.html`).catch((e: unknown) => {
    throw new Error(`Cannot open ${app}/src/dev/fixture.html: is npm run dev running? (${e instanceof Error ? e.message.split('\n')[0] : String(e)})`)
  })
  await page.waitForFunction(() => window.ready)
  let queue: Promise<unknown> = Promise.resolve()
  const one = async (slideId: string, slide: Slide, style: Style, png: string): Promise<Measured> => {
    const r = await page.evaluate(([s, st]) => (window.lint as (s: Slide, st: Style) => Promise<LintResult>)(s, st), [slide, style] as const)
    await page.locator('#frame').screenshot({ path: png })
    return { slideId, fit: r.fit, issues: r.issues, warnings: r.warnings, png }
  }
  return {
    measure: (slideId, slide, style, png) => { const p = queue.then(() => one(slideId, slide, style, png)); queue = p.catch(() => undefined); return p },
    close: () => browser.close(),
  }
}
