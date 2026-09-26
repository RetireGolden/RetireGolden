import { expect, it } from 'vitest'

import type { Account, InsurancePolicy, Plan } from '../model/plan.js'
import { describeCalculation, withinTolerance } from '../rules/describeCalculation.js'
import { applyCapitalLossCarryforward } from '../tax/federalTax.js'
import { createFlatTaxCalculator } from '../testing/flatTax.js'
import {
  cashAccount,
  productionTaxCalculator,
  recurringOrdinaryIncome,
  singlePersonPlan,
  taxableAccount,
  traditionalAccount,
  validatePlan,
} from '../testing/planFixtures.js'
import { simulatePlan } from './simulate.js'
import type { YearResult } from './types.js'
import {
  BALANCE_CATEGORIES,
  balancesByCategory,
  capitalLossCarryforwardUsed,
  netCareCost,
  spendingWithTaxAndPenalties,
  taxAndPenalties,
  unassignedCash,
  upsideShortfall,
  upsideSpending,
} from './yearFigures.js'

type Row = Record<string, number>

describeCalculation(
  'display-tax-plus-penalties-annual',
  {
    example: {
      inputs: {
        caseA: { tax: 18_742, penalties: 2_000, amt: 0 },
        caseB: { tax: 8_412.35, penalties: 1_250.1, amt: 0 },
        caseC: { tax: 31_000, penalties: 0, amt: 1_400 },
      },
      expected: {
        caseA: 20_742,
        caseB: 9_662.45,
        caseC: 31_000,
        wrongTaxOnlyA: 18_742,
        wrongAmtAgainC: 32_400,
        wrongSubtractedA: 16_742,
      },
      tolerance: { abs: 0.000001 },
    },
    worksheet: 'DOCS/calculations/taxes/display-tax-plus-penalties-annual.md',
    mutation: 'DOCS/calculations/taxes/display-tax-plus-penalties-annual.mutation.md',
  },
  ({ example }) => {
    const inputs = example.inputs as Record<string, Row>
    const expected = example.expected as Row
    it('adds the settled tax and the penalties, and never adds AMT a second time', () => {
      for (const key of ['caseA', 'caseB', 'caseC'] as const) {
        const value = taxAndPenalties(inputs[key] as { tax: number; penalties: number })
        expect(withinTolerance(value, expected[key]!, example.tolerance), `${key}: ${value}`).toBe(true)
      }
      expect(Object.is(taxAndPenalties({ tax: 18_742, penalties: 2_000 }), expected.caseA)).toBe(true)
      expect(Object.is(taxAndPenalties({ tax: 31_000, penalties: 0 }), expected.caseC)).toBe(true)
      expect(taxAndPenalties(inputs.caseA as { tax: number; penalties: number })).not.toBe(expected.wrongTaxOnlyA)
      expect(taxAndPenalties(inputs.caseA as { tax: number; penalties: number })).not.toBe(expected.wrongSubtractedA)
      expect(taxAndPenalties(inputs.caseC as { tax: number; penalties: number })).not.toBe(expected.wrongAmtAgainC)
    })
  },
)

