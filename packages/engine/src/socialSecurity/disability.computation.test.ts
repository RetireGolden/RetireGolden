import { describe, expect, it } from 'vitest'

import { createEmptyPlan, parsePlan, type Plan } from '../model/plan.js'
import { simulatePlan } from '../projection/simulate.js'
import { describeRule } from '../rules/describeRule.js'
import { createFlatTaxCalculator } from '../testing/flatTax.js'

import { familyMaximumEligibilityYear, workerFamilyMaximumMonthlyAt } from './familyMaximum.js'
import { resolveStreamPiaMonthly } from './piaFromEarnings.js'
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

function cashAccount(): Plan['accounts'][number] {
  return {
    type: 'cash', id: testIds(), name: 'Cash', ownerPersonId: null,
    annualReturnPct: null, balance: 2_000_000, annualContribution: 0,
  }
}

function person(id: string, dob: string): Plan['household']['people'][number] {
  return { id, name: id, dob, sex: 'average', retirementAge: null, longevity: { planningAge: 95, source: 'manual' } }
}

function run(plan: Plan): ReturnType<typeof simulatePlan> {
  plan.assumptions.inflationPct = 0
  plan.assumptions.defaultReturnPct = 0
  const parsed = parsePlan(plan)
  if (!parsed.ok) throw new Error(parsed.issues.join('; '))
  return simulatePlan(parsed.plan, { startYear: 2026, taxCalculator: noTax })
}

// The disability family maximum on the onset-year computation (42 U.S.C.
// 403(a)(6); 20 CFR 404.403(d-1)), with a spouse. Worker born 1964-06-15,
// disabled from 2019 (onsetAge 55), earnings equal to each year's AWI for the
// fourteen years 2005-2018. Year of eligibility 2019, indexing year 2017: the
// thirteen years 2005-2017 index to 50,321.89, 2018 stays 52,145.80; 33
// elapsed years, five dropped, 28 averaged:
//   AIME = floor((13 × 50,321.89 + 52,145.80) / 336) = floor(2,102.17) = 2,102
//   PIA (2019 bend points 926 / 5,583) = 833.40 + 0.32 × 1,176 = 1,209.72 → 1,209.70
//   maximum = min(max(0.85 × 2,102, 1,209.70), 1.5 × 1,209.70)
//           = min(1,786.70, 1,814.55) = 1,786.70
// Both raised by the 2019-2025 increases, each floored to the dime
// (415(i)(2)(A)(ii)): PIA 1,229.00, 1,244.90, 1,318.30, 1,432.90, 1,478.70,
// 1,515.60, 1,558.00; maximum 1,815.20, 1,838.70, 1,947.10, 2,116.40,
// 2,184.10, 2,238.70, 2,301.30. Room 2,301.30 − 1,558.00 = 743.30.
// The spouse, born 1958-06-15, has no benefit of her own and claimed at 67
// (2025), after her full retirement age, so she is owed half the PIA, 779.00,
// held to the room: 743.30. 2026, zero inflation:
//   12 × (1,558.00 + 743.30) = 18,696.00 + 8,919.60 = 27,615.60.
// Uncapped spouse: 12 × (1,558.00 + 779.00) = 28,044.00. The retirement
// computation for 2026 the engine used until 2026-11-23 (AIME 2,328, PIA
// 1,490.80, maximum 1,978.80, room 488.00): 12 × 1,978.80 = 23,745.60.
describeRule('usc-42-415-b-2-b-disability-freeze-aime-exclusion', {
  readings: {
    onsetYearAimeAndPiaUnderTheDisabilityMaximum: 27_615.6,
    spouseNotHeldToTheMaximum: 28_044,
    retirementComputationFor2026: 23_745.6,
  },
  accepted: 'onsetYearAimeAndPiaUnderTheDisabilityMaximum',
  note: 'disability family maximum with a spouse',
}, ({ accepted, readings }) => {
  it('holds the spouse to the maximum from the 2019 AIME and PIA, raised since 2019', () => {
    const plan: Plan = createEmptyPlan({ newId: testIds, now: () => new Date('2026-06-11T00:00:00.000Z') })
    plan.household.filingStatus = 'marriedFilingJointly'
    plan.household.people = [person('p1', '1964-06-15'), person('p2', '1958-06-15')]
    plan.incomes = [
      {
        type: 'socialSecurity', id: testIds(), personId: 'p1', piaMonthly: null,
        earnings: Array.from({ length: 14 }, (_, index) => ({ year: 2005 + index, amount: AWI_BY_YEAR[2005 + index]! })),
        disability: { onsetAge: 55 }, claimAge: { years: 62, months: 0 },
      },
      { type: 'socialSecurity', id: testIds(), personId: 'p2', piaMonthly: 0, earnings: null, claimAge: { years: 67, months: 0 } },
    ]
    plan.accounts = [cashAccount()]
    const observed = run(plan).years.find((y) => y.year === 2026)!.incomes.socialSecurity
    expect(observed).toBeCloseTo(accepted, 6)
    expect(observed).not.toBeCloseTo(readings.spouseNotHeldToTheMaximum, 6)
    expect(observed).not.toBeCloseTo(readings.retirementComputationFor2026, 6)
  })
})

