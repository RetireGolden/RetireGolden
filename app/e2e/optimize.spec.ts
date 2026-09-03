import { expect, test } from '@playwright/test'

/**
 * Browser coverage for the optimizer, which unit tests cannot reach: it
 * loads the ~3.4 MB HiGHS wasm inside a module worker
 * (packages/planner-ui/src/workers/planner.worker.ts) with its own Rolldown
 * codeSplitting config, so a Vite/Rolldown bump can break the worker bundle
 * while lint, unit tests, and pack-smoke all stay green. Mirrors the
 * Monte Carlo pattern in smoke.spec.ts.
 */
test.describe('Optimize', () => {
  test('runs the solver for an example plan and renders a dollar result', async ({ page }) => {
    await page.goto('/examples')
    await expect(page.getByRole('heading', { name: 'Example library' })).toBeVisible()
    // Non-featured examples live behind the first-run "Show all" funnel.
    await page.getByRole('button', { name: /Show all \d+ examples/ }).click()
    const card = page.locator('.example-card').filter({ hasText: 'Aggressive saver to early retirement' })
    await card.getByRole('button', { name: 'Open' }).click()
    await expect(page).toHaveURL(/\/plan\/[^/]+\/results$/)

    await page.getByRole('link', { name: 'Roth & Tax Optimizer' }).click()
    await expect(page).toHaveURL(/\/plan\/[^/]+\/optimize$/)
    await expect(page.getByRole('heading', { name: 'Roth & Tax Optimizer', level: 2 })).toBeVisible()

    // The optimizer auto-runs 300ms after mount: it loads the HiGHS wasm in
    // a module worker, searches candidate schedules, then re-prices the
    // winner through the full year-by-year projection before rendering a
    // result. Same generous timeout as Monte Carlo's 1,000-path auto-run in
    // smoke.spec.ts — CI runners measure roughly 6x local wall time.
    await expect(page.locator('.stat-grid .stat-value').first()).toContainText('$', { timeout: 60_000 })
  })
})
