import { expect, it } from 'vitest'

import { parsePlan, type Plan } from '../../model/plan.js'
import { describeCalculation, withinTolerance } from '../../rules/describeCalculation.js'
import {
  createGoalScheduler,
  type GoalScheduler,
  type SchedulableGoal,
} from '../../spending/flexibleGoals.js'
import { createFederalTaxCalculator } from '../../tax/federalTax.js'
import { singlePersonPlan } from '../../testing/planFixtures.js'
import { simulatePlan } from '../simulate.js'
import { annualOneTimeGoalFundingPhase } from './annualOneTimeGoalFundingPhase.js'

const YEAR = 2030

describeCalculation(
  'flexible-goal-outcomes-annual',
  {
    example: {
      inputs: {
        planningYear: YEAR,
        cumulativeInflationFactor: 1.1,
        cutting: true,
        canPullForward: false,
        flexibleGoalBudget: 1_700,
        goals: [
          { order: 1, classification: 'required', priority: 1, flexibility: 'fixed', targetYear: YEAR, latestYear: YEAR, amountTodayDollars: 1_000, minFundingPct: 100, allowPartialFunding: false },
          { order: 2, classification: 'target', priority: 1, flexibility: 'movable', targetYear: YEAR, latestYear: 2031, amountTodayDollars: 1_000, minFundingPct: 100, allowPartialFunding: false },
          { order: 3, classification: 'ideal', priority: 1, flexibility: 'movable', targetYear: YEAR, latestYear: 2031, amountTodayDollars: 1_000, minFundingPct: 50, allowPartialFunding: true },
          { order: 4, classification: 'excess', priority: 1, flexibility: 'movable', targetYear: YEAR, latestYear: 2031, amountTodayDollars: 500, minFundingPct: 100, allowPartialFunding: false },
          { order: 5, classification: 'excess', priority: 2, flexibility: 'skippable', targetYear: YEAR, latestYear: YEAR, amountTodayDollars: 400, minFundingPct: 0, allowPartialFunding: false },
        ],
      },
      expected: {
        funded: 2,
        partiallyFunded: 1,
        deferred: 1,
        skipped: 1,
        fundedAmount: 2_800,
        unfundedAmount: 940,
        outsideGuardrailMode: { funded: 0, partiallyFunded: 0, deferred: 0, skipped: 0, fundedAmount: 0, unfundedAmount: 0 },
      },
      tolerance: { abs: 0.005 },
    },
    worksheet: 'DOCS/calculations/cash-flow-and-summary/flexible-goal-outcomes-annual.md',
    mutation: 'DOCS/calculations/cash-flow-and-summary/flexible-goal-outcomes-annual.mutation.md',
  },
  ({ example }) => {
    const inputs = example.inputs as Record<string, unknown>
    const expected = example.expected as Record<string, unknown>
    const budget = inputs.flexibleGoalBudget as number
    const inflFactor = inputs.cumulativeInflationFactor as number
    const rows = inputs.goals as {
      order: number
      classification: SchedulableGoal['classification']
      priority: number
      flexibility: SchedulableGoal['flexibility']
      targetYear: number
      latestYear: number
      amountTodayDollars: number
      minFundingPct: number
      allowPartialFunding: boolean
    }[]

    it('publishes 2 funded, 1 partial, 1 deferred, 1 skipped, 2800 funded and 940 unfunded', () => {
      const scheduler = createGoalScheduler(
        rows.map((row) => ({
          id: `goal-${row.order}`,
          classification: row.classification,
          flexibility: row.flexibility,
          earliestYear: row.targetYear,
          targetYear: row.targetYear,
          latestYear: row.latestYear,
          priority: row.priority,
          order: row.order,
          amountTodayDollars: row.amountTodayDollars,
          minFundingPct: row.minFundingPct,
          allowPartialFunding: row.allowPartialFunding,
        })),
      )
      /**
       * annualOneTimeGoalFundingPhase passes availableBudget 0 whenever the
       * guardrail is cutting, and passes the remaining upside budget only when
       * it is NOT cutting — where the scheduler then reads the budget as
       * unlimited. The worksheet's cutting year with a positive $1,700 budget
       * is therefore not a state the phase produces, so the budget is injected
       * at the scheduler seam. Both the scheduler and the aggregator below are
       * production; the substituted budget is the only thing that is not a
       * plan-produced state.
       */
      const seam: GoalScheduler = {
        isResolved: (id) => scheduler.isResolved(id),
        planYear: (year, ctx) => scheduler.planYear(year, { ...ctx, availableBudget: budget }),
      }

      const phase = annualOneTimeGoalFundingPhase({
        year: inputs.planningYear as number,
        inflFactor,
        anyAlive: true,
        goalScheduler: seam,
        oneTimeGoals: [],
        cutting: inputs.cutting as boolean,
        canPullForwardGoals: inputs.canPullForward as boolean,
        remainingUpsideBudget: 0,
      })
      const counts = phase.goalOutcomeCounts

      expect(counts.funded).toBe(expected.funded)
      expect(counts.partiallyFunded).toBe(expected.partiallyFunded)
      expect(counts.deferred).toBe(expected.deferred)
      expect(counts.skipped).toBe(expected.skipped)
      expect(
        withinTolerance(counts.fundedAmount, expected.fundedAmount as number, example.tolerance),
        `fundedAmount: actual ${counts.fundedAmount}, worksheet ${String(expected.fundedAmount)}`,
      ).toBe(true)
      expect(
        withinTolerance(counts.unfundedAmount, expected.unfundedAmount as number, example.tolerance),
        `unfundedAmount: actual ${counts.unfundedAmount}, worksheet ${String(expected.unfundedAmount)}`,
      ).toBe(true)

      // The fixed goal funded without consuming the flexible budget: the
      // worksheet's first wrong reading would have left the target goal
      // deferred and the counts at 1/1/2/1.
      expect(
        withinTolerance(phase.requiredGoalsFunded, rows[0]!.amountTodayDollars * inflFactor, example.tolerance),
        `requiredGoalsFunded: actual ${phase.requiredGoalsFunded}`,
      ).toBe(true)
      expect(
        withinTolerance(phase.targetGoalsFunded, rows[1]!.amountTodayDollars * inflFactor, example.tolerance),
        `targetGoalsFunded: actual ${phase.targetGoalsFunded}`,
      ).toBe(true)
      // The terminal skip stays in its own layer as intended spending: the
      // worksheet's third wrong reading drops it and reports 500 unfunded.
      expect(
        withinTolerance(phase.skippedExcessNominal, rows[4]!.amountTodayDollars * inflFactor, example.tolerance),
        `skippedExcessNominal: actual ${phase.skippedExcessNominal}`,
      ).toBe(true)
      expect(withinTolerance(counts.unfundedAmount, 500, example.tolerance)).toBe(false)
    })

    it('publishes six exact zeros outside guardrail mode while the goal still funds', () => {
      const zeros = expected.outsideGuardrailMode as Record<string, number>
      const plan: Plan = singlePersonPlan({ dob: '1975-06-15', planningAge: 95 })
      plan.accounts = [
        { type: 'cash', id: 'cash', name: 'Cash', ownerPersonId: null, annualReturnPct: 0, balance: 200_000, annualContribution: 0 },
      ]
      // No spendingPolicy, so simulatePlan builds no scheduler at all.
      plan.expenses.oneTimeGoals = [
        { id: 'goal', label: 'Roof', year: YEAR, amount: 5_000, classification: 'target', flexibility: 'movable', latestYear: 2031 },
      ]
      const parsed = parsePlan(plan)
      if (!parsed.ok) throw new Error(parsed.issues.join('; '))
      const result = simulatePlan(parsed.plan, {
        startYear: YEAR,
        horizonEndYear: YEAR,
        taxCalculator: createFederalTaxCalculator(),
      })
      const row = result.years.find((entry) => entry.year === YEAR)
      if (row === undefined) throw new Error(`missing projection year ${YEAR}`)

      expect(row.flexibleGoals.funded).toBe(zeros.funded)
      expect(row.flexibleGoals.partiallyFunded).toBe(zeros.partiallyFunded)
      expect(row.flexibleGoals.deferred).toBe(zeros.deferred)
      expect(row.flexibleGoals.skipped).toBe(zeros.skipped)
      expect(row.flexibleGoals.fundedAmount).toBe(zeros.fundedAmount)
      expect(row.flexibleGoals.unfundedAmount).toBe(zeros.unfundedAmount)
      // ... and the goal really did fund in its target year.
      expect(
        withinTolerance(row.expenses.oneTimeGoals, 5_000, example.tolerance),
        `oneTimeGoals: actual ${row.expenses.oneTimeGoals}`,
      ).toBe(true)
    })
  },
)
