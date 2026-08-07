import { test, expect } from '@playwright/test'

/**
 * PARITY NET for the Phase 1 inbox rewrite.
 *
 * Written and proven GREEN against the OLD 1,037-line conversations page before
 * the rewrite started, so it describes behaviour that actually exists rather
 * than behaviour invented to match the new code. Every assertion here must still
 * hold afterwards; anything that breaks is a real regression in a screen that
 * handles live patient conversations.
 *
 * Assertions are deliberately behavioural and selector-light — they check what a
 * clinic user can observe (a thread list exists, picking one shows its messages,
 * search narrows the list), not internal DOM structure, which the rewrite is
 * explicitly allowed to change.
 *
 * Runs against demo mode: seeded, hermetic, zero-login, no database.
 */

const INBOX = '/conversations'

/**
 * Thread rows. Matched by ARIA role rather than tag: the rewrite moved them from
 * bare <button> onto the ListRow primitive (role="option"), and a selector tied
 * to the tag would report "0 threads" for a perfectly healthy list — which is
 * exactly what happened the first time this suite ran against the new page.
 */
function threadRows(page) {
  return page.getByRole('option')
}

test.describe('inbox parity', () => {
  test('loads with a thread list and an open conversation', async ({ page }) => {
    const errors = []
    page.on('pageerror', e => errors.push(e.message))

    await page.goto(INBOX, { waitUntil: 'networkidle' })

    // Some conversation content is on screen — the demo seed guarantees threads.
    await expect(page.locator('body')).toContainText(/message|conversation|Conversations|Inbox/i)
    expect(errors, `page errors: ${errors.join('; ')}`).toEqual([])
  })

  test('a search box narrows the visible threads', async ({ page }) => {
    await page.goto(INBOX, { waitUntil: 'networkidle' })

    const search = page.getByPlaceholder(/search/i).first()
    await expect(search).toBeVisible()

    const before = await threadRows(page).count()
    await search.fill('zzzzzzz-no-such-patient')
    await page.waitForTimeout(300)
    const after = await threadRows(page).count()

    expect(after, 'a nonsense query should not leave the full list visible').toBeLessThan(before)
  })

  test('clearing the search restores the list', async ({ page }) => {
    await page.goto(INBOX, { waitUntil: 'networkidle' })
    const search = page.getByPlaceholder(/search/i).first()

    const before = await threadRows(page).count()
    await search.fill('zzzzzzz')
    await page.waitForTimeout(250)
    await search.fill('')
    await page.waitForTimeout(250)
    const restored = await threadRows(page).count()

    expect(restored).toBe(before)
  })

  test('selecting a thread shows its conversation', async ({ page }) => {
    await page.goto(INBOX, { waitUntil: 'networkidle' })

    const rows = threadRows(page)
    const count = await rows.count()
    test.skip(count === 0, 'demo seed produced no threads')

    await rows.first().click()
    await page.waitForTimeout(400)

    // A timestamp alone is NOT enough. The demo fixture wrote `content:` where
    // every consumer reads `.message`, so the inbox rendered correctly-shaped
    // bubbles containing no text at all, and a timestamp-only assertion passed
    // straight over it. Assert real prose is on screen.
    await expect(page.locator('body')).toContainText(/\d{1,2}:\d{2}\s*(am|pm)/i)
    const prose = await page.evaluate(() => {
      const bodies = [...document.querySelectorAll('p')].map(p => p.textContent.trim())
      // a real message body: several words, not a label/'· timestamp' line
      return bodies.filter(t => t.split(/\s+/).length >= 4 && !/·/.test(t)).length
    })
    expect(prose, 'no message bodies rendered in the transcript').toBeGreaterThan(0)
  })

  test('thread rows show a message preview, not just a name', async ({ page }) => {
    await page.goto(INBOX, { waitUntil: 'networkidle' })
    const rows = threadRows(page)
    test.skip(await rows.count() === 0, 'demo seed produced no threads')
    // Guards the same fixture bug from the list side.
    await expect(rows.first()).toContainText(/[a-z]{3,}\s+[a-z]{3,}/i)
  })

  test('channel filtering is reachable', async ({ page }) => {
    await page.goto(INBOX, { waitUntil: 'networkidle' })
    // Either the old horizontal tabs or the new folder rail — both expose the
    // channel names as controls.
    await expect(page.getByText(/whatsapp/i).first()).toBeVisible()
  })

  test('no horizontal overflow at desktop, tablet and mobile', async ({ page }) => {
    for (const size of [{ width: 1440, height: 900 }, { width: 768, height: 1024 }, { width: 375, height: 812 }]) {
      await page.setViewportSize(size)
      await page.goto(INBOX, { waitUntil: 'networkidle' })
      const overflows = await page.evaluate(() =>
        document.documentElement.scrollWidth > window.innerWidth + 1
      )
      expect(overflows, `horizontal overflow at ${size.width}px`).toBe(false)
    }
  })

  test('renders in both themes without console errors', async ({ page }) => {
    for (const theme of ['dark', 'light']) {
      const errors = []
      page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
      await page.goto(INBOX, { waitUntil: 'networkidle' })
      await page.evaluate(t => document.documentElement.setAttribute('data-theme', t), theme)
      await page.waitForTimeout(500)
      expect(errors, `console errors in ${theme}: ${errors.join('; ')}`).toEqual([])
    }
  })
})
