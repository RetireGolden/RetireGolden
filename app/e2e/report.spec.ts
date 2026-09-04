import { expect, test } from '@playwright/test'

import { openExamplePlan } from './helpers'

/**
 * Browser coverage for the printable report route (packages/planner-ui/src
 * /routes/PlanRoutes.tsx, ":planId/report"), which sits outside the
 * workspace shell and has its own bundling boundary. Unit tests render the
 * component in jsdom; only a real browser proves the route resolves and the
 * projection model renders.
 */
test.describe('Report', () => {
  test('renders the report headline sections and downloads the HTML report', async ({ page }) => {
    await openExamplePlan(page, 'Aggressive saver to early retirement')

    await page.getByRole('link', { name: 'View printable report' }).click()
    await expect(page).toHaveURL(/\/plan\/[^/]+\/report$/)

    // Headline sections of the report model rendered.
    await expect(page.getByRole('heading', { name: 'Headline results' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Household' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Year-by-year appendix (nominal $)' })).toBeVisible()
    await expect(page.locator('.report-kpis .kpi-value').first()).toContainText('$')

    // Download HTML report is exercised for real (ReportPage.tsx calls
    // downloadStandaloneReport, which clicks a Blob-backed <a download>) —
    // mirrors smoke.spec.ts's backup-export assertion, so a regression in
    // that wiring fails this test instead of a visible-and-enabled button
    // that happens to have a no-op handler.
    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Download HTML report' }).click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toMatch(/\.html$/)

    // Print opens the browser's native print dialog, which Playwright
    // cannot drive headlessly — window.print() is not invoked here. This
    // only proves the button is present and not disabled.
    const printButton = page.getByRole('button', { name: 'Print / Save as PDF' })
    await expect(printButton).toBeVisible()
    await expect(printButton).toBeEnabled()
  })
})
