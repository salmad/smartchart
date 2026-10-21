/* The sidebar's page tree (dev account): docs and decks nested three levels, opened and closed, kept across reloads, and
   driven from the keyboard. */
import { test, expect, type Locator, type Page } from '@playwright/test'
import { signInAsDev } from './dev-account'

signInAsDev()
const OPEN = 'smartchart.tree.open.v1.dev.ws_local'
const deck = (id: string, title: string, place: object) => ({ id, style: 'consulting', theme: 'ink', accent: null, current: 0, updated: 1, history: [], working: [], messages: [{ kind: 'bot', text: 'Hi.' }],
  items: [{ id: 's', slide: { template: 'section', title }, status: 'ok', errors: [], warnings: [], checks: [] }], ...place })
const doc = (id: string, title: string, place: object) => ({ id, name: title, text: `---\ntitle: ${title}\n---\n\n## One {#one}\n\nText.`, updated: 5, workspaceId: 'ws_local', ...place })
const R = { kind: 'doc', id: 'doc_r' }, C = { kind: 'doc', id: 'doc_c' }

/** Research > Competitors > Revolut (a deck), with Alpha (a deck) beside Research. Seeded once per test. */
const seed = (page: Page, open: string[] = []) => page.addInitScript(([decks, docs, openKey, openVal]) => {
  if (sessionStorage.getItem('seeded')) return
  localStorage.setItem('smartchart.journey.decks.v1', decks); localStorage.setItem('smartchart.docs.v1', docs)
  if (openVal !== '[]') localStorage.setItem(openKey, openVal)
  sessionStorage.setItem('seeded', '1')
}, [
  JSON.stringify({ active: 'alpha', decks: { alpha: deck('alpha', 'Alpha', { sortKey: 'b' }), rev: deck('rev', 'Revolut', { parent: C, sortKey: 'a' }) } }),
  JSON.stringify({ doc_r: doc('doc_r', 'Research', { sortKey: 'a' }), doc_c: doc('doc_c', 'Competitors', { parent: R, sortKey: 'a' }) }),
  OPEN, JSON.stringify(open),
] as const)
const sidebar = (page: Page) => page.getByRole('navigation', { name: 'Workspace' })
const rows = (page: Page) => sidebar(page).getByRole('tree', { name: 'Pages' }).getByRole('treeitem')
const row = (page: Page, name: string) => rows(page).filter({ hasText: name })

test('the open page’s branch is expanded: three levels, with their depth and the open row marked', async ({ page }) => {
  await seed(page)
  await page.goto('/d/rev')
  await expect(rows(page)).toHaveText(['Research', 'Competitors', 'Revolut', 'Alpha'])
  expect(await rows(page).evaluateAll((els) => els.map((e) => e.getAttribute('aria-level')))).toEqual(['1', '2', '3', '1'])
  await expect(row(page, 'Revolut')).toHaveAttribute('aria-selected', 'true')
  await expect(row(page, 'Research')).toHaveAttribute('aria-expanded', 'true')
  await expect(row(page, 'Alpha')).not.toHaveAttribute('aria-expanded')
})

test('chevrons open and close a branch', async ({ page }) => {
  await seed(page)
  await page.goto('/d/alpha')
  await expect(rows(page)).toHaveText(['Research', 'Alpha'])
  await page.getByRole('button', { name: 'Expand Research' }).click()
  await expect(rows(page)).toHaveText(['Research', 'Competitors', 'Alpha'])
  await page.getByRole('button', { name: 'Expand Competitors' }).click()
  await expect(rows(page)).toHaveText(['Research', 'Competitors', 'Revolut', 'Alpha'])
  await page.getByRole('button', { name: 'Collapse Research' }).click()
  await expect(rows(page)).toHaveText(['Research', 'Alpha'])
})

