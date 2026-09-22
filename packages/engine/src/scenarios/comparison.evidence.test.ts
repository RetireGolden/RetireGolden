import { expect, it, vi } from 'vitest'
import { singlePersonPlan } from '../testing/planFixtures.js'
import { describeCalculation } from '../rules/describeCalculation.js'
import type { ProjectionResult, TaxCalculator, YearResult } from '../projection/types.js'
import { compareScenarioPlans } from './comparison.js'

vi.mock('../projection/simulate.js', () => ({
  simulatePlan: vi.fn(),
}))

import { simulatePlan } from '../projection/simulate.js'

const mockedSimulate = vi.mocked(simulatePlan)

const ZERO_INCOMES = {
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
}

const ZERO_EXPENSES = {
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
}

const ZERO_WITHDRAWALS = {
  cash: 0,
  taxable: 0,
  traditional: 0,
  roth: 0,
  hsa: 0,
  total: 0,
}

function stubYear(year: number, irmaaTier: number): YearResult {
  return {
    year,
    people: [],
    filingStatus: 'single',
    incomes: ZERO_INCOMES,
    expenses: ZERO_EXPENSES,
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
    irmaaTier,
    amt: 0,
    ltcgZeroHeadroom: 0,
    ssEarningsTestWithheld: 0,
    ssdiPaid: 0,
    tax: 0,
    withdrawals: ZERO_WITHDRAWALS,
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
  }
}

function stubResult(tiers: readonly number[]): ProjectionResult {
  const years = tiers.map((tier, index) => stubYear(2026 + index, tier))
  return {
    startYear: 2026,
    endYear: 2025 + tiers.length,
    years,
    depletionYear: null,
    endingInvestable: 0,
    endingNetWorth: 0,
    endingNondeductibleIraBasis: 0,
    warnings: [],
  }
}

describeCalculation(
  'scenario-irmaa-surcharge-tier-years',
  {
    example: {
      inputs: {
        baselineTiers: [0, 1, 3, 0, 5],
        proposalTiers: [0, 0, 2, 0, 4],
      },
      expected: { baselineSurchargeTierYears: 3, proposalSurchargeTierYears: 2, delta: -1 },
      tolerance: 'exact',
    },
    worksheet: 'DOCS/calculations/medicare-and-aca/scenario-irmaa-surcharge-tier-years.md',
    mutation: 'DOCS/calculations/medicare-and-aca/scenario-irmaa-surcharge-tier-years.mutation.md',
  },
  ({ example }) => {
    it('counts 3 baseline and 2 proposal surcharge-tier years (delta −1)', () => {
      // Constructed ProjectionResult years: the worksheet's irmaaTier rows
      // only, no full simulation. simulatePlan is stubbed to return those
      // rows so compareScenarioPlans still runs the real count.
      const baselineTiers = example.inputs.baselineTiers as number[]
      const proposalTiers = example.inputs.proposalTiers as number[]
      mockedSimulate
        .mockReturnValueOnce(stubResult(baselineTiers))
        .mockReturnValueOnce(stubResult(proposalTiers))
      const baseline = singlePersonPlan({ dob: '1961-01-01' })
      const proposal = singlePersonPlan({ dob: '1961-01-01' })
      const comparison = compareScenarioPlans(baseline, proposal, {
        startYear: 2026,
        taxCalculatorForPlan: () => ({ compute: () => ({ amount: 0 }) }) as unknown as TaxCalculator,
      })
      expect(comparison.irmaa.surchargeTierYears.baseline).toBe(example.expected.baselineSurchargeTierYears)
      expect(comparison.irmaa.surchargeTierYears.proposal).toBe(example.expected.proposalSurchargeTierYears)
      expect(comparison.irmaa.surchargeTierYears.delta).toBe(example.expected.delta)
    })
  },
)
