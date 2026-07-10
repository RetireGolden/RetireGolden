import { expect, type Page, test } from '@playwright/test'

/**
 * Shallow happy-path smoke suite for the flows users depend on:
 * create → autosave → reload persistence, Results/Monte Carlo rendering,
 * backup export → clear → import round-trip, and the lazy Examples/Compare
 * routes. Depth stays in unit tests; these only prove the wiring in a real
 * browser (IndexedDB, workers, code-split chunks).
 */

async function createPlanFromHome(page: Page) {
  await page.goto('/')
  // First run in a fresh browser context shows the getting-started paths.
  await page.getByRole('button', { name: 'Build your own plan' }).click()
  await expect(page).toHaveURL(/\/plan\/[^/]+\/household$/)
}

test.describe('Smoke', () => {
  test('created plan autosaves and survives a reload (IndexedDB)', async ({ page }) => {
    await createPlanFromHome(page)

    const nameInput = page
      .locator('.field, .field-with-action')
      .filter({ hasText: 'Name' })
      .first()
      .locator('input')
    await nameInput.fill('Smoke Tester')
    await nameInput.blur()
    await expect(page.getByText('Stored on this device')).toBeVisible()

    await page.reload()
    await expect(
      page
        .locator('.field, .field-with-action')
        .filter({ hasText: 'Name' })
        .first()
        .locator('input'),
    ).toHaveValue('Smoke Tester')
  })

  test('Results and Monte Carlo render numbers for an example plan', async ({ page }) => {
    await page.goto('/examples')
    await expect(page.getByRole('heading', { name: 'Example library' })).toBeVisible()
    // Non-featured examples live behind the first-run "Browse all" funnel.
    await page.getByRole('button', { name: /Browse all \d+ examples/ }).click()
    const card = page.locator('.example-card').filter({ hasText: 'Aggressive saver to early retirement' })
    await card.getByRole('button', { name: 'Open' }).click()
    await expect(page).toHaveURL(/\/plan\/[^/]+\/results$/)

    // The KPI strip renders projected dollar figures.
    await expect(page.locator('.kpi-value').first()).toContainText('$')

    await page.getByRole('link', { name: 'Monte Carlo' }).click()
    // The 1,000-path auto-run finishes and the success gauge shows a rate.
    await expect(page.locator('.success-gauge-value')).toContainText('%', { timeout: 60_000 })
  })

  test('backup export → clear → import round-trips', async ({ page }) => {
    await createPlanFromHome(page)
    await page.goto('/')

    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Download plan backup' }).click()
    const download = await downloadPromise
    const backupPath = await download.path()
    expect(backupPath).toBeTruthy()

    // Clear-all runs through the in-app dialog with a typed-confirmation gate
    // (no native confirm since the UI/UX remediation).
    await page.getByRole('button', { name: 'Clear all data' }).click()
    const confirmDialog = page.getByRole('dialog', { name: 'Clear all data' })
    await expect(confirmDialog).toBeVisible()
    const eraseButton = confirmDialog.getByRole('button', { name: 'Erase everything' })
    await expect(eraseButton).toBeDisabled()
    await confirmDialog.getByRole('textbox').fill('delete')
    await eraseButton.click()
    await expect(page.getByText('All RetireGolden data has been erased from this browser.')).toBeVisible()

    await page.locator('input[type="file"]').setInputFiles(backupPath!)
    await expect(page.getByText(/Imported 1 plan/)).toBeVisible()
  })

  test('lazy Examples and Compare routes load', async ({ page }) => {
    await page.goto('/examples')
    await expect(page.getByRole('heading', { name: 'Example library' })).toBeVisible()

    await page.goto('/compare')
    await expect(page.getByRole('heading', { name: 'Compare plans' })).toBeVisible()
  })
})