test('what the viewer opened stays open after a reload, and what they closed stays closed', async ({ page }) => {
  await seed(page)
  await page.goto('/d/alpha')
  await page.getByRole('button', { name: 'Expand Research' }).click()
  await expect(rows(page)).toHaveText(['Research', 'Competitors', 'Alpha'])
  await page.reload()
  await expect(rows(page)).toHaveText(['Research', 'Competitors', 'Alpha'])
  await page.getByRole('button', { name: 'Collapse Research' }).click()
  await page.reload()
  await expect(rows(page)).toHaveText(['Research', 'Alpha'])
})

test('opening a page inside a closed branch opens the branch, and a reload on it keeps it', async ({ page }) => {
  await seed(page)
  await page.goto('/d/rev')
  await page.getByRole('button', { name: 'Collapse Research' }).click()
  await expect(rows(page)).toHaveText(['Research', 'Alpha'])
  await page.reload()
  // The page on screen is inside the closed branch: it is shown.
  await expect(rows(page)).toHaveText(['Research', 'Competitors', 'Revolut', 'Alpha'])
  await expect(row(page, 'Revolut')).toHaveAttribute('aria-selected', 'true')
})

test('the tree works from the keyboard: arrows, Right, Left, Home, End, typing a letter, Enter', async ({ page }) => {
  await seed(page)
  await page.goto('/d/alpha')
  await expect(rows(page)).toHaveText(['Research', 'Alpha'])
  await row(page, 'Alpha').focus()
  await page.keyboard.press('ArrowUp')
  await expect(row(page, 'Research')).toBeFocused()
  await page.keyboard.press('ArrowRight') // expands
  await expect(rows(page)).toHaveText(['Research', 'Competitors', 'Alpha'])
  await expect(row(page, 'Research')).toBeFocused()
  await page.keyboard.press('ArrowRight') // enters
  await expect(row(page, 'Competitors')).toBeFocused()
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('ArrowDown')
  await expect(row(page, 'Revolut')).toBeFocused()
  await page.keyboard.press('ArrowLeft') // to the parent
  await expect(row(page, 'Competitors')).toBeFocused()
  await page.keyboard.press('ArrowLeft') // collapses
  await expect(rows(page)).toHaveText(['Research', 'Competitors', 'Alpha'])
  await page.keyboard.press('End')
  await expect(row(page, 'Alpha')).toBeFocused()
  await page.keyboard.press('Home')
  await expect(row(page, 'Research')).toBeFocused()
  await page.keyboard.press('a')
  await expect(row(page, 'Alpha')).toBeFocused()
  await page.keyboard.press('ArrowUp'); await page.keyboard.press('ArrowUp')
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/doc\/doc_r$/)
  await expect(row(page, 'Research')).toHaveAttribute('aria-selected', 'true')
})

test('only one row takes Tab', async ({ page }) => {
  await seed(page)
  await page.goto('/d/rev')
  await expect(rows(page).and(page.locator('[tabindex="0"]'))).toHaveCount(1)
  await expect(row(page, 'Revolut')).toHaveAttribute('tabindex', '0')
})

const hover = async (page: Page, name: string) => { await row(page, name).hover(); return row(page, name) }

test('Add subpage → Doc makes a doc under the page and opens it, with the branch open', async ({ page }) => {
  await seed(page)
  await page.goto('/d/alpha')
  await (await hover(page, 'Alpha')).getByRole('button', { name: 'More for Alpha' }).click()
  await page.getByRole('menuitem', { name: 'Add subpage' }).hover()
  await page.getByRole('menuitem', { name: 'Doc', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'New doc' })
  await dialog.getByText('Product requirements', { exact: true }).click()
  await dialog.getByRole('button', { name: 'Create doc' }).click()
  await expect(page).toHaveURL(/\/doc\/doc_[\w-]+$/)
  await expect(row(page, 'Alpha')).toHaveAttribute('aria-expanded', 'true')
  await expect(rows(page)).toHaveText(['Research', 'Alpha', 'Card controls PRD'])
  expect(await rows(page).evaluateAll((els) => els.map((e) => e.getAttribute('aria-level')))).toEqual(['1', '1', '2'])
})