describeCalculation(
  'display-total-spending-annual',
  {
    example: {
      inputs: {
        caseA: { total: 64_321.5, tax: 7_000.25, penalties: 500 },
        caseB: { total: 40_477.35, tax: 18_353.95, penalties: 539.21 },
      },
      expected: {
        caseA: 71_821.75,
        caseBLeftToRight: 59_370.51,
        caseBOtherGrouping: 59_370.509999999995,
        wrongWithoutPenaltiesA: 71_321.75,
        wrongWithoutTaxA: 64_821.5,
      },
      tolerance: { abs: 0.000001 },
    },
    worksheet: 'DOCS/calculations/spending-and-withdrawals/display-total-spending-annual.md',
    mutation: 'DOCS/calculations/spending-and-withdrawals/display-total-spending-annual.mutation.md',
  },
  ({ example }) => {
    const inputs = example.inputs as Record<string, Row>
    const expected = example.expected as Row
    const row = (r: Row) => ({ expenses: { total: r.total! }, tax: r.tax!, penalties: r.penalties! })
    it('adds expenses, tax and penalties left to right', () => {
      expect(Object.is(spendingWithTaxAndPenalties(row(inputs.caseA!)), expected.caseA)).toBe(true)
      expect(spendingWithTaxAndPenalties(row(inputs.caseA!))).not.toBe(expected.wrongWithoutPenaltiesA)
      expect(spendingWithTaxAndPenalties(row(inputs.caseA!))).not.toBe(expected.wrongWithoutTaxA)
      // The association is part of the figure: (total + tax) + penalties, not total + (tax + penalties).
      const b = spendingWithTaxAndPenalties(row(inputs.caseB!))
      expect(Object.is(b, expected.caseBLeftToRight)).toBe(true)
      expect(b).not.toBe(expected.caseBOtherGrouping)
      expect(withinTolerance(b, expected.caseBOtherGrouping!, example.tolerance)).toBe(true)
    })

    it("is the FI number's spending base, read off a ledger year", () => {
      const plan = singlePersonPlan({ dob: '1960-01-01', planningAge: 90 })
      plan.accounts = [cashAccount('cash', 400_000)]
      plan.expenses.baseAnnual = 30_000
      plan.assumptions.inflationPct = 2.5
      const result = simulatePlan(validatePlan(plan), { startYear: 2026, horizonEndYear: 2030, taxCalculator: productionTaxCalculator() })
      const first = result.years[0]!
      expect(Object.is(spendingWithTaxAndPenalties(first), first.expenses.total + first.tax + first.penalties)).toBe(true)
    })
  },
)

describeCalculation(
  'display-net-care-cost-annual',
  {
    example: {
      inputs: {
        caseA: { careCost: 72_000, ltcBenefit: 54_000 },
        caseB: { careCost: 60_000, ltcBenefit: 0 },
        caseC: { careCost: 53_932.241304, firstPolicyCap: 10_756.3 },
        refused: { careCost: 1_000, ltcBenefit: 1_000.01 },
        ledger: { annualCost: 53_932.24, firstPolicyMonthly: 501.68, secondPolicyMonthly: 10_000, age: 85 },
      },
      expected: {
        caseA: 18_000,
        caseB: 60_000,
        caseC: 0,
        caseCResidue: -7.275957614183426e-12,
        ledgerNetCare: 0,
        ledgerFirstPolicyPayment: 6_020.16,
        wrongGrossA: 72_000,
        wrongReversedA: 0,
      },
      tolerance: { abs: 0 },
    },
    worksheet: 'DOCS/calculations/medicare-and-aca/display-net-care-cost-annual.md',
    mutation: 'DOCS/calculations/medicare-and-aca/display-net-care-cost-annual.mutation.md',
  },
  ({ example }) => {
    const inputs = example.inputs as Record<string, Row>
    const expected = example.expected as Row
    const row = (careCost: number, ltcBenefit: number) => ({ year: 2026, expenses: { careCost, ltcBenefit } })

    it('subtracts the benefit from the care cost, floored at 0', () => {
      expect(Object.is(netCareCost(row(inputs.caseA!.careCost!, inputs.caseA!.ltcBenefit!)), expected.caseA)).toBe(true)
      expect(Object.is(netCareCost(row(inputs.caseB!.careCost!, inputs.caseB!.ltcBenefit!)), expected.caseB)).toBe(true)
      expect(netCareCost(row(inputs.caseA!.careCost!, inputs.caseA!.ltcBenefit!))).not.toBe(expected.wrongGrossA)
    })

    it('absorbs the two-policy residue and refuses a real overpayment', () => {
      const cost = inputs.caseC!.careCost!
      const cap = inputs.caseC!.firstPolicyCap!
      const benefit = cap + (cost - cap)
      expect(cost - benefit).toBe(expected.caseCResidue)
      expect(Object.is(netCareCost(row(cost, benefit)), 0)).toBe(true)
      expect(() => netCareCost(row(inputs.refused!.careCost!, inputs.refused!.ltcBenefit!))).toThrow(/2026/u)
    })

    it('floors the residue a real two-policy ledger year produces', () => {
      const ledger = inputs.ledger!
      const plan = singlePersonPlan({ dob: '1941-01-01', planningAge: 95 })
      plan.accounts = [cashAccount('cash', 500_000)]
      plan.expenses.baseAnnual = 0
      const policy = (id: string, monthly: number): InsurancePolicy => ({
        kind: 'ltc', id, name: id, owner: 'p1', annualPremium: 0, premiumMode: 'lifetime',
        benefitMonthly: monthly, benefitPeriodYears: 'lifetime', eliminationPeriodDays: 0,
      })
      plan.insurance = [policy('first-ltc', ledger.firstPolicyMonthly!), policy('second-ltc', ledger.secondPolicyMonthly!)]
      plan.careEvents = [{ id: 'care', personId: 'p1', startAge: ledger.age!, durationYears: 1, annualCost: ledger.annualCost! }]
      const result = simulatePlan(validatePlan(plan), { startYear: 2026, horizonEndYear: 2026, taxCalculator: createFlatTaxCalculator(0) })
      const year = result.years[0]!
      expect(year.expenses.careCost).toBe(ledger.annualCost)
      expect(year.expenses.ltcBenefit).toBe(expected.ledgerFirstPolicyPayment! + (ledger.annualCost! - expected.ledgerFirstPolicyPayment!))
      expect(year.expenses.careCost - year.expenses.ltcBenefit).toBeLessThan(0)
      expect(Object.is(netCareCost(year), expected.ledgerNetCare)).toBe(true)
    })
  },
)

