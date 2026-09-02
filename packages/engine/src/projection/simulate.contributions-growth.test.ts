import { describe, expect, it } from 'vitest'

import { describeRule } from '../rules/describeRule.js'

import { year2026 } from '../params/data/year2026.js'
import { createFederalTaxCalculator } from '../tax/federalTax.js'
import { createFlatTaxCalculator } from '../testing/flatTax.js'
import { simulatePlan } from './simulate.js'
import {
  basePlan,
  cash,
  currentYearAca,
  noTax,
  taxable,
  testIds,
  traditional,
  validate,
  wages,
} from './simulate.test-support.js'

describe('contributions', () => {
  it('caps employer-plan contributions, with the 60–63 super catch-up', () => {
    const plan = basePlan()
    plan.household.people[0]!.dob = '1965-06-15' // age 61 in 2026
    plan.incomes = [wages(300_000)]
    plan.accounts = [cash(0), traditional(0, 60_000)]
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })

    const y1 = result.years[0]!
    // 2026: 24,500 + 11,250 super catch-up = 35,750.
    expect(y1.contributions).toBeCloseTo(35_750, 6)
    expect(result.warnings.join(' ')).toContain('IRS annual limits')
  })

  it('stops contributions when wages stop', () => {
    const plan = basePlan()
    plan.incomes = [wages(100_000)]
    plan.accounts = [cash(1_000_000), traditional(0, 10_000)]
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })

    const working = result.years.find((y) => y.year === 2032)! // age 66
    const retired = result.years.find((y) => y.year === 2033)! // age 67
    expect(working.contributions).toBe(10_000)
    expect(retired.contributions).toBe(0)
  })

  it('treats traditional contributions as pre-tax', () => {
    const plan = basePlan()
    plan.incomes = [wages(100_000)]
    plan.expenses.baseAnnual = 0
    plan.accounts = [cash(0), traditional(0, 20_000)]
    const flat10 = createFlatTaxCalculator(10)
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: flat10 })

    expect(result.years[0]!.tax).toBeCloseTo(8_000, 6) // 10% of (100k − 20k)
  })
  it('uses scheduled contributions with age windows and escalation for non-employer accounts without wages', () => {
    const plan = basePlan()
    plan.household.people[0]!.dob = '1996-06-15' // age 30 in 2026
    plan.incomes = []
    const brokerage = taxable(0, 0)
    if (brokerage.type !== 'taxable') throw new Error('expected taxable account')
    plan.accounts = [
      cash(50_000),
      {
        ...brokerage,
        contributionSchedule: [{ annualAmount: 1_000, fromAge: 30, toAge: 31, escalationPct: 10 }],
      },
    ]
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })

    expect(result.years.find((y) => y.year === 2026)!.contributions).toBeCloseTo(1_000, 6)
    expect(result.years.find((y) => y.year === 2027)!.contributions).toBeCloseTo(1_100, 6)
    expect(result.years.find((y) => y.year === 2028)!.contributions).toBe(0)
  })

  it('keeps scheduled employer-plan contributions wage-gated', () => {
    const plan = basePlan()
    plan.incomes = []
    const employerPlan = traditional(0, 0)
    if (employerPlan.type !== 'traditional') throw new Error('expected traditional account')
    plan.accounts = [
      cash(50_000),
      {
        ...employerPlan,
        contributionSchedule: [{ annualAmount: 10_000, fromAge: null, toAge: null, escalationPct: 0 }],
      },
    ]
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })

    expect(result.years[0]!.contributions).toBe(0)
  })

  it('adds employer match without using the employee elective-deferral limit', () => {
    const plan = basePlan()
    plan.incomes = [wages(100_000)]
    const employerPlan = traditional(0, 10_000)
    if (employerPlan.type !== 'traditional') throw new Error('expected traditional account')
    plan.accounts = [
      cash(0),
      {
        ...employerPlan,
        employerMatch: { matchPct: 50, capPctOfPay: 6 },
      },
    ]
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })

    const y1 = result.years[0]!
    expect(y1.contributions).toBeCloseTo(10_000, 6)
    expect(y1.employerMatch).toBeCloseTo(3_000, 6)
    expect(y1.balances[plan.accounts[1]!.id]).toBeCloseTo(13_000, 6)
  })

  it('caps employer match by the section 415(c) total-additions limit', () => {
    const plan = basePlan()
    plan.household.people[0]!.dob = '1990-06-15' // no catch-up
    plan.incomes = [wages(2_000_000)]
    const employerPlan = traditional(0, 24_500)
    if (employerPlan.type !== 'traditional') throw new Error('expected traditional account')
    plan.accounts = [
      cash(0),
      {
        ...employerPlan,
        employerMatch: { matchPct: 500, capPctOfPay: 100 },
      },
    ]
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })

    const y1 = result.years[0]!
    expect(y1.contributions).toBeCloseTo(24_500, 6)
    expect(y1.employerMatch).toBeCloseTo(72_000 - 24_500, 6)
  })

  // IRC 223(g)(1) indexes the subsection (b)(2) contribution limits and does
  // NOT list the (b)(3) catch-up, which has been a flat 1,000 dollars since
  // 2009. Carrying the inflation factor across both is the natural mistake and
  // it compounds: every projected year hands a 55-plus contributor more room
  // than the statute allows, growing with the horizon.
  //
  // 2027 is past the latest pack year, so limits scale by one year of
  // inflation. At 10 percent:
  //   base indexed, catch-up flat:  4,400 x 1.10 + 1,000 = 5,840
  //   both indexed:                (4,400 + 1,000) x 1.10 = 5,940
  describeRule('irc-223-b-3-hsa-catch-up-not-indexed', {
    readings: { onlyTheBaseIsIndexed: 5_840, bothIndexed: 5_940 },
    accepted: 'onlyTheBaseIsIndexed',
  }, ({ accepted, readings }) => {
    it('keeps the catch-up flat while the base limit grows', () => {
      const plan = basePlan()
      plan.assumptions.inflationPct = 10
      plan.household.people[0]! = {
        ...plan.household.people[0]!,
        dob: '1966-06-15', // 60 in 2026, so the catch-up applies throughout
      }
      plan.incomes = [wages(500_000)]
      plan.accounts = [
        { ...cash(1_000_000) },
        {
          id: testIds(), name: 'HSA', type: 'hsa', ownerPersonId: 'p1',
          balance: 0, annualReturnPct: 0, annualContribution: 50_000,
        } as never,
      ]

      const result = simulatePlan(validate(plan), { startYear: 2026, horizonEndYear: 2027, taxCalculator: noTax })
      const projected = result.years.find((y) => y.year === 2027)!

      expect(projected.contributions).toBeCloseTo(accepted, 6)
      expect(projected.contributions).not.toBeCloseTo(readings.bothIndexed, 6)
    })
  })

  // IRC 223(b)(5) gives a married couple ONE family limit, not one each.
  // Subparagraph (A) treats both spouses as having the family coverage, and
  // (B)(ii) divides the paragraph (1) limitation equally between them unless
  // they agree otherwise. Keying the limit group per person while sizing the
  // base on family coverage hands each spouse a whole family limit, so the
  // household deducts roughly twice the statutory maximum and the excess is
  // exposed to the section 4973 excise.
  //
  // (B) computes the amount to be divided "without regard to any additional
  // contribution amount under paragraph (3)", so the age-55 catch-up is NOT
  // halved -- each spouse keeps a whole one. Pat is 60 (catch-up) and Sam is
  // 50 (none), which is what separates the third reading from the first: on
  // equal ages the halved-catch-up reading produces the same household total.
  //
  // 2026 is the pack year, so no indexing applies. Family limit 8,750:
  //   divided equally, whole catch-ups: 4,375 + 1,000 and 4,375 + 0
  //   a full family limit each:         8,750 + 1,000 and 8,750 + 0
  //   catch-up divided as well:         (8,750 + 1,000) / 2 to each
  describeRule('irc-223-b-5-hsa-family-limit-divided-between-spouses', {
    readings: {
      dividedEquallyWithWholeCatchUps: { pat: 5_375, sam: 4_375 },
      aFullFamilyLimitEach: { pat: 9_750, sam: 8_750 },
      catchUpDividedToo: { pat: 4_875, sam: 4_875 },
    },
    accepted: 'dividedEquallyWithWholeCatchUps',
  }, ({ accepted, readings }) => {
    it('halves the family base between spouses but leaves each catch-up whole', () => {
      const plan = basePlan()
      plan.household.filingStatus = 'marriedFilingJointly'
      plan.household.people[0]! = {
        ...plan.household.people[0]!,
        dob: '1966-06-15', // 60 in 2026, so the age-55 catch-up applies
      }
      plan.household.people.push({
        id: 'p2',
        name: 'Sam',
        dob: '1976-06-15', // 50 in 2026, below the age-55 catch-up
        sex: 'average',
        retirementAge: 67,
        longevity: { planningAge: 90, source: 'manual' },
      })
      plan.incomes = [wages(300_000, 'p1'), wages(300_000, 'p2')]
      plan.accounts = [
        cash(1_000_000),
        {
          id: 'hsa-pat', name: 'HSA Pat', type: 'hsa', ownerPersonId: 'p1',
          balance: 0, annualReturnPct: 0, annualContribution: 50_000,
        } as never,
        {
          id: 'hsa-sam', name: 'HSA Sam', type: 'hsa', ownerPersonId: 'p2',
          balance: 0, annualReturnPct: 0, annualContribution: 50_000,
        } as never,
      ]

      const year = simulatePlan(validate(plan), {
        startYear: 2026, horizonEndYear: 2026, taxCalculator: noTax,
      }).years[0]!

      expect(year.balances['hsa-pat']).toBeCloseTo(accepted.pat, 6)
      expect(year.balances['hsa-sam']).toBeCloseTo(accepted.sam, 6)
      expect(year.contributions).toBeCloseTo(accepted.pat + accepted.sam, 6)
      // The household total alone cannot separate the first and third
      // readings, so the failure is pinned per spouse.
      expect(year.balances['hsa-pat']).not.toBeCloseTo(readings.aFullFamilyLimitEach.pat, 6)
      expect(year.balances['hsa-pat']).not.toBeCloseTo(readings.catchUpDividedToo.pat, 6)
    })

    it('leaves a one-person household on the undivided self-only limit', () => {
      // Paragraph (5) opens on individuals married to each other. A single
      // filer never reaches it, so the (b)(2)(A) self-only base stands whole.
      const plan = basePlan()
      plan.household.people[0]! = { ...plan.household.people[0]!, dob: '1976-06-15' } // 50 in 2026
      plan.incomes = [wages(300_000)]
      plan.accounts = [
        cash(1_000_000),
        {
          id: 'hsa-solo', name: 'HSA', type: 'hsa', ownerPersonId: 'p1',
          balance: 0, annualReturnPct: 0, annualContribution: 50_000,
        } as never,
      ]

      const year = simulatePlan(validate(plan), {
        startYear: 2026, horizonEndYear: 2026, taxCalculator: noTax,
      }).years[0]!

      expect(year.balances['hsa-solo']).toBeCloseTo(4_400, 6)
    })

    it('leaves an unmarried two-person household a whole family limit each', () => {
      // The division is a rule about spouses, not about household size, and
      // the two are not the same fact here: the schema requires two people for
      // a joint return but does not require a joint return of a two-person
      // household. Two unmarried individuals with family coverage are each an
      // eligible individual under (b)(2)(B) whom paragraph (5) never reaches,
      // so neither the base nor the catch-up is divided. Same ages as the
      // married fixture above, so only the marital fact differs.
      const plan = basePlan()
      plan.household.filingStatus = 'single'
      plan.household.people[0]! = { ...plan.household.people[0]!, dob: '1966-06-15' } // 60 in 2026
      plan.household.people.push({
        id: 'p2',
        name: 'Sam',
        dob: '1976-06-15', // 50 in 2026
        sex: 'average',
        retirementAge: 67,
        longevity: { planningAge: 90, source: 'manual' },
      })
      plan.incomes = [wages(300_000, 'p1'), wages(300_000, 'p2')]
      plan.accounts = [
        cash(1_000_000),
        {
          id: 'hsa-pat', name: 'HSA Pat', type: 'hsa', ownerPersonId: 'p1',
          balance: 0, annualReturnPct: 0, annualContribution: 50_000,
        } as never,
        {
          id: 'hsa-sam', name: 'HSA Sam', type: 'hsa', ownerPersonId: 'p2',
          balance: 0, annualReturnPct: 0, annualContribution: 50_000,
        } as never,
      ]

      const year = simulatePlan(validate(plan), {
        startYear: 2026, horizonEndYear: 2026, taxCalculator: noTax,
      }).years[0]!

      expect(year.balances['hsa-pat']).toBeCloseTo(9_750, 6) // 8,750 + 1,000
      expect(year.balances['hsa-sam']).toBeCloseTo(8_750, 6)
      // Halving an unmarried pair is the failure this pins.
      expect(year.balances['hsa-pat']).not.toBeCloseTo(5_375, 6)
      expect(year.balances['hsa-sam']).not.toBeCloseTo(4_375, 6)
    })
  })

  // IRC 414(v)(2)(E) covers a participant who "would attain age 60 but would
  // not attain age 64" before the close of the year. The window CLOSES at 64 --
  // it is not an enhancement that persists once reached. Treating it as
  // permanent overstates the deferral limit for every year from 64 onward,
  // which for most plans is the rest of the working life.
  //
  // 2026 is the pack year, so no indexing applies. Aged 64:
  //   reverts to the age-50 catch-up:  24,500 + 8,000  = 32,500
  //   keeps the 60-63 catch-up:        24,500 + 11,250 = 35,750
  describeRule('irc-414-v-2-E-super-catch-up-window', {
    readings: { revertsAtSixtyFour: 32_500, keepsTheHigherCatchUp: 35_750 },
    accepted: 'revertsAtSixtyFour',
    note: 'the window closes at 64',
  }, ({ accepted, readings }) => {
    it('drops back to the ordinary catch-up at sixty-four', () => {
      const plan = basePlan()
      plan.household.people[0]! = {
        ...plan.household.people[0]!,
        dob: '1962-06-15', // 64 in 2026
        retirementAge: 70,
      }
      plan.incomes = [wages(500_000)]
      plan.accounts = [
        { ...cash(1_000_000) },
        {
          id: testIds(), name: '401k', type: 'traditional', kind: 'employer',
          ownerPersonId: 'p1', balance: 0, annualReturnPct: 0,
          annualContribution: 60_000,
        } as never,
      ]

      const result = simulatePlan(validate(plan), { startYear: 2026, horizonEndYear: 2026, taxCalculator: noTax })

      expect(result.years[0]!.contributions).toBeCloseTo(accepted, 6)
      expect(result.years[0]!.contributions).not.toBeCloseTo(readings.keepsTheHigherCatchUp, 6)
    })
  })

  // IRC 414(v)(2)(E)(i) makes the ages 60-63 amount the greater of (I) 10,000
  // dollars and (II) 150 percent of the catch-up in effect for 2024, which is
  // 11,250. Leg (I) never governs: Treasury's final catch-up regulations fix
  // the indexed base at 11,250 outright (26 CFR 1.414(v)-1(c)(2)(iii)(B)).
  //
  // The window fixture above sits at the 2026 pack year, where limitGrowth is
  // 1 and every reading agrees, so it cannot see the mechanism at all.
  //
  // 414(v)(2)(C)(i) rounds the INCREASE down to a multiple of 500, not the
  // adjusted amount. 2027 at 2 percent is the case where that matters and the
  // mechanism does not: the increase is too small to clear a step, so the
  // amount does not move even though it is indexed.
  //   increase   11,250 x 0.02 = 225, floors to 0  -> catch-up stays 11,250
  //   deferral   24,500 x 1.02 = 24,990
  //   rounded increase:  24,990 + 11,250          = 36,240
  //   amount indexed:    24,990 + 11,475          = 36,465
  //
  // This is exactly why Notice 2025-67 holding the amount at 11,250 for 2026
  // proves nothing about whether it is indexed.
  describeRule('irc-414-v-2-E-super-catch-up-window', {
    readings: { increaseRoundedToAStep: 36_240, amountIndexedDirectly: 36_465 },
    accepted: 'increaseRoundedToAStep',
    note: 'a sub-step increase does not move the amount',
  }, ({ accepted, readings }) => {
    it('does not move the amount when the increase falls short of a 500 step', () => {
      const plan = basePlan()
      plan.assumptions.inflationPct = 2
      plan.household.people[0]! = {
        ...plan.household.people[0]!,
        dob: '1965-06-15', // 62 in 2027, inside the window
        retirementAge: 70,
      }
      plan.incomes = [wages(500_000)]
      plan.accounts = [
        { ...cash(1_000_000) },
        {
          id: testIds(), name: '401k', type: 'traditional', kind: 'employer',
          ownerPersonId: 'p1', balance: 0, annualReturnPct: 0,
          annualContribution: 60_000,
        } as never,
      ]

      const result = simulatePlan(validate(plan), { startYear: 2026, horizonEndYear: 2027, taxCalculator: noTax })
      const projected = result.years.find((y) => y.year === 2027)!

      expect(projected.contributions).toBeCloseTo(accepted, 6)
      expect(projected.contributions).not.toBeCloseTo(readings.amountIndexedDirectly, 6)
    })
  })

  // The companion to the case above, and the one that pins WHERE the increase
  // is measured from. 26 CFR 1.414(v)-1(c)(2)(iii)(B) indexes the initial
  // 11,250 off a fixed base period (the quarter beginning July 1 2024). This
  // fixture does not exercise that base period -- the engine measures from the
  // pack year instead -- but it does pin the property the two share: the
  // rounding is applied once to a cumulative increase, so cost-of-living below
  // a 500 step is banked rather than discarded and eventually carries the
  // amount up a full step.
  //
  // 2029 is three years past the pack year; at 2 percent limits scale by
  // 1.02^3 = 1.061208. Each single year moves 11,250 by only 225, short of a
  // step, but the cumulative increase clears one:
  //   increase   11,250 x 0.061208 = 688.59, floors to 500 -> catch-up 11,750
  //   deferral   24,500 x 1.061208 = 25,999.596
  //   measured from the fixed base: 25,999.596 + 11,750 = 37,749.596
  //   rounded per year, compounded: 25,999.596 + 11,250 = 37,249.596
  //   indexed with no rounding: (24,500 + 11,250) x 1.061208 = 37,938.186
  //
  // The middle reading is the natural-looking mistake: rounding each year in
  // turn drops the sub-step remainder every year and pins the amount forever,
  // which understates the limit permanently and reproduces the very behaviour
  // the fixed-base-period reading was adopted to reject.
  describeRule('irc-414-v-2-E-super-catch-up-window', {
    readings: {
      increaseMeasuredFromTheBasePeriod: 37_749.596,
      roundedEachYearAndCompounded: 37_249.596,
      indexedWithoutRounding: 37_938.186,
    },
    accepted: 'increaseMeasuredFromTheBasePeriod',
    note: 'the increase is measured from a fixed origin, not year over year',
  }, ({ accepted, readings }) => {
    it('banks cost-of-living below a step until it carries the amount up', () => {
      const plan = basePlan()
      plan.assumptions.inflationPct = 2
      plan.household.people[0]! = {
        ...plan.household.people[0]!,
        dob: '1967-06-15', // 62 in 2029, inside the window
        retirementAge: 70,
      }
      plan.incomes = [wages(500_000)]
      plan.accounts = [
        { ...cash(1_000_000) },
        {
          id: testIds(), name: '401k', type: 'traditional', kind: 'employer',
          ownerPersonId: 'p1', balance: 0, annualReturnPct: 0,
          annualContribution: 60_000,
        } as never,
      ]

      const result = simulatePlan(validate(plan), { startYear: 2026, horizonEndYear: 2029, taxCalculator: noTax })
      const projected = result.years.find((y) => y.year === 2029)!

      expect(projected.contributions).toBeCloseTo(accepted, 6)
      expect(projected.contributions).not.toBeCloseTo(readings.roundedEachYearAndCompounded, 6)
      expect(projected.contributions).not.toBeCloseTo(readings.indexedWithoutRounding, 6)
    })
  })

  // The case that separates the two readings of 414(v)(2)(C)(i). 2028 at 10
  // percent scales limits by 1.1^2 = 1.21, enough for the operative amount to
  // clear four rounding steps:
  //   increase   11,250 x 0.21 = 2,362.50, floors to 2,000 -> catch-up 13,250
  //   deferral   24,500 x 1.21 = 29,645
  //   operative amount indexed:  29,645 + 13,250          = 42,895
  //   only the 10,000 leg moves: 29,645 + max(12,100, 11,250) = 41,745
  //   amount indexed unrounded:  (24,500 + 11,250) x 1.21 = 43,257.50
  describeRule('irc-414-v-2-E-super-catch-up-window', {
    readings: {
      operativeAmountIndexed: 42_895,
      onlyTheTenThousandLegMoves: 41_745,
      indexedWithoutRounding: 43_257.5,
    },
    accepted: 'operativeAmountIndexed',
    note: 'which amount the adjustment reaches',
  }, ({ accepted, readings }) => {
    it('indexes the operative amount rather than the inoperative 10,000 leg', () => {
      const plan = basePlan()
      plan.assumptions.inflationPct = 10
      plan.household.people[0]! = {
        ...plan.household.people[0]!,
        dob: '1966-06-15', // 62 in 2028, inside the window
        retirementAge: 70,
      }
      plan.incomes = [wages(500_000)]
      plan.accounts = [
        { ...cash(1_000_000) },
        {
          id: testIds(), name: '401k', type: 'traditional', kind: 'employer',
          ownerPersonId: 'p1', balance: 0, annualReturnPct: 0,
          annualContribution: 60_000,
        } as never,
      ]

      const result = simulatePlan(validate(plan), { startYear: 2026, horizonEndYear: 2028, taxCalculator: noTax })
      const projected = result.years.find((y) => y.year === 2028)!

      expect(projected.contributions).toBeCloseTo(accepted, 6)
      expect(projected.contributions).not.toBeCloseTo(readings.onlyTheTenThousandLegMoves, 6)
      expect(projected.contributions).not.toBeCloseTo(readings.indexedWithoutRounding, 6)
    })
  })

  // IRC 415(c)(1) caps ANNUAL ADDITIONS -- 415(c)(2) defines those as employer
  // contributions plus employee contributions plus forfeitures -- at the LESSER
  // of the dollar amount and 100 percent of compensation. The cap is on the
  // total, not on the match, which is what makes the pay prong bite so hard:
  // deferrals consume it first and the match gets only what is left.
  //
  // Wages 30,000, a 200 percent match on all pay. Deferrals reach 24,500:
  //   pay prong binds:     24,500 + 5,500  = 30,000, exactly the pay
  //   dollar prong alone:  24,500 + 47,500 = 72,000, more than twice the pay
  describeRule('irc-415-c-1-annual-additions-lesser-of', {
    readings: { totalCappedByCompensation: 30_000, totalCappedByDollarLimit: 72_000 },
    accepted: 'totalCappedByCompensation',
    note: 'the cap binds total additions, not the match alone',
  }, ({ accepted, readings }) => {
    it('never lets total additions exceed the participant pay', () => {
      const plan = basePlan()
      plan.household.people[0]! = {
        ...plan.household.people[0]!,
        dob: '1980-06-15',
        retirementAge: 70,
      }
      plan.incomes = [wages(30_000)]
      plan.accounts = [
        { ...cash(1_000_000) },
        {
          id: testIds(), name: '401k', type: 'traditional', kind: 'employer',
          ownerPersonId: 'p1', balance: 0, annualReturnPct: 0,
          annualContribution: 30_000,
          employerMatch: { matchPct: 200, capPctOfPay: 100 },
        } as never,
      ]

      const result = simulatePlan(validate(plan), { startYear: 2026, horizonEndYear: 2026, taxCalculator: noTax })
      const year = result.years[0]!
      const annualAdditions = year.contributions + year.employerMatch

      expect(annualAdditions).toBeCloseTo(accepted, 6)
      expect(annualAdditions).not.toBeCloseTo(readings.totalCappedByDollarLimit, 6)
    })
  })

  // The same cap, reached without a match at all. 415(c)(2)(B) puts "the
  // employee contributions" inside annual additions, so the pay prong binds the
  // deferral itself -- there is no match left to zero out. This is the case a
  // fixture that only watches the match cannot see: a participant paid less
  // than the 402(g) limit would otherwise defer more than they earned.
  //
  // Wages 20,000, no match, 24,500 asked for. Age 46, so no catch-up:
  //   pay prong binds:           20,000, exactly the pay
  //   402(g) limit alone binds:  24,500, more than the participant earned
  describeRule('irc-415-c-1-annual-additions-lesser-of', {
    readings: { deferralCappedByCompensation: 20_000, deferralCappedByDeferralLimitOnly: 24_500 },
    accepted: 'deferralCappedByCompensation',
    note: 'the pay prong binds deferrals too',
  }, ({ accepted, readings }) => {
    it('binds the deferral itself, not only the match', () => {
      const plan = basePlan()
      plan.household.people[0]! = {
        ...plan.household.people[0]!,
        dob: '1980-06-15',
        retirementAge: 70,
      }
      plan.incomes = [wages(20_000)]
      plan.accounts = [
        { ...cash(1_000_000) },
        {
          id: testIds(), name: '401k', type: 'traditional', kind: 'employer',
          ownerPersonId: 'p1', balance: 0, annualReturnPct: 0,
          annualContribution: 24_500,
        } as never,
      ]

      const result = simulatePlan(validate(plan), { startYear: 2026, horizonEndYear: 2026, taxCalculator: noTax })
      const year = result.years[0]!

      expect(year.employerMatch).toBeCloseTo(0, 6)
      expect(year.contributions).toBeCloseTo(accepted, 6)
      expect(year.contributions).not.toBeCloseTo(readings.deferralCappedByDeferralLimitOnly, 6)
    })
  })

  // IRC 402(g)(1)(A) limits "the elective deferrals of any INDIVIDUAL", and
  // 402(g)(3) sums every arrangement into that one total. Treating the limit as
  // per plan doubles the room for anyone holding two employer accounts, which
  // is common enough after a job change.
  //
  // Two employer plans, each asked for 30,000, owner aged 46 so no catch-up:
  //   aggregate across plans:  24,500
  //   one limit per plan:      49,000
  describeRule('irc-402-g-1-elective-deferral-aggregate', {
    readings: { aggregateAcrossAllPlans: 24_500, oneLimitPerPlan: 49_000 },
    accepted: 'aggregateAcrossAllPlans',
  }, ({ accepted, readings }) => {
    it('shares one deferral limit across every employer plan', () => {
      const plan = basePlan()
      plan.household.people[0]! = { ...plan.household.people[0]!, dob: '1980-06-15', retirementAge: 70 }
      plan.incomes = [wages(500_000)]
      plan.accounts = [
        { ...cash(1_000_000) },
        { id: testIds(), name: '401k A', type: 'traditional', kind: 'employer',
          ownerPersonId: 'p1', balance: 0, annualReturnPct: 0, annualContribution: 30_000 } as never,
        { id: testIds(), name: '401k B', type: 'traditional', kind: 'employer',
          ownerPersonId: 'p1', balance: 0, annualReturnPct: 0, annualContribution: 30_000 } as never,
      ]

      const result = simulatePlan(validate(plan), { startYear: 2026, horizonEndYear: 2026, taxCalculator: noTax })

      expect(result.years[0]!.contributions).toBeCloseTo(accepted, 6)
      expect(result.years[0]!.contributions).not.toBeCloseTo(readings.oneLimitPerPlan, 6)
    })
  })

  // IRC 223(b)(2) supplies the self-only and family coverage tiers, while
  // Rev. Proc. 2025-19 publishes the 2026 adjusted annual limits. The plan has
  // no HDHP coverage election; irc-223-b-2-7 approximates household size as
  // family coverage, so the observed 8,750 is pack.contributionLimits.hsaFamily
  // under that substitution rather than a coverage-type election. The old
  // statutory base amounts ($2,250/$4,500) are the rejected reading; using
  // them would understate both a solo HSA and the total family contribution.
  describeRule('irc-223-b-2-hsa-base-limits-2026', {
    readings: {
      revProc2026: {
        selfOnly: 4_400,
        family: year2026.contributionLimits.hsaFamily,
      },
      unadjustedStatutoryAmounts: { selfOnly: 2_250, family: 4_500 },
    },
    accepted: 'revProc2026',
  }, ({ accepted, readings }) => {
    it('reads the 2026 self-only and family limits from the parameter pack', () => {
      const selfOnly = basePlan()
      selfOnly.household.people[0]! = {
        ...selfOnly.household.people[0]!,
        dob: '1986-06-15', // age 40: no catch-up
        retirementAge: 70,
      }
      selfOnly.incomes = [wages(100_000)]
      selfOnly.accounts = [
        cash(1_000_000),
        {
          id: testIds(), name: 'HSA', type: 'hsa', ownerPersonId: 'p1',
          balance: 0, annualReturnPct: 0, annualContribution: 50_000,
        } as never,
      ]
      const selfYear = simulatePlan(validate(selfOnly), {
        startYear: 2026, horizonEndYear: 2026, taxCalculator: noTax,
      }).years[0]!

      const family = basePlan()
      family.household.filingStatus = 'marriedFilingJointly'
      family.household.people[0]! = {
        ...family.household.people[0]!,
        dob: '1986-06-15',
        retirementAge: 70,
      }
      family.household.people.push({
        id: 'p2', name: 'Sam', dob: '1986-06-15', sex: 'average',
        retirementAge: 70, longevity: { planningAge: 90, source: 'manual' },
      })
      family.incomes = [wages(100_000, 'p1'), wages(100_000, 'p2')]
      family.accounts = [
        cash(1_000_000),
        {
          id: 'hsa-p1', name: 'HSA Pat', type: 'hsa', ownerPersonId: 'p1',
          balance: 0, annualReturnPct: 0, annualContribution: 50_000,
        } as never,
        {
          id: 'hsa-p2', name: 'HSA Sam', type: 'hsa', ownerPersonId: 'p2',
          balance: 0, annualReturnPct: 0, annualContribution: 50_000,
        } as never,
      ]
      const familyYear = simulatePlan(validate(family), {
        startYear: 2026, horizonEndYear: 2026, taxCalculator: noTax,
      }).years[0]!

      const observed = {
        selfOnly: selfYear.balances[selfOnly.accounts[1]!.id]!,
        family: familyYear.contributions,
      }
      expect(observed).toEqual(accepted)
      expect(observed).not.toEqual(readings.unadjustedStatutoryAmounts)
      expect(familyYear.balances['hsa-p1']).toBeCloseTo(4_375, 6)
      expect(familyYear.balances['hsa-p2']).toBeCloseTo(4_375, 6)
    })
  })

  // IRC 223(a) makes an allowed HSA payment an above-the-line deduction. The
  // rejected reading leaves the deposit in AGI; a $4,400 contribution against
  // $100,000 of wages therefore gives federal AGI/MAGI 95,600 rather than
  // 100,000. currentYearAca also pins ACA householdMagi falling by the same
  // $4,400.
  describeRule('irc-223-a-hsa-contribution-deduction-reduces-agi', {
    readings: {
      aboveTheLineDeduction: { agi: 95_600, magi: 95_600, householdMagi: 95_600 },
      contributionNotDeducted: { agi: 100_000, magi: 100_000, householdMagi: 100_000 },
    },
    accepted: 'aboveTheLineDeduction',
  }, ({ accepted, readings }) => {
    it('reduces realized MAGI and ACA household MAGI by the allowed HSA contribution', () => {
      const withHsa = basePlan()
      withHsa.household.people[0]! = {
        ...withHsa.household.people[0]!,
        dob: '1986-06-15', // age 40: self-only base applies, no catch-up
        retirementAge: 70,
      }
      withHsa.incomes = [wages(100_000)]
      withHsa.accounts = [
        cash(1_000_000),
        {
          id: testIds(), name: 'HSA', type: 'hsa', ownerPersonId: 'p1',
          balance: 0, annualReturnPct: 0, annualContribution: 4_400,
        } as never,
      ]
      currentYearAca(withHsa)
      const withoutHsa = structuredClone(withHsa)
      withoutHsa.accounts = [cash(1_000_000)]
      currentYearAca(withoutHsa)

      const withYear = simulatePlan(validate(withHsa), {
        startYear: 2026, horizonEndYear: 2026, taxCalculator: createFederalTaxCalculator(),
      }).years[0]!
      const withoutYear = simulatePlan(validate(withoutHsa), {
        startYear: 2026, horizonEndYear: 2026, taxCalculator: createFederalTaxCalculator(),
      }).years[0]!
      const observed = {
        agi: withYear.advisoryFederalTax!.detail.agi,
        magi: withYear.magi,
        householdMagi: withYear.aca!.householdMagi!,
      }

      expect(observed).toEqual(accepted)
      expect(observed).not.toEqual(readings.contributionNotDeducted)
      expect({
        agi: withoutYear.advisoryFederalTax!.detail.agi,
        magi: withoutYear.magi,
        householdMagi: withoutYear.aca!.householdMagi!,
      }).toEqual(readings.contributionNotDeducted)
      expect(withoutYear.magi - withYear.magi).toBe(4_400)
      expect(withoutYear.aca!.householdMagi! - withYear.aca!.householdMagi!).toBe(4_400)
    })
  })
})

