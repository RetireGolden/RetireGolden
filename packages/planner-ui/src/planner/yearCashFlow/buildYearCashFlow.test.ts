import { describe, expect, it } from 'vitest'

import type { Plan } from '@retiregolden/engine/model/plan'
import type { AccountId, PersonId } from '@retiregolden/engine/actions/identity'
import type {
  YearCashFlow,
  YearCashFlowReconciliation,
  YearCashFlowSourceLine,
  YearCashFlowTransferLine,
  YearCashFlowUseLine,
  YearResult,
} from '@retiregolden/engine/projection/types'
import {
  cashAccount,
  couplePlan,
  traditionalAccount,
  validatePlan,
} from '@retiregolden/engine/testing/planFixtures'

import {
  HOUSEHOLD_CASH_NODE_ID,
  UNFUNDED_ORIGIN_NODE_ID,
  buildYearCashFlowSankey,
  type YearCashFlowSankeyReady,
} from './buildYearCashFlow'

const personId = (id: string): PersonId => id as PersonId
const accountId = (id: string): AccountId => id as AccountId

function reconciled(): YearCashFlowReconciliation {
  return {
    status: 'reconciled',
    tolerancePlanDollars: 1e-6,
    cash: {
      spendableSourcesPlanDollars: 50_000,
      portfolioFundingPlanDollars: 35_000,
      loanProceedsPlanDollars: 0,
      sourceTotalPlanDollars: 85_000,
      fundedHouseholdUsesPlanDollars: 70_000,
      settledTaxPlanDollars: 5_000,
      penaltiesPlanDollars: 0,
      contributionsPlanDollars: 0,
      surplusInvestmentPlanDollars: 10_000,
      destinationTotalPlanDollars: 85_000,
      differencePlanDollars: 0,
    },
    uses: {
      requestedUsesPlanDollars: 95_000,
      fundedUsesPlanDollars: 85_000,
      unfundedUsesPlanDollars: 10_000,
      dispositionTotalPlanDollars: 95_000,
      differencePlanDollars: 0,
    },
    transfers: {
      debitsPlanDollars: 10_000,
      creditsPlanDollars: 10_000,
      differencePlanDollars: 0,
    },
    reasonCodes: [],
    diagnostics: [],
  }
}

function yearOf(cashFlow: YearCashFlow, year = 2030): YearResult {
  return { year, cashFlow } as YearResult
}

function twoOwnerPlan(): Plan {
  const plan = couplePlan({ p1PlanningAge: 95, p2PlanningAge: 95 })
  plan.accounts = [
    { ...traditionalAccount('ira-pat', 400_000, 'p1', 'ira'), name: 'Rollover IRA' },
    { ...traditionalAccount('k-robin', 500_000, 'p2', 'employer'), name: 'Workplace' },
    cashAccount('cash', 20_000),
  ]
  plan.incomes = [
    {
      type: 'wages',
      id: 'w-pat',
      personId: 'p1',
      annualGross: 50_000,
      endAge: null,
      realGrowthPct: 0,
    },
  ]
  return validatePlan(plan)
}

function source(
  partial: Pick<YearCashFlowSourceLine, 'id' | 'kind' | 'role' | 'amountPlanDollars' | 'identities'> &
    Partial<YearCashFlowSourceLine>,
): YearCashFlowSourceLine {
  return partial as YearCashFlowSourceLine
}

function asUseLine(partial: YearCashFlowUseLine): YearCashFlowUseLine {
  return partial
}

function transfer(partial: YearCashFlowTransferLine): YearCashFlowTransferLine {
  return partial
}