test('the + beside a row adds a subpage deck: it shows under its parent and stays there after a reload', async ({ page }) => {
  await seed(page)
  await page.goto('/d/alpha')
  await (await hover(page, 'Research')).getByRole('button', { name: 'Add subpage to Research' }).click()
  await page.getByRole('menuitem', { name: 'Deck', exact: true }).click()
  await expect(page).toHaveURL(/\/new$/)
  await page.locator('[data-starter="section"]').dblclick()
  await expect(page).toHaveURL(/\/d\/d_[\w-]+$/)
  await expect(row(page, 'Research')).toHaveAttribute('aria-expanded', 'true')
  const levels = () => rows(page).evaluateAll((els) => els.map((e) => e.getAttribute('aria-level')))
  await expect.poll(levels).toEqual(['1', '2', '2', '1'])
  await page.waitForTimeout(600) // longer than the save pause
  await page.reload()
  await expect.poll(levels).toEqual(['1', '2', '2', '1'])
  await expect(rows(page).nth(2)).toHaveAttribute('aria-selected', 'true')
})

test('the + at the top still makes a top-level deck, after a subpage was started', async ({ page }) => {
  await seed(page)
  await page.goto('/d/alpha')
  await (await hover(page, 'Research')).getByRole('button', { name: 'Add subpage to Research' }).click()
  await page.getByRole('menuitem', { name: 'Deck', exact: true }).click()
  await expect(page).toHaveURL(/\/new$/)
  await sidebar(page).getByRole('button', { name: 'New page' }).click()
  await page.getByRole('menuitem', { name: 'New deck' }).click()
  await page.locator('[data-starter="section"]').dblclick()
  await expect(page).toHaveURL(/\/d\/d_[\w-]+$/)
  await expect.poll(() => rows(page).evaluateAll((els) => els.map((e) => e.getAttribute('aria-level')))).toEqual(['1', '1', '1'])
})

const levels = (page: Page) => rows(page).evaluateAll((els) => els.map((e) => e.getAttribute('aria-level')))

test('Move to… moves a page last under the one picked, greys what would make a loop, and a reload keeps it', async ({ page }) => {
  await seed(page)
  await page.goto('/d/alpha')
  await (await hover(page, 'Research')).getByRole('button', { name: 'More for Research' }).click()
  await page.getByRole('menuitem', { name: 'Move to…' }).click()
  const dialog = page.getByRole('dialog', { name: 'Move “Research”' })
  // Research can't go inside itself or Competitors, which is inside it.
  await expect(dialog.getByRole('option', { name: /^Research/ })).toHaveAttribute('aria-disabled', 'true')
  await expect(dialog.getByRole('option', { name: /Competitors/ })).toHaveAttribute('aria-disabled', 'true')
  await expect(dialog.getByRole('option', { name: /Competitors/ })).toContainText('can’t go inside itself')
  await dialog.getByRole('button', { name: 'Cancel' }).click()

  await (await hover(page, 'Alpha')).getByRole('button', { name: 'More for Alpha' }).click()
  await page.getByRole('menuitem', { name: 'Move to…' }).click()
  const move = page.getByRole('dialog', { name: 'Move “Alpha”' })
  await move.getByLabel('Search pages').fill('compet')
  await move.getByRole('option', { name: /Competitors/ }).click()
  await move.getByRole('button', { name: 'Move' }).click()
  await expect(move).toBeHidden()
  await expect(rows(page)).toHaveText(['Research', 'Competitors', 'Revolut', 'Alpha'])
  await expect.poll(() => levels(page)).toEqual(['1', '2', '3', '3'])
  await page.reload()
  await expect.poll(() => levels(page)).toEqual(['1', '2', '3', '3'])
})