describe('growth, pensions, property, debt', () => {
  it('applies per-account and default growth after flows', () => {
    const plan = basePlan()
    plan.assumptions.defaultReturnPct = 10
    plan.accounts = [cash(100_000), { ...taxable(100_000, 100_000), annualReturnPct: 5 }]
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })

    const y1 = result.years[0]!
    expect(y1.balances[plan.accounts[0]!.id]).toBeCloseTo(110_000, 6)
    expect(y1.balances[plan.accounts[1]!.id]).toBeCloseTo(105_000, 6)
  })

  it('pays pension survivor percentage after the owner dies', () => {
    const plan = basePlan()
    plan.household.filingStatus = 'marriedFilingJointly'
    plan.household.people = [
      plan.household.people[0]!,
      { id: 'p2', name: 'Sam', dob: '1966-06-15', sex: 'average', retirementAge: null, longevity: { planningAge: 80, source: 'manual' } },
    ]
    plan.accounts = [
      cash(5_000_000),
      { type: 'pension', id: 'pen1', name: 'Pension', ownerPersonId: 'p2', annualReturnPct: null, startAge: 65, monthlyAmount: 3000, colaPct: 0, survivorPct: 50 },
    ]
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })

    const whileAlive = result.years.find((y) => y.year === 2046)! // p2 age 80 (last alive year)
    const afterDeath = result.years.find((y) => y.year === 2047)!
    expect(whileAlive.incomes.pension).toBeCloseTo(36_000, 6)
    expect(afterDeath.incomes.pension).toBeCloseTo(18_000, 6)
  })

  it('sells property in the planned year and deposits proceeds', () => {
    const plan = basePlan()
    plan.accounts = [
      cash(0),
      { type: 'property', id: 'home', name: 'Home', ownerPersonId: null, annualReturnPct: null, value: 500_000, plannedSaleYear: 2030, expectedNetProceeds: 450_000 },
    ]
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })

    const saleYear = result.years.find((y) => y.year === 2030)!
    expect(saleYear.balances['home']).toBe(0)
    expect(saleYear.balances[plan.accounts[0]!.id]).toBeCloseTo(450_000, 6)
  })

  it('amortizes debt and counts payments as expenses until payoff', () => {
    const plan = basePlan()
    plan.accounts = [
      cash(1_000_000),
      { type: 'debt', id: 'mort', name: 'Mortgage', ownerPersonId: null, annualReturnPct: null, balance: 100_000, interestPct: 4, monthlyPayment: 2_000 },
    ]
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })

    const y1 = result.years[0]!
    expect(y1.expenses.debtService).toBe(24_000)
    expect(y1.balances['mort']).toBeCloseTo(100_000 * 1.04 - 24_000, 6)

    const payoffReached = result.years.find((y) => y.balances['mort'] === 0)
    expect(payoffReached).toBeDefined()
    const after = result.years.find((y) => y.year === payoffReached!.year + 1)!
    expect(after.expenses.debtService).toBe(0)
    // Net worth reflects debt while outstanding.
    expect(y1.netWorth).toBeCloseTo(y1.investableTotal - y1.balances['mort']!, 6)
  })
})