// An onset before 1979 keeps the stream paid. Worker born 1938-06-15,
// disabled from 1978 (onsetAge 40), 10,000 of earnings in 1978. The
// computation for a year of eligibility before 1979 is out of scope, so the
// engine makes the ordinary computation for 2000 (the year of 62): AIME 65
// (the earnings worksheet), PIA 0.9 × 65 = 58.50 on the 2000 bend points
// (531 / 3,202). Until this guard the disability year, 1978, became the year
// of eligibility, the computation refused it (eligibility_before_1979) and
// simulatePlan skipped the whole stream.
describe('usc-42-415-b-2-b-disability-freeze-aime-exclusion: onset before 1979', () => {
  it('pays the stream on the ordinary computation instead of dropping it', () => {
    const plan: Plan = createEmptyPlan({ newId: testIds, now: () => new Date('2026-06-11T00:00:00.000Z') })
    plan.household.people = [person('p1', '1938-06-15')]
    const stream = {
      type: 'socialSecurity' as const, id: testIds(), personId: 'p1', piaMonthly: null,
      earnings: [{ year: 1978, amount: 10_000 }], disability: { onsetAge: 40 }, claimAge: { years: 62, months: 0 },
    }
    plan.incomes = [stream]
    plan.accounts = [cashAccount()]

    const resolved = resolveStreamPiaMonthly(stream, { dob: '1938-06-15', retirementAge: null }, { startYear: 2026, colaAssumptionPct: 0 })
    if (resolved.status !== 'fromEarnings') throw new Error(`expected an earnings PIA, received ${resolved.status}`)
    expect([resolved.detail.eligibilityYear, resolved.detail.disabilityComputation, resolved.detail.aime]).toEqual([2000, false, 65])
    expect(resolved.detail.piaMonthly).toBeCloseTo(58.5, 9)

    const result = run(plan)
    const paid = result.years.find((y) => y.year === 2026)!.incomes.socialSecurity
    expect(paid).toBeCloseTo(12 * resolved.piaMonthly, 6)
    expect(paid).toBeGreaterThan(0)
    expect(result.warnings.some((warning) => warning.includes('could not be used'))).toBe(false)
  })
})

