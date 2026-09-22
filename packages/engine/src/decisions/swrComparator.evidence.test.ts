import { expect, it, vi } from 'vitest'
import { describeCalculation, withinTolerance } from '../rules/describeCalculation.js'
import { createEmptyPlan, parsePlan, type Plan } from '../model/plan.js'
import * as simulation from '../projection/simulate.js'
import type { SimulateOptions } from '../projection/simulate.js'
import type { ProjectionResult, YearResult } from '../projection/types.js'
import { createFlatTaxCalculator } from '../testing/flatTax.js'
import { noTraditionalPlan, simOptions } from '../testing/decisionFixtures.js'
import { compareSwrRules } from './swrComparator.js'

describeCalculation('swr-rule-rate-and-initial-spend', {
  example: {
    inputs: { startingInvestable: 1_000_000, cape: 25, spendTolerance: { abs: 1e-8 } },
    expected: { rates: [4.7, 3.9, 3.75], spends: [47_000, 39_000, 37_500] },
    tolerance: { abs: 1e-12 },
  },
  worksheet: 'DOCS/calculations/optimizer-and-comparisons/swr-rule-rate-and-initial-spend.md',
  mutation: 'DOCS/calculations/optimizer-and-comparisons/swr-rule-rate-and-initial-spend.mutation.md',
}, ({ example }) => {
  it('prices Bengen, Morningstar and ERN at 47000, 39000 and 37500 on one million', () => {
    const plan = noTraditionalPlan()
    plan.accounts = [{ type: 'cash', id: 'worksheet-cash', name: 'Cash', ownerPersonId: null, annualReturnPct: 0, balance: example.inputs.startingInvestable as number, annualContribution: 0 }]
    const actual = compareSwrRules(plan, simOptions(), example.inputs.cape as number)
    const rates = example.expected.rates as number[]
    const spends = example.expected.spends as number[]
    expect(actual.length).toBe(rates.length)
    actual.forEach((row, index) => {
      expect(withinTolerance(row.initialRatePct, rates[index]!, example.tolerance), `${row.id} rate: actual ${row.initialRatePct}, worksheet ${rates[index]}`).toBe(true)
      expect(withinTolerance(row.initialAnnualSpend, spends[index]!, example.inputs.spendTolerance as { abs: number }), `${row.id} spend: actual ${row.initialAnnualSpend}, worksheet ${spends[index]}`).toBe(true)
    })
  })
})

/**
 * The smallest real rule-run ledger: a `ProjectionResult` whose rows carry
 * only the fields a worksheet names, with every other published field at zero.
 * The projection types are the production ones, so a field the ledger adds
 * later has to be given a value here too.
 */
