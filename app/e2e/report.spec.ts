import { expect, test } from '@playwright/test'

/**
 * Browser coverage for the printable report route (packages/planner-ui/src
 * /routes/PlanRoutes.tsx, ":planId/report"), which sits outside the
 * workspace shell and has its own bundling boundary. Unit tests render the
 * component in jsdom; only a real browser proves the route resolves, the
 * projection model renders, and the print/export controls are wired.
 */
test.describe('Report', () => {
  test('renders the report headline sections with a working print/export affordance', async ({ page }) => {
    await page.goto('/examples')
    await expect(page.getByRole('heading', { name: 'Example library' })).toBeVisible()
    // Non-featured examples live behind the first-run "Show all" funnel.
    await page.getByRole('button', { name: /Show all \d+ examples/ }).click()
    const card = page.locator('.example-card').filter({ hasText: 'Aggressive saver to early retirement' })
    await card.getByRole('button', { name: 'Open' }).click()
    await expect(page).toHaveURL(/\/plan\/[^/]+\/results$/)

    await page.getByRole('link', { name: 'View printable report' }).click()
    await expect(page).toHaveURL(/\/plan\/[^/]+\/report$/)

    // Headline sections of the report model rendered.
    await expect(page.getByRole('heading', { name: 'Headline results' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Household' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Year-by-year appendix (nominal $)' })).toBeVisible()
    await expect(page.locator('.report-kpis .kpi-value').first()).toContainText('$')

    // Print/export affordances are present and enabled.
    const printButton = page.getByRole('button', { name: 'Print / Save as PDF' })
    const downloadButton = page.getByRole('button', { name: 'Download HTML report' })
    await expect(printButton).toBeVisible()
    await expect(printButton).toBeEnabled()
    await expect(downloadButton).toBeVisible()
    await expect(downloadButton).toBeEnabled()
  })
})
