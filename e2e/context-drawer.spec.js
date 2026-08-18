import { test, expect } from '@playwright/test'

/**
 * The patient-context rail (identity, AI summary, and every triage control —
 * status/priority/assignee/tags) used to be `hidden 2xl:block` with NO
 * substitute below that width: on any screen narrower than 1536px logical
 * (most laptops — a 13" MacBook Air is 1280px, a 14" MacBook Pro is 1512px)
 * both Phase 1's headline feature (patient context) and all of Phase 2's
 * (triage) were completely unreachable, not just visually cramped.
 *
 * This is the substitute: a Drawer (components/ui/Drawer.js), opened by a
 * "Patient info" button in the chat header that's itself only shown below
 * 2xl (the fixed pane already covers 2xl+, see triage.spec.js). Same
 * PatientContext component, same props, same triage.js logic underneath —
 * only the chrome differs, so these tests are functional parity checks
 * against the already-covered fixed-pane behaviour, not new triage logic.
 *
 * Runs against demo mode: seeded, hermetic, zero-login, no database.
 */

const INBOX = '/conversations'

function threadRows(page) {
  return page.getByRole('listbox', { name: 'Conversations' }).getByRole('option')
}

async function openFirstThread(page) {
  await page.goto(INBOX, { waitUntil: 'networkidle' })
  await threadRows(page).first().click()
  await page.waitForTimeout(300)
}

const infoButton = (page) => page.getByRole('button', { name: 'Patient info' })
// Scoped to the drawer's own role="dialog" — a plain getByText('Patient
// Context') matches the FIXED pane's heading too (present in the DOM at any
// width, just display:none below 2xl), which Playwright's strict mode
// correctly refuses to disambiguate on its own.
const drawer = (page) => page.getByRole('dialog', { name: 'Patient context' })

test.describe('context drawer — visibility by breakpoint', () => {
  test('below 2xl, the Patient info button is visible in the chat header', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await openFirstThread(page)
    await expect(infoButton(page)).toBeVisible()
  })

  test('at 2xl+, the Patient info button is hidden — the fixed pane covers it instead', async ({ page }) => {
    await page.setViewportSize({ width: 1680, height: 950 })
    await openFirstThread(page)
    await expect(infoButton(page)).not.toBeVisible()
    // The fixed pane is showing instead — same content, no button needed.
    await expect(page.getByText('Patient Context', { exact: true })).toBeVisible()
  })
})

test.describe('context drawer — open, content, close', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test('opening the drawer shows identity and the Triage section', async ({ page }) => {
    await openFirstThread(page)
    await infoButton(page).click()

    await expect(drawer(page)).toBeVisible()
    await expect(drawer(page).getByText('Priority', { exact: true })).toBeVisible()
    await expect(drawer(page).getByText('Assigned to', { exact: true })).toBeVisible()
    await expect(drawer(page).getByText('Tags', { exact: true })).toBeVisible()
  })

  test('the X button closes the drawer', async ({ page }) => {
    await openFirstThread(page)
    await infoButton(page).click()
    await expect(drawer(page)).toBeVisible()

    await drawer(page).getByRole('button', { name: 'Close panel' }).click()
    await expect(drawer(page)).not.toBeVisible()
  })

  test('Escape closes the drawer', async ({ page }) => {
    await openFirstThread(page)
    await infoButton(page).click()
    await expect(drawer(page)).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(drawer(page)).not.toBeVisible()
  })

  test('clicking the backdrop closes the drawer', async ({ page }) => {
    await openFirstThread(page)
    await infoButton(page).click()
    await expect(drawer(page)).toBeVisible()

    // Click far left of the viewport — inside the backdrop, well outside the
    // right-anchored drawer panel itself.
    await page.mouse.click(20, 400)
    await expect(drawer(page)).not.toBeVisible()
  })

  test('setting priority through the drawer works exactly like the fixed pane', async ({ page }) => {
    await openFirstThread(page)
    await infoButton(page).click()

    const trigger = drawer(page).getByRole('button', { name: /priority/i }).first()
    await trigger.click()
    await page.getByRole('menuitem', { name: /urgent/i }).click()
    await page.waitForTimeout(200)

    await expect(drawer(page).getByRole('button', { name: /priority: urgent/i })).toBeVisible()
  })
})
