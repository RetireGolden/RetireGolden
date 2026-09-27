import { expect, it } from 'vitest'

import { simulatePlan } from '../projection/simulate.js'
import { basePlan, cash, noTax, validate } from '../projection/simulate.test-support.js'
import { describeRule } from '../rules/describeRule.js'
import { piaWithCostOfLivingIncreases } from './piaFromEarnings.js'

// A single man born 1960-05-01 (eligibility 2022) with 50,000 dollars of
// covered earnings in each year from 1982 through 2021 has a 2022 PIA of
// 2,846.40 (AIME 8,022). Section 415(i)(2)(A)(iii) raises it by the increase of
// his eligibility year and every later one, and (ii) floors each result to the
// dime: 8.7% (3,094.00), 3.2% (3,193.00), 2.5% (3,272.80) and 2.8% (3,364.40)
// for December 2022 through 2025. From a 2026 start with no inflation he claims
// at 67 in 2027 and is paid 3,364.40 x 12 = 40,372.80; the eligibility-year PIA
// would pay 34,156.80.
describeRule('usc-42-415-i-2-A-pia-cost-of-living-since-eligibility', {
  note: 'an earnings history eligible in 2022, projected from 2026',
  readings: {
    raisedByTheIncreasesSinceEligibility: 40_372.8,
    eligibilityYearDollars: 34_156.8,
  },
  accepted: 'raisedByTheIncreasesSinceEligibility',
}, ({ accepted, readings }) => {
  it('pays the PIA raised by the December 2022 through 2025 increases', () => {
    const plan = basePlan()
    plan.household.people = [
      { id: 'p1', name: 'Worker', dob: '1960-05-01', sex: 'male', retirementAge: 62, longevity: { planningAge: 90, source: 'manual' } },
    ]
    plan.incomes = [{
      type: 'socialSecurity',
      id: 'ss-p1',
      personId: 'p1',
      piaMonthly: null,
      earnings: Array.from({ length: 40 }, (_, index) => ({ year: 1982 + index, amount: 50_000 })),
      claimAge: { years: 67, months: 0 },
    }]
    plan.accounts = [cash(3_000_000)]
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })
    const paid = result.years.find((row) => row.year === 2027)!.incomes.socialSecurity
    expect(paid).toBeCloseTo(accepted, 6)
    expect(paid).not.toBeCloseTo(readings.eligibilityYearDollars, 6)
  })
})

// The increase of the eligibility year itself is included ("that increase and
// subsequent applicable increases"): the 2018 PIA of a 1956 birth, 2,551.90,
// takes all eight increases 2018 through 2025 to 3,379.20. Starting from 2019
// instead skips the 2.8% of December 2018: 2,551.90 -> 2,592.70 -> 2,626.40 ->
// 2,781.30 -> 3,023.20 -> 3,119.90 -> 3,197.80 -> 3,287.30.
describeRule('usc-42-415-i-2-A-pia-cost-of-living-since-eligibility', {
  note: 'the increase of the eligibility year itself',
  readings: {
    fromTheEligibilityYear: 3_379.2,
    fromTheYearAfterEligibility: 3_287.3,
  },
  accepted: 'fromTheEligibilityYear',
}, ({ accepted, readings }) => {
  it('applies the eligibility year\'s increase and every later one', () => {
    const pia = piaWithCostOfLivingIncreases(2_551.9, 2018, 2025, 0).piaMonthly
    expect(pia).toBeCloseTo(accepted, 6)
    expect(pia).not.toBeCloseTo(readings.fromTheYearAfterEligibility, 6)
  })
})