// The retirement and survivor family maximum for that worker follows the PIA
// onto the year of 62 (42 U.S.C. 403(a)(2)(D) would count 1978, whose
// maximum, like its PIA, is out of scope). Worker born 1938-06-15, disabled
// from 1978, earnings equal to each year's AWI for the 35 years 1963-1997.
// Ordinary computation for 2000 (the year of 62), indexing year 1998 (AWI
// 28,861.44): every year indexes to 28,861.44; elapsed years 1960-1999 are 40,
// five dropped, 35 averaged:
//   AIME = floor(35 × 28,861.44 / 420) = floor(2,405.12) = 2,405
//   PIA (2000 bend points 531 / 3,202) = 477.90 + 0.32 × 1,874 = 1,077.58 → 1,077.50
// Raised by the 2000-2025 increases, each floored to the dime
// (415(i)(2)(A)(ii)): 3.5% 1,115.20; 2.6% 1,144.10; 1.4% 1,160.10;
// 2.1% 1,184.40; 2.7% 1,216.30; 4.1% 1,266.10; 3.3% 1,307.80; 2.3% 1,337.80;
// 5.8% 1,415.30; 0% 1,415.30; 0% 1,415.30; 3.6% 1,466.20; 1.7% 1,491.10;
// 1.5% 1,513.40; 1.7% 1,539.10; 0% 1,539.10; 0.3% 1,543.70; 2% 1,574.50;
// 2.8% 1,618.50; 1.6% 1,644.30; 1.3% 1,665.60; 5.9% 1,763.80; 8.7% 1,917.20;
// 3.2% 1,978.50; 2.5% 2,027.90; 2.8% 2,084.60.
// Maximum in 2026 (his disability benefit converted at full retirement age in
// 2003, so the retirement and survivor maximum), on the 2000 family-maximum
// bend points 679 / 980 / 1,278:
//   1.5 × 679 + 2.72 × 301 + 1.34 × 298 + 1.75 × 806.60
//   = 1,018.50 + 818.72 + 399.32 + 1,411.55 = 3,648.09 → 3,648.00
// Priced on 1978, a year the table has no triplet for, it fell back to the
// 2026 bend points 1,643 / 2,371 / 3,093:
//   1.5 × 1,643 + 2.72 × 441.60 = 2,464.50 + 1,201.152 = 3,665.652 → 3,665.60
// The spouse, born 1940-06-15, no benefit of her own, claimed at 67 (after
// her full retirement age of 65 and 6 months), is owed half the PIA,
// 1,042.30. The room is 3,648.00 − 2,084.60 = 1,563.40 (1,581.00 on the
// fallback), so she is paid in full either way: a single spouse under the
// retirement and survivor maximum, at least 150 percent of the PIA, always is
// (#capAuxiliaryForFamilyMaximum). 2026, zero inflation:
//   12 × (2,084.60 + 1,042.30) = 25,015.20 + 12,507.60 = 37,522.80.
describeRule('usc-42-403-a-2-D-family-maximum-eligibility-after-disability', {
  readings: {
    yearOfSixtyTwoAsThePiaUses: 3_648,
    onsetYearFallingBackToLatestBendPoints: 3_665.6,
  },
  accepted: 'yearOfSixtyTwoAsThePiaUses',
  note: 'a worker disabled before 1979, with a spouse',
}, ({ accepted, readings }) => {
  it('prices the maximum on the year of 62 the PIA was computed for', () => {
    const plan: Plan = createEmptyPlan({ newId: testIds, now: () => new Date('2026-06-11T00:00:00.000Z') })
    plan.household.filingStatus = 'marriedFilingJointly'
    plan.household.people = [person('p1', '1938-06-15'), person('p2', '1940-06-15')]
    const stream = {
      type: 'socialSecurity' as const, id: testIds(), personId: 'p1', piaMonthly: null,
      earnings: Array.from({ length: 35 }, (_, index) => ({ year: 1963 + index, amount: AWI_BY_YEAR[1963 + index]! })),
      disability: { onsetAge: 40 }, claimAge: { years: 62, months: 0 },
    }
    plan.incomes = [
      stream,
      { type: 'socialSecurity', id: testIds(), personId: 'p2', piaMonthly: 0, earnings: null, claimAge: { years: 67, months: 0 } },
    ]
    plan.accounts = [cashAccount()]

    const resolved = resolveStreamPiaMonthly(stream, { dob: '1938-06-15', retirementAge: null }, { startYear: 2026, colaAssumptionPct: 0 })
    if (resolved.status !== 'fromEarnings') throw new Error(`expected an earnings PIA, received ${resolved.status}`)
    expect([resolved.detail.eligibilityYear, resolved.detail.disabilityComputation, resolved.detail.aime]).toEqual([2000, false, 2_405])
    expect(resolved.piaMonthly).toBeCloseTo(2_084.6, 9)

    const dob = { year: 1938, month: 6, day: 15 }
    expect(familyMaximumEligibilityYear(dob, 1978)).toBe(2000)
    const disability = {
      onsetYear: 1978, firstPayableMonthIndex: 1978 * 12 + 11, fraMonthIndex: 2003 * 12 + 7, disabilityMaximumMonthly: 0,
    }
    const maximum = workerFamilyMaximumMonthlyAt({ piaMonthly: resolved.piaMonthly, dob, disability }, 2026 * 12)
    expect(maximum).toBeCloseTo(accepted, 9)
    expect(maximum).not.toBeCloseTo(readings.onsetYearFallingBackToLatestBendPoints, 6)

    const paid = run(plan).years.find((y) => y.year === 2026)!.incomes.socialSecurity
    expect(paid).toBeCloseTo(37_522.8, 6)
  })
})
