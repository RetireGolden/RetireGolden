import { expect, it, vi } from 'vitest'
import { describeCalculation, withinTolerance } from '../rules/describeCalculation.js'
import { createEmptyPlan, parsePlan, type Plan } from '../model/plan.js'
import * as simulation from '../projection/simulate.js'
import type { ProjectionResult, YearResult } from '../projection/types.js'
import { createFlatTaxCalculator } from '../testing/flatTax.js'
import { compareScenarioPlans, type ScenarioPlanComparisonOptions } from './comparison.js'

/**
 * The smallest real scenario side: a `ProjectionResult` whose rows carry only
 * the fields a worksheet names, with every other published field at zero. The
 * projection types are the production ones, so a field the ledger adds later
 * has to be given a value here too.
 */
function ledgerYear(year: number, overrides: Partial<YearResult> = {}): YearResult {
  return {
    year,
    people: [],
    filingStatus: 'single',
    incomes: {
      wages: 0,
      socialSecurity: 0,
      pension: 0,
      annuity: 0,
      tipsLadder: 0,
      recurring: 0,
      oneTime: 0,
      taxableInterest: 0,
      ordinaryDividends: 0,
      qualifiedDividends: 0,
      taxableYield: 0,
      taxExemptInterest: 0,
      total: 0,
    },
    expenses: {
      baseSpending: 0,
      oneTimeGoals: 0,
      debtService: 0,
      propertyCosts: 0,
      healthcare: 0,
      insurancePremiums: 0,
      careCost: 0,
      ltcBenefit: 0,
      requiredSpending: 0,
      targetSpending: 0,
      idealSpending: 0,
      excessSpending: 0,
      intendedSpending: 0,
      guardrailFactor: 1,
      total: 0,
    },
    contributions: 0,
    employerMatch: 0,
    rmd: 0,
    sepp: 0,
    inheritedDistribution: 0,
    inheritedTraditionalDistribution: 0,
    qcd: 0,
    rothConversion: 0,
    penalties: 0,
    magi: 0,
    medicarePremiums: 0,
    irmaaSurcharge: 0,
    irmaaTier: 0,
    amt: 0,
    ltcgZeroHeadroom: 0,
    ssEarningsTestWithheld: 0,
    ssdiPaid: 0,
    tax: 0,
    withdrawals: { cash: 0, taxable: 0, traditional: 0, roth: 0, hsa: 0, total: 0 },
    realizedGains: 0,
    taxableYield: 0,
    taxExemptInterest: 0,
    capitalLossUsedAgainstGains: 0,
    capitalLossUsedAgainstOrdinary: 0,
    capitalLossCarryforwardRemaining: 0,
    surplusInvested: 0,
    shortfall: 0,
    requiredShortfall: 0,
    targetShortfall: 0,
    idealShortfall: 0,
    excessShortfall: 0,
    guardrailAction: 'hold',
    flexibleGoals: {
      funded: 0,
      partiallyFunded: 0,
      deferred: 0,
      skipped: 0,
      fundedAmount: 0,
      unfundedAmount: 0,
    },
    balances: {},
    investableTotal: 0,
    insuranceCashValue: 0,
    ladderValue: 0,
    deathBenefit: 0,
    hecmDraw: 0,
    hecmLoanBalance: 0,
    netWorth: 0,
    netPortfolioNeed: 0,
    ...overrides,
  }
}

function sideLedger(years: YearResult[]): ProjectionResult {
  return {
    startYear: 2026,
    endYear: years[years.length - 1]?.year ?? 2026,
    years,
    depletionYear: null,
    endingInvestable: 0,
    endingNetWorth: 0,
    endingNondeductibleIraBasis: 0,
    warnings: [],
  }
}

/** A validated plan: `parsePlan` is the production gate every real plan passes. */
function evidencePlan(scope: string, mutate: (plan: Plan) => void): Plan {
  let counter = 0
  const plan = createEmptyPlan({
    newId: () => `${scope}-${++counter}`,
    now: () => new Date('2026-06-11T00:00:00.000Z'),
  })
  plan.name = scope
  plan.household.people[0] = {
    id: 'p1',
    name: 'Pat',
    dob: '1980-01-01',
    sex: 'average',
    retirementAge: 65,
    longevity: { planningAge: 65, source: 'manual' },
  }
  plan.assumptions.inflationPct = 0
  plan.assumptions.healthcareExtraInflationPct = 0
  plan.assumptions.defaultReturnPct = 0
  plan.assumptions.stateEffectiveTaxPct = 0
  plan.expenses.baseAnnual = 0
  mutate(plan)
  const parsed = parsePlan(plan)
  if (!parsed.ok) throw new Error(parsed.issues.join('; '))
  return parsed.plan
}