test('from the keyboard: Tab indents, Shift-Tab outdents, Ctrl-Up reorders; a reload keeps the result', async ({ page }) => {
  await seed(page)
  await page.goto('/d/alpha')
  await expect(rows(page)).toHaveText(['Research', 'Alpha'])
  await row(page, 'Alpha').focus()
  await page.keyboard.press('Tab')
  await expect(rows(page)).toHaveText(['Research', 'Competitors', 'Alpha'])
  await expect.poll(() => levels(page)).toEqual(['1', '2', '2'])
  await expect(row(page, 'Alpha')).toBeFocused()
  await page.keyboard.press('Shift+Tab')
  await expect.poll(() => levels(page)).toEqual(['1', '2', '1'])
  await expect(row(page, 'Alpha')).toBeFocused()
  await page.keyboard.press('Control+ArrowUp')
  await expect(rows(page)).toHaveText(['Alpha', 'Research', 'Competitors'])
  await page.reload()
  await expect(rows(page)).toHaveText(['Alpha', 'Research', 'Competitors'])
})

test('deleting a page that has subpages names how many go with it, takes the branch, and leaves the open page if it was inside', async ({ page }) => {
  await seed(page)
  await page.goto('/d/rev') // Revolut is open, inside Research > Competitors
  await (await hover(page, 'Competitors')).getByRole('button', { name: 'More for Competitors' }).click()
  await page.getByRole('menuitem', { name: /^Delete doc/ }).click()
  const dialog = page.getByRole('dialog', { name: 'Delete “Competitors” and its 1 subpage?' })
  await expect(dialog).toContainText('Their slides, text and figures go with them.')
  await dialog.getByRole('button', { name: 'Cancel' }).click()
  await expect(rows(page)).toHaveText(['Research', 'Competitors', 'Revolut', 'Alpha'])

  await (await hover(page, 'Research')).getByRole('button', { name: 'More for Research' }).click()
  await page.getByRole('menuitem', { name: /^Delete doc/ }).click()
  const all = page.getByRole('dialog', { name: 'Delete “Research” and its 2 subpages?' })
  await all.getByRole('button', { name: 'Delete 3 pages' }).click()
  await expect(all).toBeHidden()
  await expect(page).not.toHaveURL(/\/d\/rev/) // the open deck was in the branch
  await expect(rows(page)).toHaveText(['Alpha'])
  await page.reload()
  await expect(rows(page)).toHaveText(['Alpha'])
})

test('a page without subpages keeps the plain dialog', async ({ page }) => {
  await seed(page)
  await page.goto('/d/alpha')
  await (await hover(page, 'Alpha')).getByRole('button', { name: 'More for Alpha' }).click()
  await page.getByRole('menuitem', { name: /^Delete deck/ }).click()
  const dialog = page.getByRole('dialog', { name: 'Delete “Alpha”?' })
  await expect(dialog).toContainText('Its slides and chat go with it.')
  await dialog.getByRole('button', { name: 'Delete deck' }).click()
  await expect(rows(page)).toHaveText(['Research'])
})

test('the deck bar’s delete says how many subpages go with the deck', async ({ page }) => {
  await seed(page)
  await page.addInitScript(() => {
    if (sessionStorage.getItem('kids')) return
    const s = JSON.parse(localStorage.getItem('smartchart.journey.decks.v1') ?? '{}') as { decks: Record<string, { parent?: unknown }> }
    s.decks.rev.parent = { kind: 'deck', id: 'alpha' } // Revolut now sits under Alpha
    localStorage.setItem('smartchart.journey.decks.v1', JSON.stringify(s)); sessionStorage.setItem('kids', '1')
  })
  await page.goto('/d/alpha')
  await page.getByRole('button', { name: 'Deck menu' }).click()
  await page.getByRole('menuitem', { name: 'Delete deck…' }).click()
  await expect(page.getByRole('dialog', { name: 'Delete “Alpha” and its 1 subpage?' })).toBeVisible()
})

