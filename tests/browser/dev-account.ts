/* The editor needs an account. Tests that are not about accounts use the dev account (dev builds only): its
   decks live in this browser, so they seed decks through localStorage as before. Its "Connect an agent" nudge is
   dismissed: it sits over the bottom-right corner, where Save and Done are. */
import { test, type Page } from '@playwright/test'

export const devAccount = (page: Page) => page.addInitScript(() => { localStorage.setItem('smartchart.devAccount', '1'); localStorage.setItem('smartchart.agentNudge.dismissed.dev', '1') })
/** Call at the top of a spec file: every test in it runs signed in as the dev account. */
export const signInAsDev = () => test.beforeEach(({ page }) => devAccount(page))
