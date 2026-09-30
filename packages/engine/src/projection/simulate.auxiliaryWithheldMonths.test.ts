import { describe, expect, it } from 'vitest'

import type { FormerSpouse, IncomeStream, Plan } from '../model/plan.js'
import { describeRule } from '../rules/describeRule.js'
import { simulatePlan } from './simulate.js'
import { basePlan, cash, noTax, testIds, validate } from './simulate.test-support.js'

// 42 U.S.C. 402(q)(7)(A): from the month a person reaches the full retirement
// age of a benefit (20 CFR 404.412(b)), that benefit's reduction is recomputed
// without "any month in which such benefit was subject to deductions". The
// ledger keeps one count per benefit: the months of the own benefit's reduction
// period with a deduction, of a spouse benefit's and of a widow(er) benefit's,
// each from that benefit's first month of entitlement. The current-spouse
// survivor path is pinned by the survivor-reduction-entitlement-month worksheet
// (cases D and E); these cases pin the spouse, divorced-spouse and former-spouse
// survivor paths.
//
// Every case: plan start 2026, no inflation (COLA factor 1), no benefit cut, no
// tax, a large cash account. The 2026 below-FRA earnings-test limit is $24,480
// and one dollar is withheld for every two above it, charged month by month
// from January. A claim at a whole age pays the whole year it is attained (the
// claim-year convention), but its reduction period, and so its crediting
// months, start in the month the age is attained. Every figure is recomputed by
// the law model the D-SS-ANALYSIS-EARNINGS-TEST implementation keeps outside
// the engine (it imports nothing from it).

type Person = Plan['household']['people'][number]
type Claim = { years: number; months: number }

function person(id: string, dob: string): Person {
  return { id, name: id, dob, sex: 'average', retirementAge: 67, longevity: { planningAge: 95, source: 'manual' } }
}

function ss(personId: string, pia: number, claimAge: Claim, formerSpouses?: FormerSpouse[]): IncomeStream {
  return { type: 'socialSecurity', id: testIds(), personId, piaMonthly: pia, earnings: null, claimAge, formerSpouses }
}

// Wages are paid in the years the person's attained age is below `endAge`.
function wages(personId: string, annualGross: number, endAge: number): IncomeStream {
  return { type: 'wages', id: testIds(), personId, annualGross, endAge, realGrowthPct: 0 }
}

function socialSecurityByYear(plan: Plan): (year: number) => number {
  plan.accounts = [cash(5_000_000)]
  const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })
  return (year: number): number => result.years.find((row) => row.year === year)!.incomes.socialSecurity
}

// A couple: the lower earner, born 1962-06-15 (FRA 67, 804 months), has an 800
// PIA and claims at 64y0m (768 months, factor 0.8, 640 a month from 2026). The
// higher earner, born 1960-06-15, has a 2,400 PIA and claims at 67y0m, in June
// 2027, when the lower earner is 780 months old: her spouse benefit starts then,
// reduced by 24 x 25/36 of 1% to 0.833333, so the excess 1,200 - 800 = 400 pays
// 333.33 on top of her own 640 (973.33 a month). The family maximum does not bind.
function spouseCouple(lowerWagesEndAge: number): (year: number) => number {
  const plan = basePlan()
  plan.household.filingStatus = 'marriedFilingJointly'
  plan.household.people = [person('lower', '1962-06-15'), person('higher', '1960-06-15')]
  plan.incomes = [
    ss('lower', 800, { years: 64, months: 0 }),
    ss('higher', 2_400, { years: 67, months: 0 }),
    wages('lower', 40_000, lowerWagesEndAge),
  ]
  return socialSecurityByYear(plan)
}

