import { expect, it } from 'vitest'

import type { IncomeStream, Plan } from '../model/plan.js'
import { describeRule } from '../rules/describeRule.js'
import { simulatePlan } from './simulate.js'
import { basePlan, cash, noTax, testIds, validate } from './simulate.test-support.js'

type Person = Plan['household']['people'][number]

// The survivor, born 1962-09-20, claimed her own 1,200 PIA at 62y0m (744
// months). The worker, born 1961-03-05 with a 2,600 PIA, has a life age of 65,
// so the ledger keeps him alive through 2026 and first pays her as a widow in
// January 2027, when she is 772 months old. Her survivor FRA is 67 (804 months).
const survivor: Person = { id: 'w', name: 'Survivor', dob: '1962-09-20', sex: 'female', retirementAge: null, longevity: { planningAge: 95, source: 'manual' } }
const worker: Person = { id: 'h', name: 'Worker', dob: '1961-03-05', sex: 'male', retirementAge: null, longevity: { planningAge: 65, source: 'manual' } }

function socialSecurityByYear(workerClaimYears: number, survivorWagesEndAge: number | null): (year: number) => number {
  const plan = basePlan()
  plan.household.filingStatus = 'marriedFilingJointly'
  plan.household.people = [survivor, worker]
  const incomes: IncomeStream[] = [
    { type: 'socialSecurity', id: testIds(), personId: survivor.id, piaMonthly: 1_200, earnings: null, claimAge: { years: 62, months: 0 } },
    { type: 'socialSecurity', id: testIds(), personId: worker.id, piaMonthly: 2_600, earnings: null, claimAge: { years: workerClaimYears, months: 0 } },
  ]
  if (survivorWagesEndAge !== null) {
    incomes.push({ type: 'wages', id: testIds(), personId: survivor.id, annualGross: 40_000, endAge: survivorWagesEndAge, realGrowthPct: 0 })
  }
  plan.incomes = incomes
  plan.accounts = [cash(5_000_000)]
  const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })
  return (year) => result.years.find((row) => row.year === year)!.incomes.socialSecurity
}

// The worker claimed at 63 (factor 0.75, paid 1,950; the limit is
// max(1,950, 0.825 x 2,600) = 2,145). At 772 months the widow factor is
// 1 - 0.285 x 32/84 = 0.891429, so 2,600 x 0.891429 = 2,317.71 is held to the
// 2,145 limit: 25,740 in 2027. Reduced at her own claim age, 744 months, the
// factor is 0.796429 and 2,600 x 0.796429 = 2,070.71 is under the limit:
// 24,848.57.
describeRule('usc-42-402-q-6-A-iii-widow-reduction-from-entitlement-month', {
  note: 'the first month of widow(er) entitlement',
  readings: {
    reducedFromTheMonthOfDeath: 25_740,
    reducedFromTheSurvivorsOwnClaim: 24_848.571428571428,
  },
  accepted: 'reducedFromTheMonthOfDeath',
}, ({ accepted, readings }) => {
  it('reduces the widow(er) benefit at the survivor’s age when it is first paid, not at her earlier own claim', () => {
    const paid = socialSecurityByYear(63, null)(2027)
    expect(paid).toBeCloseTo(accepted, 6)
    expect(paid).not.toBeCloseTo(readings.reducedFromTheSurvivorsOwnClaim, 6)
  })
})

// The worker dies unclaimed (claim age 67), so the base is his 2,600 PIA with
// no limit. In 2026 the earnings test withholds (40,000 - 24,480) / 2 = 7,760 of
// her own 10,080, nine months by the ledger's count, all before the death. From
// 2027 she is paid 2,600 x 0.891429 x 12 = 27,812.57. In 2029, the year she
// reaches 67, no widow(er) month was withheld, so nothing is credited; crediting
// the nine own months would give 781 months, factor 0.921964, 28,765.29.
describeRule('usc-42-402-q-6-A-iii-widow-reduction-from-entitlement-month', {
  note: 'earnings-test months of the widow(er) benefit only',
  readings: {
    widowMonthsOnly: 27_812.571428571428,
    everyWithheldMonth: 28_765.285714285714,
  },
  accepted: 'widowMonthsOnly',
}, ({ accepted, readings }) => {
  it('credits at the survivor FRA only the months the widow(er) benefit itself was withheld', () => {
    const ss = socialSecurityByYear(67, 65)
    expect(ss(2027)).toBeCloseTo(accepted, 6)
    expect(ss(2029)).toBeCloseTo(accepted, 6)
    expect(ss(2029)).not.toBeCloseTo(readings.everyWithheldMonth, 6)
  })
})
