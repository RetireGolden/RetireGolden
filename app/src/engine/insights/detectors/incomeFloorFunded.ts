import type { Detector, InsightCard } from '../types'
import { EMBEDDED_REAL_YIELD_CURVE } from '../../params'
import { computeFundedRatio } from '../../ladder/fundedRatio'

/**
 * "Your floor is X% funded" (social-security-bridge-and-tips-ladder, step 4):
 * the Pfau funded-ratio lens as an advisory card. Fires when the household has
 * distinguished a required floor from lifestyle spending and guaranteed income
 * covers less than ~90% of its present value on the TIPS curve.
 */
export const incomeFloorFunded: Detector = {
  id: 'income-floor-funded',
  category: 'longevity-insurance-geography',
  screen(ctx): InsightCard | null {
    const plan = ctx.plan
    // Only meaningful once the user has said what "essential" means: without
    // requiredAnnual the floor equals the whole lifestyle and the card would
    // just restate the success rate.
    if (plan.expenses.requiredAnnual === undefined) return null

    const primary = plan.household.people[0]
    if (!primary) return null
    const retirementYear =
      primary.retirementAge !== null ? Number(primary.dob.slice(0, 4)) + primary.retirementAge : ctx.projection.startYear
    const fr = computeFundedRatio({
      years: ctx.projection.result.years,
      startYear: ctx.projection.startYear,
      deflate: ctx.projection.deflate,
      curve: EMBEDDED_REAL_YIELD_CURVE,
      fromYear: Math.max(retirementYear, ctx.projection.startYear),
    })
    if (!fr || fr.fundedRatioPct >= 90) return null

    const pct = Math.round(fr.fundedRatioPct)
    return {
      id: 'income-floor-funded',
      category: 'longevity-insurance-geography',
      title: `Your essential-spending floor is ${pct}% funded`,
      rationale:
        `Discounted on today's TIPS curve, your essential retirement spending is worth ` +
        `$${Math.round(fr.essentialSpendingPv).toLocaleString()} in today's dollars, and guaranteed income ` +
        `(Social Security, pensions, annuities, TIPS ladders) covers $${Math.round(fr.guaranteedIncomePv).toLocaleString()} of it (${pct}%). ` +
        `The $${Math.round(fr.unfundedPv).toLocaleString()} gap rides on the portfolio; a TIPS ladder can lock some of it in at ~` +
        `${EMBEDDED_REAL_YIELD_CURVE.points[EMBEDDED_REAL_YIELD_CURVE.points.length - 1]!.realYieldPct}% real.`,
      impact: {
        qualitative:
          'The funded ratio is a risk lens, not a verdict: a portfolio can fund the gap in most markets — the question is how much of the floor you want guaranteed regardless of markets.',
      },
      exact: false,
      confidence: 'medium',
      learnSlug: 'funded-ratio',
      plannerRoute: 'income-floor',
      action: { kind: 'advisory' },
    }
  },
}