describe('402(q)(7) credit for a current spouse benefit', () => {
  it('does not credit months withheld from the own benefit before the spouse benefit began (40,853.33 in 2030, not 41,086.67)', () => {
    // 2026 only: her claim at 64y0m is entitled from June 2026, so only June to
    // December can be charged (403(f)(1)(A)); January to May are paid in full
    // under the claim-year convention. The 7,760 excess takes all seven entitled
    // months, 7 x 640 = 4,480, and the rest lapses, so June-December are her 7
    // own crediting months. From her June 2029 FRA month her own reduction is
    // credited, 768 + 7 = 775 months, 29 months early, factor 0.838889, 671.11;
    // her spouse reduction keeps its 780 months, since no spouse month was
    // withheld. She is paid min(671.11, 800) + 333.33 = 1,004.44 a month in 2030,
    // 12,053.33, and he 28,800. Crediting her own months to the spouse benefit
    // too (787 months, factor 0.881944, excess 352.78) would pay 1,023.89 a month:
    // 41,086.67.
    const byYear = spouseCouple(65)
    expect(byYear(2027)).toBeCloseTo((973.3333333333334 + 2_400) * 12, 6)
    // 2029: January-May at 973.33, June-December at 1,004.44.
    expect(byYear(2029)).toBeCloseTo(28_800 + 11_897.777778, 5)
    expect(byYear(2030)).toBeCloseTo(28_800 + (671.1111111111111 + 333.33333333333337) * 12, 6)
    expect(byYear(2030)).toBeCloseTo(40_853.333333, 5)
  })

  it('credits months withheld while the spouse benefit was paid, from its first month (41,553.33 in 2030, not 41,380)', () => {
    // 2026 as above: 7 own months. 2027: the spouse benefit is paid all year under
    // the claim-year convention (he claims at 67y0m) but is entitled only from
    // June 2027, his claim month, so January-May only her own 640 can be charged
    // (403(f)(1)(A)): 3,200. June-September take the whole 973.33 (3,893.33) and
    // October the last 666.67: 10 deduction months, all in her own reduction
    // period, and June-October 5 on the spouse benefit. From June 2029 her own
    // reduction is credited with 17 months (785, factor 0.894444, 715.56) and her
    // spouse reduction with 5 (785, factor 0.868056, excess 347.22): 1,062.78 a
    // month, 12,753.33 in 2030, with his 28,800. Charging the spouse benefit from
    // January, before its entitlement (the engine until the implementation
    // review), paid 41,380.
    const byYear = spouseCouple(66)
    expect(byYear(2030)).toBeCloseTo(28_800 + (715.5555555555555 + 347.2222222222222) * 12, 6)
    expect(byYear(2030)).toBeCloseTo(41_553.333333, 5)
    expect(byYear(2030)).not.toBeCloseTo(41_380, 2)
  })
})

describe('402(q)(7) credit for a divorced spouse benefit', () => {
  it('credits months withheld while the divorced-spouse total was paid (11,886.67 in 2030, not 11,653.33)', () => {
    // Single, born 1962-06-15, 800 PIA, claims at 64y0m; the ex, born
    // 1955-01-10 with a 2,400 PIA, has been 62 since 2017, so the divorced-spouse
    // benefit starts with her claim at 768 months: 640 + 400 x 0.75 = 940 a
    // month. In 2026 the 12,760 excess withholds all of her 11,280; both benefits
    // are entitled from June 2026, so June-December are 7 crediting months of
    // each. From the June 2029 FRA month both reductions are credited to 775
    // months: 800 x 0.838889 + 400 x 0.798611 = 671.11 + 319.44 = 990.56 a month,
    // 11,886.67 in 2030. Leaving the spouse reduction uncredited pays
    // 671.11 + 300 = 971.11 a month, 11,653.33.
    const plan = basePlan()
    plan.household.people = [person('p1', '1962-06-15')]
    plan.incomes = [
      ss('p1', 800, { years: 64, months: 0 }, [
        { id: 'ex', relationship: 'divorced', dob: '1955-01-10', piaMonthly: 2_400, marriageYears: 12, remarriedAtAge: null },
      ]),
      wages('p1', 50_000, 65),
    ]
    const byYear = socialSecurityByYear(plan)
    expect(byYear(2027)).toBeCloseTo(11_280, 6)
    expect(byYear(2029)).toBeCloseTo(11_633.888889, 5)
    expect(byYear(2030)).toBeCloseTo(11_886.666667, 5)
  })
})