function ledgerYear(year: number, overrides: Partial<YearResult> = {}): YearResult {
  const zeroIncomes = {
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
  const zeroExpenses = {
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
  return {
    year,
    people: [],
    filingStatus: 'single',
    incomes: zeroIncomes,
    expenses: zeroExpenses,
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
    flexibleGoals: { funded: 0, partiallyFunded: 0, deferred: 0, skipped: 0, fundedAmount: 0, unfundedAmount: 0 },
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

function ruleRunLedger(overrides: Partial<ProjectionResult> = {}): ProjectionResult {
  return {
    startYear: 2026,
    endYear: 2026,
    years: [],
    depletionYear: null,
    endingInvestable: 0,
    endingNetWorth: 0,
    endingNondeductibleIraBasis: 0,
    warnings: [],
    ...overrides,
  }
}

/** A validated plan: `parsePlan` is the production gate every real plan passes. */
function evidencePlan(mutate: (plan: Plan) => void): Plan {
  let counter = 0
  const plan = createEmptyPlan({
    newId: () => `swr-${++counter}`,
    now: () => new Date('2026-06-11T00:00:00.000Z'),
  })
  plan.household.people[0] = {
    id: 'p1',
    name: 'Pat',
    dob: '1980-01-01',
    sex: 'average',
    retirementAge: 65,
    longevity: { planningAge: 75, source: 'manual' },
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

const BENGEN = 'bengen-2025'

describeCalculation(
  'swr-rule-end-year',
  {
    example: {
      inputs: { startYear: 2026, endYear: 2055, depletionYear: 2041 },
      expected: { endYear: 2055 },
      tolerance: 'exact',
    },
    worksheet: 'DOCS/calculations/optimizer-and-comparisons/swr-rule-end-year.md',
    mutation: 'DOCS/calculations/optimizer-and-comparisons/swr-rule-end-year.mutation.md',
  },
  ({ example }) => {
    it('publishes the 2055 ledger endpoint, not the 2041 depletion year', () => {
      // The worksheet's ledger endpoint and its depletion-year discriminator
      // are supplied as a ProjectionResult literal at the simulate seam; the
      // comparator's own selection is the pinned code under test.
      const inputs = example.inputs as Record<string, number>
      const ledger = ruleRunLedger({
        startYear: inputs.startYear,
        endYear: inputs.endYear,
        depletionYear: inputs.depletionYear,
        years: [ledgerYear(inputs.startYear), ledgerYear(inputs.endYear)],
      })
      const spy = vi.spyOn(simulation, 'simulatePlan').mockReturnValue(ledger)
      try {
        const rows = compareSwrRules(evidencePlan((plan) => {
          plan.accounts = [
            { type: 'cash', id: 'cash-1', name: 'Cash', ownerPersonId: null, annualReturnPct: 0, balance: 1_000_000, annualContribution: 0 },
          ]
        }), simOptions())
        const row = rows.find((candidate) => candidate.id === BENGEN)!
        expect(row.endYear).toBe(example.expected.endYear)
        expect(row.depletionYear).toBe(inputs.depletionYear)
        expect(row.endYear).not.toBe(inputs.depletionYear)
        expect(row.endYear).not.toBe(inputs.startYear + 30)
      } finally {
        spy.mockRestore()
      }
    })
  },
)

describeCalculation(
  'swr-rule-depletion-year',
  {
    example: {
      // The fixture realizes the worksheet's first two cases with a real
      // ledger run built from these inputs, not from the worksheet's shortfall
      // table. The third case (a sole shortfall of exactly 0.005) is not
      // constructed from plan inputs and is not asserted: the ledger funds to
      // its own exact-cent fixed point, as the record's limits and the
      // worksheet's Expected section say.
      inputs: {
        cashBalance: 1_000_000,
        monthlyPremiumPerPerson: 1_500,
        depletingPlanningAge: 75,
        fundedPlanningAge: 60,
        toleranceDollars: 0.005,
      },
      expected: { depletionYear: 2041, noShortfallDepletionYear: null },
      tolerance: 'exact',
    },
    worksheet: 'DOCS/calculations/optimizer-and-comparisons/swr-rule-depletion-year.md',
    mutation: 'DOCS/calculations/optimizer-and-comparisons/swr-rule-depletion-year.mutation.md',
  },
  ({ example }) => {
    // A real ledger run, not an injected one: the worksheet's first crossing
    // year is realized by a constant-real rule level plus a level premium that
    // together exhaust a $1,000,000 cash portfolio in the sixteenth year, so
    // the rule the claim names — the first year over the half-cent budget, not
    // the largest-shortfall year — is what selects 2041.
    function depletingPlan(planningAge: number): Plan {
      return evidencePlan((plan) => {
        plan.household.people[0]!.longevity = { planningAge, source: 'manual' }
        plan.expenses.healthcare = {
          pre65MonthlyPremiumPerPerson: example.inputs.monthlyPremiumPerPerson as number,
          applyAcaCredit: false,
          medicareExtrasMonthlyPerPerson: 0,
        }
        plan.accounts = [
          { type: 'cash', id: 'cash-1', name: 'Cash', ownerPersonId: null, annualReturnPct: 0, balance: example.inputs.cashBalance as number, annualContribution: 0 },
        ]
      })
    }
    const opts = (): SimulateOptions => ({ startYear: 2026, taxCalculator: createFlatTaxCalculator(0) })

    it('selects 2041, the first year whose shortfall clears the half-cent budget', () => {
      const rows = compareSwrRules(depletingPlan(example.inputs.depletingPlanningAge as number), opts())
      const row = rows.find((candidate) => candidate.id === BENGEN)!
      // Every later year of this run is short by more than 2041 is, so the
      // largest-shortfall reading the worksheet rejects would name a later
      // year; the mutation receipt executes exactly that reading.
      expect(row.depletionYear).toBe(example.expected.depletionYear)
    })

    it('publishes null when no year is short', () => {
      // The minimum modeled planning age, 60, ends the run in 2040 — the
      // fifteenth funded year, one short of the crossing.
      const rows = compareSwrRules(depletingPlan(example.inputs.fundedPlanningAge as number), opts())
      const row = rows.find((candidate) => candidate.id === BENGEN)!
      expect(row.depletionYear).toBe(example.expected.noShortfallDepletionYear)
    })
  },
)

describeCalculation(
  'swr-rule-ending-after-tax-estate',
  {
    example: {
      inputs: { endingNetWorth: 700_000.0, endingAfterTaxEstate: 640_000.0, heirTaxDiscount: 60_000.0 },
      expected: { endingAfterTaxEstate: 640_000.0 },
      tolerance: { abs: 0.005 },
    },
    worksheet: 'DOCS/calculations/optimizer-and-comparisons/swr-rule-ending-after-tax-estate.md',
    mutation: 'DOCS/calculations/optimizer-and-comparisons/swr-rule-ending-after-tax-estate.mutation.md',
  },
  ({ example }) => {
    it('republishes the 640000.00 summary estate, not the 700000.00 net worth', () => {
      // The worksheet's rule-run ledger is supplied as a ProjectionResult
      // literal at the simulate seam; the heir-tax discriminator is a real
      // traditional balance at a 20% heir rate, so the real summary composes
      // the estate and the real comparator republishes it.
      const inputs = example.inputs as Record<string, number>
      const heirTaxRatePct = 20
      const traditionalBalance = inputs.heirTaxDiscount / (heirTaxRatePct / 100)
      const plan = evidencePlan((draft) => {
        draft.assumptions.heirTaxRatePct = heirTaxRatePct
        draft.accounts = [
          { type: 'traditional', id: 'trad-1', name: 'IRA', ownerPersonId: 'p1', annualReturnPct: 0, kind: 'ira', balance: traditionalBalance, annualContribution: 0 },
        ]
      })
      const ledger = ruleRunLedger({
        endYear: 2055,
        years: [ledgerYear(2055, { balances: { 'trad-1': traditionalBalance }, netWorth: inputs.endingNetWorth })],
        endingNetWorth: inputs.endingNetWorth,
      })
      const spy = vi.spyOn(simulation, 'simulatePlan').mockReturnValue(ledger)
      try {
        const rows = compareSwrRules(plan, simOptions())
        const row = rows.find((candidate) => candidate.id === BENGEN)!
        const expected = example.expected.endingAfterTaxEstate as number
        expect(
          withinTolerance(row.endingAfterTaxEstate, expected, example.tolerance),
          `endingAfterTaxEstate: actual ${row.endingAfterTaxEstate}, worksheet ${expected}`,
        ).toBe(true)
        expect(row.endingAfterTaxEstate).not.toBe(inputs.endingNetWorth)
        expect(row.endingAfterTaxEstate).not.toBe(inputs.endingAfterTaxEstate - inputs.heirTaxDiscount)
      } finally {
        spy.mockRestore()
      }
    })
  },
)

describeCalculation(
  'swr-rule-lifetime-taxes-and-penalties',
  {
    example: {
      inputs: { summaryLifetimeTax: 112_500.0, summaryLifetimePenalties: 2_750.25, summaryLifetimeTaxesAndPenalties: 115_250.25 },
      expected: { lifetimeTaxesAndPenalties: 115_250.25 },
      tolerance: { abs: 0.005 },
    },
    worksheet: 'DOCS/calculations/optimizer-and-comparisons/swr-rule-lifetime-taxes-and-penalties.md',
    mutation: 'DOCS/calculations/optimizer-and-comparisons/swr-rule-lifetime-taxes-and-penalties.mutation.md',
  },
  ({ example }) => {
    it('republishes 115250.25, not the 112500.00 tax channel alone', () => {
      // The worksheet's two tax channels are supplied as a ProjectionResult
      // literal at the simulate seam; the real summary combines them and the
      // real comparator republishes the combined figure.
      const inputs = example.inputs as Record<string, number>
      const ledger = ruleRunLedger({
        endYear: 2026,
        years: [ledgerYear(2026, { tax: inputs.summaryLifetimeTax, penalties: inputs.summaryLifetimePenalties })],
      })
      const spy = vi.spyOn(simulation, 'simulatePlan').mockReturnValue(ledger)
      try {
        const rows = compareSwrRules(evidencePlan((plan) => {
          plan.accounts = [
            { type: 'cash', id: 'cash-1', name: 'Cash', ownerPersonId: null, annualReturnPct: 0, balance: 1_000_000, annualContribution: 0 },
          ]
        }), simOptions())
        const row = rows.find((candidate) => candidate.id === BENGEN)!
        const expected = example.expected.lifetimeTaxesAndPenalties as number
        expect(
          withinTolerance(row.lifetimeTaxesAndPenalties, expected, example.tolerance),
          `lifetimeTaxesAndPenalties: actual ${row.lifetimeTaxesAndPenalties}, worksheet ${expected}`,
        ).toBe(true)
        expect(row.lifetimeTaxesAndPenalties).not.toBe(inputs.summaryLifetimeTax)
        expect(row.lifetimeTaxesAndPenalties).not.toBe(
          inputs.summaryLifetimeTaxesAndPenalties + inputs.summaryLifetimePenalties,
        )
      } finally {
        spy.mockRestore()
      }
    })
  },
)