const crumbs = (page: Page) => page.getByRole('navigation', { name: 'Breadcrumb' })

test('the header shows the pages above the open one as links, none for a page at the top, and a click opens it', async ({ page }) => {
  await seed(page)
  await page.goto('/d/rev') // Research > Competitors > Revolut
  await expect(crumbs(page).getByRole('link')).toHaveText(['Occam', 'Research', 'Competitors'])
  await crumbs(page).getByRole('link', { name: 'Research' }).click()
  await expect(page).toHaveURL(/\/doc\/doc_r$/)
  await expect(crumbs(page).getByRole('link')).toHaveText(['Occam']) // Research is at the top: no path
  await page.goto('/doc/doc_c')
  await expect(crumbs(page).getByRole('link')).toHaveText(['Occam', 'Research'])
  await page.goto('/d/alpha')
  await expect(crumbs(page).getByRole('link')).toHaveText(['Occam'])
})

test('the sidebar closed or open, the path is there; a move in the sidebar changes it at once', async ({ page }) => {
  await seed(page)
  await page.goto('/d/rev')
  await expect(row(page, 'Revolut')).toBeVisible() // the app has booted, so the key is heard
  await page.keyboard.press('Control+\\')
  await expect(sidebar(page)).toBeHidden()
  await expect(crumbs(page).getByRole('link')).toHaveText(['Occam', 'Research', 'Competitors'])
  await page.keyboard.press('Control+\\')
  await (await hover(page, 'Revolut')).getByRole('button', { name: 'More for Revolut' }).click()
  await page.getByRole('menuitem', { name: 'Move to…' }).click()
  const move = page.getByRole('dialog', { name: 'Move “Revolut”' })
  await move.getByRole('option', { name: 'Top level' }).click()
  await move.getByRole('button', { name: 'Move' }).click()
  await expect(move).toBeHidden()
  await expect(crumbs(page).getByRole('link')).toHaveText(['Occam'])
})

test('past three pages above the title, the middle ones fold into an ellipsis that names them', async ({ page }) => {
  await seed(page)
  await page.addInitScript(() => {
    if (sessionStorage.getItem('deep')) return
    const decks = JSON.parse(localStorage.getItem('smartchart.journey.decks.v1') ?? '{}') as { decks: Record<string, { parent?: unknown }> }
    const docs = JSON.parse(localStorage.getItem('smartchart.docs.v1') ?? '{}') as Record<string, { parent?: unknown; name?: string; text?: string; updated?: number; workspaceId?: string; sortKey?: string }>
    const mk = (id: string, name: string, parent: unknown) => { docs[id] = { id, name, text: `---\ntitle: ${name}\n---\n\n## One {#one}\n\nText.`, updated: 5, workspaceId: 'ws_local', parent, sortKey: 'a' } as never }
    mk('doc_x1', 'Level four', { kind: 'doc', id: 'doc_c' }); mk('doc_x2', 'Level five', { kind: 'doc', id: 'doc_x1' })
    decks.decks.rev.parent = { kind: 'doc', id: 'doc_x2' } // Research > Competitors > Level four > Level five > Revolut
    localStorage.setItem('smartchart.journey.decks.v1', JSON.stringify(decks)); localStorage.setItem('smartchart.docs.v1', JSON.stringify(docs)); sessionStorage.setItem('deep', '1')
  })
  await page.goto('/d/rev')
  await expect(crumbs(page).getByRole('link')).toHaveText(['Occam', 'Research', 'Level four', 'Level five'])
  await expect(crumbs(page).getByTitle('Competitors')).toHaveText('…')
})

