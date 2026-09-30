import { expect, it } from 'vitest'
import { describeCalculation, withinTolerance } from '../rules/describeCalculation.js'
import { createEmptyPlan, parsePlan, type Account, type Plan } from '../model/plan.js'
import { summarizeProjection } from '../projection/compare.js'
import { simulatePlan } from '../projection/simulate.js'
import { createFlatTaxCalculator } from '../testing/flatTax.js'
import { compareScenarioPlans, type ScenarioPlanComparisonOptions } from './comparison.js'

/**
 * One side of RetireGolden-MCP's compare_scenarios as the worksheet states it:
 * a person born 1990-01-01 whose planning age ends the run (60 in 2050, 64 in
 * 2054, both before Medicare), no income, no spending, every return 0%, and a
 * cash account and a traditional IRA that therefore end where they start. The
 * heir tax is the plan's default 25% on the traditional balance.
 */
function sidePlan(scope: string, planningAge: number, cash: number, traditional: number): Plan {
  let counter = 0
  const plan = createEmptyPlan({
    newId: () => `${scope}-${++counter}`,
    now: () => new Date('2026-06-11T00:00:00.000Z'),
  })
  plan.name = scope
  plan.household.people[0] = {
    id: 'p1',
    name: 'Pat',
    dob: '1990-01-01',
    sex: 'average',
    retirementAge: 65,
    longevity: { planningAge, source: 'manual' },
  }
  plan.assumptions.inflationPct = 2.5
  plan.assumptions.healthcareExtraInflationPct = 0
  plan.assumptions.defaultReturnPct = 0
  plan.assumptions.stateEffectiveTaxPct = 0
  plan.expenses.baseAnnual = 0
  plan.accounts = [
    { type: 'cash', id: 'cash-1', name: 'Cash', ownerPersonId: null, annualReturnPct: 0, balance: cash, annualContribution: 0 },
    {
      type: 'traditional',
      kind: 'ira',
      id: 'ira-1',
      name: 'IRA',
      ownerPersonId: 'p1',
      annualReturnPct: 0,
      balance: traditional,
      annualContribution: 0,
    } as unknown as Account,
  ]
  const parsed = parsePlan(plan)
  if (!parsed.ok) throw new Error(parsed.issues.join('; '))
  return parsed.plan
}

const options = (): ScenarioPlanComparisonOptions => ({
  startYear: 2026,
  taxCalculatorForPlan: () => createFlatTaxCalculator(0),
})

describeCalculation(
  'mcp-compare-ending-after-tax-estate-delta',
  {
    example: {
      inputs: {
        baseline: { planningAge: 60, endYear: 2050, cash: 1_500_000, traditional: 400_000 },
        proposal: { planningAge: 64, endYear: 2054, cash: 1_400_000, traditional: 800_000 },
      },
      expected: {
        baselineEstate: 1_800_000,
        proposalEstate: 2_000_000,
        delta: 200_000,
        baselineMinusProposal: -200_000,
        netWorthDelta: 300_000,
        startYearDollarDelta: 6_579.93,
      },
      tolerance: { abs: 0.005 },
    },
    worksheet: 'DOCS/calculations/optimizer-and-comparisons/mcp-compare-ending-after-tax-estate-delta.md',
    mutation: 'DOCS/calculations/optimizer-and-comparisons/mcp-compare-ending-after-tax-estate-delta.mutation.md',
  },
  ({ example }) => {
    type Side = { planningAge: number; endYear: number; cash: number; traditional: number }
    const baseline = example.inputs.baseline as Side
    const proposal = example.inputs.proposal as Side
    const expected = example.expected as Record<string, number>
    const plans = () => ({
      a: sidePlan('baseline', baseline.planningAge, baseline.cash, baseline.traditional),
      b: sidePlan('proposal', proposal.planningAge, proposal.cash, proposal.traditional),
    })

    it('reports Plan B minus Plan A, 2,000,000 in 2054 less 1,800,000 in 2050 = +200,000 nominal', () => {
      const { a, b } = plans()
      const cell = compareScenarioPlans(a, b, options()).headline.endingAfterTaxEstate
      expect(
        withinTolerance(cell.baseline, expected.baselineEstate!, example.tolerance),
        `baseline estate: actual ${cell.baseline}, worksheet ${expected.baselineEstate}`,
      ).toBe(true)
      expect(
        withinTolerance(cell.proposal, expected.proposalEstate!, example.tolerance),
        `proposal estate: actual ${cell.proposal}, worksheet ${expected.proposalEstate}`,
      ).toBe(true)
      expect(
        withinTolerance(cell.delta, expected.delta!, example.tolerance),
        `delta: actual ${cell.delta}, worksheet ${expected.delta}`,
      ).toBe(true)
      // The worksheet's wrong readings: A minus B, the net-worth delta that
      // leaves out the heir tax, and the Compare page's start-year dollars.
      for (const reading of ['baselineMinusProposal', 'netWorthDelta', 'startYearDollarDelta']) {
        expect(
          withinTolerance(cell.delta, expected[reading]!, example.tolerance),
          `the delta must not read as ${reading} (${expected[reading]})`,
        ).toBe(false)
      }
    })

    it("equals the pinned adapter's subtraction of two independent summaries, each plan on its own calculator", () => {
      // RetireGolden-MCP 3197d359 src/adapter.ts#compareScenarios, the census's documented arithmetic.
      const { a, b } = plans()
      const summaryOf = (plan: Plan) =>
        summarizeProjection(plan, simulatePlan(plan, { startYear: 2026, taxCalculator: createFlatTaxCalculator(0) }), {
          conversionFreeRun: null,
        })
      const sa = summaryOf(a)
      const sb = summaryOf(b)
      const adapter = sb.endingAfterTaxEstate - sa.endingAfterTaxEstate
      expect(withinTolerance(adapter, expected.delta!, example.tolerance)).toBe(true)
      expect(compareScenarioPlans(a, b, options()).headline.endingAfterTaxEstate.delta).toBe(adapter)
      // The two plans really end in the worksheet's two different years.
      expect(compareScenarioPlans(a, b, options()).headline.projectionEndYear).toEqual({
        baseline: baseline.endYear,
        proposal: proposal.endYear,
        delta: proposal.endYear - baseline.endYear,
      })
    })
  },
)
