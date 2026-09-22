import { expect, it } from 'vitest'

import { parsePlan, type Account, type Plan } from '../../model/plan.js'
import { describeCalculation, withinTolerance } from '../../rules/describeCalculation.js'
import { createFederalTaxCalculator } from '../../tax/federalTax.js'
import { singlePersonPlan } from '../../testing/planFixtures.js'
import { simulatePlan } from '../simulate.js'
import type { YearResult } from '../types.js'
import {
  annualExpenseSummary,
  type AnnualExpenseSummaryInput,
} from './annualExpenseSummary.js'
import { annualGuardrailFundingPlan } from './annualGuardrailFunding.js'

/**
 * Every member of the expense-summary input at zero. Each worksheet then sets
 * only the components it names, so nothing unstated can reach the published
 * field under test.
 */
function zeroSummaryInput(): AnnualExpenseSummaryInput {
  return {
    requiredLifestyle: 0,
    targetLifestyle: 0,
    targetLifestyleFunded: 0,
    idealLifestyle: 0,
    idealLifestyleFunded: 0,
    excessLifestyle: 0,
    excessLifestyleFunded: 0,
    systemRequired: 0,
    oneTimeGoalsFunded: 0,
    requiredGoalsFunded: 0,
    targetGoalsFunded: 0,
    idealGoalsFunded: 0,
    excessGoalsFunded: 0,
    skippedRequiredNominal: 0,
    skippedTargetNominal: 0,
    skippedIdealNominal: 0,
    skippedExcessNominal: 0,
    debtService: 0,
    propertyCosts: 0,
    healthcare: 0,
    insurancePremiums: 0,
    careCost: 0,
    ltcBenefit: 0,
    discretionaryMultiplier: 1,
  }
}

function summarize(overrides: Partial<AnnualExpenseSummaryInput>): YearResult['expenses'] {
  return annualExpenseSummary({ ...zeroSummaryInput(), ...overrides }).expenses
}

function expectWithin(
  actual: number,
  target: number,
  tolerance: Parameters<typeof withinTolerance>[2],
  label: string,
): void {
  expect(
    withinTolerance(actual, target, tolerance),
    `${label} ${actual} is not within ${JSON.stringify(tolerance)} of the worksheet's ${target}`,
  ).toBe(true)
}

function validated(plan: Plan): Plan {
  const parsed = parsePlan(plan)
  if (!parsed.ok) throw new Error(parsed.issues.join('; '))
  return parsed.plan
}

/**
 * A real layered year: a 51-year-old with no healthcare charge, a required
 * floor under a target lifestyle, and ideal and excess layers on top, so the
 * published layer summaries can be checked against each other on a row the
 * engine really produced.
 */
function layeredProjectionRow(): YearResult {
  const plan = singlePersonPlan({ dob: '1975-06-15', planningAge: 95 })
  plan.accounts = [
    { type: 'cash', id: 'cash', name: 'Cash', ownerPersonId: null, annualReturnPct: 0, balance: 500_000, annualContribution: 0 },
    { type: 'debt', id: 'loan', name: 'Loan', ownerPersonId: null, annualReturnPct: 0, balance: 40_000, interestPct: 0, monthlyPayment: 500 } as unknown as Account,
  ]
  plan.expenses.baseAnnual = 60_000
  plan.expenses.requiredAnnual = 36_000
  plan.expenses.idealAnnual = 4_000
  plan.expenses.excessAnnual = 1_500
  plan.expenses.oneTimeGoals = [{ id: 'goal', label: 'Roof', year: 2026, amount: 8_000 }]
  const result = simulatePlan(validated(plan), {
    startYear: 2026,
    horizonEndYear: 2026,
    taxCalculator: createFederalTaxCalculator(),
  })
  const row = result.years.find((entry) => entry.year === 2026)
  if (row === undefined) throw new Error('missing projection year 2026')
  return row
}