function twoOwnerCashFlow(overrides: Partial<YearCashFlow> = {}): YearCashFlow {
  return {
    sourceLines: [
      source({
        id: 'source:wages:w-pat',
        kind: 'wages',
        role: 'spendableSource',
        amountPlanDollars: 50_000,
        identities: [
          { entityKind: 'incomeStream', incomeStreamId: 'w-pat' },
          { entityKind: 'person', personId: personId('p1') },
        ],
      }),
      source({
        id: 'source:needBasedPortfolioWithdrawal:ira-pat',
        kind: 'needBasedPortfolioWithdrawal',
        role: 'portfolioFunding',
        amountPlanDollars: 20_000,
        identities: [
          { entityKind: 'account', accountId: accountId('ira-pat') },
          { entityKind: 'person', personId: personId('p1') },
        ],
      }),
      source({
        id: 'source:needBasedPortfolioWithdrawal:k-robin',
        kind: 'needBasedPortfolioWithdrawal',
        role: 'portfolioFunding',
        amountPlanDollars: 15_000,
        identities: [
          { entityKind: 'account', accountId: accountId('k-robin') },
          { entityKind: 'person', personId: personId('p2') },
        ],
      }),
    ],
    useLines: [
      asUseLine({
        id: 'use:requiredLifestyle:household',
        kind: 'requiredLifestyle',
        requestedPlanDollars: 80_000,
        fundedPlanDollars: 70_000,
        unfundedPlanDollars: 10_000,
        identities: [],
      }),
      asUseLine({
        id: 'use:settledTax:household',
        kind: 'settledTax',
        requestedPlanDollars: 5_000,
        fundedPlanDollars: 5_000,
        unfundedPlanDollars: 0,
        identities: [],
      }),
      asUseLine({
        id: 'use:surplusInvestment:account:cash',
        kind: 'surplusInvestment',
        requestedPlanDollars: 10_000,
        fundedPlanDollars: 10_000,
        unfundedPlanDollars: 0,
        identities: [{ entityKind: 'account', accountId: accountId('cash') }],
      }),
    ],
    transferLines: [
      transfer({
        id: 'transfer:surplusInvestment:account:cash',
        kind: 'surplusInvestment',
        source: { entityKind: 'householdCash' },
        destination: { entityKind: 'account', accountId: accountId('cash') },
        debitPlanDollars: 10_000,
        creditPlanDollars: 10_000,
        identities: [{ entityKind: 'account', accountId: accountId('cash') }],
        lineage: [{ lineId: 'use:surplusInvestment:account:cash', relationship: 'sameDollarLaterStage' }],
      }),
    ],
    taxCharacterMetadata: [],
    reconciliation: reconciled(),
    ...overrides,
  }
}

function ready(plan: Plan, cashFlow: YearCashFlow, options?: { showAll?: boolean }): YearCashFlowSankeyReady {
  const model = buildYearCashFlowSankey(plan, yearOf(cashFlow), options)
  if (model.kind !== 'ready') throw new Error(`expected ready model, got ${model.kind}`)
  return model
}

