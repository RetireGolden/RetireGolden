import { expect, test } from '@playwright/test'

import { openExamplePlan } from './helpers'

/**
 * Browser coverage for the sustainable-spending solver, which unit tests
 * cannot reach: it loads the shared planner module worker
 * (packages/planner-ui/src/workers/planner.worker.ts) with its own Rolldown
 * codeSplitting config. Isolating the funding/settlement coordinators in
 * that graph created a circular chunk import whose production TDZ read as
 * "Cannot access 'oe' before initialization" (#672). Same worker as
 * Roth & Tax Optimizer (optimize.spec.ts); both routes auto-run on mount.
 */
test.describe('Spending solver', () => {
  test('runs the solver for an example plan and renders a completed answer', async ({ page }) => {
    test.setTimeout(90_000)

    await openExamplePlan(page, 'Aggressive saver to early retirement')

    await page.getByRole('link', { name: 'How much can I spend?' }).click()
    await expect(page).toHaveURL(/\/plan\/[^/]+\/spending-solver$/)
    await expect(page.getByRole('heading', { name: 'How much can I spend?', level: 2 })).toBeVisible()

    // Auto-runs 300ms after mount through the worker. A completed run
    // renders either the dollar answer (`.mc-hero` / `.stat-grid`) or the
    // announced no-sustainable-level well. Either proves the worker bundle
    // loaded and the solver finished — coupling the wait to one outcome
    // would make a still-successful other outcome read as a hang.
    const dollarResult = page.locator('.mc-hero, .stat-grid').first()
    const noLevel = page.getByRole('heading', { name: 'No sustainable spending level found', level: 2 })
    await expect(dollarResult.or(noLevel)).toBeVisible({ timeout: 60_000 })
    await expect(page.getByText(/Solver error/)).toHaveCount(0)
    await expect(page.getByText(/Cannot access ['"]oe['"] before initialization/)).toHaveCount(0)
  })
})