describeCalculation(
  'spending-required-requested-annual',
  {
    example: {
      inputs: {
        everyTerm: {
          debtService: 6_000, propertyCosts: 4_000, healthcare: 5_000, insurancePremiums: 1_000,
          careCost: 3_000, ltcBenefit: 1_000, requiredLifestyle: 24_000,
          requiredGoalsFunded: 2_500, skippedRequiredNominal: 1_500,
        },
        noSkips: {
          debtService: 3_000, propertyCosts: 2_000, healthcare: 4_000, insurancePremiums: 1_000,
          careCost: 3_000, ltcBenefit: 1_000, requiredLifestyle: 18_000,
          requiredGoalsFunded: 2_000, skippedRequiredNominal: 0,
        },
      },
      expected: {
        everyTerm: 46_000, noSkips: 32_000,
        everyTermSystemRequired: 18_000, noSkipsSystemRequired: 12_000,
        withoutSkippedGoalWrongReading: 44_500,
        grossLtcWrongReading: 47_000,
        lifestyleAndGoalsOnlyWrongReading: 28_000,
      },
      tolerance: { abs: 0.005 },
    },
    worksheet: 'DOCS/calculations/cash-flow-and-summary/spending-required-requested-annual.md',
    mutation: 'DOCS/calculations/cash-flow-and-summary/spending-required-requested-annual.mutation.md',
  },
  ({ example }) => {
    const inputs = example.inputs as Record<string, Record<string, number>>
    const expected = example.expected as Record<string, number>

    function requiredFor(caseName: 'everyTerm' | 'noSkips'): YearResult['expenses'] {
      const row = inputs[caseName]!
      // The five system-computed costs are folded the way the caller folds
      // them, net of the LTC benefit, and handed to the seam as systemRequired.
      const systemRequired =
        row.debtService! + row.propertyCosts! + row.healthcare! + row.insurancePremiums! +
        row.careCost! - row.ltcBenefit!
      expectWithin(
        systemRequired,
        expected[caseName === 'everyTerm' ? 'everyTermSystemRequired' : 'noSkipsSystemRequired']!,
        example.tolerance,
        `${caseName} systemRequired`,
      )
      return summarize({
        systemRequired,
        requiredLifestyle: row.requiredLifestyle!,
        requiredGoalsFunded: row.requiredGoalsFunded!,
        skippedRequiredNominal: row.skippedRequiredNominal!,
        debtService: row.debtService!,
        propertyCosts: row.propertyCosts!,
        healthcare: row.healthcare!,
        insurancePremiums: row.insurancePremiums!,
        careCost: row.careCost!,
        ltcBenefit: row.ltcBenefit!,
      })
    }

    it('adds system costs, required lifestyle, funded goals and the skipped goal to 46000', () => {
      const expenses = requiredFor('everyTerm')
      expectWithin(expenses.requiredSpending, expected.everyTerm!, example.tolerance, 'requiredSpending')
      // The worksheet's three wrong readings.
      for (const wrong of [
        expected.withoutSkippedGoalWrongReading!,
        expected.grossLtcWrongReading!,
        expected.lifestyleAndGoalsOnlyWrongReading!,
      ]) {
        expect(withinTolerance(expenses.requiredSpending, wrong, example.tolerance)).toBe(false)
      }
    })

    it('publishes 32000 when no required goal was skipped', () => {
      const expenses = requiredFor('noSkips')
      expectWithin(expenses.requiredSpending, expected.noSkips!, example.tolerance, 'requiredSpending')
    })
  },
)

