import { expect, test } from '@playwright/test'

import { openExamplePlan } from './helpers'

/**
 * Browser smoke for the sustainable-spending solver: open an example, visit
 * How much can I spend?, require the dollar answer and no Solver-error
 * chrome. Unit tests cannot reach the worker spawn. Same shared worker as
 * Roth & Tax Optimizer (optimize.spec.ts).
 *
 * Aggressive saver has Marketplace years past the latest ACA parameter year,
 * whose credit the projection cannot price. Until 2026-09-26 that made the
 * solver refuse every probe and this spec accepted the empty well; the solver
 * now answers on the full premium and names those years, so the answer and
 * its note are required. The amount itself (about $90,300 from a 2026 start)
 * is pinned by examples.spendingSolver.golden.test.ts at the examples' fixed
 * start year. The example runs from that same 2026 start here too (decision
 * D-2027-ROLLOVER), but this browser smoke leaves the amount to the golden test.
 *
 * This spec runs against Vite's dev server, like the rest of app/e2e — it
 * does not load the production Rolldown worker graph that #672 crashed on.
 * The production pin is the bundle-budget cycle check over dist/assets
 * (`workerEntryImporters` in app/scripts/bundleBudget.mjs).
 */
test.describe('Spending solver', () => {
  test('runs the solver for an example plan and renders the dollar answer', async ({ page }) => {
    test.setTimeout(90_000)

    await openExamplePlan(page, 'Aggressive saver to early retirement')

    await page.getByRole('link', { name: 'How much can I spend?' }).click()
    await expect(page).toHaveURL(/\/plan\/[^/]+\/spending-solver$/)
    await expect(page.getByRole('heading', { name: 'How much can I spend?', level: 2 })).toBeVisible()

    // Auto-runs 300ms after mount through the worker. The dollar answer
    // proves the worker bundle loaded and the solver finished with a level.
    const answer = page.getByRole('heading', {
      name: /^Your plan can sustain about \$[\d,]+ of baseline spending per year\.$/,
      level: 2,
    })
    await expect(answer).toBeVisible({ timeout: 60_000 })
    await expect(page.getByRole('heading', { name: 'No sustainable spending level found', level: 2 })).toHaveCount(0)
    await expect(page.getByTestId('aca-gross-premium-note')).toContainText("The premium tax credit isn't counted in")
    await expect(page.getByText(/Solver error/)).toHaveCount(0)
  })
})
