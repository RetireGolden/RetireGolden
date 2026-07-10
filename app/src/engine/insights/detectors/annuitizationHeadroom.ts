import type { Detector, InsightCard } from '../types'
import type { Account } from '../../model/plan'
import { spiaPayoutRate } from '../../decisions/spiaQuotes'

/**
 * "You plan for a long life but hold no guaranteed income — annuitization
 * headroom" (annuity-pension-and-home-equity, step 5). Fires for
 * longevity-anxious plans (a planning age of 95+) with meaningful liquid
 * savings, no annuity on the books, and no pension income covering the same
 * ground. The action previews a cover-the-floor SPIA as a scenario so the
 * ledger — not the card — prices the liquidity/estate tradeoff; the Monte
 * Carlo annuitization sweep is the full solver view.
 */
export const annuitizationHeadroom: Detector = {
  id: 'annuitization-headroom',
  category: 'longevity-insurance-geography',
  screen(ctx): InsightCard | null {
    const plan = ctx.plan
    const startYear = ctx.projection.startYear
    const primary = plan.household.people[0]
    if (!primary) return null
    // Longevity-anxious: someone plans to 95+.
    const maxPlanningAge = Math.max(...plan.household.people.map((p) => p.longevity.planningAge))
    if (maxPlanningAge < 95) return null
    // Headroom is *unused*: any annuity (owned or purchased) or pension income
    // stream means the household already holds lifetime income beyond SS.
    if (plan.accounts.some((a) => a.type === 'annuity' || (a.type === 'pension' && !a.lumpSumElection))) return null

    const liquid = plan.accounts
      .filter((a) => a.type === 'cash' || a.type === 'taxable')
      .sort((a, b) => ('balance' in b ? b.balance : 0) - ('balance' in a ? a.balance : 0))[0]
    if (!liquid || !('balance' in liquid) || liquid.balance < 100_000) return null

    const currentAge = startYear - Number(primary.dob.slice(0, 4))
    const startAge = Math.min(95, Math.max(currentAge, 65))
    const premium = Math.min(liquid.balance * 0.25, 250_000)
    const monthly = (premium * spiaPayoutRate(startAge)) / 12
    const spia: Account = {
      id: `annuitization-headroom-preview-${startYear}-${liquid.id}`,
      type: 'annuity',
      name: 'SPIA (preview)',
      ownerPersonId: primary.id,
      annualReturnPct: null,
      startAge,
      monthlyAmount: monthly,
      colaPct: 0,
      taxablePct: 100,
      purchase: { year: startYear, premium, fundingAccountId: liquid.id, taxQualification: 'nonQualified' },
    }

    return {
      id: 'annuitization-headroom',
      category: 'longevity-insurance-geography',
      title: 'Planning to 95+ with no lifetime income beyond Social Security',
      rationale:
        `Your plan runs to ${maxPlanningAge} with no pension or annuity income. ` +
        `Trading $${Math.round(premium).toLocaleString()} of liquid savings for a life annuity (~$${Math.round(monthly).toLocaleString()}/mo) ` +
        'insures the years past life expectancy — the exact risk a long planning age worries about — at the cost of liquidity and estate. ' +
        'The Monte Carlo page\'s annuitization sweep shows the full success-vs-legacy frontier.',
      impact: {
        qualitative:
          'Preview the SPIA against your full plan: guaranteed lifetime income and steadier late-life funding, priced against the liquidity and estate it costs.',
      },
      exact: false,
      confidence: 'medium',
      learnSlug: 'pensions-and-annuities',
      plannerRoute: 'monte-carlo',
      action: {
        kind: 'preview-scenario',
        scenarioName: 'Buy a cover-the-floor SPIA',
        patch: { accounts: [...plan.accounts, spia] },
      },
    }
  },
  evaluate(ctx) {
    const card = this.screen(ctx)
    if (!card) throw new Error('Annuitization headroom not eligible')
    return { action: card.action, impact: card.impact }
  },
}