describeCalculation(
  'spending-target-requested-annual',
  {
    example: {
      inputs: {
        everyTerm: {
          systemRequired: 18_000, requiredLifestyle: 24_000, requiredGoalsFunded: 2_500,
          targetLifestyle: 12_000, targetGoalsFunded: 3_500,
          skippedRequiredNominal: 1_500, skippedTargetNominal: 1_000,
        },
        noSkips: {
          systemRequired: 12_000, requiredLifestyle: 18_000, requiredGoalsFunded: 2_000,
          targetLifestyle: 9_000, targetGoalsFunded: 2_500,
          skippedRequiredNominal: 0, skippedTargetNominal: 0,
        },
      },
      expected: {
        everyTerm: 62_500, noSkips: 43_500,
        everyTermRequiredSpending: 46_000,
        skippedRequiredTwiceWrongReading: 64_000,
        withoutSkippedAmountsWrongReading: 60_000,
        cutTargetLayerWrongReading: 57_700,
      },
      tolerance: { abs: 0.005 },
    },
    worksheet: 'DOCS/calculations/cash-flow-and-summary/spending-target-requested-annual.md',
    mutation: 'DOCS/calculations/cash-flow-and-summary/spending-target-requested-annual.mutation.md',
  },
  ({ example }) => {
    const inputs = example.inputs as Record<string, Record<string, number>>
    const expected = example.expected as Record<string, number>

    function targetFor(caseName: 'everyTerm' | 'noSkips'): YearResult['expenses'] {
      const row = inputs[caseName]!
      return summarize({
        systemRequired: row.systemRequired!,
        requiredLifestyle: row.requiredLifestyle!,
        requiredGoalsFunded: row.requiredGoalsFunded!,
        targetLifestyle: row.targetLifestyle!,
        // The cut layer is baseSpending's business; the target summary uses
        // the full layer. A 60% funded share is supplied here to prove it.
        targetLifestyleFunded: row.targetLifestyle! * 0.6,
        targetGoalsFunded: row.targetGoalsFunded!,
        skippedRequiredNominal: row.skippedRequiredNominal!,
        skippedTargetNominal: row.skippedTargetNominal!,
      })
    }

    it('carries the full target layer and each skipped amount once: 62500', () => {
      const expenses = targetFor('everyTerm')
      expectWithin(expenses.targetSpending, expected.everyTerm!, example.tolerance, 'targetSpending')
      // The equivalent form the worksheet names, against this same row's own
      // published requiredSpending rather than a re-entered constant.
      expectWithin(expenses.requiredSpending, expected.everyTermRequiredSpending!, example.tolerance, 'requiredSpending')
      expectWithin(
        expenses.targetSpending,
        expenses.requiredSpending +
          inputs.everyTerm!.targetLifestyle! +
          inputs.everyTerm!.targetGoalsFunded! +
          inputs.everyTerm!.skippedTargetNominal!,
        example.tolerance,
        'targetSpending against published requiredSpending',
      )
      // The worksheet's three wrong readings.
      for (const wrong of [
        expected.skippedRequiredTwiceWrongReading!,
        expected.withoutSkippedAmountsWrongReading!,
        expected.cutTargetLayerWrongReading!,
      ]) {
        expect(withinTolerance(expenses.targetSpending, wrong, example.tolerance)).toBe(false)
      }
    })

    it('publishes 43500 when no goal was skipped', () => {
      const expenses = targetFor('noSkips')
      expectWithin(expenses.targetSpending, expected.noSkips!, example.tolerance, 'targetSpending')
    })
  },
)

/**
 * The layer split the ideal and excess worksheets share: a 50,000 required
 * floor, a 20,000 target layer, a 10,000 ideal layer and a 5,000 excess layer,
 * which publishes the four summaries those two worksheets state as inputs.
 */
const LAYER_SPLIT = {
  requiredLifestyle: 50_000,
  targetLifestyle: 20_000,
  targetLifestyleFunded: 20_000,
  idealLifestyle: 10_000,
  idealLifestyleFunded: 10_000,
  excessLifestyle: 5_000,
  excessLifestyleFunded: 5_000,
} as const