describeCalculation(
  'display-upside-spending-annual',
  {
    example: {
      inputs: {
        caseA: { idealSpending: 12_000.4, excessSpending: 3_000.35 },
        caseB: { idealSpending: 0.3, excessSpending: 0.1 },
        caseC: { idealSpending: 8_000, excessSpending: 0 },
      },
      expected: { caseA: 15_000.75, caseB: 0.4, caseC: 8_000, displayGate: 0.5, wrongIdealOnlyA: 12_000.4 },
      tolerance: { abs: 0.000001 },
    },
    worksheet: 'DOCS/calculations/spending-and-withdrawals/display-upside-spending-annual.md',
    mutation: 'DOCS/calculations/spending-and-withdrawals/display-upside-spending-annual.mutation.md',
  },
  ({ example }) => {
    const inputs = example.inputs as Record<string, Row>
    const expected = example.expected as Row
    const row = (r: Row) => ({ expenses: { idealSpending: r.idealSpending!, excessSpending: r.excessSpending! } })
    it('adds the ideal and excess layers', () => {
      expect(withinTolerance(upsideSpending(row(inputs.caseA!)), expected.caseA!, example.tolerance)).toBe(true)
      expect(withinTolerance(upsideSpending(row(inputs.caseA!)), expected.wrongIdealOnlyA!, example.tolerance)).toBe(false)
      const b = upsideSpending(row(inputs.caseB!))
      expect(withinTolerance(b, expected.caseB!, { abs: 1e-12 })).toBe(true)
      expect(b > expected.displayGate!).toBe(false)
      expect(Object.is(upsideSpending(row(inputs.caseC!)), expected.caseC)).toBe(true)
    })
  },
)

describeCalculation(
  'display-upside-shortfall-annual',
  {
    example: {
      inputs: {
        caseA: { idealShortfall: 4_200, excessShortfall: 3_000.35, requiredShortfall: 0, targetShortfall: 0 },
        caseB: { idealShortfall: 0.2, excessShortfall: 0.25, requiredShortfall: 0.3, targetShortfall: 0 },
        caseC: { idealShortfall: 0, excessShortfall: 0, requiredShortfall: 0, targetShortfall: 1_250 },
      },
      expected: { caseA: 7_200.35, caseB: 0.45, caseC: 0, displayGate: 0.5, oldFourWaySumB: 0.75 },
      tolerance: { abs: 0.000001 },
    },
    worksheet: 'DOCS/calculations/spending-and-withdrawals/display-upside-shortfall-annual.md',
    mutation: 'DOCS/calculations/spending-and-withdrawals/display-upside-shortfall-annual.mutation.md',
  },
  ({ example }) => {
    const inputs = example.inputs as Record<string, Row>
    const expected = example.expected as Row
    const row = (r: Row) => ({ idealShortfall: r.idealShortfall!, excessShortfall: r.excessShortfall! })
    it('adds the ideal and excess misses and leaves the lower layers out', () => {
      expect(withinTolerance(upsideShortfall(row(inputs.caseA!)), expected.caseA!, example.tolerance)).toBe(true)
      const b = inputs.caseB!
      const upsideB = upsideShortfall(row(b))
      expect(withinTolerance(upsideB, expected.caseB!, { abs: 1e-12 })).toBe(true)
      // The page's old outer test added all four misses (0.75, over the gate)
      // yet every inner part was blank; the engine-figure test is blank too.
      expect(b.requiredShortfall! + b.targetShortfall! + b.idealShortfall! + b.excessShortfall!).toBeCloseTo(expected.oldFourWaySumB!, 12)
      expect(b.requiredShortfall! > expected.displayGate! || b.targetShortfall! > expected.displayGate! || upsideB > expected.displayGate!).toBe(false)
      expect(Object.is(upsideShortfall(row(inputs.caseC!)), expected.caseC)).toBe(true)
    })
  },
)

