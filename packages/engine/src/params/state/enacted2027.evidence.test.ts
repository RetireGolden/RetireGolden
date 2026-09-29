import { expect, it } from 'vitest'

import { describeCalculation, withinTolerance } from '../../rules/describeCalculation.js'
import { createStateTaxCalculator, computeStateTaxYearTotal } from '../../tax/stateTax.js'
import type { TaxYearInput } from '../../projection/types.js'
import { cashAccount, couplePlan, recurringOrdinaryIncome, runPlan } from '../../testing/planFixtures.js'
import { stateEnactedYearFor } from './index.js'

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

/** A worksheet household: joint, both 61, all ordinary income, unless the row says otherwise. */
interface Household {
  year: number
  income: number
  single?: boolean
  ages?: number[]
  retirementIncome?: number
}

describeCalculation(
  'state-enacted-tax-year-figures',
  {
    example: {
      inputs: {
        // The state standard deduction plus the state taxable income, joint,
        // both 61: 100,000 of taxable income in the first five states and
        // Hawaii, Virginia and Maine (Montana 150,000); 3,000,000 in New York,
        // 2,000,000 in Rhode Island and 1,000,000 in California so the top
        // bands show; Georgia a couple both 70 with 200,000 of retirement
        // income; Washington a single filer with 1,500,000.
        households: {
          IN: { year: 2027, income: 100_000 },
          MS: { year: 2027, income: 104_600 },
          NE: { year: 2027, income: 117_700 },
          NC: { year: 2027, income: 125_500 },
          MT: { year: 2027, income: 182_200 },
          'MS 2028': { year: 2028, income: 104_600 },
          'MS 2029': { year: 2029, income: 104_600 },
          'MS 2030': { year: 2030, income: 104_600 },
          'NC 2030': { year: 2030, income: 125_500 },
          'NC 2033': { year: 2033, income: 125_500 },
          HI: { year: 2027, income: 116_000 },
          'HI 2029': { year: 2029, income: 116_000 },
          'HI 2031': { year: 2031, income: 116_000 },
          NY: { year: 2027, income: 3_016_050 },
          'NY 2033': { year: 2033, income: 3_016_050 },
          RI: { year: 2027, income: 2_022_400 },
          'RI 2029': { year: 2029, income: 2_022_400 },
          VA: { year: 2027, income: 118_400 },
          'VA 2030': { year: 2030, income: 118_400 },
          ME: { year: 2027, income: 132_200 },
          GA: { year: 2027, income: 200_000, ages: [70, 70], retirementIncome: 200_000 },
          'CA 2030': { year: 2030, income: 1_011_412 },
          'CA 2031': { year: 2031, income: 1_011_412 },
          'WA 2028': { year: 2028, income: 1_500_000, single: true, ages: [61] },
        } satisfies Record<string, Household>,
        inflationPct: 0,
      },
      expected: {
        IN: 2_900,
        MS: 3_375,
        NE: 3_665.631,
        NC: 3_490,
        MT: 7_190,
        'MS 2028': 3_150,
        'MS 2029': 2_925,
        'MS 2030': 2_700,
        'NC 2030': 3_240,
        'NC 2033': 2_990,
        HI: 4_579,
        'HI 2029': 3_650,
        'HI 2031': 3_258,
        NY: 224_615.725,
        'NY 2033': 217_605.13,
        RI: 126_667.52,
        'RI 2029': 146_667.52,
        VA: 5_385.55,
        'VA 2030': 6_098.55,
        ME: 6_228.925,
        GA: 1_497,
        'CA 2030': 89_532.276,
        'CA 2031': 85_877.276,
        'WA 2028': 49_500,
      },
      tolerance: { abs: 0.005 },
    },
    worksheet: 'DOCS/calculations/taxes/state-enacted-tax-year-figures.md',
    mutation: 'DOCS/calculations/taxes/state-enacted-tax-year-figures.mutation.md',
  },
  ({ example }) => {
    const inputs = example.inputs as { households: Record<string, Household>; inflationPct: number }
    const expected = example.expected as Record<string, number>
    const stateOf = (key: string): string => key.split(' ')[0]!
    const input = (key: string): TaxYearInput => {
      const household = inputs.households[key]!
      const ages = household.ages ?? (household.single ? [61] : [61, 61])
      return {
        year: household.year,
        filingStatus: household.single ? 'single' : 'marriedFilingJointly',
        ordinaryIncome: household.income,
        capitalGains: 0,
        ssBenefits: 0,
        peopleAged65Plus: ages.filter((age) => age >= 65).length,
        ...(household.retirementIncome === undefined ? {} : { privateRetirementIncome: household.retirementIncome }),
        state: stateOf(key),
        agesAlive: ages,
      }
    }

    it('reads each household from the enacted year the worksheet names, and South Carolina from 2026', () => {
      for (const key of Object.keys(expected)) {
        const household = inputs.households[key]!
        expect(stateEnactedYearFor(stateOf(key), household.year), key).toBe(household.year)
      }
      expect(stateEnactedYearFor('SC', 2027)).toBeNull()
    })

    it('prices each worksheet household through the annual state resolver', () => {
      for (const key of Object.keys(expected)) {
        expectWithin(computeStateTaxYearTotal(input(key)), expected[key]!, example.tolerance, `${key} state tax`)
      }
    })

    it('publishes the same 2027 state tax through the ledger', () => {
      // A state-only calculator, so the year's tax is the state tax alone. The
      // 2027 joint households with ordinary income only.
      const stateOnly = createStateTaxCalculator()
      for (const key of ['IN', 'MS', 'NE', 'NC', 'MT', 'HI', 'NY', 'RI', 'VA', 'ME']) {
        const household = inputs.households[key]!
        const plan = couplePlan({ p1Dob: '1966-01-01', p2Dob: '1966-01-01', p1PlanningAge: 62, p2PlanningAge: 62, state: key })
        plan.assumptions.inflationPct = inputs.inflationPct
        plan.accounts = [cashAccount('cash', 100_000)]
        plan.incomes = [recurringOrdinaryIncome('ordinary', household.income, household.year)]
        plan.expenses.baseAnnual = 0
        const year = runPlan(plan, stateOnly, household.year).years[0]!
        expect(year.year).toBe(household.year)
        expectWithin(year.tax, expected[key]!, example.tolerance, `${key} published 2027 tax`)
      }
    })
  },
)
