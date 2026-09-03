import { expect, test } from '@playwright/test'

import { openExamplePlan } from './helpers'

/**
 * Browser coverage for the optimizer, which unit tests cannot reach: it
 * loads the ~3.4 MB HiGHS wasm inside a module worker
 * (packages/planner-ui/src/workers/planner.worker.ts) with its own Rolldown
 * codeSplitting config, so a Vite/Rolldown bump can break the worker bundle
 * while lint, unit tests, and pack-smoke all stay green. Mirrors the
 * Monte Carlo pattern in smoke.spec.ts.
 */
test.describe('Optimize', () => {
  test('runs the solver for an example plan and renders a completed recommendation', async ({ page }) => {
    // The wasm load, candidate search, and full-projection re-price can run
    // close to Playwright's 30s default *test* timeout on a slow CI runner,
    // even though the assertion below allows 60s for its own wait: the test
    // timeout is a hard ceiling on the whole test, this wait included. Raise
    // it to give the documented 60s budget somewhere to fit, with headroom
    // for the navigation steps above it.
    test.setTimeout(90_000)

    await openExamplePlan(page, 'Aggressive saver to early retirement')

    await page.getByRole('link', { name: 'Roth & Tax Optimizer' }).click()
    await expect(page).toHaveURL(/\/plan\/[^/]+\/optimize$/)
    await expect(page.getByRole('heading', { name: 'Roth & Tax Optimizer', level: 2 })).toBeVisible()

    // The optimizer auto-runs 300ms after mount: it loads the HiGHS wasm in
    // a module worker, searches candidate schedules, then re-prices the
    // winner through the full year-by-year projection before rendering a
    // result. A completed run renders exactly one of these outcome cards
    // (OptimizePage.tsx): a dollar-denominated recommendation (`.stat-grid`),
    // "nothing beat your current plan", "no beneficial conversions found",
    // or "couldn't optimize this plan" (infeasible). Assert on any of them —
    // this proves the worker bundle loaded and the solver ran to completion,
    // which is what this spec exists to catch; coupling the wait to the one
    // outcome this example plan happens to produce today would make a
    // different, still-successful outcome read as a hang instead of a pass.
    // Same generous timeout as Monte Carlo's 1,000-path auto-run in
    // smoke.spec.ts — CI runners measure roughly 6x local wall time.
    const dollarResult = page.locator('.stat-grid .stat-value').first()
    const incumbentHolds = page.getByRole('heading', { name: /still ranks highest/, level: 2 })
    const noBenefit = page.getByRole('heading', { name: 'No beneficial conversions found', level: 2 })
    const infeasible = page.getByRole('heading', { name: "Couldn't optimize this plan", level: 2 })
    await expect(dollarResult.or(incumbentHolds).or(noBenefit).or(infeasible)).toBeVisible({ timeout: 60_000 })
  })
})
