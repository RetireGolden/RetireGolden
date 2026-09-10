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
