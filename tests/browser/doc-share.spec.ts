/* A doc shared by link opens read-only for anyone with the link. */
import { test, expect } from '@playwright/test'

const shared = { kind: 'doc', name: 'Competitor teardown', rev: 2, text: `---
title: Competitor teardown
---

## Market {#sec-1}

A short read.
` }

test('a shared doc opens for a signed-out visitor', async ({ page }) => {
  await page.route('**/api/share?s=doc_tok', (r) => r.fulfill({ json: shared }))
  await page.goto('/s/doc_tok')
  await expect(page.getByRole('banner').getByRole('heading', { name: 'Competitor teardown' })).toBeVisible()
  const article = page.getByRole('article')
  await expect(article).toBeVisible()
  await expect(article.getByRole('heading', { name: 'Market', level: 2 })).toBeVisible()
  await expect(article.getByText('A short read.')).toBeVisible()
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex')
})
