import { describe, expect, it } from 'vitest'
import type { Plan } from '@retiregolden/engine/model/plan'
import { singlePersonPlan, socialSecurityIncome } from '@retiregolden/engine/testing/planFixtures'
import { benefitsOnlyPlanLimits } from './benefitsOnlyPlanLimits'

const OTHER_INCOME = "Income entered as other income, such as part-time work, doesn't count as earnings for the earnings test here or in the projection: only wages do."

/** One claimant born on `dob`, with other income from `fromYear` on, in a plan starting 2026. */
function limitsFor(dob: string, fromYear: number): string[] {
  const plan = singlePersonPlan({ dob, planningAge: 95 })
  plan.incomes = [
    socialSecurityIncome('ss', 2_000, 62),
    { type: 'recurring', id: 'part-time', label: 'Part-time work', annualAmount: 20_000, startYear: fromYear, endYear: null, inflationAdjusted: true, taxTreatment: 'ordinary' },
  ] as Plan['incomes']
  return benefitsOnlyPlanLimits(plan, () => 'Pat', 2026)
}

// PR #769 review, issue 9: the other-income note follows each claimant's full
// retirement age, not the birth year plus 67 (the FRA for 1959 is 66 and 10
// months).
describe('benefitsOnlyPlanLimits: the other-income note', () => {
  it('names other income in a year before the full-retirement-age month', () => {
    // Born 1959-06-15: FRA month April 2026, so January to March 2026 are tested.
    expect(limitsFor('1959-06-15', 2026)).toContain(OTHER_INCOME)
  })

  it('does not name other income that starts after the last month the earnings test reaches', () => {
    // Born 1959-01-15: FRA month November 2025, so 2026 is past it; birth year
    // plus 67 would still reach 2026.
    expect(limitsFor('1959-01-15', 2026)).not.toContain(OTHER_INCOME)
    // Born 1960-01-15: FRA month January 2027 leaves no month of 2027 before it.
    expect(limitsFor('1960-01-15', 2027)).not.toContain(OTHER_INCOME)
    expect(limitsFor('1960-01-15', 2026)).toContain(OTHER_INCOME)
  })
})