describeCalculation(
  'spending-ideal-requested-annual',
  {
    example: {
      inputs: { requiredSpending: 50_000, targetSpending: 70_000, excessSpending: 5_000, intendedSpending: 85_000 },
      expected: {
        idealSpending: 10_000,
        cumulativeThroughIdealWrongReading: 80_000,
        subtractingRequiredWrongReading: 30_000,
      },
      tolerance: { abs: 0.005 },
    },
    worksheet: 'DOCS/calculations/cash-flow-and-summary/spending-ideal-requested-annual.md',
    mutation: 'DOCS/calculations/cash-flow-and-summary/spending-ideal-requested-annual.mutation.md',
  },
  ({ example }) => {
    const inputs = example.inputs as Record<string, number>
    const expected = example.expected as Record<string, number>

    it('isolates the 10000 ideal increment from the worksheet\'s four summaries', () => {
      const expenses = summarize({ ...LAYER_SPLIT })
      // The seam call really does publish the worksheet's stated inputs.
      expectWithin(expenses.requiredSpending, inputs.requiredSpending!, example.tolerance, 'requiredSpending')
      expectWithin(expenses.targetSpending, inputs.targetSpending!, example.tolerance, 'targetSpending')
      expectWithin(expenses.excessSpending, inputs.excessSpending!, example.tolerance, 'excessSpending')
      expectWithin(expenses.intendedSpending, inputs.intendedSpending!, example.tolerance, 'intendedSpending')

      expectWithin(expenses.idealSpending, expected.idealSpending!, example.tolerance, 'idealSpending')
      // The identity, against this row's own published fields.
      expectWithin(
        expenses.idealSpending,
        expenses.intendedSpending - expenses.targetSpending - expenses.excessSpending,
        example.tolerance,
        'idealSpending against the published identity',
      )
      // The worksheet's two wrong readings.
      expect(withinTolerance(expenses.idealSpending, expected.cumulativeThroughIdealWrongReading!, example.tolerance)).toBe(false)
      expect(withinTolerance(expenses.idealSpending, expected.subtractingRequiredWrongReading!, example.tolerance)).toBe(false)
    })
  },
)

describeCalculation(
  'spending-excess-requested-annual',
  {
    example: {
      inputs: { requiredSpending: 50_000, targetSpending: 70_000, idealSpending: 10_000, intendedSpending: 85_000 },
      expected: {
        excessSpending: 5_000,
        aboveRequiredWrongReading: 35_000,
        withoutIdealIncrementWrongReading: 15_000,
      },
      tolerance: { abs: 0.005 },
    },
    worksheet: 'DOCS/calculations/cash-flow-and-summary/spending-excess-requested-annual.md',
    mutation: 'DOCS/calculations/cash-flow-and-summary/spending-excess-requested-annual.mutation.md',
  },
  ({ example }) => {
    const inputs = example.inputs as Record<string, number>
    const expected = example.expected as Record<string, number>

    it('isolates the 5000 excess increment from the worksheet\'s four summaries', () => {
      const expenses = summarize({ ...LAYER_SPLIT })
      expectWithin(expenses.requiredSpending, inputs.requiredSpending!, example.tolerance, 'requiredSpending')
      expectWithin(expenses.targetSpending, inputs.targetSpending!, example.tolerance, 'targetSpending')
      expectWithin(expenses.idealSpending, inputs.idealSpending!, example.tolerance, 'idealSpending')
      expectWithin(expenses.intendedSpending, inputs.intendedSpending!, example.tolerance, 'intendedSpending')

      expectWithin(expenses.excessSpending, expected.excessSpending!, example.tolerance, 'excessSpending')
      expectWithin(
        expenses.excessSpending,
        expenses.intendedSpending - expenses.targetSpending - expenses.idealSpending,
        example.tolerance,
        'excessSpending against the published identity',
      )
      expect(withinTolerance(expenses.excessSpending, expected.aboveRequiredWrongReading!, example.tolerance)).toBe(false)
      expect(withinTolerance(expenses.excessSpending, expected.withoutIdealIncrementWrongReading!, example.tolerance)).toBe(false)
    })
  },
)