describe('IRA contribution ceilings', () => {
  /** Born 1985, so 41 in 2026 — no age-50 catch-up muddying the arithmetic. */
  function youngPerson(id: string, name: string) {
    return {
      id, name, dob: '1985-06-15', sex: 'average' as const, retirementAge: 67,
      longevity: { planningAge: 90, source: 'manual' as const },
    }
  }

  function ira(ownerPersonId: string, annualContribution: number, type: 'traditional' | 'roth' = 'traditional') {
    return {
      id: testIds(), name: `${ownerPersonId} ${type} IRA`, type, kind: 'ira', ownerPersonId,
      balance: 0, annualReturnPct: 0, annualContribution,
    } as never
  }

  /** Scheduled contributions skip the legacy "owner must have wages" gate, which
   *  is what lets a non-earning spouse reach the 219(c) pool at all. */
  function scheduledIra(ownerPersonId: string, annualAmount: number) {
    return {
      id: testIds(), name: `${ownerPersonId} IRA`, type: 'traditional', kind: 'ira', ownerPersonId,
      balance: 0, annualReturnPct: 0, annualContribution: 0,
      contributionSchedule: [{ annualAmount, fromAge: null, toAge: null, escalationPct: 0 }],
    } as never
  }

  describeRule('irc-219-b-1-ira-limit-lesser-of-compensation', {
    readings: { dollarLimitOnly: 7_500, lesserOfCompensation: 3_000 },
    accepted: 'lesserOfCompensation',
  }, ({ accepted, readings }) => {
    it('holds a low earner to compensation rather than to the dollar limit', () => {
      const plan = basePlan()
      plan.household.people[0]! = youngPerson('p1', 'Pat')
      plan.incomes = [wages(3_000)]
      plan.accounts = [cash(1_000_000), ira('p1', 7_500)]

      const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })
      const y = result.years.find((r) => r.year === 2026)!

      expect(y.contributions).toBeCloseTo(accepted, 6)
      expect(y.contributions).not.toBeCloseTo(readings.dollarLimitOnly, 6)
    })
  })

  describeRule('irc-219-c-1-spousal-ira-combined-compensation', {
    readings: { ownCompensationOnly: 7_500, combinedCompensationPool: 10_000, noCompensationCap: 15_000 },
    accepted: 'combinedCompensationPool',
  }, ({ accepted, readings }) => {
    it('lets a non-earning spouse draw on the earner’s compensation, up to the combined total', () => {
      const plan = basePlan()
      plan.household.filingStatus = 'marriedFilingJointly'
      plan.household.people = [youngPerson('p1', 'Earner'), youngPerson('p2', 'Homemaker')]
      plan.incomes = [wages(10_000, 'p1')] // p2 has no compensation of their own
      plan.accounts = [cash(1_000_000), scheduledIra('p1', 7_500), scheduledIra('p2', 7_500)]

      const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })
      const y = result.years.find((r) => r.year === 2026)!

      // Each spouse is still separately held to the 7,500 dollar limit, so the
      // binding constraint here is the 10,000 of combined compensation.
      expect(y.contributions).toBeCloseTo(accepted, 6)
      expect(y.contributions).not.toBeCloseTo(readings.ownCompensationOnly, 6)
      expect(y.contributions).not.toBeCloseTo(readings.noCompensationCap, 6)
    })
  })

  describeRule('irc-219-f-1-compensation-excludes-deferred-income', {
    readings: { pensionIsNotCompensation: 0, anyIncomeCounts: 7_500 },
    accepted: 'pensionIsNotCompensation',
  }, ({ accepted, readings }) => {
    it('gives a retiree living on a pension no contribution room', () => {
      const plan = basePlan()
      plan.household.people[0]! = youngPerson('p1', 'Pat')
      plan.incomes = [{
        type: 'recurring', id: testIds(), label: 'Pension', annualAmount: 80_000,
        startYear: null, endYear: null, inflationAdjusted: false, taxTreatment: 'ordinary',
      } as never]
      plan.accounts = [cash(1_000_000), scheduledIra('p1', 7_500)]

      const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })
      const y = result.years.find((r) => r.year === 2026)!

      expect(y.contributions).toBeCloseTo(accepted, 6)
      expect(y.contributions).not.toBeCloseTo(readings.anyIncomeCounts, 6)
    })
  })

  describeRule('irc-408A-c-2-roth-shares-the-section-219-ceiling', {
    readings: { sharedAnnualCeiling: 7_500, separateCeilings: 15_000 },
    accepted: 'sharedAnnualCeiling',
  }, ({ accepted, readings }) => {
    it('does not give a second ceiling to someone holding both IRA flavours', () => {
      const plan = basePlan()
      plan.household.people[0]! = youngPerson('p1', 'Pat')
      plan.incomes = [wages(100_000)] // well clear of the compensation prong
      plan.accounts = [cash(1_000_000), ira('p1', 7_500, 'traditional'), ira('p1', 7_500, 'roth')]

      const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })
      const y = result.years.find((r) => r.year === 2026)!

      expect(y.contributions).toBeCloseTo(accepted, 6)
      expect(y.contributions).not.toBeCloseTo(readings.separateCeilings, 6)
    })
  })

  describeRule('irc-219-b-5-C-iii-ira-catch-up-indexed', {
    readings: { catchUpIndexed: 9_460, catchUpFlatLikeTheHsaOne: 9_350 },
    accepted: 'catchUpIndexed',
  }, ({ accepted, readings }) => {
    it('projects the age-50 catch-up instead of holding it flat', () => {
      const plan = basePlan() // p1 born 1966, so 61 in 2027
      plan.assumptions.inflationPct = 10
      plan.incomes = [wages(500_000)]
      plan.accounts = [cash(1_000_000), ira('p1', 50_000)]

      const result = simulatePlan(validate(plan), { startYear: 2026, horizonEndYear: 2027, taxCalculator: noTax })
      const y = result.years.find((r) => r.year === 2027)!

      // (7,500 + 1,100) × 1.1. The HSA catch-up next door is deliberately not
      // projected this way; see irc-223-b-3-hsa-catch-up-not-indexed.
      expect(y.contributions).toBeCloseTo(accepted, 6)
      expect(y.contributions).not.toBeCloseTo(readings.catchUpFlatLikeTheHsaOne, 6)
    })
  })
})
