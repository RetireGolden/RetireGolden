/**
 * "Refine to the month" from a chosen whole-year start, through the engine's
 * own route (@retiregolden/engine/decisions/claimAgeSweep): the page's sweep
 * on the after-tax-estate objective, its row for `startClaims` taken as the
 * winner, refined by refineClaimAgeMonthly. The page refines from the sweep's
 * winner; tests start from the plan's current claims, a start the page does
 * not offer, because that is where one pass and a fixed point part company.
 */
import type { Plan } from '@retiregolden/engine/model/plan'
import {
  refineClaimAgeMonthly,
  sweepClaimAges,
  type ClaimAgeRefinement,
  type ClaimAgeSweep,
} from '@retiregolden/engine/decisions/claimAgeSweep'

import { taxCalculatorFor } from '../planTaxCalculator'

/** The page's sweep on the after-tax-estate objective. */
export function estateSweep(plan: Plan, startYear: number): ClaimAgeSweep {
  return sweepClaimAges(plan, { startYear, taxCalculator: taxCalculatorFor(plan), objectivePolicyId: 'max-after-tax-estate' })
}

/** The refinement from the sweep's row for `startClaims`; null when the sweep has no such row. */
export function refineFromClaims(
  plan: Plan,
  sweep: ClaimAgeSweep,
  startClaims: Readonly<Record<string, number>>,
  startYear: number,
): ClaimAgeRefinement | null {
  const start = sweep.rows.find((row) => Object.entries(startClaims).every(([personId, years]) => row.claimByPersonId[personId] === years))
  if (start === undefined) return null
  return refineClaimAgeMonthly(plan, { ...sweep, winner: start }, { startYear, taxCalculator: taxCalculatorFor(plan) })
}
