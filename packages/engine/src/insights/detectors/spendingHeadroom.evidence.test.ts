import { expect, it } from 'vitest'
import { describeCalculation, withinTolerance } from '../../rules/describeCalculation.js'
import { singlePersonPlan } from '../../testing/planFixtures.js'
import type { DetectorContext } from '../types.js'
import { spendingHeadroom } from './spendingHeadroom.js'

/**
 * Constructed DetectorContext: a nondepleting plan, start year 2026, end year
 * 2035 (the worksheet's ten inclusive rows 2026 through 2035), nominal ending
 * after-tax estate $1,200,000, deflator 3/4, bequest target $500,000. No
 * simulation is run; summary.endingAfterTaxEstate and deflate are the
 * worksheet's stated inputs.
 */
function context(): DetectorContext {
  const plan = singlePersonPlan({ dob: '1961-01-01' })
  plan.expenses.bequestTargetDollars = 500_000
  return {
    plan,
    params: { year: 2026 },
    projection: {
      startYear: 2026,
      result: { endYear: 2035, years: [] },
      summary: { depletionYear: null, endingAfterTaxEstate: 1_200_000 },
      deflate: (year: number, amount: number) => (year === 2035 ? amount * (3 / 4) : amount),
    },
  } as unknown as DetectorContext
}

function evidenceUsd(card: NonNullable<ReturnType<typeof spendingHeadroom.screen>>, label: string): number {
  const row = card.evidence.find((entry) => entry.label === label)
  if (row === undefined) throw new Error(`missing evidence "${label}"`)
  return Number(row.value.replace(/[$,/yr]/gu, ''))
}

describeCalculation(
  'insight-spending-headroom-rough-annual',
  {
    example: {
      inputs: {
        nominalEndingAfterTaxEstate: 1_200_000,
        deflationFactor: 0.75,
        bequestTarget: 500_000,
        remainingProjectionRows: 10,
        startYear: 2026,
        endYear: 2035,
      },
      // The card publishes whole dollars: the worksheet states the quotient 44,444.44 and the shown figure $44,444.
      expected: { endingEstateToday: 900_000, roughAnnualHeadroom: 44_444 },
      tolerance: { abs: 1e-9 },
    },
    worksheet: 'DOCS/calculations/insights/insight-spending-headroom-rough-annual.md',
    mutation: 'DOCS/calculations/insights/insight-spending-headroom-rough-annual.mutation.md',
  },
  ({ example }) => {
    it('deflates $1,200,000 by 3/4 to $900,000 and spreads the $400,000 excess over the 9 year boundaries of 2026-2035', () => {
      const card = spendingHeadroom.screen(context())
      expect(card).not.toBeNull()
      const endingToday = evidenceUsd(card!, "Ending after-tax estate (today's $)")
      const headroom = evidenceUsd(card!, "Rough annual spending headroom (today's $)")
      const expectedEstate = example.expected.endingEstateToday as number
      const expectedHeadroom = example.expected.roughAnnualHeadroom as number
      expect(
        withinTolerance(endingToday, expectedEstate, example.tolerance),
        `endingEstateToday ${endingToday} is not within ${JSON.stringify(example.tolerance)} of the worksheet's ${expectedEstate}`,
      ).toBe(true)
      expect(
        withinTolerance(headroom, expectedHeadroom, example.tolerance),
        `roughAnnualHeadroom ${headroom} is not within ${JSON.stringify(example.tolerance)} of the worksheet's ${expectedHeadroom}`,
      ).toBe(true)
    })
  },
)
