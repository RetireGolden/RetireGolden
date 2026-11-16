import { describe, expect, it } from 'vitest'
import type { Plan } from '@retiregolden/engine/model/plan'
import { couplePlan, singlePersonPlan, socialSecurityIncome } from '@retiregolden/engine/testing/planFixtures'
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

// Calculation validation round of 2026-11-16: in a couple, a blank remarriage
// age on a survivor record no longer counts the benefit while the claimant is
// married (20 CFR 404.335(e), 404.336(e)); the note says when it is counted.
describe('benefitsOnlyPlanLimits: a blank remarriage age in a couple', () => {
  function coupleLimits(remarriedAtAge: number | null): string[] {
    const plan = couplePlan({ p1Dob: '1964-02-10', p2Dob: '1962-03-20', p1PlanningAge: 92, p2PlanningAge: 90 })
    const income = socialSecurityIncome('ss', 600, 62) as Extract<Plan['incomes'][number], { type: 'socialSecurity' }>
    income.formerSpouses = [{ id: 'first', relationship: 'deceased', dob: '1958-05-10', piaMonthly: 3_000, marriageYears: 20, remarriedAtAge }]
    plan.incomes = [income, socialSecurityIncome('ss2', 1_000, 67, 'p2')] as Plan['incomes']
    return benefitsOnlyPlanLimits(plan, (id) => (id === 'p1' ? 'Jo' : 'Hal'), 2026)
  }

  it('says the benefit is counted only from the January after the current spouse\'s death', () => {
    expect(coupleLimits(null)).toContain(
      "Jo's remarriage age is blank on a former spouse's record. While Jo is married, a survivor benefit is counted here only when that marriage began at 60 or later; the exceptions for a disabled widow(er) who remarried at 50 or later are not evaluated. So the survivor benefit on the former spouse's record is counted from the later of Jo's claim and the January after the current spouse's death, and is reduced only if that month is before Jo's survivor full retirement age. If the current marriage began at 60 or later, enter that age.",
    )
    expect(coupleLimits(null).join(' ')).not.toContain('The law pays')
  })

  it('names the same rule for a remarriage before 60, read as the current marriage', () => {
    expect(coupleLimits(55)).toEqual(["Jo remarried before 60, which is read as the current marriage. While Jo is married, a survivor benefit is counted here only when that marriage began at 60 or later; the exceptions for a disabled widow(er) who remarried at 50 or later are not evaluated. So the survivor benefit on the former spouse's record is counted from the later of Jo's claim and the January after the current spouse's death, and is reduced only if that month is before Jo's survivor full retirement age."])
  })

  it('names nothing for a remarriage at 60, which the law disregards', () => {
    expect(coupleLimits(60)).toEqual([])
  })
})
