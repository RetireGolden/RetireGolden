import { expect, test } from '@playwright/test'

import { openExamplePlan } from './helpers'

/**
 * Browser smoke for the sustainable-spending solver: open an example, visit
 * How much can I spend?, require a completed answer (or the announced empty
 * well) and no Solver-error chrome. Unit tests cannot reach the worker spawn.
 * Same shared worker as Roth & Tax Optimizer (optimize.spec.ts).
 *
 * This spec runs against Vite's dev server, like the rest of app/e2e — it
 * does not load the production Rolldown worker graph that #672 crashed on.
 * The production pin is the bundle-budget cycle check over dist/assets
 * (`workerEntryImporters` in app/scripts/bundleBudget.mjs).
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
