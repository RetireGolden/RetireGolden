import { formatEvidencePercent, formatWholeUsd } from '../../internal/evidenceFormat.js'
import type { Detector, InsightCard } from '../types.js'
import { EMBEDDED_REAL_YIELD_CURVE } from '../../params/index.js'
import { computeFundedRatio, fundedRatioStart } from '../../ladder/fundedRatio.js'
import { householdRetirementClause, notRetiringClause } from '../../projection/householdRetirement.js'

/**
 * "Your floor is X% funded" (social-security-bridge-and-tips-ladder, step 4):
 * the Pfau funded-ratio lens as an advisory card. Fires when the household has
 * distinguished a required floor from lifestyle spending and guaranteed income
 * covers less than ~90% of its present value on the TIPS curve.
 */
export const incomeFloorFunded: Detector = {
  id: 'income-floor-funded',
  category: 'longevity-insurance-geography',
  version: 1,
  screen(ctx): InsightCard | null {
    const plan = ctx.plan
    // Only meaningful once the user has said what "essential" means: without
    // requiredAnnual the floor equals the whole lifestyle and the card would
    // just restate the success rate.
    if (plan.expenses.requiredAnnual === undefined) return null

    if (plan.household.people.length === 0) return null
    // Counted from the household's later retirement, whoever is listed first
    // (ladder/fundedRatio.ts#fundedRatioStart); the ratio is the household's.
    const start = fundedRatioStart(plan, ctx.projection.startYear)
    // Nobody retires in the plan: wages carry the floor throughout, and there
    // is no retirement to count from (the independent review's N3).
    if (start.fromYear === null) return null
    const fr = computeFundedRatio({
      years: ctx.projection.result.years,
      startYear: ctx.projection.startYear,
      deflate: ctx.projection.deflate,
      curve: EMBEDDED_REAL_YIELD_CURVE,
      fromYear: start.fromYear,
    })
    if (!fr || fr.fundedRatioPct >= 90) return null

    const pct = Math.round(fr.fundedRatioPct)
    const later = plan.household.people.length > 1
      ? plan.household.people.find((p) => p.id === start.personId)
      : undefined
    // Say which year the count starts, whose retirement decides it and by
    // which rule; for a couple the figure is the household's.
    // A partner who never retires in the plan (wages through their last year
    // alive) is named, and the count starts at the other's retirement.
    const others = start.notRetiring.map((person) =>
      notRetiringClause(person, plan.household.people.find((p) => p.id === person.personId)?.name ?? null))
    const counted = start.retirementYear === null || start.rule === null
      ? ''
      : `Counted from ${fr.fromYear}: ${householdRetirementClause(
        { year: start.retirementYear, rule: start.rule },
        later?.name ?? null,
        fr.fromYear,
        others.length === 0,
      )}${others.length > 0 && later ? `; ${others.join(' and ')}, so the count starts at ${later.name}'s retirement` : ''}. `
    return {
      id: 'income-floor-funded',
      category: 'longevity-insurance-geography',
      title: `Your essential-spending floor is ${pct}% funded`,
      rationale:
        counted +
        `Discounted on today's TIPS curve, your ${later ? "household's " : ''}essential retirement spending is worth ` +
        `${formatWholeUsd(fr.essentialSpendingPv)} in today's dollars, and guaranteed income ` +
        `(Social Security, pensions, annuities, TIPS ladders) covers ${formatWholeUsd(fr.guaranteedIncomePv)} of it (${pct}%). ` +
        `The ${formatWholeUsd(fr.unfundedPv)} gap rides on the portfolio; a TIPS ladder can lock some of it in at ~` +
        `${EMBEDDED_REAL_YIELD_CURVE.points[EMBEDDED_REAL_YIELD_CURVE.points.length - 1]!.realYieldPct}% real.`,
      impact: {
        qualitative:
          'The funded ratio is a risk lens, not a verdict: a portfolio can fund the gap in most markets. The question is how much of the floor you want guaranteed regardless of markets.',
      },
      exact: false,
      confidence: 'medium',
      severity: 'attention',
      evidence: [
        { label: 'Funded ratio', value: formatEvidencePercent(fr.fundedRatioPct) },
        { label: 'Essential spending present value (today\'s $)', value: formatWholeUsd(fr.essentialSpendingPv), year: ctx.projection.startYear },
        { label: 'Guaranteed income present value (today\'s $)', value: formatWholeUsd(fr.guaranteedIncomePv), year: ctx.projection.startYear },
        { label: 'Unfunded present value (today\'s $)', value: formatWholeUsd(fr.unfundedPv), year: ctx.projection.startYear },
      ],
      learnSlug: 'funded-ratio',
      plannerRoute: 'income-floor',
      action: { kind: 'advisory' },
    }
  },
}
