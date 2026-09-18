import { expect, it } from 'vitest'
import { createEmptyPlan, parsePlan, type Account, type Plan } from '../model/plan.js'
import { describeCalculation } from '../rules/describeCalculation.js'
import { startingInvestableOf } from './riskBasedGuardrails.js'

let counter = 0
const testIds = () => `b1p4-mc-${++counter}`
const fixedNow = () => new Date('2026-06-11T00:00:00.000Z')

function taxable(balance: number): Account {
  return {
    type: 'taxable',
    id: testIds(),
    name: 'Brokerage',
    ownerPersonId: null,
    annualReturnPct: null,
    balance,
    costBasis: balance,
    annualContribution: 0,
  }
}

function cash(balance: number): Account {
  return {
    type: 'cash',
    id: testIds(),
    name: 'Cash',
    ownerPersonId: null,
    annualReturnPct: null,
    balance,
    annualContribution: 0,
  }
}

function home(value: number): Account {
  return {
    type: 'property',
    id: testIds(),
    name: 'Home',
    ownerPersonId: null,
    annualReturnPct: null,
    value,
    plannedSaleYear: null,
    expectedNetProceeds: null,
  }
}

function planOf(accounts: Account[]): Plan {
  const plan = createEmptyPlan({ newId: testIds, now: fixedNow })
  plan.accounts = accounts
  const parsed = parsePlan(plan)
  if (!parsed.ok) throw new Error(parsed.issues.join('; '))
  return parsed.plan
}

describeCalculation(
  'risk-based-starting-investable',
  {
    example: {
      inputs: { taxable: 100_000, cash: 20_000, home: 300_000 },
      expected: { startingInvestable: 120_000 },
      tolerance: 'exact',
    },
    worksheet: 'DOCS/calculations/monte-carlo/risk-based-starting-investable.md',
    mutation: 'DOCS/calculations/monte-carlo/risk-based-starting-investable.mutation.md',
  },
  ({ example }) => {
    it('sums taxable $100,000 and cash $20,000; the $300,000 home is excluded', () => {
      const plan = planOf([
        taxable(example.inputs.taxable as number),
        cash(example.inputs.cash as number),
        home(example.inputs.home as number),
      ])
      expect(startingInvestableOf(plan)).toBe(example.expected.startingInvestable)
    })
  },
)