describeCalculation(
  'spending-intended-annual',
  {
    example: {
      inputs: {
        systemRequired: 20_000,
        requiredLifestyle: 30_000,
        requiredGoalsFunded: 2_000,
        skippedRequiredNominal: 1_000,
        targetLifestyle: 15_000,
        targetGoalsFunded: 3_000,
        skippedTargetNominal: 2_000,
        idealLifestyle: 6_000,
        idealGoalsFunded: 1_000,
        skippedIdealNominal: 500,
        excessLifestyle: 4_000,
        excessGoalsFunded: 500,
        skippedExcessNominal: 250,
      },
      expected: {
        intendedSpending: 85_250,
        requiredSpending: 53_000,
        targetSpending: 73_000,
        idealSpending: 7_500,
        excessSpending: 4_750,
        withoutSkippedGoalsWrongReading: 81_500,
        doubleCountedRequiredWrongReading: 138_250,
      },
      tolerance: { abs: 0.005 },
    },
    worksheet: 'DOCS/calculations/cash-flow-and-summary/spending-intended-annual.md',
    mutation: 'DOCS/calculations/cash-flow-and-summary/spending-intended-annual.mutation.md',
  },
  ({ example }) => {
    const inputs = example.inputs as Record<string, number>
    const expected = example.expected as Record<string, number>

    it('adds the target base and the two increments, each skipped goal once: 85250', () => {
      const expenses = summarize({
        systemRequired: inputs.systemRequired!,
        requiredLifestyle: inputs.requiredLifestyle!,
        requiredGoalsFunded: inputs.requiredGoalsFunded!,
        skippedRequiredNominal: inputs.skippedRequiredNominal!,
        targetLifestyle: inputs.targetLifestyle!,
        targetLifestyleFunded: inputs.targetLifestyle!,
        targetGoalsFunded: inputs.targetGoalsFunded!,
        skippedTargetNominal: inputs.skippedTargetNominal!,
        idealLifestyle: inputs.idealLifestyle!,
        idealLifestyleFunded: inputs.idealLifestyle!,
        idealGoalsFunded: inputs.idealGoalsFunded!,
        skippedIdealNominal: inputs.skippedIdealNominal!,
        excessLifestyle: inputs.excessLifestyle!,
        excessLifestyleFunded: inputs.excessLifestyle!,
        excessGoalsFunded: inputs.excessGoalsFunded!,
        skippedExcessNominal: inputs.skippedExcessNominal!,
      })
      expectWithin(expenses.requiredSpending, expected.requiredSpending!, example.tolerance, 'requiredSpending')
      expectWithin(expenses.targetSpending, expected.targetSpending!, example.tolerance, 'targetSpending')
      expectWithin(expenses.idealSpending, expected.idealSpending!, example.tolerance, 'idealSpending')
      expectWithin(expenses.excessSpending, expected.excessSpending!, example.tolerance, 'excessSpending')

      expectWithin(expenses.intendedSpending, expected.intendedSpending!, example.tolerance, 'intendedSpending')
      // The worksheet's two wrong readings: dropping every skipped goal, and
      // adding required and target summaries before the two increments.
      expect(withinTolerance(expenses.intendedSpending, expected.withoutSkippedGoalsWrongReading!, example.tolerance)).toBe(false)
      expect(withinTolerance(expenses.intendedSpending, expected.doubleCountedRequiredWrongReading!, example.tolerance)).toBe(false)
    })

    it('equals target plus the two increments on a real projection row', () => {
      const row = layeredProjectionRow()
      expectWithin(
        row.expenses.intendedSpending,
        row.expenses.targetSpending + row.expenses.idealSpending + row.expenses.excessSpending,
        example.tolerance,
        'intendedSpending against its own published layers',
      )
      expect(row.expenses.idealSpending).toBeGreaterThan(0)
      expect(row.expenses.excessSpending).toBeGreaterThan(0)
    })
  },
)

