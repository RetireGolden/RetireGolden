/**
 * Two projected plans compared headline by headline (B2-P1 slice 3): the
 * figures the Compare page shows for Plan A (the baseline) and Plan B (the
 * proposal), each as baseline, proposal and proposal − baseline through the
 * one comparison convention (`scalarComparison.ts`).
 *
 * Money basis (owner decision R13, 2026-09-25). Two plans that end in the same
 * year are compared in nominal dollars, as their summaries give them: the
 * ending figures are dollars of that one year, and the lifetime sums add each
 * year's own dollars. Two plans that end in different years are compared in
 * today's (start-year) dollars: each ending figure is divided by that plan's
 * own published inflation factor at its own end year, and lifetime tax plus
 * penalties is re-summed year by year, each year divided by that year's
 * factor. Subtracting nominal dollars of two different years would report
 * inflation as a difference between the plans. `moneyBasis` says which basis
 * a comparison is in, and `endYear` publishes both end years.
 *
 * How long the money lasts follows the one convention of
 * `projection/moneyLasts.ts` (owner decision R15), whose `compareMoneyLasts`
 * publishes the difference of the two last fully funded years, bounded when
 * one plan runs its full horizon, and no number when both do (neither
 * exhaustion year is known).
 *
 * @see DOCS/calculations/optimizer-and-comparisons/compare-plan-money-deltas.md
 * @see DOCS/calculations/optimizer-and-comparisons/compare-plan-deltas.md
 */

import type { Plan } from '../model/plan.js'
import type { ProjectionSummary } from '../projection/compare.js'
import { projectionDollarBasis, toTodayDollars, type DollarBasis } from '../projection/dollarBasis.js'
import { compareMoneyLasts, type MoneyLastsComparison } from '../projection/moneyLasts.js'
import type { ProjectionResult } from '../projection/types.js'
import {
  compareNullableScalars,
  compareScalars,
  type NullableScalarComparison,
  type ScalarComparison,
} from './scalarComparison.js'

// The money-lasts comparison lives with the R15 convention it applies; the
// Compare page reads it from here with the rest of the headline comparison.
export { compareMoneyLasts, type MoneyLastsBound, type MoneyLastsComparison } from '../projection/moneyLasts.js'

/** One side of a headline comparison: the plan's household and its projection. */
export interface ComparedProjection {
  plan: Pick<Plan, 'household'>
  result: Pick<ProjectionResult, 'startYear' | 'endYear' | 'depletionYear' | 'years'>
  summary: Pick<
    ProjectionSummary,
    'endingNetWorth' | 'endingInvestable' | 'endingAfterTaxEstate' | 'lifetimeTaxesAndPenalties'
  >
}

/** 'nominal': each plan's own dollars (the plans end in the same year); 'today': start-year dollars. */
export type HeadlineMoneyBasis = 'nominal' | 'today'

export interface PlanHeadlineComparison {
  /** The start year both projections share. */
  startYear: number
  /** 'today' exactly when the two plans end in different years (R13). */
  moneyBasis: HeadlineMoneyBasis
  /** Each plan's last projection year. */
  endYear: ScalarComparison
  endingNetWorth: ScalarComparison
  endingInvestable: ScalarComparison
  endingAfterTaxEstate: ScalarComparison
  /** Nominal: the summaries' sums. Today: each year's tax plus penalties divided by that year's factor, summed. */
  lifetimeTaxesAndPenalties: ScalarComparison
  moneyLasts: MoneyLastsComparison
  /** 100 when the projection never depletes, else 0: the single-path reading, not a probability. */
  deterministicSuccessPct: ScalarComparison
  /**
   * The first listed person's calendar age (year − birth year) in the depletion
   * year; null on a side that never depletes.
   */
  depletionAgePrimary: NullableScalarComparison
}