describeCalculation(
  'display-loss-carryforward-used-annual',
  {
    example: {
      inputs: {
        ordinaryIncome: 40_000,
        offsetLimit: 3_000,
        caseA: { pool: 10_000, gain: 4_000 },
        caseB: { pool: 10_000, gain: 0 },
        caseC: { pool: 10_000, gain: -2_000 },
        caseD: { pool: 2_000, gain: 5_000 },
      },
      expected: {
        caseA: 7_000,
        caseB: 3_000,
        caseC: 3_000,
        caseD: 2_000,
        wrongRemainingA: 3_000,
        wrongPoolDecreaseC: 1_000,
      },
      tolerance: 'exact',
    },
    worksheet: 'DOCS/calculations/taxes/display-loss-carryforward-used-annual.md',
    mutation: 'DOCS/calculations/taxes/display-loss-carryforward-used-annual.mutation.md',
  },
  ({ example }) => {
    const inputs = example.inputs as Record<string, number | Row>
    const expected = example.expected as Row
    it("adds the carryforward used against gains and against ordinary income, through the engine's own netting", () => {
      for (const key of ['caseA', 'caseB', 'caseC', 'caseD'] as const) {
        const c = inputs[key] as Row
        const netting = applyCapitalLossCarryforward(c.pool!, inputs.ordinaryIncome as number, c.gain!, inputs.offsetLimit as number)
        const used = capitalLossCarryforwardUsed({
          capitalLossUsedAgainstGains: netting.usedAgainstGains,
          capitalLossUsedAgainstOrdinary: netting.usedAgainstOrdinary,
        })
        expect(used, key).toBe(expected[key])
        if (key === 'caseA') expect(used).not.toBe(netting.remaining)
        if (key === 'caseC') {
          expect(c.pool! - netting.remaining).toBe(expected.wrongPoolDecreaseC)
          expect(used).not.toBe(expected.wrongPoolDecreaseC)
        }
      }
    })
  },
)

/** A one-year run that publishes the requested balances with nothing flowing. */
function stillRun(accounts: Account[], opts: { income?: number; spending?: number } = {}): YearResult {
  const plan = singlePersonPlan({ dob: '1963-01-01', planningAge: 95 })
  plan.accounts = accounts
  plan.expenses.baseAnnual = opts.spending ?? 0
  plan.expenses.healthcare = { pre65MonthlyPremiumPerPerson: 0, applyAcaCredit: false, medicareExtrasMonthlyPerPerson: 0 }
  if (opts.income !== undefined) plan.incomes = [recurringOrdinaryIncome('pension', opts.income)]
  const result = simulatePlan(validatePlan(plan), { startYear: 2026, horizonEndYear: 2026, taxCalculator: createFlatTaxCalculator(0) })
  return result.years[0]!
}

