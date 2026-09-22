import { expect, it } from 'vitest'

import { parsePlan, type Plan } from '../../model/plan.js'
import { describeCalculation, withinTolerance } from '../../rules/describeCalculation.js'
import { createGoalScheduler, type SchedulableGoal } from '../../spending/flexibleGoals.js'
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
        // Case A: a pull-forward year; the phase hands the scheduler the
        // remaining upside budget. Case B: a cutting year; the budget is 0.
        pullForwardYear: { cutting: false, canPullForward: true, remainingUpsideBudget: 1_700 },
        cuttingYear: { cutting: true, canPullForward: false, remainingUpsideBudget: 0 },
        goals: [
          { order: 1, classification: 'required', priority: 1, flexibility: 'fixed', earliestYear: YEAR, targetYear: YEAR, latestYear: YEAR, amountTodayDollars: 1_000, minFundingPct: 100, allowPartialFunding: false },
          { order: 2, classification: 'target', priority: 1, flexibility: 'movable', earliestYear: YEAR, targetYear: 2031, latestYear: 2032, amountTodayDollars: 1_000, minFundingPct: 100, allowPartialFunding: false },
          { order: 3, classification: 'ideal', priority: 1, flexibility: 'movable', earliestYear: YEAR, targetYear: 2031, latestYear: 2032, amountTodayDollars: 1_000, minFundingPct: 50, allowPartialFunding: true },
          { order: 4, classification: 'excess', priority: 1, flexibility: 'movable', earliestYear: YEAR, targetYear: 2031, latestYear: 2032, amountTodayDollars: 500, minFundingPct: 100, allowPartialFunding: false },
          { order: 5, classification: 'excess', priority: 2, flexibility: 'skippable', earliestYear: YEAR, targetYear: YEAR, latestYear: YEAR, amountTodayDollars: 400, minFundingPct: 0, allowPartialFunding: false },
        ],
      },
      expected: {
        pullForwardYear: { funded: 3, partiallyFunded: 1, deferred: 1, skipped: 0, fundedAmount: 3_240, unfundedAmount: 500 },
        cuttingYear: { funded: 1, partiallyFunded: 0, deferred: 0, skipped: 1, fundedAmount: 1_100, unfundedAmount: 440 },
        outsideGuardrailMode: { funded: 0, partiallyFunded: 0, deferred: 0, skipped: 0, fundedAmount: 0, unfundedAmount: 0 },
      },
      tolerance: { abs: 0.005 },
    },
    worksheet: 'DOCS/calculations/cash-flow-and-summary/flexible-goal-outcomes-annual.md',
    mutation: 'DOCS/calculations/cash-flow-and-summary/flexible-goal-outcomes-annual.mutation.md',
  },
  ({ example }) => {
    const inputs = example.inputs as Record<string, unknown>
    const expected = example.expected as Record<string, Record<string, number>>
    const inflFactor = inputs.cumulativeInflationFactor as number
    const rows = inputs.goals as {
      order: number
      classification: SchedulableGoal['classification']
      priority: number
      flexibility: SchedulableGoal['flexibility']
      earliestYear: number
      targetYear: number
      latestYear: number
      amountTodayDollars: number
      minFundingPct: number
      allowPartialFunding: boolean
    }[]
    type YearCase = { cutting: boolean; canPullForward: boolean; remainingUpsideBudget: number }

    /** The real scheduler over the worksheet's goals, driven by the real phase for one year. */
    function runYear(yearCase: YearCase) {
      const scheduler = createGoalScheduler(
        rows.map((row) => ({
          id: `goal-${row.order}`,
          classification: row.classification,
          flexibility: row.flexibility,
          earliestYear: row.earliestYear,
          targetYear: row.targetYear,
          latestYear: row.latestYear,
          priority: row.priority,
          order: row.order,
          amountTodayDollars: row.amountTodayDollars,
          minFundingPct: row.minFundingPct,
          allowPartialFunding: row.allowPartialFunding,
        })),
      )
      return annualOneTimeGoalFundingPhase({
        year: inputs.planningYear as number,
        inflFactor,
        anyAlive: true,
        goalScheduler: scheduler,
        oneTimeGoals: [],
        cutting: yearCase.cutting,
        canPullForwardGoals: yearCase.canPullForward,
        remainingUpsideBudget: yearCase.remainingUpsideBudget,
      })
    }

    function expectCounts(counts: ReturnType<typeof runYear>['goalOutcomeCounts'], want: Record<string, number>, label: string): void {
      expect(counts.funded, `${label} funded`).toBe(want.funded)
      expect(counts.partiallyFunded, `${label} partiallyFunded`).toBe(want.partiallyFunded)
      expect(counts.deferred, `${label} deferred`).toBe(want.deferred)
      expect(counts.skipped, `${label} skipped`).toBe(want.skipped)
      expect(
        withinTolerance(counts.fundedAmount, want.fundedAmount!, example.tolerance),
        `${label} fundedAmount: actual ${counts.fundedAmount}, worksheet ${want.fundedAmount}`,
      ).toBe(true)
      expect(
        withinTolerance(counts.unfundedAmount, want.unfundedAmount!, example.tolerance),
        `${label} unfundedAmount: actual ${counts.unfundedAmount}, worksheet ${want.unfundedAmount}`,
      ).toBe(true)
    }

    it('case A, a pull-forward year: 3 funded, 1 partial, 1 deferred, 0 skipped, 3240 funded and 500 unfunded', () => {
      const phase = runYear(inputs.pullForwardYear as YearCase)
      expectCounts(phase.goalOutcomeCounts, expected.pullForwardYear!, 'pull-forward year')
      // The fixed goal funded without consuming the budget, and the pulled-
      // forward target goal funded from it: the worksheet's first wrong
      // reading would have left the target goal deferred at 2/1/2/0 and 2,140.
      expect(
        withinTolerance(phase.requiredGoalsFunded, rows[0]!.amountTodayDollars * inflFactor, example.tolerance),
        `requiredGoalsFunded: actual ${phase.requiredGoalsFunded}`,
      ).toBe(true)
      expect(
        withinTolerance(phase.targetGoalsFunded, rows[1]!.amountTodayDollars * inflFactor, example.tolerance),
        `targetGoalsFunded: actual ${phase.targetGoalsFunded}`,
      ).toBe(true)
      expect(withinTolerance(phase.goalOutcomeCounts.fundedAmount, 2_140, example.tolerance)).toBe(false)
    })

    it('case B, a cutting year: 1 funded, 0 partial, 0 deferred, 1 skipped, 1100 funded and 440 unfunded', () => {
      const phase = runYear(inputs.cuttingYear as YearCase)
      expectCounts(phase.goalOutcomeCounts, expected.cuttingYear!, 'cutting year')
      // Goals 2 to 4 are not in the schedule (target year 2031, no
      // pull-forward in a cutting year) and have no outcome; the worksheet's
      // wrong readings for this case: treating them as deferred (3), and
      // dropping the terminal skipped amount (0 unfunded).
      expect(phase.goalOutcomeCounts.deferred).not.toBe(3)
      expect(withinTolerance(phase.goalOutcomeCounts.unfundedAmount, 0, example.tolerance)).toBe(false)
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

describeCalculation(
  'spending-one-time-goals-annual',
  {
    example: {
      inputs: {
        currentYear: YEAR,
        cumulativeInflationFactor: 1.1,
        goalScheduler: null,
        anyAlive: true,
        goals: [
          { id: 'roof', label: 'Roof', targetYear: YEAR, amountTodayDollars: 10_000 },
          { id: 'trip', label: 'Trip', targetYear: YEAR, amountTodayDollars: 5_000 },
          { id: 'car', label: 'Car', targetYear: 2031, amountTodayDollars: 20_000 },
        ],
      },
      expected: {
        oneTimeGoals: 16_500,
        roofFunded: 11_000,
        tripFunded: 5_500,
        carFunded: 0,
        includingNextYearGoalWrongReading: 38_500,
        uninflatedWrongReading: 15_000,
        skippedAddedWrongReading: 23_500,
      },
      tolerance: { abs: 0.005 },
    },
    worksheet: 'DOCS/calculations/cash-flow-and-summary/spending-one-time-goals-annual.md',
    mutation: 'DOCS/calculations/cash-flow-and-summary/spending-one-time-goals-annual.mutation.md',
  },
  ({ example }) => {
    const inputs = example.inputs as Record<string, unknown>
    const expected = example.expected as Record<string, number>
    const inflFactor = inputs.cumulativeInflationFactor as number
    const goals = inputs.goals as {
      id: string
      label: string
      targetYear: number
      amountTodayDollars: number
    }[]

    it('funds both 2030 goals at the inflated amount and leaves the 2031 goal out', () => {
      const phase = annualOneTimeGoalFundingPhase({
        year: YEAR,
        inflFactor,
        anyAlive: inputs.anyAlive as boolean,
        goalScheduler: null,
        oneTimeGoals: goals.map((goal) => ({
          id: goal.id,
          label: goal.label,
          year: goal.targetYear,
          amount: goal.amountTodayDollars,
        })) as Plan['expenses']['oneTimeGoals'],
        cutting: false,
        canPullForwardGoals: false,
        remainingUpsideBudget: 0,
      })

      expect(
        withinTolerance(phase.oneTimeGoalsFunded, expected.oneTimeGoals!, example.tolerance),
        `oneTimeGoalsFunded: actual ${phase.oneTimeGoalsFunded}, worksheet ${expected.oneTimeGoals}`,
      ).toBe(true)
      // The composition really is the two 2030 goals inflated, and nothing else.
      expect(
        withinTolerance(
          phase.oneTimeGoalsFunded,
          expected.roofFunded! + expected.tripFunded! + expected.carFunded!,
          example.tolerance,
        ),
      ).toBe(true)
      // With no scheduler nothing is skipped, so no miss can leak into the field.
      expect(phase.skippedRequiredNominal).toBe(0)
      expect(phase.skippedTargetNominal).toBe(0)
      expect(phase.skippedIdealNominal).toBe(0)
      expect(phase.skippedExcessNominal).toBe(0)

      // The worksheet's three wrong readings.
      for (const wrong of [
        expected.includingNextYearGoalWrongReading!,
        expected.uninflatedWrongReading!,
        expected.skippedAddedWrongReading!,
      ]) {
        expect(withinTolerance(phase.oneTimeGoalsFunded, wrong, example.tolerance)).toBe(false)
      }
    })

    it('funds nothing at all when nobody in the household is alive', () => {
      const phase = annualOneTimeGoalFundingPhase({
        year: YEAR,
        inflFactor,
        anyAlive: false,
        goalScheduler: null,
        oneTimeGoals: goals.map((goal) => ({
          id: goal.id,
          label: goal.label,
          year: goal.targetYear,
          amount: goal.amountTodayDollars,
        })) as Plan['expenses']['oneTimeGoals'],
        cutting: false,
        canPullForwardGoals: false,
        remainingUpsideBudget: 0,
      })
      expect(phase.oneTimeGoalsFunded).toBe(0)
    })
  },
)