/* The milestone's done-when: a three-level tree is built and walked with the keyboard alone (no pointer), and reload keeps it. */
test('done when: three levels built with Tab, kept by a reload, and walked and opened without a pointer', async ({ page }) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('flat')) return
    const d = (id: string, name: string, key: string) => [id, { id, name, text: `---\ntitle: ${name}\n---\n\n## One {#one}\n\nText.`, updated: 5, workspaceId: 'ws_local', sortKey: key }] as const
    localStorage.setItem('smartchart.docs.v1', JSON.stringify(Object.fromEntries([d('doc_a', 'Research', 'a'), d('doc_b', 'Competitors', 'b'), d('doc_c', 'Revolut', 'c')])))
    sessionStorage.setItem('flat', '1')
  })
  await page.goto('/doc/doc_a')
  await expect(rows(page)).toHaveText(['Research', 'Competitors', 'Revolut'])
  await row(page, 'Competitors').focus()
  await page.keyboard.press('Tab') // under Research
  await expect.poll(() => levels(page)).toEqual(['1', '2', '1'])
  await row(page, 'Revolut').focus()
  await page.keyboard.press('Tab') // under Research, after Competitors
  await expect.poll(() => levels(page)).toEqual(['1', '2', '2'])
  await page.keyboard.press('Tab') // under Competitors
  await expect.poll(() => levels(page)).toEqual(['1', '2', '3'])
  await expect(rows(page)).toHaveText(['Research', 'Competitors', 'Revolut'])

  await page.reload()
  await expect.poll(() => levels(page)).toEqual(['1', '2', '3'])

  // Walk it and open the deepest page, then read the path in the header.
  await row(page, 'Research').focus()
  await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowDown')
  await expect(row(page, 'Revolut')).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/doc\/doc_c$/)
  await expect(crumbs(page).getByRole('link')).toHaveText(['Occam', 'Research', 'Competitors'])
  // Outdent twice, and the path goes.
  await row(page, 'Revolut').focus()
  await page.keyboard.press('Shift+Tab'); await page.keyboard.press('Shift+Tab')
  await expect.poll(() => levels(page)).toEqual(['1', '2', '1'])
  await expect(crumbs(page).getByRole('link')).toHaveText(['Occam'])
})

test('1,000 pages: the sidebar opens a 200-child branch quickly and keeps one tab stop', async ({ page }) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('big')) return
    const docs: Record<string, object> = {}
    const key = (n: number) => `${n.toString(36).padStart(4, '0')}V`
    const add = (id: string, name: string, n: number, parent?: object) => { docs[id] = { id, name, text: `---\ntitle: ${name}\n---\n\n## One {#one}\n\nText.`, updated: 5, workspaceId: 'ws_local', sortKey: key(n), ...(parent ? { parent } : {}) } }
    add('big_0', 'Big branch', 0)
    for (let i = 1; i <= 200; i++) add(`big_${i}`, `Child ${i}`, i, { kind: 'doc', id: 'big_0' })
    for (let i = 201; i < 1000; i++) add(`top_${i}`, `Top ${i}`, i)
    localStorage.setItem('smartchart.docs.v1', JSON.stringify(docs)); sessionStorage.setItem('big', '1')
  })
  await page.goto('/doc/big_0')
  await expect(rows(page)).toHaveCount(800) // the branch is closed: 1 + 799 pages at the top
  const ms = await page.evaluate(async () => {
    const b = [...document.querySelectorAll('button')].find((x) => x.getAttribute('aria-label') === 'Expand Big branch')
    const t = performance.now()
    b?.click()
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
    return Math.round(performance.now() - t)
  })
  await expect(rows(page)).toHaveCount(1000)
  console.log(`expand 200 children among 1,000 pages: ${ms} ms`)
  expect(ms).toBeLessThan(1500)
  await expect(rows(page).and(page.locator('[tabindex="0"]'))).toHaveCount(1)
})

