import { expect, it } from 'vitest'

import { describeCalculation, withinTolerance } from '../../rules/describeCalculation.js'
import type { IncomeStream, Plan } from '../../model/plan.js'
import {
  cashAccount,
  couplePlan,
  productionTaxCalculator,
  singlePersonPlan,
  socialSecurityIncome,
  validatePlan,
} from '../../testing/planFixtures.js'
import { simulatePlan } from '../simulate.js'
import type { YearResult } from '../types.js'

function run(plan: Plan, startYear: number, horizonEndYear: number): YearResult[] {
  return simulatePlan(validatePlan(plan), {
    startYear,
    horizonEndYear,
    taxCalculator: productionTaxCalculator(),
  }).years
}

/** The helper claims at whole years only; the worksheet's claim age has months. */
function claimingAt(stream: IncomeStream, years: number, months: number): IncomeStream {
  if (stream.type !== 'socialSecurity') throw new Error('expected a Social Security stream')
  return { ...stream, claimAge: { years, months } }
}

describeCalculation(
  'social-security-benefit-annual',
  {
    example: {
      inputs: {
        ownBenefitBirthYear: 1960,
        ownBenefitFraYearsAndMonths: [67, 0],
        ownBenefitClaimAgeYearsAndMonths: [64, 3],
        ownBenefitMonthsBeforeFra: 33,
        ownBenefitMonthlyPia: 2_000,
        ownClaimFactor: 49 / 60,
        claimYearPayableMonths: 9,
        claimYearColaAndHaircutFactors: [1, 0.95],
        laterYearPayableMonths: 12,
        laterYearColaAndHaircutFactors: [1.06, 0.95],
        spouseCaseHigherAndLowerPia: [2_000, 300],
        spouseCaseClaimAndSpousalFactors: [1, 1],
        familyMaximumBinding: false,
        earningsTestGrossBenefit: 24_000,
        earningsTestWages: 34_480,
        earningsTestBelowFraAnnual: 24_480,
        earningsTestFraYearAnnual: 65_160,
        earningsTestMonthlyPia: 2_500,
        earningsTestClaimFactor: 0.8,
      },
      expected: {
        ownClaimYear: 13_965,
        laterYear: 19_737.2,
        twoPersonCase: 36_000,
        belowFraPaid: 19_000,
        belowFraWithheld: 5_000,
        incompatibleFactorAndMonthsWrongReading: 13_680,
        excessOnlySpousalWrongReading: 32_400,
        divideByThreeWithheldWrongReading: 3_333.33,
      },
      tolerance: { abs: 0.005 },
    },
    worksheet: 'DOCS/calculations/social-security/social-security-benefit-annual.md',
    mutation: 'DOCS/calculations/social-security/social-security-benefit-annual.mutation.md',
  },
  ({ example }) => {
    const inputs = example.inputs as Record<string, number | number[] | boolean>
    const expected = example.expected as Record<string, number>

    function expectWithin(actual: number, target: number, label: string): void {
      expect(
        withinTolerance(actual, target, example.tolerance),
        `${label} ${actual} is not within ${JSON.stringify(example.tolerance)} of ${target}`,
      ).toBe(true)
    }

    /**
     * The worksheet's own-benefit person, on one plan: born 1960 (FRA 67y0m)
     * and claiming at 64y3m, which is 33 months early, so the claim factor is
     * 1 - 33 x (5/9 of 1%) = 49/60 and the claim year pays 12 - 3 = 9 months.
     * The claim year is 2024 — the year that birth attains 64 — and it is the
     * projection's FIRST year, where the COLA factor is exactly 1; the fixed
     * 6%/year ssCola makes 2025 exactly 1.06, and ssHaircut cuts 5% from the
     * start year, so both years carry the 0.95 haircut factor.
     */
    function ownBenefitYears(): YearResult[] {
      const [claimYears, claimMonths] = inputs.ownBenefitClaimAgeYearsAndMonths as number[]
      const [laterCola, haircut] = inputs.laterYearColaAndHaircutFactors as number[]
      const plan = singlePersonPlan({ dob: '1960-06-15', planningAge: 95 })
      plan.accounts = [cashAccount('cash', 50_000)]
      plan.incomes = [
        claimingAt(
          socialSecurityIncome('ss', inputs.ownBenefitMonthlyPia as number, claimYears!),
          claimYears!,
          claimMonths!,
        ),
      ]
      plan.assumptions.ssCola = { mode: 'fixed', annualPct: (laterCola! - 1) * 100 }
      plan.assumptions.ssHaircut = { fromYear: 2024, cutPct: (1 - haircut!) * 100 }
      return run(plan, 2024, 2025)
    }

    it('pays 13965 in the claim year: nine payable months at the 49/60 factor of a 64y3m claim', () => {
      const [claimCola, haircut] = inputs.claimYearColaAndHaircutFactors as number[]
      const claimYear = ownBenefitYears()[0]!.incomes.socialSecurity

      expectWithin(claimYear, expected.ownClaimYear!, '2024 socialSecurity')
      // ... and it is the product of the worksheet's own stated factors.
      expectWithin(
        claimYear,
        (inputs.ownBenefitMonthlyPia as number) *
          (inputs.ownClaimFactor as number) *
          (inputs.claimYearPayableMonths as number) *
          claimCola! *
          haircut!,
        '2024 socialSecurity against its own factors',
      )
      // The worksheet's first wrong reading: the old 0.8 factor beside these
      // nine payable months. 0.8 is exactly 36 months early, whose claim-age
      // month is 0 and which therefore pays 12 months in the claim year; nine
      // payable months come from the 64y3m claim and its 49/60 factor. No
      // claim age produces both, so the pair names no year of any plan.
      expect(
        withinTolerance(claimYear, expected.incompatibleFactorAndMonthsWrongReading!, example.tolerance),
      ).toBe(false)
    })

    it('pays 19737.20 in the year after the claim, at 12 months of the same factor with COLA and haircut', () => {
      const [laterCola, haircut] = inputs.laterYearColaAndHaircutFactors as number[]
      const laterYear = ownBenefitYears()[1]!.incomes.socialSecurity

      expectWithin(laterYear, expected.laterYear!, '2025 socialSecurity')
      // ... and it is that product of its own stated factors.
      expectWithin(
        laterYear,
        (inputs.ownBenefitMonthlyPia as number) *
          (inputs.ownClaimFactor as number) *
          (inputs.laterYearPayableMonths as number) *
          laterCola! *
          haircut!,
        '2025 socialSecurity against its own factors',
      )
    })

    it('replaces the lower earner\'s own benefit with own plus the capped excess, paying 36000', () => {
      // Both born 1960 (FRA 67) and claiming at 67, in the projection's first
      // year: payable months 12, COLA factor 1, no haircut, family maximum
      // non-binding on a $700 excess against a $2,000 PIA.
      //
      // The auxiliary excess is max(0, 0.5 x $2,000 x 1 - $300) = $700/month,
      // and the current-spouse candidate that replaces the lower earner's
      // running amount is own monthly PLUS that capped excess:
      // $300 + $700 = $1,000/month, so the household is
      // ($2,000 + $1,000) x 12 = $36,000.
      const [higherPia, lowerPia] = inputs.spouseCaseHigherAndLowerPia as number[]
      const plan = couplePlan({ p1Dob: '1960-06-15', p2Dob: '1960-06-15', p1PlanningAge: 95, p2PlanningAge: 95 })
      plan.accounts = [cashAccount('cash', 50_000)]
      plan.incomes = [
        socialSecurityIncome('ss-high', higherPia!, 67, 'p1'),
        socialSecurityIncome('ss-low', lowerPia!, 67, 'p2'),
      ]
      const household = run(plan, 2027, 2027)[0]!.incomes.socialSecurity

      expectWithin(household, expected.twoPersonCase!, '2027 household socialSecurity')
      // ... and it is the higher earner's own benefit beside that candidate.
      expectWithin(
        household,
        (higherPia! + (lowerPia! + (0.5 * higherPia! - lowerPia!))) * 12,
        '2027 household socialSecurity against its own components',
      )
      // The worksheet's second wrong reading: the $700 excess taken as the
      // WHOLE spousal candidate, dropping the lower earner's own $300.
      expect(
        withinTolerance(household, expected.excessOnlySpousalWrongReading!, example.tolerance),
      ).toBe(false)
    })

    it('withholds half the excess wages below FRA, paying 19000 of a 24000 benefit', () => {
      // PIA 2,500 at a 0.8 factor over 12 months is a $24,000 gross benefit:
      // a 1962 birth has FRA 67, so claiming at 64y0m is exactly 36 months
      // early, the factor is exactly 0.8, and the claim-age month of 0 pays
      // all 12 months — the compatible pairing the first wrong reading above
      // breaks. The person is 64 in 2026, under FRA, and the 2026 pack's
      // below-FRA limit is unindexed at $24,480.
      const plan = singlePersonPlan({ dob: '1962-06-15', planningAge: 95 })
      plan.accounts = [cashAccount('cash', 50_000)]
      plan.incomes = [
        socialSecurityIncome('ss', inputs.earningsTestMonthlyPia as number, 64),
        {
          type: 'wages',
          id: 'w',
          personId: 'p1',
          annualGross: inputs.earningsTestWages as number,
          realGrowthPct: 0,
          endAge: null,
        },
      ]
      const years = run(plan, 2026, 2026)
      const row = years[0]!

      // The constructed row really does carry the worksheet's gross benefit
      // and wage figures.
      expectWithin(row.incomes.wages, inputs.earningsTestWages as number, 'wages')
      expectWithin(
        row.incomes.socialSecurity + row.ssEarningsTestWithheld,
        inputs.earningsTestGrossBenefit as number,
        'gross benefit before the earnings test',
      )
      expectWithin(row.ssEarningsTestWithheld, expected.belowFraWithheld!, 'ssEarningsTestWithheld')
      expectWithin(row.incomes.socialSecurity, expected.belowFraPaid!, 'paid socialSecurity')
      // The worksheet's third wrong reading: the FRA-year divide-by-three
      // applied below FRA.
      expect(
        withinTolerance(row.ssEarningsTestWithheld, expected.divideByThreeWithheldWrongReading!, { abs: 0.01 }),
      ).toBe(false)
    })
  },
)
