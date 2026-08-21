import { describe, expect, it } from 'vitest'

import type { Plan } from '@retiregolden/engine/model/plan'
import type { AccountId, PersonId } from '@retiregolden/engine/actions/identity'
import type {
  YearCashFlow,
  YearCashFlowReconciliation,
  YearCashFlowSourceLine,
  YearCashFlowUseLine,
  YearResult,
} from '@retiregolden/engine/projection/types'
import {
  cashAccount,
  couplePlan,
  traditionalAccount,
  validatePlan,
} from '@retiregolden/engine/testing/planFixtures'

import { HOUSEHOLD_CASH_NODE_ID, buildYearCashFlowSankey, type YearCashFlowSankeyReady } from './buildYearCashFlow'
import {
  YEAR_CASH_FLOW_COLLAPSE_THRESHOLD_SHARE,
  applyYearCashFlowGrouping,
} from './grouping'

const personId = (id: string): PersonId => id as PersonId
const accountId = (id: string): AccountId => id as AccountId

function reconciled(): YearCashFlowReconciliation {
  return {
    status: 'reconciled',
    tolerancePlanDollars: 1e-6,
    cash: {
      spendableSourcesPlanDollars: 99_800,
      portfolioFundingPlanDollars: 400,
      loanProceedsPlanDollars: 0,
      sourceTotalPlanDollars: 100_200,
      fundedHouseholdUsesPlanDollars: 100_200,
      settledTaxPlanDollars: 0,
      penaltiesPlanDollars: 0,
      contributionsPlanDollars: 0,
      surplusInvestmentPlanDollars: 0,
      destinationTotalPlanDollars: 100_200,
      differencePlanDollars: 0,
    },
    uses: {
      requestedUsesPlanDollars: 100_200,
      fundedUsesPlanDollars: 100_200,
      unfundedUsesPlanDollars: 0,
      dispositionTotalPlanDollars: 100_200,
      differencePlanDollars: 0,
    },
    transfers: { debitsPlanDollars: 0, creditsPlanDollars: 0, differencePlanDollars: 0 },
    reasonCodes: [],
    diagnostics: [],
  }
}

function collapsePlan(): Plan {
  const plan = couplePlan({ p1PlanningAge: 95, p2PlanningAge: 95 })
  plan.accounts = [
    { ...traditionalAccount('ira-pat', 400_000, 'p1', 'ira'), name: 'Rollover IRA' },
    { ...traditionalAccount('tiny-a', 1_000, 'p1', 'ira'), name: 'Tiny A' },
    { ...traditionalAccount('tiny-b', 1_000, 'p1', 'ira'), name: 'Tiny B' },
    { ...traditionalAccount('tiny-c', 1_000, 'p1', 'ira'), name: 'Tiny C' },
    { ...traditionalAccount('tiny-robin', 1_000, 'p2', 'ira'), name: 'Spouse IRA' },
    cashAccount('cash', 20_000),
  ]
  plan.incomes = [
    {
      type: 'wages',
      id: 'w-pat',
      personId: 'p1',
      annualGross: 99_700,
      endAge: null,
      realGrowthPct: 0,
    },
    {
      type: 'recurring',
      id: 'side-job',
      label: 'Side job',
      annualAmount: 100,
      startYear: null,
      endYear: null,
      inflationAdjusted: false,
      taxTreatment: 'ordinary',
    },
  ]
  return validatePlan(plan)
}

function withdrawal(id: string, acct: string, owner: string, amount: number): YearCashFlowSourceLine {
  return {
    id,
    kind: 'needBasedPortfolioWithdrawal',
    role: 'portfolioFunding',
    amountPlanDollars: amount,
    identities: [
      { entityKind: 'account', accountId: accountId(acct) },
      { entityKind: 'person', personId: personId(owner) },
    ],
  }
}

function collapseCashFlow(): YearCashFlow {
  const lifestyle: YearCashFlowUseLine = {
    id: 'use:requiredLifestyle:household',
    kind: 'requiredLifestyle',
    requestedPlanDollars: 100_200,
    fundedPlanDollars: 100_200,
    unfundedPlanDollars: 0,
    identities: [],
  }
  return {
    sourceLines: [
      {
        id: 'source:wages:w-pat',
        kind: 'wages',
        role: 'spendableSource',
        amountPlanDollars: 99_700,
        identities: [
          { entityKind: 'incomeStream', incomeStreamId: 'w-pat' },
          { entityKind: 'person', personId: personId('p1') },
        ],
      },
      {
        id: 'source:recurringIncome:side-job',
        kind: 'recurringIncome',
        role: 'spendableSource',
        amountPlanDollars: 100,
        identities: [{ entityKind: 'incomeStream', incomeStreamId: 'side-job' }],
      },
      withdrawal('source:needBasedPortfolioWithdrawal:tiny-a', 'tiny-a', 'p1', 100),
      withdrawal('source:needBasedPortfolioWithdrawal:tiny-b', 'tiny-b', 'p1', 100),
      withdrawal('source:needBasedPortfolioWithdrawal:tiny-c', 'tiny-c', 'p1', 100),
      withdrawal('source:needBasedPortfolioWithdrawal:tiny-robin', 'tiny-robin', 'p2', 100),
    ],
    useLines: [lifestyle],
    transferLines: [],
    taxCharacterMetadata: [],
    reconciliation: reconciled(),
  }
}