describe('402(q)(7) credit for a former spouse survivor benefit', () => {
  // Single, born 1961-06-15: worker FRA 67 (804 months, June 2028), survivor FRA
  // 66y10m (802 months, April 2028), so the widow(er) reduction is credited from
  // April 2028 and the own reduction from June 2028. She has a 1,000 PIA and
  // claimed at 62y0m in 2023 (744 months, own factor 0.70, 700 a month). The
  // deceased ex, born 1958-03-10, claimed at FRA. Her widow(er) factor at 744
  // months is 1 - 0.285 x 58/82 = 0.798415, and at 755 months 0.836646.
  function formerSurvivor(exPia: number): (year: number) => number {
    const plan = basePlan()
    plan.household.people = [person('p1', '1961-06-15')]
    plan.incomes = [
      ss('p1', 1_000, { years: 62, months: 0 }, [
        { id: 'ex', relationship: 'deceased', dob: '1958-03-10', piaMonthly: exPia, marriageYears: 20, remarriedAtAge: null },
      ]),
      wages('p1', 40_000, 66),
    ]
    return socialSecurityByYear(plan)
  }

  it('does not credit months withheld from the own benefit to the widow(er) benefit (8,750 in 2028, not 8,788.78)', () => {
    // An 850 ex PIA: the widow(er) benefit, 850 x 0.798415 = 678.65, is below
    // her 700, so she is paid her own benefit and 2026 withholds 7,760 of it:
    // January-November and 60 of December, 12 own months. No widow(er) month is
    // credited. From her June 2028 FRA month her own benefit is credited to 756
    // months, 0.75, 750 a month: 2028 pays 5 x 700 + 7 x 750 = 8,750, and 9,000
    // from 2029. Crediting the own months to the widow(er) benefit too (756
    // months, 850 x 0.846341 = 719.39 from the April 2028 survivor FRA month)
    // would pay it in April and May: 8,788.78.
    const byYear = formerSurvivor(850)
    expect(byYear(2026)).toBeCloseTo(8_400 - 7_760, 6)
    expect(byYear(2027)).toBeCloseTo(8_400, 6)
    expect(byYear(2028)).toBeCloseTo(8_750, 6)
    expect(byYear(2029)).toBeCloseTo(9_000, 6)
  })

  it('credits months withheld while the widow(er) benefit was paid, from the survivor FRA month (9,035.78 in 2029, 8,622.88 in 2027)', () => {
    // A 900 ex PIA: the widow(er) benefit, 900 x 0.798415 = 718.57, is paid, and
    // 2026 withholds 7,760 of its 8,622.88: 11 deduction months, each a widow(er)
    // crediting month. The adjustment takes effect in the survivor FRA month,
    // April 2028, not in January of the year she reaches 66: 2027 still pays
    // 718.57 a month, and from April 2028 755 months, 900 x 0.836646 = 752.98.
    const byYear = formerSurvivor(900)
    expect(byYear(2027)).toBeCloseTo(900 * (1 - (0.285 * 58) / 82) * 12, 6)
    expect(byYear(2028)).toBeCloseTo(900 * (1 - (0.285 * 58) / 82) * 3 + 900 * (1 - (0.285 * 47) / 82) * 9, 6)
    expect(byYear(2029)).toBeCloseTo(900 * (1 - (0.285 * 47) / 82) * 12, 6)
    expect(byYear(2029)).toBeCloseTo(9_035.78, 2)
  })
})