describeCalculation(
  'spending-total-annual',
  {
    example: {
      inputs: {
        baseSpending: 54_000,
        oneTimeGoals: 6_000,
        debtService: 12_000,
        propertyCosts: 5_000,
        healthcare: 9_000,
        insurancePremiums: 2_000,
        careCost: 20_000,
        ltcBenefit: 14_000,
        guardrailFactor: 0.9,
        intendedSpending: 100_000,
      },
      expected: {
        total: 94_000,
        addedLtcBenefitWrongReading: 122_000,
        withoutGrossCareCostWrongReading: 74_000,
        doubleGuardrailWrongReading: 84_600,
        intendedSubstitutionWrongReading: 100_000,
      },
      tolerance: { abs: 0.005 },
    },
    worksheet: 'DOCS/calculations/spending-and-withdrawals/spending-total-annual.md',
    mutation: 'DOCS/calculations/spending-and-withdrawals/spending-total-annual.mutation.md',
  },
  ({ example }) => {
    const inputs = example.inputs as Record<string, number>
    const expected = example.expected as Record<string, number>

    it('nets the eight members to 94000 and ignores the factor and the request', () => {
      // A 60,000 target layer cut to the worksheet's 0.90 factor is its 54,000
      // of base spending; the ideal layer then lifts the no-cut request to the
      // worksheet's 100,000, so both descriptive fields are really present.
      const systemRequired =
        inputs.debtService! + inputs.propertyCosts! + inputs.healthcare! +
        inputs.insurancePremiums! + inputs.careCost! - inputs.ltcBenefit!
      const expenses = summarize({
        targetLifestyle: 60_000,
        targetLifestyleFunded: inputs.baseSpending!,
        idealLifestyle: 6_000,
        systemRequired,
        oneTimeGoalsFunded: inputs.oneTimeGoals!,
        debtService: inputs.debtService!,
        propertyCosts: inputs.propertyCosts!,
        healthcare: inputs.healthcare!,
        insurancePremiums: inputs.insurancePremiums!,
        careCost: inputs.careCost!,
        ltcBenefit: inputs.ltcBenefit!,
        discretionaryMultiplier: inputs.guardrailFactor!,
      })
      expectWithin(expenses.baseSpending, inputs.baseSpending!, example.tolerance, 'baseSpending')
      expect(expenses.guardrailFactor).toBe(inputs.guardrailFactor)
      expectWithin(expenses.intendedSpending, inputs.intendedSpending!, example.tolerance, 'intendedSpending')

      expectWithin(expenses.total, expected.total!, example.tolerance, 'expenses.total')
      // The worksheet's four wrong readings.
      for (const wrong of [
        expected.addedLtcBenefitWrongReading!,
        expected.withoutGrossCareCostWrongReading!,
        expected.doubleGuardrailWrongReading!,
        expected.intendedSubstitutionWrongReading!,
      ]) {
        expect(withinTolerance(expenses.total, wrong, example.tolerance)).toBe(false)
      }
    })

    it('equals its own eight published members on a real projection row', () => {
      const row = layeredProjectionRow()
      const expenses = row.expenses
      expectWithin(
        expenses.total,
        expenses.baseSpending + expenses.oneTimeGoals + expenses.debtService + expenses.propertyCosts +
          expenses.healthcare + expenses.insurancePremiums + expenses.careCost - expenses.ltcBenefit,
        example.tolerance,
        'expenses.total against its own published members',
      )
      expect(expenses.oneTimeGoals).toBeGreaterThan(0)
      expect(expenses.debtService).toBeGreaterThan(0)
      // The layer summaries are not members. This row is a no-cut year, so
      // its intended request and its total coincide — which is exactly why the
      // required and target summaries, which do not, are the ones checked.
      expect(expenses.guardrailFactor).toBe(1)
      expect(withinTolerance(expenses.total, expenses.requiredSpending, example.tolerance)).toBe(false)
      expect(withinTolerance(expenses.total, expenses.targetSpending, example.tolerance)).toBe(false)
    })
  },
)

