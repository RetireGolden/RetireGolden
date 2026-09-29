import { expect, test } from '@playwright/test'

import { openExamplePlan } from '../e2e/helpers'

/**
 * The production chunk graph, exercised end to end.
 *
 * When `annualProjectionFundingClose` had an explicit-only chunk in the app
 * graph, it sat in a static import cycle with the `useProjection` core and
 * its module-level alias of the half-cent funding tolerance evaluated to
 * `undefined` before the core chunk ran. Every comparison against it read
 * false: the funding solver "never converged" (one "could not reconcile"
 * note per year, differing by $0.00), ACA years fell back to gross premium,
 * and `depletionYear` was never set, so a plan with $500k+ shortfalls every
 * year still read "Your money lasts the full plan". Only the built `dist/`
 * reproduces it — the dev server serves unbundled modules — which is why
 * this spec runs under playwright.dist.config.ts against `vite preview`.
 *
 * The example couple is the same plan the notes were first seen on, and it
 * converges in every year in the engine's own tests; the spending edit is
 * the smallest change that makes it deplete in the steady-market ledger.
 */
test.describe('Production build', () => {
  test('the funding fixed point converges and depletion is reported on the Results page', async ({ page }) => {
    test.setTimeout(90_000)
    await openExamplePlan(page, 'Example couple')

    // Scoped to the Modeling-notes callout, not `page.getByRole('listitem')`:
    // ResultsPage renders several other lists (Facts used, per-detail notes,
    // the inherited-RMD schedule, citations), and the positive pin below
    // would count a repeat of the same phrase in any of them.
    const notes = page.locator('.callout--warn').filter({ hasText: 'Modeling notes' }).getByRole('listitem')
    await expect(page.getByText('Your money lasts the full plan, through 2059.')).toBeVisible({ timeout: 30_000 })
    // A converged solver emits neither of these for a plan that converges in
    // every year under the engine's unit tests.
    await expect(notes.filter({ hasText: 'could not reconcile within half a cent' })).toHaveCount(0)
    await expect(notes.filter({ hasText: 'did not reach a stable subsidized fixed point' })).toHaveCount(0)
    // The plan's real notes still arrive, so the empty checks above are not
    // an unrendered list.
    await expect(notes.filter({ hasText: 'Sam has no Roth account' })).toHaveCount(1)

    // Make the plan deplete: baseline spending far above what the portfolio
    // and income can fund. Example edits are kept on this device only.
    await page.getByRole('link', { name: 'Spending', exact: true }).click()
    const baseline = page.getByRole('textbox', { name: 'Baseline annual spending' })
    await expect(baseline).toBeVisible()
    await baseline.fill('600000')
    await baseline.press('Tab')

    await page.getByRole('link', { name: 'Results', exact: true }).click()
    await expect(page.getByText(/This plan runs out of money in 20\d\d\./)).toBeVisible({ timeout: 30_000 })
    await expect(page.getByText('Your money lasts the full plan')).toHaveCount(0)
  })
})

/**
 * The four worker channels, run from the production build. A production build
 * has no in-process fallback (`typeof Worker === 'undefined' &&
 * import.meta.env.DEV` in planner-ui's runners compiles to `false`), so these pages
 * compute only if the one emitted worker chunk spawns and answers. Each spec
 * asserts what its dev-server counterpart in app/e2e pins (smoke.spec.ts,
 * optimize.spec.ts, spending-solver.spec.ts), on the example couple; the
 * relocation compare has no dev-server spec, so it pins a ranked table with a
 * success-rate column. None of the four may show the no-Worker reason.
 */
test.describe('Production build worker channels', () => {
  const noWorkerReason = /can't run calculations in the background/

  test('Monte Carlo renders a success rate', async ({ page }) => {
    test.setTimeout(90_000)
    await openExamplePlan(page, 'Example couple')
    await page.getByRole('link', { name: 'Monte Carlo', exact: true }).click()
    await expect(page.locator('.success-gauge-value')).toContainText('%', { timeout: 60_000 })
    await expect(page.getByText(/Simulation error/)).toHaveCount(0)
    await expect(page.getByText(noWorkerReason)).toHaveCount(0)
  })

  test('the Roth & Tax Optimizer renders a completed outcome', async ({ page }) => {
    test.setTimeout(90_000)
    await openExamplePlan(page, 'Example couple')
    await page.getByRole('link', { name: 'Roth & Tax Optimizer' }).click()
    await expect(page).toHaveURL(/\/plan\/[^/]+\/optimize$/)
    const dollarResult = page.locator('.stat-grid .stat-value').first()
    const incumbentHolds = page.getByRole('heading', { name: /still ranks highest/, level: 2 })
    const noBenefit = page.getByRole('heading', { name: 'No beneficial conversions found', level: 2 })
    const infeasible = page.getByRole('heading', { name: "Couldn't optimize this plan", level: 2 })
    await expect(dollarResult.or(incumbentHolds).or(noBenefit).or(infeasible)).toBeVisible({ timeout: 60_000 })
    await expect(page.getByText(/Optimizer error:/)).toHaveCount(0)
    await expect(page.getByText(/The optimizer couldn't finish this run/)).toHaveCount(0)
    await expect(page.getByText(noWorkerReason)).toHaveCount(0)
    const download = page.getByRole('button', { name: 'Download recommendation report' })
    await expect(download).toBeVisible()
    if (await infeasible.isVisible()) {
      await expect(download).toBeDisabled()
    } else {
      await expect(download).toBeEnabled()
    }
  })

  test('How much can I spend? renders the dollar answer', async ({ page }) => {
    test.setTimeout(90_000)
    await openExamplePlan(page, 'Example couple')
    await page.getByRole('link', { name: 'How much can I spend?' }).click()
    await expect(page).toHaveURL(/\/plan\/[^/]+\/spending-solver$/)
    const answer = page.getByRole('heading', {
      name: /^Your plan can sustain about \$[\d,]+ of baseline spending per year\.$/,
      level: 2,
    })
    await expect(answer).toBeVisible({ timeout: 60_000 })
    await expect(page.getByRole('heading', { name: 'No sustainable spending level found', level: 2 })).toHaveCount(0)
    await expect(page.getByText(/Solver error/)).toHaveCount(0)
    await expect(page.getByText(noWorkerReason)).toHaveCount(0)
  })

  test('Relocation Compare ranks the candidate state with a success rate', async ({ page }) => {
    test.setTimeout(90_000)
    await openExamplePlan(page, 'Example couple')
    await page.getByRole('link', { name: 'Relocation Compare' }).click()
    await expect(page).toHaveURL(/\/plan\/[^/]+\/relocation$/)
    await page.getByRole('button', { name: 'Run compare' }).click()
    await expect(page.getByRole('heading', { name: 'Ranked results', level: 2 })).toBeVisible({ timeout: 60_000 })
    const table = page.getByRole('table')
    await expect(table.getByRole('columnheader', { name: 'Success rate' })).toBeVisible()
    // The plan as entered plus the default candidate (Florida), both priced.
    const rows = table.locator('tbody tr')
    await expect(rows).toHaveCount(2)
    await expect(rows.nth(0)).toContainText('$')
    await expect(rows.nth(0)).toContainText('%')
    await expect(rows.nth(1)).toContainText('$')
    await expect(rows.nth(1)).toContainText('%')
    await expect(page.getByText(/The states couldn't be compared/)).toHaveCount(0)
    await expect(page.getByText(noWorkerReason)).toHaveCount(0)
  })
})