test('dragging a row onto the middle of another makes it that page’s last child, opening it; a reload keeps it', async ({ page }) => {
  await seed(page)
  await page.goto('/d/alpha')
  await expect(rows(page)).toHaveText(['Research', 'Alpha'])
  await row(page, 'Alpha').dragTo(row(page, 'Research'), { targetPosition: { x: 80, y: 16 } })
  await expect(rows(page)).toHaveText(['Research', 'Competitors', 'Alpha'])
  await expect.poll(() => levels(page)).toEqual(['1', '2', '2'])
  await expect(row(page, 'Research')).toHaveAttribute('aria-expanded', 'true')
  await page.reload()
  await expect.poll(() => levels(page)).toEqual(['1', '2', '2'])
})

test('dragging a row to the top edge of a sibling puts it just before that sibling', async ({ page }) => {
  await seed(page, ['doc:doc_r'])
  await page.goto('/d/alpha')
  await expect(rows(page)).toHaveText(['Research', 'Competitors', 'Alpha'])
  await row(page, 'Alpha').dragTo(row(page, 'Competitors'), { targetPosition: { x: 80, y: 3 } })
  await expect(rows(page)).toHaveText(['Research', 'Alpha', 'Competitors'])
  await expect.poll(() => levels(page)).toEqual(['1', '2', '2'])
  await page.reload()
  await expect(rows(page)).toHaveText(['Research', 'Alpha', 'Competitors'])
})

/** A locator's box on the page; throws when it is not there. */
async function box(l: Locator) { const b = await l.boundingBox(); if (!b) throw new Error('not on the page'); return b }

/** Holds `from` with the mouse and moves over `to` at (x, y of the row); the caller releases. */
async function hold(page: Page, from: string, to: string, y: number) {
  const a = (await box(row(page, from))), b = (await box(row(page, to)))
  await page.mouse.move(a.x + 80, a.y + 16); await page.mouse.down()
  await page.mouse.move(a.x + 80, a.y + 24, { steps: 3 }); await page.mouse.move(b.x + 80, b.y + y, { steps: 6 })
}

test('resting 600 ms over a collapsed parent opens it, mid-drag', async ({ page }) => {
  await seed(page)
  await page.goto('/d/alpha')
  await expect(rows(page)).toHaveText(['Research', 'Alpha'])
  await hold(page, 'Alpha', 'Research', 16)
  const r = (await box(row(page, 'Research')))
  await page.mouse.move(r.x + 82, r.y + 16); await page.mouse.move(r.x + 84, r.y + 16) // Playwright delivers a dragover with the next move
  await expect(row(page, 'Research')).toHaveAttribute('aria-expanded', 'true')
  await page.mouse.up()
})

test('dropping on the empty space under the last row makes the page top level, and says so', async ({ page }) => {
  await seed(page, ['doc:doc_r'])
  await page.goto('/d/alpha')
  await expect(rows(page)).toHaveText(['Research', 'Competitors', 'Alpha'])
  const c = (await box(row(page, 'Competitors')))
  await page.mouse.move(c.x + 80, c.y + 16); await page.mouse.down()
  await page.mouse.move(c.x + 80, c.y + 40, { steps: 3 }); await page.mouse.move(c.x + 80, c.y + 120, { steps: 6 })
  await page.mouse.move(c.x + 80, c.y + 130); await page.mouse.up()
  await expect.poll(() => levels(page)).toEqual(['1', '1', '1'])
  await expect(sidebar(page).getByRole('status')).toHaveText('Moved “Competitors” to the top level.')
})

test('a row dropped on a parent is announced', async ({ page }) => {
  await seed(page)
  await page.goto('/d/alpha')
  await row(page, 'Alpha').dragTo(row(page, 'Research'), { targetPosition: { x: 80, y: 16 } })
  await expect(sidebar(page).getByRole('status')).toHaveText('Moved “Alpha” under “Research”.')
})

