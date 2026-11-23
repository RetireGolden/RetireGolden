import { expect, it } from 'vitest'

import { createEmptyPlan, parsePlan, type Plan } from '../model/plan.js'
import { simulatePlan } from '../projection/simulate.js'
import { describeRule } from '../rules/describeRule.js'
import { createFlatTaxCalculator } from '../testing/flatTax.js'

import { AWI_BY_YEAR } from './ssaWageData.js'

const noTax = createFlatTaxCalculator(0)
let counter = 0
const testIds = () => `dis-comp-${++counter}`

function awiLevelEarnings1986Through2018(): { year: number; amount: number }[] {
  return Array.from({ length: 33 }, (_, index) => {
    const year = 1986 + index
    const amount = AWI_BY_YEAR[year]
    if (amount === undefined) throw new Error(`expected published AWI for ${year}`)
    return { year, amount }
  })
}

// The 2019 disability worksheet of
// rules/approximations/socialSecurityEarnings.approximation.test.ts carried
// through simulatePlan: a stream with `disability: { onsetAge: 55 }` for a
// worker born 1964-06-15 began its disability in 2019, before the year he
// attains 62 (2026), so the earnings computation is made for 2019 (AIME 4,198,
// PIA 1,880.40 on the 2019 bend points). 42 U.S.C. 415(i)(2)(A)(iii) raises it
// by every increase from the year of eligibility, each floored to the dime
// (415(i)(2)(A)(ii)), using SSA's published series:
//   2019 1.6%: 1,880.40 × 1.016 = 1,910.4864 → 1,910.40
//   2020 1.3%: × 1.013 = 1,935.2352 → 1,935.20
//   2021 5.9%: × 1.059 = 2,049.3768 → 2,049.30
//   2022 8.7%: × 1.087 = 2,227.5891 → 2,227.50
//   2023 3.2%: × 1.032 = 2,298.78 → 2,298.70
//   2024 2.5%: × 1.025 = 2,356.1675 → 2,356.10
//   2025 2.8%: × 1.028 = 2,422.0708 → 2,422.00
// With zero inflation (no ledger COLA) the disability benefit, paid in full
// every month of 2026, is 12 × 2,422.00 = 29,064.00.
// Until 2026-11-23 the onset only placed the payments: the PIA was the age-62
// computation for 2026 (AIME 5,487, 2026 bend points, 2,501.70, no increase
// yet), paying 12 × 2,501.70 = 30,020.40. A 2017 index with the ordinary
// 35-year divisor (AIME 3,958) would give 1,803.60 raised to 2,323.30, or 27,879.60.
describeRule('usc-42-415-b-2-b-disability-freeze-aime-exclusion', {
  readings: {
    disabilityComputationRaisedSince2019: 29_064,
    retirementComputationFor2026: 30_020.4,
    disabilityIndexButOrdinary35YearDivisor: 27_879.6,
  },
  accepted: 'disabilityComputationRaisedSince2019',
  note: 'SSDI paid in 2026 through simulatePlan',
}, ({ accepted, readings }) => {
  it('pays the PIA of the 2019 disability computation, raised by the increases since', () => {
    const plan: Plan = createEmptyPlan({ newId: testIds, now: () => new Date('2026-06-11T00:00:00.000Z') })
    plan.household.people[0] = {
      id: 'p1',
      name: 'Pat',
      dob: '1964-06-15',
      sex: 'average',
      retirementAge: null,
      longevity: { planningAge: 90, source: 'manual' },
    }
    plan.assumptions.inflationPct = 0
    plan.assumptions.defaultReturnPct = 0
    plan.incomes = [{
      type: 'socialSecurity',
      id: testIds(),
      personId: 'p1',
      piaMonthly: null,
      earnings: awiLevelEarnings1986Through2018(),
      disability: { onsetAge: 55 },
      claimAge: { years: 62, months: 0 },
    }]
    plan.accounts = [{
      type: 'cash', id: testIds(), name: 'Cash', ownerPersonId: null,
      annualReturnPct: null, balance: 2_000_000, annualContribution: 0,
    }]

    const parsed = parsePlan(plan)
    if (!parsed.ok) throw new Error(parsed.issues.join('; '))
    const observed = simulatePlan(parsed.plan, { startYear: 2026, taxCalculator: noTax })
      .years.find((y) => y.year === 2026)!.incomes.socialSecurity

    expect(observed).toBeCloseTo(accepted, 6)
    expect(observed).not.toBeCloseTo(readings.retirementComputationFor2026, 6)
    expect(observed).not.toBeCloseTo(readings.disabilityIndexButOrdinary35YearDivisor, 6)
  })
})