// Planning age 64 ends every run in 2044, the last year before the primary
// person turns 65: no modeled Medicare premium can add spending the worksheets
// do not name, and 2044 is still in the run for the depletion-year case.
function cashPlan(scope: string, balance: number, baseAnnual: number, planningAge = 64): Plan {
  return evidencePlan(scope, (plan) => {
    plan.household.people[0]!.longevity = { planningAge, source: 'manual' }
    plan.expenses.baseAnnual = baseAnnual
    plan.accounts = [
      {
        type: 'cash',
        id: 'cash-1',
        name: 'Cash',
        ownerPersonId: null,
        annualReturnPct: 0,
        balance,
        annualContribution: 0,
      },
    ]
  })
}

const comparisonOptions = (): ScenarioPlanComparisonOptions => ({
  startYear: 2026,
  taxCalculatorForPlan: () => createFlatTaxCalculator(0),
})

describeCalculation(
  'scenario-scalar-comparison',
  {
    example: {
      inputs: { baseline: 120_000.0, proposal: 95_000.0 },
      expected: { baseline: 120_000.0, proposal: 95_000.0, delta: -25_000.0 },
      tolerance: { abs: 0.005 },
    },
    worksheet: 'DOCS/calculations/optimizer-and-comparisons/scenario-scalar-comparison.md',
    mutation: 'DOCS/calculations/optimizer-and-comparisons/scenario-scalar-comparison.mutation.md',
  },
  ({ example }) => {
    it('publishes 120000.00, 95000.00 and a signed delta of -25000.00', () => {
      // `scalar` is not exported, so the claim is asserted through the exported
      // compareScenarioPlans on a headline money metric whose comparison cell
      // is a plain scalar: two spend-nothing cash plans end the run holding
      // exactly the worksheet's baseline and proposal balances.
      const inputs = example.inputs as Record<string, number>
      const comparison = compareScenarioPlans(
        cashPlan('baseline', inputs.baseline, 0),
        cashPlan('proposal', inputs.proposal, 0),
        comparisonOptions(),
      )
      const cell = comparison.headline.endingInvestable
      const expected = example.expected as Record<string, number>
      expect(
        withinTolerance(cell.baseline, expected.baseline, example.tolerance),
        `baseline: actual ${cell.baseline}, worksheet ${expected.baseline}`,
      ).toBe(true)
      expect(
        withinTolerance(cell.proposal, expected.proposal, example.tolerance),
        `proposal: actual ${cell.proposal}, worksheet ${expected.proposal}`,
      ).toBe(true)
      expect(
        withinTolerance(cell.delta, expected.delta, example.tolerance),
        `delta: actual ${cell.delta}, worksheet ${expected.delta}`,
      ).toBe(true)
      // The wrong readings: baseline minus proposal, and a relative change.
      expect(cell.delta).not.toBe(inputs.baseline - inputs.proposal)
      expect(cell.delta).not.toBe((inputs.proposal - inputs.baseline) / inputs.baseline)
    })
  },
)

describeCalculation(
  'scenario-nullable-scalar-comparison',
  {
    example: {
      inputs: {
        bothPresent: { baseline: 2041, proposal: 2044 },
        baselineAbsent: { baseline: null, proposal: 2044 },
      },
      expected: { presentDelta: 3, absentDelta: null },
      tolerance: 'exact',
    },
    worksheet: 'DOCS/calculations/optimizer-and-comparisons/scenario-nullable-scalar-comparison.md',
    mutation: 'DOCS/calculations/optimizer-and-comparisons/scenario-nullable-scalar-comparison.mutation.md',
  },
  ({ example }) => {
    // `nullableScalar` is not exported, so the claim is asserted through the
    // exported compareScenarioPlans on the one headline metric whose
    // comparison cell is nullable: the depletion year. Each side is a real run
    // whose cash portfolio is exhausted in the worksheet's calendar year — a
    // $100,000 balance against a level $6,400 spend crosses in 2041, against
    // $5,400 in 2044 — and a side that spends nothing never crosses.
    const present = example.inputs.bothPresent as { baseline: number; proposal: number }
    const absent = example.inputs.baselineAbsent as { baseline: null; proposal: number }

    it('subtracts 2041 from 2044 for a delta of exactly 3 years', () => {
      const comparison = compareScenarioPlans(
        cashPlan('baseline', 100_000, 6_400),
        cashPlan('proposal', 100_000, 5_400),
        comparisonOptions(),
      )
      const cell = comparison.headline.depletionYear
      expect(cell.baseline).toBe(present.baseline)
      expect(cell.proposal).toBe(present.proposal)
      expect(cell.delta).toBe(example.expected.presentDelta)
    })

    it('publishes a null delta when the baseline never depletes', () => {
      const comparison = compareScenarioPlans(
        cashPlan('baseline', 100_000, 0),
        cashPlan('proposal', 100_000, 5_400),
        comparisonOptions(),
      )
      const cell = comparison.headline.depletionYear
      expect(cell.baseline).toBe(absent.baseline)
      expect(cell.proposal).toBe(absent.proposal)
      expect(cell.delta).toBe(example.expected.absentDelta)
      // Coercing the absent operand to zero would present the proposal year
      // itself as a comparison.
      expect(cell.delta).not.toBe(absent.proposal)
    })
  },
)