describeCalculation(
  'spending-base-annual',
  {
    example: {
      inputs: {
        requiredLifestyle: 36_000,
        targetLifestyle: 24_000,
        guardrailFactor: 0.75,
        idealLifestyleFunded: 4_000,
        excessLifestyleFunded: 1_500,
        oneTimeGoals: 8_000,
      },
      expected: {
        baseSpending: 59_500,
        targetLifestyleFunded: 18_000,
        factorOnRequiredWrongReading: 50_500,
        withOneTimeGoalWrongReading: 67_500,
        withoutUpsideLayersWrongReading: 54_000,
      },
      tolerance: { abs: 0.005 },
    },
    worksheet: 'DOCS/calculations/spending-and-withdrawals/spending-base-annual.md',
    mutation: 'DOCS/calculations/spending-and-withdrawals/spending-base-annual.mutation.md',
  },
  ({ example }) => {
    const inputs = example.inputs as Record<string, number>
    const expected = example.expected as Record<string, number>

    it('caps the target layer at the factor and leaves the one-time goal out: 59500', () => {
      // The min(1, factor) cap comes from the production guardrail phase, not
      // from this fixture: a household with nobody alive leaves the incoming
      // multiplier untouched, so the phase applies the worksheet's own 0.75 to
      // its own 24,000 target layer.
      const guardrail = annualGuardrailFundingPlan({
        guardrailsActive: true,
        riskBasedGuardrails: false,
        allowRaisesAboveTarget: false,
        guardrailPolicy: {},
        oneTimeGoals: [],
        isGoalResolved: () => false,
        year: 2030,
        inflFactor: 1,
        anyAlive: false,
        balances: [],
        startOfYearBalances: [],
        requiredLifestyle: inputs.requiredLifestyle!,
        targetLifestyle: inputs.targetLifestyle!,
        idealLifestyle: 0,
        excessLifestyle: 0,
        systemRequired: 0,
        discretionaryMultiplier: inputs.guardrailFactor!,
        startingWithdrawalRate: null,
        startingRealPortfolio: null,
      })
      expect(guardrail.discretionaryMultiplier).toBe(inputs.guardrailFactor)
      expectWithin(
        guardrail.targetLifestyleFunded,
        expected.targetLifestyleFunded!,
        example.tolerance,
        'targetLifestyleFunded',
      )

      const expenses = summarize({
        requiredLifestyle: inputs.requiredLifestyle!,
        targetLifestyle: inputs.targetLifestyle!,
        targetLifestyleFunded: guardrail.targetLifestyleFunded,
        idealLifestyleFunded: inputs.idealLifestyleFunded!,
        excessLifestyleFunded: inputs.excessLifestyleFunded!,
        oneTimeGoalsFunded: inputs.oneTimeGoals!,
        discretionaryMultiplier: guardrail.discretionaryMultiplier,
      })
      expectWithin(expenses.baseSpending, expected.baseSpending!, example.tolerance, 'baseSpending')
      // The one-time goal is in the year's total but not in base spending.
      expectWithin(expenses.oneTimeGoals, inputs.oneTimeGoals!, example.tolerance, 'oneTimeGoals')
      expectWithin(
        expenses.total,
        expected.baseSpending! + inputs.oneTimeGoals!,
        example.tolerance,
        'expenses.total',
      )
      // The worksheet's three wrong readings.
      for (const wrong of [
        expected.factorOnRequiredWrongReading!,
        expected.withOneTimeGoalWrongReading!,
        expected.withoutUpsideLayersWrongReading!,
      ]) {
        expect(withinTolerance(expenses.baseSpending, wrong, example.tolerance)).toBe(false)
      }
    })

    it('never lets a multiplier above one inflate the target layer', () => {
      const guardrail = annualGuardrailFundingPlan({
        guardrailsActive: true,
        riskBasedGuardrails: false,
        allowRaisesAboveTarget: false,
        guardrailPolicy: {},
        oneTimeGoals: [],
        isGoalResolved: () => false,
        year: 2030,
        inflFactor: 1,
        anyAlive: false,
        balances: [],
        startOfYearBalances: [],
        requiredLifestyle: inputs.requiredLifestyle!,
        targetLifestyle: inputs.targetLifestyle!,
        idealLifestyle: 0,
        excessLifestyle: 0,
        systemRequired: 0,
        discretionaryMultiplier: 1.4,
        startingWithdrawalRate: null,
        startingRealPortfolio: null,
      })
      expectWithin(
        guardrail.targetLifestyleFunded,
        inputs.targetLifestyle!,
        example.tolerance,
        'targetLifestyleFunded at a multiplier above one',
      )
    })
  },
)