function birthYearOf(side: ComparedProjection, role: 'baseline' | 'proposal'): number {
  const dob = side.plan.household.people[0]?.dob
  if (dob === undefined || !/^\d{4}-\d{2}-\d{2}$/u.test(dob)) {
    throw new RangeError(
      `The ${role} plan's first person has no birth date in YYYY-MM-DD form, so no depletion age can be published`,
    )
  }
  return Number(dob.slice(0, 4))
}

function depletionAge(side: ComparedProjection, role: 'baseline' | 'proposal'): number | null {
  const year = side.result.depletionYear
  return year === null ? null : year - birthYearOf(side, role)
}

/** Σ over the ledger's years, in order and from 0, of (tax + penalties) divided by that year's published factor. */
function lifetimeTaxesAndPenaltiesToday(side: ComparedProjection, basis: DollarBasis): number {
  let total = 0
  for (const year of side.result.years) total += toTodayDollars(basis, year.year, year.tax + year.penalties)
  return total
}

/**
 * Compare two projections that share a start year. Refuses with a RangeError
 * two results with different start years, a non-finite figure (through
 * compareScalars) and a depleting side whose first person has no birth date.
 * When today's dollars are needed, a projection whose rows give no dollar
 * basis is refused by projection/dollarBasis.ts#projectionDollarBasis: with a
 * plain Error for a missing, non-contiguous or unscaled row, and a RangeError
 * for a start or end year that is not a whole year or an end year before the
 * start year with rows present.
 */
export function comparePlanHeadlines(
  baseline: ComparedProjection,
  proposal: ComparedProjection,
): PlanHeadlineComparison {
  const startYear = baseline.result.startYear
  if (startYear !== proposal.result.startYear) {
    throw new RangeError(
      `Two plans are compared only from one start year; the baseline starts in ${startYear} and the proposal in ${proposal.result.startYear}`,
    )
  }
  const moneyBasis: HeadlineMoneyBasis = baseline.result.endYear === proposal.result.endYear ? 'nominal' : 'today'
  // Each side's dollar basis, built once per comparison and only when today's
  // dollars are needed: every ending row and the lifetime sum read the same one.
  const bases =
    moneyBasis === 'today'
      ? { baseline: projectionDollarBasis(baseline.result), proposal: projectionDollarBasis(proposal.result) }
      : null
  const ending = (side: 'baseline' | 'proposal', nominal: number): number => {
    const projection = side === 'baseline' ? baseline : proposal
    return bases === null ? nominal : toTodayDollars(bases[side], projection.result.endYear, nominal)
  }
  const endingRow = (read: (summary: ComparedProjection['summary']) => number): ScalarComparison =>
    compareScalars(ending('baseline', read(baseline.summary)), ending('proposal', read(proposal.summary)))
  const lasts = compareMoneyLasts(baseline.result, proposal.result)
  return {
    startYear,
    moneyBasis,
    endYear: compareScalars(baseline.result.endYear, proposal.result.endYear),
    endingNetWorth: endingRow((summary) => summary.endingNetWorth),
    endingInvestable: endingRow((summary) => summary.endingInvestable),
    endingAfterTaxEstate: endingRow((summary) => summary.endingAfterTaxEstate),
    lifetimeTaxesAndPenalties:
      bases === null
        ? compareScalars(baseline.summary.lifetimeTaxesAndPenalties, proposal.summary.lifetimeTaxesAndPenalties)
        : compareScalars(
            lifetimeTaxesAndPenaltiesToday(baseline, bases.baseline),
            lifetimeTaxesAndPenaltiesToday(proposal, bases.proposal),
          ),
    moneyLasts: lasts,
    deterministicSuccessPct: compareScalars(
      lasts.baseline.depletionYear === null ? 100 : 0,
      lasts.proposal.depletionYear === null ? 100 : 0,
    ),
    depletionAgePrimary: compareNullableScalars(depletionAge(baseline, 'baseline'), depletionAge(proposal, 'proposal')),
  }
}