function ready(options?: { showAll?: boolean }): YearCashFlowSankeyReady {
  const model = buildYearCashFlowSankey(
    collapsePlan(),
    { year: 2030, cashFlow: collapseCashFlow() } as YearResult,
    options,
  )
  if (model.kind !== 'ready') throw new Error(`expected ready, got ${model.kind}`)
  return model
}

describe('year cash-flow grouping', () => {
  it('exposes a 1% default collapse threshold', () => {
    expect(YEAR_CASH_FLOW_COLLAPSE_THRESHOLD_SHARE).toBe(0.01)
  })

  it('keeps source, hub, and reconciliation totals in agreement', () => {
    const model = ready()
    const sourceSum = model.views.cashFlow.nodes
      .filter((node) => node.side === 'source')
      .reduce((sum, node) => sum + node.amountPlanDollars, 0)
    const hub = model.views.cashFlow.nodes.find((node) => node.id === HOUSEHOLD_CASH_NODE_ID)
    expect(sourceSum).toBe(100_200)
    expect(hub?.amountPlanDollars).toBe(100_200)
    expect(model.reconciliation.cash.sourceTotalPlanDollars).toBe(sourceSum)
    expect(model.reconciliation.uses.fundedUsesPlanDollars).toBe(100_200)
  })

  it('collapses same-person same-kind lines below the side-share threshold into Other (n)', () => {
    const model = ready()
    const other = model.views.cashFlow.nodes.find((n) => n.collapsed)
    expect(other).toBeDefined()
    expect(other!.label).toBe('Pat — Other (3) — Need-based withdrawal')
    expect(other!.underlyingLineIds).toEqual([
      'source:needBasedPortfolioWithdrawal:tiny-a',
      'source:needBasedPortfolioWithdrawal:tiny-b',
      'source:needBasedPortfolioWithdrawal:tiny-c',
    ])
    expect(other!.amountPlanDollars).toBe(300)
    expect(model.views.cashFlow.nodes.some((n) => n.id === 'source:needBasedPortfolioWithdrawal:tiny-a')).toBe(false)
    const otherLink = model.views.cashFlow.links.find((link) => link.source === other!.id)
    expect(otherLink?.amountPlanDollars).toBe(300)
    expect(otherLink?.target).toBe('householdCash')
    expect(otherLink?.lineLabel).toBe('Pat — Other (3) — Need-based withdrawal')
    expect(otherLink?.lineLabel).not.toBe('Pat - Tiny A (IRA)')
    expect(otherLink?.kindLabel).toBe('Need-based withdrawal')
  })

  it('never merges two spouses\' accounts into one collapsed node', () => {
    const model = ready()
    const robin = model.views.cashFlow.nodes.find((n) => n.id === 'source:needBasedPortfolioWithdrawal:tiny-robin')
    expect(robin).toBeDefined()
    expect(robin!.label).toBe('Robin - Spouse IRA (IRA)')
    expect(robin!.collapsed).toBe(false)
    const other = model.views.cashFlow.nodes.find((n) => n.collapsed)
    expect(other!.personKey).toBe('p1')
    expect(other!.underlyingLineIds.join(' ')).not.toContain('tiny-robin')
  })

  it('never collapses two distinct kinds into one Other node', () => {
    const model = ready()
    const recurring = model.views.cashFlow.nodes.find((n) => n.id === 'source:recurringIncome:side-job')
    expect(recurring).toBeDefined()
    expect(recurring!.collapsed).toBe(false)
    expect(recurring!.kind).toBe('recurringIncome')
    const other = model.views.cashFlow.nodes.find((n) => n.collapsed)
    expect(other!.kind).toBe('needBasedPortfolioWithdrawal')
  })

  it('disables collapsing entirely when showAll is set', () => {
    const model = ready({ showAll: true })
    expect(model.showAll).toBe(true)
    expect(model.views.cashFlow.nodes.filter((n) => n.collapsed)).toEqual([])
    expect(model.views.cashFlow.nodes.map((n) => n.id)).toEqual(
      expect.arrayContaining([
        'source:needBasedPortfolioWithdrawal:tiny-a',
        'source:needBasedPortfolioWithdrawal:tiny-b',
        'source:needBasedPortfolioWithdrawal:tiny-c',
        'source:needBasedPortfolioWithdrawal:tiny-robin',
        'source:recurringIncome:side-job',
      ]),
    )
  })

  it('keeps every underlying line in the table regardless of grouping', () => {
    const grouped = ready()
    const shown = ready({ showAll: true })
    expect(grouped.table.map((row) => row.id)).toEqual(shown.table.map((row) => row.id))
    expect(grouped.table.map((row) => row.id)).toEqual(
      expect.arrayContaining([
        'source:needBasedPortfolioWithdrawal:tiny-a',
        'source:needBasedPortfolioWithdrawal:tiny-b',
        'source:needBasedPortfolioWithdrawal:tiny-c',
        'source:needBasedPortfolioWithdrawal:tiny-robin',
      ]),
    )
  })

  it('leaves a view unchanged when showAll is passed straight to the grouping helper', () => {
    const model = ready({ showAll: true })
    const again = applyYearCashFlowGrouping(model.views.cashFlow, { showAll: true })
    expect(again).toEqual(model.views.cashFlow)
  })
})
