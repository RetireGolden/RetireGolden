import { expect, it } from 'vitest'

import { simulatePlan } from '../projection/simulate.js'
import { describeCalculation, withinTolerance } from '../rules/describeCalculation.js'
import { acaApplicablePct, acaEconomicPremiumByMonth, acaFederalPovertyLine, acaWholeFplPct } from '../tax/aca.js'
import { createFlatTaxCalculator } from '../testing/flatTax.js'
import {
  cashAccount,
  recurringOrdinaryIncome,
  setAcaYearContract,
  singlePersonPlan,
  validatePlan,
} from '../testing/planFixtures.js'
import { acaParametersForCoverageYear } from './acaCoverageYears.js'

function expectWithin(
  actual: number,
  expected: number,
  tolerance: Parameters<typeof withinTolerance>[2],
  label: string,
): void {
  expect(
    withinTolerance(actual, expected, tolerance),
    `${label} ${actual} is not within ${JSON.stringify(tolerance)} of the worksheet's ${expected}`,
  ).toBe(true)
}

describeCalculation(
  'aca-coverage-year-parameters',
  {
    example: {
      inputs: {
        coverageYear: 2027,
        householdSize: 1,
        householdMagi: 29_212.5,
        monthlyPremium: 1_055,
        inflationPct: 2.5,
        percentTolerance: 1e-9,
      },
      expected: {
        federalPovertyLine: 15_960,
        fplPct: 183.0357142857,
        applicablePct: 5.94,
        expectedContribution: 1_735.22,
        credit: 10_924.78,
        netPremium: 1_735.22,
        alaskaTwoPersonCliff: 108_200,
        hawaiiTwoPersonCliff: 99_560,
        contiguousOnePersonCliff: 63_840,
        contiguousFourPersonCliff: 132_000,
      },
      tolerance: { abs: 0.005 },
    },
    worksheet: 'DOCS/calculations/medicare-and-aca/aca-coverage-year-parameters.md',
    mutation: 'DOCS/calculations/medicare-and-aca/aca-coverage-year-parameters.mutation.md',
  },
  ({ example }) => {
    const inputs = example.inputs as Record<string, number>
    const expected = example.expected as Record<string, number>
    const byMonth = new Array<number>(12).fill(inputs.monthlyPremium!)

    it('resolves 2027 to its own published block and 2028 to a stand-in', () => {
      const y2027 = acaParametersForCoverageYear(inputs.coverageYear!)
      expect(y2027.isStandIn).toBe(false)
      expect(y2027.params.coverageYear).toBe(2027)
      expect(y2027.params.povertyGuidelineYear).toBe(2026)
      const y2028 = acaParametersForCoverageYear(2028)
      expect(y2028.isStandIn).toBe(true)
      expect(y2028.params.coverageYear).toBe(2027)
    })

    it('prices the worksheet household on the 2027 block at a poverty-line scale of 1', () => {
      const { params } = acaParametersForCoverageYear(inputs.coverageYear!)
      expect(acaFederalPovertyLine(params, inputs.householdSize!)).toBe(expected.federalPovertyLine)
      // Read at the whole-number percentage, 183, and rounded to a hundredth.
      expect(acaApplicablePct(params, acaWholeFplPct(expected.fplPct!))).toBe(expected.applicablePct)
      const quote = acaEconomicPremiumByMonth(params, inputs.householdSize!, inputs.householdMagi!, byMonth, byMonth)
      expectWithin(quote.fplPct, expected.fplPct!, { abs: inputs.percentTolerance! }, 'fplPct')
      expectWithin(quote.expectedContribution, expected.expectedContribution!, example.tolerance, 'expectedContribution')
      expectWithin(quote.modeledAllowablePtc, expected.credit!, example.tolerance, 'modeledAllowablePtc')
      expectWithin(quote.economicNetPremium, expected.netPremium!, example.tolerance, 'economicNetPremium')
    })

    it('publishes the same credit through the ledger, with the published line and the projected-income code', () => {
      // One 2027 Marketplace year for a single filer whose only income is
      // 29,212.50 of recurring ordinary income, funded from cash, with the
      // income tax priced at zero so federal AGI is exactly that income. Plan
      // inflation of 2.5% is what a scaled poverty line would pick up.
      const plan = singlePersonPlan({ dob: '1965-01-01', planningAge: 90 })
      plan.assumptions.inflationPct = inputs.inflationPct!
      plan.accounts = [cashAccount('cash', 200_000)]
      plan.incomes = [recurringOrdinaryIncome('consulting', inputs.householdMagi!, inputs.coverageYear!)]
      setAcaYearContract(plan, { year: inputs.coverageYear!, monthlyEnrollment: inputs.monthlyPremium! })
      const year = simulatePlan(validatePlan(plan), {
        startYear: inputs.coverageYear!,
        horizonEndYear: inputs.coverageYear!,
        taxCalculator: createFlatTaxCalculator(0),
      }).years[0]!
      const aca = year.aca!
      expect(aca.readiness).toBe('actionable')
      expect(aca.supportCodes).toEqual(['actionable', 'income-tax-parameters-projected'])
      expect(aca.householdMagi).toBe(inputs.householdMagi)
      expect(aca.federalPovertyLine).toBe(expected.federalPovertyLine)
      expectWithin(aca.fplPct!, expected.fplPct!, { abs: inputs.percentTolerance! }, 'published fplPct')
      expectWithin(aca.modeledAllowablePtc!, expected.credit!, example.tolerance, 'published modeledAllowablePtc')
      expectWithin(aca.economicNetPremium, expected.netPremium!, example.tolerance, 'published economicNetPremium')
    })

    it('reproduces the Alaska, Hawaii and contiguous cliffs from the 2027 guidelines', () => {
      const { params } = acaParametersForCoverageYear(inputs.coverageYear!)
      const cliff = (size: number, region: 'contiguous' | 'alaska' | 'hawaii') =>
        acaFederalPovertyLine(params, size, region) * (params.aca.maxFplPctForCredit / 100)
      expect(cliff(2, 'alaska')).toBe(expected.alaskaTwoPersonCliff)
      expect(cliff(2, 'hawaii')).toBe(expected.hawaiiTwoPersonCliff)
      expect(cliff(1, 'contiguous')).toBe(expected.contiguousOnePersonCliff)
      expect(cliff(4, 'contiguous')).toBe(expected.contiguousFourPersonCliff)
    })
  },
)