describeCalculation(
  'scenario-lifetime-tax-and-penalties',
  {
    example: {
      inputs: {
        baseline: {
          taxes: [12_000.0, 9_500.0, 8_000.0],
          penalties: [300.0, 0.0, 1_200.0],
        },
        proposal: {
          taxes: [11_000.0, 9_000.0, 7_750.0],
          penalties: [0.0, 0.0, 250.0],
        },
      },
      expected: {
        baselineTax: 29_500.0,
        proposalTax: 27_750.0,
        baselinePenalties: 1_500.0,
        proposalPenalties: 250.0,
      },
      tolerance: { abs: 0.005 },
    },
    worksheet: 'DOCS/calculations/taxes/scenario-lifetime-tax-and-penalties.md',
    mutation: 'DOCS/calculations/taxes/scenario-lifetime-tax-and-penalties.mutation.md',
  },
  ({ example }) => {
    it('totals each side separately without mixing the tax and penalty channels', () => {
      // The worksheet's annual rows for both sides are supplied as
      // ProjectionResult literals at the simulate seam, keyed by the side's own
      // plan; the aggregation and the comparison assembly are the real code.
      const inputs = example.inputs as Record<string, { taxes: number[]; penalties: number[] }>
      const years = (side: { taxes: number[]; penalties: number[] }): YearResult[] =>
        side.taxes.map((tax, index) =>
          ledgerYear(2026 + index, { tax, penalties: side.penalties[index]! }),
        )
      const baselinePlan = cashPlan('baseline', 500_000, 0)
      const proposalPlan = cashPlan('proposal', 500_000, 0)
      const bySide = new Map<string, ProjectionResult>([
        [baselinePlan.name, sideLedger(years(inputs.baseline!))],
        [proposalPlan.name, sideLedger(years(inputs.proposal!))],
      ])
      const spy = vi.spyOn(simulation, 'simulatePlan').mockImplementation((plan) => {
        const ledger = bySide.get(plan.name)
        if (ledger === undefined) throw new Error('No worksheet ledger for side ' + plan.name)
        return ledger
      })
      try {
        const comparison = compareScenarioPlans(baselinePlan, proposalPlan, comparisonOptions())
        const expected = example.expected as Record<string, number>
        const tax = comparison.headline.lifetimeTax
        const penalties = comparison.headline.lifetimePenalties
        expect(
          withinTolerance(tax.baseline, expected.baselineTax, example.tolerance),
          `baseline lifetime tax: actual ${tax.baseline}, worksheet ${expected.baselineTax}`,
        ).toBe(true)
        expect(
          withinTolerance(tax.proposal, expected.proposalTax, example.tolerance),
          `proposal lifetime tax: actual ${tax.proposal}, worksheet ${expected.proposalTax}`,
        ).toBe(true)
        expect(
          withinTolerance(penalties.baseline, expected.baselinePenalties, example.tolerance),
          `baseline lifetime penalties: actual ${penalties.baseline}, worksheet ${expected.baselinePenalties}`,
        ).toBe(true)
        expect(
          withinTolerance(penalties.proposal, expected.proposalPenalties, example.tolerance),
          `proposal lifetime penalties: actual ${penalties.proposal}, worksheet ${expected.proposalPenalties}`,
        ).toBe(true)
        // Folding penalties into the tax channel is the worksheet's wrong
        // reading: it would report 31000.00 and 28000.00.
        expect(tax.baseline).not.toBe(expected.baselineTax + expected.baselinePenalties)
        expect(tax.proposal).not.toBe(expected.proposalTax + expected.proposalPenalties)
      } finally {
        spy.mockRestore()
      }
    })
  },
)
