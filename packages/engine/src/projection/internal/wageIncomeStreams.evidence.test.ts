import { expect, it } from 'vitest'

import { parsePlan, type Plan } from '../../model/plan.js'
import { describeCalculation, withinTolerance } from '../../rules/describeCalculation.js'
import { createFederalTaxCalculator } from '../../tax/federalTax.js'
import { singlePersonPlan } from '../../testing/planFixtures.js'
import { simulatePlan } from '../simulate.js'
import type { YearResult } from '../types.js'

function validated(plan: Plan): Plan {
  const parsed = parsePlan(plan)
  if (!parsed.ok) throw new Error(parsed.issues.join('; '))
  return parsed.plan
}

describeCalculation(
  'income-wages-annual',
  {
    example: {
      inputs: {
        projectionStartYear: 2028,
        currentYear: 2030,
        annualGross: 80_000,
        realGrowthPct: 2,
        cumulativeInflationFactor: 1.08,
        ownerAgeAttained: 64,
        ownerAlive: true,
        streamStopAge: 65,
      },
      expected: { wages: 89_890.56, inflationOnlyWrongReading: 86_400, stoppedYearWages: 0 },
      tolerance: { abs: 0.005 },
    },
    worksheet: 'DOCS/calculations/cash-flow-and-summary/income-wages-annual.md',
    mutation: 'DOCS/calculations/cash-flow-and-summary/income-wages-annual.mutation.md',
  },
  ({ example }) => {
    const inputs = example.inputs as Record<string, number | boolean>
    const expected = example.expected as Record<string, number>
    const startYear = inputs.projectionStartYear as number
    const currentYear = inputs.currentYear as number

    /**
     * The smallest real plan whose 2030 row realizes the worksheet's wage
     * stream: one owner who turns 64 in 2030 against a stop age of 65, an
     * 80,000 gross growing 2% real, and no accounts, so nothing but the wage
     * row can move the year. The worksheet's 1.08 cumulative inflation factor
     * is supplied as a per-year inflation path — 8% in the first projection
     * year and 0 after it — because no single constant rate squares to
     * exactly 1.08.
     */
    function wagePlan(): Plan {
      const plan = singlePersonPlan({ dob: '1966-06-15', planningAge: 95 })
      plan.incomes = [
        {
          type: 'wages',
          id: 'w1',
          personId: 'p1',
          annualGross: inputs.annualGross as number,
          realGrowthPct: inputs.realGrowthPct as number,
          endAge: inputs.streamStopAge as number,
        },
      ]
      return plan
    }

    function rows(): YearResult[] {
      return simulatePlan(validated(wagePlan()), {
        startYear,
        horizonEndYear: currentYear + 1,
        taxCalculator: createFederalTaxCalculator(),
        market: { inflationPct: [8, 0, 0, 0] },
      }).years
    }

    it('pays 89890.56 at age 64, two real raises and the 1.08 inflation factor', () => {
      const years = rows()
      const year = years.find((row) => row.year === currentYear)
      if (year === undefined) throw new Error(`missing projection year ${currentYear}`)
      // The constructed year really is the worksheet's: the owner is alive at
      // the stated attained age, before the stream's stop age.
      const person = year.people[0]
      expect(person?.ageAttained).toBe(inputs.ownerAgeAttained)
      expect(person?.alive).toBe(inputs.ownerAlive)
      // ... and the inflation path really does give the worksheet's factor,
      // read back from the projection's own first-year wage row, which carries
      // no raise and no inflation.
      const firstYear = years.find((row) => row.year === startYear)
      if (firstYear === undefined) throw new Error(`missing projection year ${startYear}`)
      expect(
        withinTolerance(firstYear.incomes.wages, inputs.annualGross as number, example.tolerance),
        `start-year wages: actual ${firstYear.incomes.wages}, worksheet ${String(inputs.annualGross)}`,
      ).toBe(true)

      expect(
        withinTolerance(year.incomes.wages, expected.wages!, example.tolerance),
        `wages: actual ${year.incomes.wages}, worksheet ${expected.wages}`,
      ).toBe(true)
      // The worksheet's first wrong reading: inflation without the real raise.
      expect(
        withinTolerance(year.incomes.wages, expected.inflationOnlyWrongReading!, example.tolerance),
      ).toBe(false)
    })

    it('stops at the stop age rather than at the year after it', () => {
      // The worksheet's second wrong reading treats age 64 as already stopped.
      // The row that really stops is the next one, at attained age 65.
      const year = rows().find((row) => row.year === currentYear + 1)
      if (year === undefined) throw new Error(`missing projection year ${currentYear + 1}`)
      expect(year.people[0]?.ageAttained).toBe((inputs.streamStopAge as number))
      expect(
        withinTolerance(year.incomes.wages, expected.stoppedYearWages!, example.tolerance),
        `stopped-year wages: actual ${year.incomes.wages}, worksheet ${expected.stoppedYearWages}`,
      ).toBe(true)
    })
  },
)