describeCalculation(
  'display-balance-by-category-annual',
  {
    example: {
      inputs: {
        caseA: { cash: 1_000, iraRowA: 50_000, iraRowB: 50_000 },
        caseB: { c1: 10_000, t1: 25_000, e1: 7_500, ira: 30_000, r1: 40_000, h1: 6_000, home: 300_000, mort: 120_000, wl: 15_000 },
        caseC: { cash: 10_000, home: 300_000 },
        caseD: { traditional: 50_000, pension: 30_000, spending: 20_000 },
      },
      expected: {
        caseA: { cash: 1_000, taxable: 0, equityComp: 0, traditional: 100_000, roth: 0, hsa: 0 },
        caseAInvestableTotal: 101_000,
        caseAWrongPerRowTraditional: 200_000,
        caseB: { cash: 10_000, taxable: 25_000, equityComp: 7_500, traditional: 30_000, roth: 40_000, hsa: 6_000 },
        caseBWrongPerRowTaxable: 50_000,
        caseD: { cash: 0, taxable: 0, equityComp: 0, traditional: 50_000, roth: 0, hsa: 0 },
        caseDUnassignedCash: 10_000,
        caseDInvestableTotal: 60_000,
      },
      tolerance: 'exact',
    },
    worksheet: 'DOCS/calculations/accounts-and-growth/display-balance-by-category-annual.md',
    mutation: 'DOCS/calculations/accounts-and-growth/display-balance-by-category-annual.mutation.md',
  },
  ({ example }) => {
    const inputs = example.inputs as Record<string, Row>
    const expected = example.expected as Record<string, Row | number>

    it('counts an account split across two rows once (R1)', () => {
      const a = inputs.caseA!
      const accounts = [cashAccount('funding', a.cash!), traditionalAccount('ira', a.iraRowA!), traditionalAccount('ira', a.iraRowB!)]
      const year = stillRun(accounts)
      const plan = { accounts }
      const categories = balancesByCategory(plan, year)
      expect(categories).toEqual(expected.caseA)
      expect(Object.keys(categories)).toEqual([...BALANCE_CATEGORIES])
      const sum = BALANCE_CATEGORIES.reduce((total, category) => total + categories[category], 0)
      expect(sum).toBe(year.investableTotal)
      expect(year.investableTotal).toBe(expected.caseAInvestableTotal)
      // The retired per-row loop added the aggregate once per row.
      let perRow = 0
      for (const account of accounts) if (account.type === 'traditional') perRow += year.balances[account.id] ?? 0
      expect(perRow).toBe(expected.caseAWrongPerRowTraditional)
    })

    it('sums all six categories from a published row and leaves property, debt and policy values out', () => {
      const b = inputs.caseB!
      const accounts = [
        { type: 'cash', id: 'c1' }, { type: 'taxable', id: 't1' }, { type: 'taxable', id: 't1' },
        { type: 'equityComp', id: 'e1' }, { type: 'traditional', id: 'ira' }, { type: 'roth', id: 'r1' },
        { type: 'hsa', id: 'h1' }, { type: 'property', id: 'home' }, { type: 'debt', id: 'mort' },
      ] as unknown as Account[]
      const plan = { accounts, insurance: [{ kind: 'permanentLife', id: 'wl' }] as unknown as InsurancePolicy[] }
      const categories = balancesByCategory(plan, { balances: { ...b } })
      expect(categories).toEqual(expected.caseB)
      expect(categories.taxable).not.toBe(expected.caseBWrongPerRowTaxable)
    })

    it('refuses an account id that a property shares', () => {
      const c = inputs.caseC!
      const plan = {
        accounts: [cashAccount('home', c.cash!), { type: 'property', id: 'home' } as unknown as Account],
      } as Pick<Plan, 'accounts'>
      expect(() => balancesByCategory(plan, { balances: { home: c.home! } })).toThrow(/"home"/u)
    })

    it('publishes unassigned cash beside the categories, so they and it make up investableTotal', () => {
      const d = inputs.caseD!
      const accounts = [traditionalAccount('ira', d.traditional!)]
      const year = stillRun(accounts, { income: d.pension!, spending: d.spending! })
      expect(balancesByCategory({ accounts }, year)).toEqual(expected.caseD)
      expect(unassignedCash(year)).toBe(expected.caseDUnassignedCash)
      expect(year.investableTotal).toBe(expected.caseDInvestableTotal)
      // A plan with a cash or taxable account has nothing unassigned.
      expect(unassignedCash(stillRun([taxableAccount('brokerage', 5_000, 5_000)], { income: 1_000 }))).toBe(0)
      expect(unassignedCash({})).toBeNull()
    })
  },
)