test('the tree scrolls when a drag is held near its bottom edge', async ({ page }) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('long')) return
    const docs: Record<string, object> = {}
    for (let i = 0; i < 60; i++) { const id = `long_${i}`; docs[id] = { id, name: `Page ${i}`, text: `---\ntitle: Page ${i}\n---\n\n## One {#one}\n\nText.`, updated: 5, workspaceId: 'ws_local', sortKey: `${i.toString(36).padStart(3, '0')}V` } }
    localStorage.setItem('smartchart.docs.v1', JSON.stringify(docs)); sessionStorage.setItem('long', '1')
  })
  await page.goto('/doc/long_0')
  await expect(rows(page)).toHaveCount(60)
  const side = (await box(sidebar(page)))
  const first = (await box(row(page, 'Page 0').first()))
  await page.mouse.move(first.x + 80, first.y + 16); await page.mouse.down()
  await page.mouse.move(first.x + 80, first.y + 40, { steps: 3 })
  for (let i = 0; i < 40; i++) await page.mouse.move(first.x + 80, side.y + side.height - 10 - (i % 2))
  await page.mouse.up()
  const scrolled = await sidebar(page).evaluate((nav) => [...nav.querySelectorAll('div')].find((d) => /auto|scroll/.test(getComputedStyle(d).overflowY) && d.scrollHeight > d.clientHeight)?.scrollTop ?? 0)
  expect(scrolled).toBeGreaterThan(0)
})

test('pressing and dragging from a row’s + or ··· button does not leave a menu open', async ({ page }) => {
  await seed(page)
  await page.goto('/d/alpha')
  await row(page, 'Research').hover()
  const plus = (await box(page.getByRole('button', { name: 'Add subpage to Research' })))
  const a = (await box(row(page, 'Alpha')))
  await page.mouse.move(plus.x + 8, plus.y + 8); await page.mouse.down()
  await page.mouse.move(a.x + 80, a.y + 16, { steps: 8 }); await page.mouse.up()
  await expect(page.getByRole('menu')).toHaveCount(0)
  await row(page, 'Research').hover()
  await page.getByRole('button', { name: 'Add subpage to Research' }).click()
  await expect(page.getByRole('menu')).toHaveCount(1) // a plain click still opens it
})

test('done when: an illegal drop does nothing; the legal ones land where dropped and a reload keeps them', async ({ page }) => {
  await seed(page, ['doc:doc_r', 'doc:doc_c'])
  await page.goto('/d/rev')
  await expect(rows(page)).toHaveText(['Research', 'Competitors', 'Revolut', 'Alpha'])
  // Competitors onto its own child: no line, no ring, no move, no notice.
  await hold(page, 'Competitors', 'Revolut', 16)
  const r = (await box(row(page, 'Revolut')))
  await page.mouse.move(r.x + 82, r.y + 16)
  await page.mouse.up()
  await expect(rows(page)).toHaveText(['Research', 'Competitors', 'Revolut', 'Alpha'])
  await expect.poll(() => levels(page)).toEqual(['1', '2', '3', '1'])
  await expect(sidebar(page).getByRole('status')).toHaveCount(0)
  // Revolut to the top of the list (before Research).
  await row(page, 'Revolut').dragTo(row(page, 'Research'), { targetPosition: { x: 80, y: 3 } })
  await expect(rows(page)).toHaveText(['Revolut', 'Research', 'Competitors', 'Alpha'])
  await expect.poll(() => levels(page)).toEqual(['1', '1', '2', '1'])
  // Alpha under Research, then between Research and its child.
  await row(page, 'Alpha').dragTo(row(page, 'Research'), { targetPosition: { x: 80, y: 16 } })
  await expect(rows(page)).toHaveText(['Revolut', 'Research', 'Competitors', 'Alpha'])
  await row(page, 'Alpha').dragTo(row(page, 'Competitors'), { targetPosition: { x: 80, y: 3 } })
  await expect(rows(page)).toHaveText(['Revolut', 'Research', 'Alpha', 'Competitors'])
  await page.reload()
  await expect(rows(page)).toHaveText(['Revolut', 'Research', 'Alpha', 'Competitors'])
  await expect.poll(() => levels(page)).toEqual(['1', '1', '2', '2'])
})