describe('buildYearCashFlowSankey', () => {
  it('labels two spouses\' IRA and 401(k) from current Plan names and kinds', () => {
    const model = ready(twoOwnerPlan(), twoOwnerCashFlow())
    const labels = model.views.cashFlow.nodes.map((n) => n.label)
    expect(labels).toContain('Pat - Rollover IRA (IRA)')
    expect(labels).toContain('Robin - Workplace (401(k))')
    expect(labels).toContain('Pat - Wages')
    const ira = model.table.find((row) => row.id === 'source:needBasedPortfolioWithdrawal:ira-pat')
    const k = model.table.find((row) => row.id === 'source:needBasedPortfolioWithdrawal:k-robin')
    expect(ira?.label).toBe('Pat - Rollover IRA (IRA)')
    expect(k?.label).toBe('Robin - Workplace (401(k))')
  })

  it('renders an unknown Plan reference as its own node and never folds it into household cash', () => {
    const cashFlow = twoOwnerCashFlow({
      sourceLines: [
        ...twoOwnerCashFlow().sourceLines,
        source({
          id: 'source:needBasedPortfolioWithdrawal:ghost-ira',
          kind: 'needBasedPortfolioWithdrawal',
          role: 'portfolioFunding',
          amountPlanDollars: 1,
          identities: [{ entityKind: 'account', accountId: accountId('ghost-ira') }],
        }),
      ],
    })
    const model = ready(twoOwnerPlan(), cashFlow)
    const ghost = model.views.cashFlow.nodes.find((n) => n.id === 'source:needBasedPortfolioWithdrawal:ghost-ira')
    expect(ghost).toBeDefined()
    expect(ghost!.label).toBe('Unknown source (ID ghost-ira)')
    expect(ghost!.unresolved).toBe(true)
    expect(ghost!.id).not.toBe(HOUSEHOLD_CASH_NODE_ID)
    expect(ghost!.flag).toBe('unresolved')
    const hub = model.views.cashFlow.nodes.find((n) => n.id === HOUSEHOLD_CASH_NODE_ID)
    expect(hub?.label).toBe('Household cash')
    expect(hub?.unresolved).toBe(false)
    expect(model.table.find((row) => row.id === ghost!.id)?.unresolved).toBe(true)
  })

  it('refuses to graph a year with no cashFlow capture', () => {
    const model = buildYearCashFlowSankey(twoOwnerPlan(), { year: 2030 } as YearResult)
    expect(model).toEqual({
      kind: 'unavailable',
      year: 2030,
      unavailableReason: 'notCaptured',
      reasonCodes: [],
      diagnostics: [],
    })
  })

  it('refuses to graph a notReconciled year and surfaces the engine diagnostics', () => {
    const cashFlow = twoOwnerCashFlow({
      reconciliation: {
        ...reconciled(),
        status: 'notReconciled',
        reasonCodes: ['cashIdentityMismatch'],
        diagnostics: [
          {
            reasonCode: 'cashIdentityMismatch',
            lineIds: [],
            expectedPlanDollars: 85_000,
            actualPlanDollars: 84_000,
            differencePlanDollars: 1_000,
          },
        ],
      },
    })
    const model = buildYearCashFlowSankey(twoOwnerPlan(), yearOf(cashFlow))
    expect(model.kind).toBe('unavailable')
    if (model.kind !== 'unavailable') return
    expect(model.unavailableReason).toBe('notReconciled')
    expect(model.reasonCodes).toEqual(['cashIdentityMismatch'])
    expect(model.diagnostics[0]?.differencePlanDollars).toBe(1_000)
    expect(model).not.toHaveProperty('views')
  })

  it('routes unfunded amounts on a red-flagged side branch that never enters the hub', () => {
    const model = ready(twoOwnerPlan(), twoOwnerCashFlow())
    const unfundedNode = model.views.cashFlow.nodes.find((n) => n.id === 'unfunded:use:requiredLifestyle:household')
    expect(unfundedNode).toBeDefined()
    expect(unfundedNode!.flag).toBe('unfunded')
    expect(unfundedNode!.role).toBe('unfundedUse')
    expect(unfundedNode!.amountPlanDollars).toBe(10_000)

    const unfundedLinks = model.views.cashFlow.links.filter((link) => link.flag === 'unfunded')
    expect(unfundedLinks).toHaveLength(1)
    expect(unfundedLinks[0]!.source).toBe(UNFUNDED_ORIGIN_NODE_ID)
    expect(unfundedLinks[0]!.target).toBe(unfundedNode!.id)

    for (const link of model.views.cashFlow.links) {
      if (link.target === unfundedNode!.id || link.target.startsWith('unfunded:')) {
        expect(link.source).not.toBe(HOUSEHOLD_CASH_NODE_ID)
      }
      if (link.flag === 'unfunded') {
        expect(link.source).not.toBe(HOUSEHOLD_CASH_NODE_ID)
      }
    }

    const fundedLifestyle = model.views.cashFlow.links.find(
      (link) => link.target === 'use:requiredLifestyle:household',
    )
    expect(fundedLifestyle?.source).toBe(HOUSEHOLD_CASH_NODE_ID)
    expect(fundedLifestyle?.amountPlanDollars).toBe(70_000)
  })

  it('carries originating line kind and label on Sankey links for tooltips', () => {
    const model = ready(twoOwnerPlan(), twoOwnerCashFlow())
    const settledTaxLink = model.views.cashFlow.links.find(
      (link) => link.target === 'use:settledTax:household',
    )
    expect(settledTaxLink).toMatchObject({
      kind: 'settledTax',
      kindLabel: 'Settled tax',
      lineLabel: 'Settled tax',
    })
    expect(settledTaxLink?.kindLabel).not.toBe('Household cash')
    const transferLink = model.views.transfers.links.find(
      (link) => link.underlyingLineIds.includes('transfer:surplusInvestment:account:cash'),
    )
    expect(transferLink).toMatchObject({
      kind: 'surplusInvestment',
      kindLabel: 'Surplus investment',
    })
    expect(transferLink?.kindLabel).not.toBe('Household cash')
  })

  it('keeps transfer debit and credit as a paired view that bypasses the cash hub', () => {
    const model = ready(twoOwnerPlan(), twoOwnerCashFlow())
    const row = model.table.find((item) => item.id === 'transfer:surplusInvestment:account:cash')
    expect(row).toMatchObject({
      view: 'transfers',
      kind: 'surplusInvestment',
      debitPlanDollars: 10_000,
      creditPlanDollars: 10_000,
      sourceRef: HOUSEHOLD_CASH_NODE_ID,
      targetRef: 'account:cash',
    })
    expect(row?.lineageNotes).toEqual([
      { lineId: 'use:surplusInvestment:account:cash', relationship: 'sameDollarLaterStage' },
    ])
    const link = model.views.transfers.links.find((item) => item.underlyingLineIds.includes(row!.id))
    expect(link?.source).toBe(HOUSEHOLD_CASH_NODE_ID)
    expect(link?.target).toBe('account:cash')
    expect(link?.amountPlanDollars).toBe(10_000)
    expect(model.views.cashFlow.links.some((item) => item.id.includes('transfer:'))).toBe(false)
  })

  it('lists every underlying line in the table, including uses that split funded and unfunded', () => {
    const model = ready(twoOwnerPlan(), twoOwnerCashFlow())
    const lifestyle = model.table.find((row) => row.id === 'use:requiredLifestyle:household')
    expect(lifestyle).toMatchObject({
      requestedPlanDollars: 80_000,
      fundedPlanDollars: 70_000,
      unfundedPlanDollars: 10_000,
    })
    expect(model.table.map((row) => row.id)).toEqual([
      'source:wages:w-pat',
      'source:needBasedPortfolioWithdrawal:ira-pat',
      'source:needBasedPortfolioWithdrawal:k-robin',
      'use:requiredLifestyle:household',
      'use:settledTax:household',
      'use:surplusInvestment:account:cash',
      'transfer:surplusInvestment:account:cash',
    ])
  })

  it('labels and groups a survivor pension by the living payee, not the deceased owner', () => {
    const plan = twoOwnerPlan()
    plan.accounts = [
      ...plan.accounts,
      {
        type: 'pension',
        id: 'pen-p2',
        name: 'Pension',
        ownerPersonId: 'p2',
        annualReturnPct: 0,
        startAge: 65,
        monthlyAmount: 3_000,
        colaPct: 0,
        survivorPct: 50,
      },
    ]
    const cashFlow = twoOwnerCashFlow({
      sourceLines: [
        source({
          id: 'source:pension:pen-p2',
          kind: 'pension',
          role: 'spendableSource',
          amountPlanDollars: 18_000,
          identities: [
            { entityKind: 'account', accountId: accountId('pen-p2') },
            { entityKind: 'person', personId: personId('p1') },
          ],
        }),
      ],
    })
    const model = ready(plan, cashFlow)
    const node = model.views.cashFlow.nodes.find((n) => n.id === 'source:pension:pen-p2')
    expect(node?.label).toBe('Pat - Pension (Pension)')
    expect(node?.personKey).toBe('p1')
    expect(node?.personLabel).toBe('Pat')
    expect(node?.label).not.toContain('Robin')
    const row = model.table.find((item) => item.id === 'source:pension:pen-p2')
    expect(row?.label).toBe('Pat - Pension (Pension)')
    expect(row?.entityLabels).toEqual(expect.arrayContaining(['Robin - Pension (Pension)', 'Pat']))
  })

  it('discloses a secondary unknown identity on the label, table, and chart node', () => {
    const cashFlow = twoOwnerCashFlow({
      sourceLines: [
        source({
          id: 'source:needBasedPortfolioWithdrawal:ira-pat',
          kind: 'needBasedPortfolioWithdrawal',
          role: 'portfolioFunding',
          amountPlanDollars: 20_000,
          identities: [
            { entityKind: 'account', accountId: accountId('ira-pat') },
            { entityKind: 'person', personId: personId('ghost') },
          ],
        }),
      ],
    })
    const model = ready(twoOwnerPlan(), cashFlow)
    const node = model.views.cashFlow.nodes.find((n) => n.id === 'source:needBasedPortfolioWithdrawal:ira-pat')
    expect(node?.unresolved).toBe(true)
    expect(node?.label).toContain('Rollover IRA (IRA)')
    expect(node?.label).toContain('Unknown source (ID ghost)')
    const row = model.table.find((item) => item.id === node!.id)
    expect(row?.unresolved).toBe(true)
    expect(row?.label).toContain('Unknown source (ID ghost)')
  })

  it('joins a named QCD charity and donor from the current Plan', () => {
    const plan = twoOwnerPlan()
    plan.strategies = {
      ...plan.strategies,
      retirementActions: [
        {
          actionId: 'qcd-cf',
          kind: 'qcd',
          donorPersonId: 'p2',
          year: 2030,
          executionSequence: 1,
          requestedAmount: 5_000,
          allocation: {
            allocationId: 'qcd-alloc',
            sourceAccountId: 'ira-pat',
            requestedAmount: 5_000,
          },
          charity: {
            designationId: 'cf-1',
            name: 'Community Foundation',
            designationKind: 'eligiblePublicCharity',
            directFromCustodianAttested: true,
            eligibleOrganizationAttested: true,
            notDonorAdvisedFundOrSupportingOrganizationAttested: true,
            notSplitInterestEntityAttested: true,
            entireDistributionOtherwiseDeductibleAttested: true,
          },
          provenance: { source: 'manual' },
        } as Plan['strategies']['retirementActions'][number],
      ],
    }
    const cashFlow = twoOwnerCashFlow({
      transferLines: [
        transfer({
          id: 'transfer:qualifiedCharitableDistribution:action:qcd-cf',
          kind: 'qualifiedCharitableDistribution',
          source: { entityKind: 'account', accountId: accountId('ira-pat') },
          destination: { entityKind: 'charity', designationId: 'cf-1' },
          debitPlanDollars: 5_000,
          creditPlanDollars: 5_000,
          identities: [{ entityKind: 'retirementAction', actionId: 'qcd-cf' }],
        }),
      ],
    })
    const model = ready(plan as Plan, cashFlow)
    const charity = model.views.transfers.nodes.find((n) => n.id === 'charity:cf-1')
    expect(charity?.label).toBe('Community Foundation')
    const row = model.table.find((item) => item.id === 'transfer:qualifiedCharitableDistribution:action:qcd-cf')
    expect(row?.targetLabel).toBe('Community Foundation')
    expect(row?.label).toContain('Robin')
    const unnamed = ready(
      twoOwnerPlan(),
      twoOwnerCashFlow({
        transferLines: [
          transfer({
            id: 'transfer:qualifiedCharitableDistribution:legacy',
            kind: 'qualifiedCharitableDistribution',
            source: { entityKind: 'account', accountId: accountId('ira-pat') },
            destination: { entityKind: 'charity', designationId: 'cf-1' },
            debitPlanDollars: 5_000,
            creditPlanDollars: 5_000,
            identities: [],
          }),
        ],
      }),
    )
    expect(unnamed.views.transfers.nodes.find((n) => n.id === 'charity:cf-1')?.label).toBe('Charity (cf-1)')
  })

  it('sizes a bidirectional transfer endpoint as max(in, out) and exposes both totals', () => {
    const plan = twoOwnerPlan()
    plan.accounts = [
      ...plan.accounts,
      {
        type: 'roth',
        id: 'roth-pat',
        name: 'Roth IRA',
        ownerPersonId: 'p1',
        annualReturnPct: null,
        kind: 'ira',
        balance: 10_000,
        annualContribution: 0,
      },
    ]
    const cashFlow = twoOwnerCashFlow({
      transferLines: [
        transfer({
          id: 'transfer:employeeContribution:ira-pat',
          kind: 'employeeContribution',
          source: { entityKind: 'householdCash' },
          destination: { entityKind: 'account', accountId: accountId('ira-pat') },
          debitPlanDollars: 7_000,
          creditPlanDollars: 7_000,
          identities: [{ entityKind: 'account', accountId: accountId('ira-pat') }],
        }),
        transfer({
          id: 'transfer:namedRothConversion:ira-pat:roth-pat',
          kind: 'namedRothConversion',
          source: { entityKind: 'account', accountId: accountId('ira-pat') },
          destination: { entityKind: 'account', accountId: accountId('roth-pat') },
          debitPlanDollars: 12_000,
          creditPlanDollars: 12_000,
          identities: [{ entityKind: 'account', accountId: accountId('ira-pat') }],
        }),
      ],
      reconciliation: {
        ...reconciled(),
        transfers: { debitsPlanDollars: 19_000, creditsPlanDollars: 19_000, differencePlanDollars: 0 },
      },
    })
    const model = ready(validatePlan(plan), cashFlow)
    const ira = model.views.transfers.nodes.find((n) => n.id === 'account:ira-pat')
    expect(ira?.totalInPlanDollars).toBe(7_000)
    expect(ira?.totalOutPlanDollars).toBe(12_000)
    expect(ira?.amountPlanDollars).toBe(12_000)
    expect(ira?.amountPlanDollars).not.toBe(19_000)
    const contribution = model.views.transfers.nodes.find((n) => n.id === HOUSEHOLD_CASH_NODE_ID)
    expect(contribution?.totalInPlanDollars).toBe(0)
    expect(contribution?.totalOutPlanDollars).toBe(7_000)
    expect(contribution?.amountPlanDollars).toBe(7_000)
    const roth = model.views.transfers.nodes.find((n) => n.id === 'account:roth-pat')
    expect(roth?.totalInPlanDollars).toBe(12_000)
    expect(roth?.totalOutPlanDollars).toBe(0)
    expect(roth?.amountPlanDollars).toBe(12_000)
  })

  it('publishes endpoints, entities, penalty, tax character, lineage, and metadata amounts on table rows', () => {
    const cashFlow = twoOwnerCashFlow({
      useLines: [
        ...twoOwnerCashFlow().useLines,
        asUseLine({
          id: 'use:earlyWithdrawalPenalty:ira-pat',
          kind: 'earlyWithdrawalPenalty',
          requestedPlanDollars: 1_000,
          fundedPlanDollars: 1_000,
          unfundedPlanDollars: 0,
          penaltyClass: 'traditionalEarly',
          identities: [{ entityKind: 'account', accountId: accountId('ira-pat') }],
        }),
      ],
      taxCharacterMetadata: [
        {
          id: 'tax:tipsPhantomOidIncome:ladder-1',
          taxCharacter: { kind: 'tipsPhantomOidIncome', amountPlanDollars: 250 },
          identities: [{ entityKind: 'tipsLadder', ladderId: 'ladder-1' }],
          relatedLineId: 'source:tipsLadderCash:ladder-1',
        },
      ],
    })
    const model = ready(twoOwnerPlan(), cashFlow)
    const transferRow = model.table.find((row) => row.id === 'transfer:surplusInvestment:account:cash')
    expect(transferRow).toMatchObject({
      sourceRef: HOUSEHOLD_CASH_NODE_ID,
      targetRef: 'account:cash',
      sourceLabel: 'Household cash',
      targetLabel: 'cash (Cash)',
    })
    expect(transferRow?.lineageNotes.length).toBeGreaterThan(0)
    const penalty = model.table.find((row) => row.id === 'use:earlyWithdrawalPenalty:ira-pat')
    expect(penalty?.penaltyClass).toBe('traditionalEarly')
    const meta = model.table.find((row) => row.id === 'tax:tipsPhantomOidIncome:ladder-1')
    expect(meta?.view).toBe('taxCharacter')
    expect(meta?.amountPlanDollars).toBe(250)
    expect(meta?.sourceRef).toBe('ladder:ladder-1')
    expect(meta?.lineageNotes).toEqual([
      { relationship: 'characterizes', lineId: 'source:tipsLadderCash:ladder-1' },
    ])
    const wages = model.table.find((row) => row.id === 'source:wages:w-pat')
    expect(wages?.sourceRef).toBe('incomeStream:w-pat;person:p1')
    expect(wages?.sourceRef).not.toBe(wages?.id)
  })

  it('orders groups by contract role then lexicographic line id, deterministically across runs', () => {
    const plan = twoOwnerPlan()
    const cashFlow = twoOwnerCashFlow()
    const first = ready(plan, cashFlow)
    const second = ready(plan, cashFlow)
    expect(first).toEqual(second)
    expect(JSON.parse(JSON.stringify(first))).toEqual(JSON.parse(JSON.stringify(second)))
    const sourceIds = first.views.cashFlow.nodes.filter((n) => n.side === 'source').map((n) => n.id)
    expect(sourceIds).toEqual([
      'source:wages:w-pat',
      'source:needBasedPortfolioWithdrawal:ira-pat',
      'source:needBasedPortfolioWithdrawal:k-robin',
    ])
    const sides = first.views.cashFlow.nodes.map((n) => n.side)
    expect(sides.indexOf('source')).toBeLessThan(sides.indexOf('hub'))
    expect(sides.indexOf('hub')).toBeLessThan(sides.indexOf('fundedUse'))
    expect(sides.indexOf('fundedUse')).toBeLessThan(sides.indexOf('unfundedOrigin'))
    expect(sides.indexOf('unfundedOrigin')).toBeLessThan(sides.indexOf('unfundedUse'))
  })
})