// A widow(er) entitled to her own old-age benefit and a larger widow(er)
// benefit is paid the own benefit plus the excess (402(k)(3)(A)); the ledger
// pays the larger of the two, the same amount. The earnings test deducts
// "from any payment or payments under this subchapter to which an individual
// is entitled" (42 U.S.C. 403(b)(1)), so a month withheld while the widow(er)
// benefit was paid is a month in which her old-age benefit "was subject to
// deductions" too (402(q)(7)(A); 20 CFR 404.412(a)(1)), and it is credited to
// the own reduction.
//
// She is born 1965-01-15 (FRA 67, survivor FRA 67, both 804 months, reached in
// January 2032), has a 2,000 PIA and claims at 62y0m, in January 2027 (own
// 1,400), so every month from then is in both reduction periods. He is born 1963-02-10,
// has a 2,400 PIA, claimed at 62 (paid 1,680, so the widow's limit applies)
// and has a life age of 63, so he dies in 2026. From 2027 her widow(er)
// benefit, reduced at 744 months, is 2,400 x 0.796429 = 1,911.43, under the
// max(1,680, 1,980) limit and above her own 1,400, so it is paid. She earns
// $80,000 from 2026 through 2031, which withholds all of each year's
// 22,937.14 from 2027: 60 months, all of them widow(er) months. From January
// 2032, her FRA month, the own reduction is credited with the 60 months (804,
// factor 1, 2,000) and the widow(er) reduction too (804, 2,400, held to the
// 1,980 limit); the own benefit is larger and is paid: 24,000. Leaving the
// widow(er) months off the own reduction keeps it at 1,400 and pays the 1,980
// limit: 23,760.
describeRule('usc-42-402-q-6-A-iii-widow-reduction-from-entitlement-month', {
  note: 'months withheld from a paid widow(er) benefit credit the own old-age reduction too',
  readings: {
    everyWithheldMonthCreditsTheOldAgeBenefit: { withheld2027: 22_937.14, paid2032: 24_000 },
    onlyMonthsTheOwnBenefitWasPaidCreditIt: { withheld2027: 22_937.14, paid2032: 23_760 },
  },
  accepted: 'everyWithheldMonthCreditsTheOldAgeBenefit',
}, ({ accepted, readings }) => {
  it('credits months withheld while the widow(er) benefit was paid to the own reduction (24,000 in 2032, not 23,760)', () => {
    const plan = basePlan()
    plan.household.filingStatus = 'marriedFilingJointly'
    plan.household.people = [
      person('W', '1965-01-15'),
      { ...person('H', '1963-02-10'), longevity: { planningAge: 63, source: 'manual' } },
    ]
    plan.incomes = [
      ss('W', 2_000, { years: 62, months: 0 }),
      ss('H', 2_400, { years: 62, months: 0 }),
      wages('W', 80_000, 67),
    ]
    plan.accounts = [cash(5_000_000)]
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })
    const row = (year: number) => result.years.find((y) => y.year === year)!
    const produced = {
      withheld2027: Math.round(row(2027).ssEarningsTestWithheld * 100) / 100,
      paid2032: Math.round(row(2032).incomes.socialSecurity * 100) / 100,
    }
    expect(row(2027).incomes.socialSecurity).toBeCloseTo(0, 6)
    expect(produced).toEqual(accepted)
    expect(produced).not.toEqual(readings.onlyMonthsTheOwnBenefitWasPaidCreditIt)
  })
})

// 402(q)(7)(A) adjusts a benefit's reduction for the months in which "such
// benefit" was withheld, so each widow(er) or spouse benefit keeps the count of
// its own record (annualSocialSecurity.ts#auxiliaryBenefitSourceKey).
//
// The widow of the case above, with a 1,000 PIA (own 700 from 2027), also has
// a former spouse who died after claiming at his full retirement age, with a
// 2,200 PIA: that widow(er) benefit, reduced at her 744-month claim, is
// 2,200 x 0.796429 = 1,752.14. Her current husband's, 1,911.43, is larger, so
// it is the one paid and withheld: 60 months through 2031, all on his record.
// In 2032 his widow(er) benefit is credited to 804 months (2,400, held to the
// 1,980 limit); the former spouse's keeps its 744 months (1,752.14), and she is
// paid 1,980: 23,760. Crediting the 60 months to the former spouse's benefit
// too would take it to 2,200: 26,400.
describeRule('usc-42-402-q-6-A-iii-widow-reduction-from-entitlement-month', {
  note: 'months withheld from one widow(er) benefit do not credit a widow(er) benefit on another record',
  readings: {
    eachRecordItsOwnMonths: 23_760,
    everyWidowMonthOnEveryRecord: 26_400,
  },
  accepted: 'eachRecordItsOwnMonths',
}, ({ accepted, readings }) => {
  it('keeps the months withheld from one widow(er) benefit off another record\'s reduction (23,760 in 2032, not 26,400)', () => {
    const plan = basePlan()
    plan.household.filingStatus = 'marriedFilingJointly'
    plan.household.people = [
      person('W', '1965-01-15'),
      { ...person('H', '1963-02-10'), longevity: { planningAge: 63, source: 'manual' } },
    ]
    plan.incomes = [
      ss('W', 1_000, { years: 62, months: 0 }, [
        { id: 'X', relationship: 'deceased', dob: '1955-03-10', piaMonthly: 2_200, marriageYears: 20, remarriedAtAge: null },
      ]),
      ss('H', 2_400, { years: 62, months: 0 }),
      wages('W', 80_000, 67),
    ]
    const byYear = socialSecurityByYear(plan)
    expect(byYear(2027)).toBeCloseTo(0, 6)
    const produced = Math.round(byYear(2032) * 100) / 100
    expect(produced).toBe(accepted)
    expect(produced).not.toBe(readings.everyWidowMonthOnEveryRecord)
  })
})
