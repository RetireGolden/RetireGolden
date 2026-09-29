import { expect, it } from 'vitest'

import { simulatePlan } from '../projection/simulate.js'
import { basePlan, cash, noTax, validate, wages } from '../projection/simulate.test-support.js'
import { describeCalculation, withinTolerance } from '../rules/describeCalculation.js'
import { hsaLimitsForYear } from './hsaLimitYears.js'

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

const hsa = (id: string, ownerPersonId: string) => ({
  id, name: id, type: 'hsa', ownerPersonId, balance: 0, annualReturnPct: 0, annualContribution: 50_000,
}) as never

/** The household's credited HSA contributions in `year`, one run from 2026. */
function contributions(opts: { year: number; inflationPct: number; family: boolean; dob: string }): number {
  const plan = basePlan()
  plan.assumptions.inflationPct = opts.inflationPct
  plan.household.people[0]! = { ...plan.household.people[0]!, dob: opts.dob, retirementAge: 70 }
  plan.incomes = [wages(100_000, 'p1')]
  plan.accounts = [cash(1_000_000), hsa('hsa-p1', 'p1')]
  if (opts.family) {
    plan.household.filingStatus = 'marriedFilingJointly'
    plan.household.people.push({
      id: 'p2', name: 'Sam', dob: opts.dob, sex: 'average',
      retirementAge: 70, longevity: { planningAge: 90, source: 'manual' },
    })
    plan.incomes.push(wages(100_000, 'p2'))
    plan.accounts.push(hsa('hsa-p2', 'p2'))
  }
  const row = simulatePlan(validate(plan), { startYear: 2026, horizonEndYear: opts.year, taxCalculator: noTax })
    .years.find((year) => year.year === opts.year)!
  return row.contributions
}

describeCalculation(
  'hsa-contribution-limit-years',
  {
    example: {
      inputs: {
        publishedYear: 2027,
        projectedYear: 2028,
        inflationRates: [2.5, 4],
        dobUnder55: '1986-06-15',
        dobCatchUp: '1972-06-15',
      },
      expected: {
        selfOnly2027: 4_500,
        family2027: 9_000,
        selfOnly2028: 4_612.5,
        family2028: 9_225,
        selfOnlyWithCatchUp2028: 5_612.5,
      },
      tolerance: { abs: 0.005 },
    },
    worksheet: 'DOCS/calculations/cash-flow-and-summary/hsa-contribution-limit-years.md',
    mutation: 'DOCS/calculations/cash-flow-and-summary/hsa-contribution-limit-years.mutation.md',
  },
  ({ example }) => {
    const inputs = example.inputs as { publishedYear: number; projectedYear: number; inflationRates: number[]; dobUnder55: string; dobCatchUp: string }
    const expected = example.expected as Record<string, number>

    it('publishes 2027 and stands 2028 in on 2027', () => {
      expect(hsaLimitsForYear(inputs.publishedYear)).toEqual({
        params: { year: 2027, source: 'Rev. Proc. 2026-24', selfOnly: 4_500, family: 9_000 },
        isStandIn: false,
      })
      expect(hsaLimitsForYear(inputs.projectedYear).params.year).toBe(2027)
      expect(hsaLimitsForYear(inputs.projectedYear).isStandIn).toBe(true)
    })

    it('credits the published 2027 limits through the ledger, whatever the plan inflation', () => {
      for (const inflationPct of inputs.inflationRates) {
        const selfOnly = contributions({ year: inputs.publishedYear, inflationPct, family: false, dob: inputs.dobUnder55 })
        const family = contributions({ year: inputs.publishedYear, inflationPct, family: true, dob: inputs.dobUnder55 })
        expectWithin(selfOnly, expected.selfOnly2027!, example.tolerance, `self-only 2027 at ${inflationPct}%`)
        expectWithin(family, expected.family2027!, example.tolerance, `family 2027 at ${inflationPct}%`)
      }
    })

    it('grows 2028 one year from the 2027 limits, and adds the catch-up unscaled', () => {
      const selfOnly = contributions({ year: inputs.projectedYear, inflationPct: 2.5, family: false, dob: inputs.dobUnder55 })
      const family = contributions({ year: inputs.projectedYear, inflationPct: 2.5, family: true, dob: inputs.dobUnder55 })
      const catchUp = contributions({ year: inputs.projectedYear, inflationPct: 2.5, family: false, dob: inputs.dobCatchUp })
      expectWithin(selfOnly, expected.selfOnly2028!, example.tolerance, 'self-only 2028')
      expectWithin(family, expected.family2028!, example.tolerance, 'family 2028')
      expectWithin(catchUp, expected.selfOnlyWithCatchUp2028!, example.tolerance, 'self-only 2028 with the catch-up')
    })
  },
)
