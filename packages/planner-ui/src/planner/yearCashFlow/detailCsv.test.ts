import { describe, expect, it } from 'vitest'

import type { Plan } from '@retiregolden/engine/model/plan'
import type { AccountId, PersonId } from '@retiregolden/engine/actions/identity'
import type {
  YearCashFlow,
  YearCashFlowReconciliation,
  YearResult,
} from '@retiregolden/engine/projection/types'
import {
  cashAccount,
  couplePlan,
  traditionalAccount,
  validatePlan,
} from '@retiregolden/engine/testing/planFixtures'

import { buildYearCashFlowSankey } from './buildYearCashFlow'
import {
  YEAR_CASH_FLOW_DETAIL_CSV_COLUMNS,
  serializeYearCashFlowDetailCsv,
} from './detailCsv'

const personId = (id: string): PersonId => id as PersonId
const accountId = (id: string): AccountId => id as AccountId

function reconciled(): YearCashFlowReconciliation {
  return {
    status: 'reconciled',
    tolerancePlanDollars: 1e-6,
    cash: {
      spendableSourcesPlanDollars: 1_000,
      portfolioFundingPlanDollars: 0,
      loanProceedsPlanDollars: 0,
      sourceTotalPlanDollars: 1_000,
      fundedHouseholdUsesPlanDollars: 1_000,
      settledTaxPlanDollars: 0,
      penaltiesPlanDollars: 0,
      contributionsPlanDollars: 0,
      surplusInvestmentPlanDollars: 0,
      destinationTotalPlanDollars: 1_000,
      differencePlanDollars: 0,
    },
    uses: {
      requestedUsesPlanDollars: 1_000,
      fundedUsesPlanDollars: 1_000,
      unfundedUsesPlanDollars: 0,
      dispositionTotalPlanDollars: 1_000,
      differencePlanDollars: 0,
    },
    transfers: { debitsPlanDollars: 0, creditsPlanDollars: 0, differencePlanDollars: 0 },
    reasonCodes: [],
    diagnostics: [],
  }
}

function csvPlan(): Plan {
  const plan = couplePlan({ p1PlanningAge: 95, p2PlanningAge: 95 })
  plan.accounts = [
    { ...traditionalAccount('ira-pat', 400_000, 'p1', 'ira'), name: 'Rollover "IRA", primary' },
    cashAccount('cash', 20_000),
  ]
  plan.incomes = [
    {
      type: 'wages',
      id: 'w-pat',
      personId: 'p1',
      annualGross: 1_000,
      endAge: null,
      realGrowthPct: 0,
    },
  ]
  return validatePlan(plan)
}

function csvCashFlow(): YearCashFlow {
  return {
    sourceLines: [
      {
        id: 'source:wages:w-pat',
        kind: 'wages',
        role: 'spendableSource',
        amountPlanDollars: 1_000,
        identities: [
          { entityKind: 'incomeStream', incomeStreamId: 'w-pat' },
          { entityKind: 'person', personId: personId('p1') },
        ],
        taxCharacter: [{ kind: 'ordinaryIncome', amountPlanDollars: 1_000 }],
      },
    ],
    useLines: [
      {
        id: 'use:requiredLifestyle:household',
        kind: 'requiredLifestyle',
        requestedPlanDollars: 1_000,
        fundedPlanDollars: 1_000,
        unfundedPlanDollars: 0,
        identities: [],
      },
    ],
    transferLines: [],
    taxCharacterMetadata: [],
    reconciliation: reconciled(),
  }
}

describe('serializeYearCashFlowDetailCsv', () => {
  it('emits the documented columns, a reconciliation summary row, then one row per line', () => {
    const model = buildYearCashFlowSankey(csvPlan(), { year: 2031, cashFlow: csvCashFlow() } as YearResult)
    const csv = serializeYearCashFlowDetailCsv(model)
    const lines = csv.trimEnd().split('\n')
    expect(lines[0]).toBe(YEAR_CASH_FLOW_DETAIL_CSV_COLUMNS.join(','))
    expect(lines[1]).toBe('2031,reconciliation,summary,,,,,,,,,,,,,,reconciled')
    expect(lines).toHaveLength(4)
    expect(lines[2]).toContain('source:wages:w-pat')
    expect(lines[2]).toContain('cashFlow')
    expect(lines[2]).toContain('wages')
    expect(lines[2]).toContain('incomeStream:w-pat;person:p1')
    expect(lines[2]).toContain('householdCash')
    expect(lines[2]).toContain('1000')
    expect(lines[2]).toContain('ordinaryIncome:1000')
    expect(YEAR_CASH_FLOW_DETAIL_CSV_COLUMNS).toContain('lineId')
    expect(lines[2].split(',')[3]).toBe('source:wages:w-pat')
    expect(lines[2].split(',')[4]).not.toBe('source:wages:w-pat')
    expect(lines[3]).toContain('use:requiredLifestyle:household')
    expect(lines[3]).toContain('1000,1000,1000,0')
  })

  it('neutralizes a formula-like account label so the serialized cell cannot execute', () => {
    const plan = csvPlan()
    plan.accounts = [...plan.accounts, { ...cashAccount('hostile', 1), name: '=SUM(A1)' }]
    const cashFlow: YearCashFlow = {
      ...csvCashFlow(),
      sourceLines: [
        {
          id: 'source:needBasedPortfolioWithdrawal:hostile',
          kind: 'needBasedPortfolioWithdrawal',
          role: 'portfolioFunding',
          amountPlanDollars: 1_000,
          identities: [{ entityKind: 'account', accountId: accountId('hostile') }],
        },
      ],
    }
    const model = buildYearCashFlowSankey(validatePlan(plan), { year: 2031, cashFlow } as YearResult)
    const csv = serializeYearCashFlowDetailCsv(model)
    const labelCell = csv
      .trimEnd()
      .split('\n')
      .find((line) => line.includes('source:needBasedPortfolioWithdrawal:hostile'))
      ?.split(',')[6]
    expect(labelCell).toBe("'=SUM(A1) (Cash)")
    expect(csv).not.toMatch(/(?:^|,)=SUM\(A1\)/)
  })

  it('csvEscape\'s hostile labels the same way inheritedCsv does', () => {
    const plan = csvPlan()
    const cashFlow: YearCashFlow = {
      ...csvCashFlow(),
      sourceLines: [
        {
          id: 'source:needBasedPortfolioWithdrawal:ira-pat',
          kind: 'needBasedPortfolioWithdrawal',
          role: 'portfolioFunding',
          amountPlanDollars: 1_000,
          identities: [{ entityKind: 'account', accountId: accountId('ira-pat') }],
        },
      ],
    }
    const model = buildYearCashFlowSankey(plan, { year: 2031, cashFlow } as YearResult)
    const csv = serializeYearCashFlowDetailCsv(model)
    expect(csv).toContain('"Pat - Rollover ""IRA"", primary (IRA)"')
    expect(csv).not.toMatch(/,Pat - Rollover "IRA", primary/)
  })

  it('serializes characterizes lineage for standalone tax-character metadata rows', () => {
    const plan = csvPlan()
    const cashFlow: YearCashFlow = {
      ...csvCashFlow(),
      taxCharacterMetadata: [
        {
          id: 'tax:tipsPhantomOidIncome:ladder-1',
          taxCharacter: { kind: 'tipsPhantomOidIncome', amountPlanDollars: 250 },
          identities: [{ entityKind: 'tipsLadder', ladderId: 'ladder-1' }],
          relatedLineId: 'source:tipsLadderCash:ladder-1',
        },
      ],
    }
    const model = buildYearCashFlowSankey(plan, { year: 2031, cashFlow } as YearResult)
    const csv = serializeYearCashFlowDetailCsv(model)
    const row = csv
      .trimEnd()
      .split('\n')
      .find((line) => line.includes('tax:tipsPhantomOidIncome:ladder-1'))
    expect(row).toBeDefined()
    const lineageCell = row!.split(',')[15]
    expect(lineageCell).toBe('characterizes>source:tipsLadderCash:ladder-1')
  })

  it('emits header plus reconciliation summary only for an unavailable year', () => {
    const missing = serializeYearCashFlowDetailCsv(
      buildYearCashFlowSankey(csvPlan(), { year: 2031 } as unknown as YearResult),
    )
    expect(missing.trimEnd().split('\n')).toEqual([
      YEAR_CASH_FLOW_DETAIL_CSV_COLUMNS.join(','),
      '2031,reconciliation,summary,,,,,,,,,,,,,,notCaptured',
    ])

    const failed = serializeYearCashFlowDetailCsv(
      buildYearCashFlowSankey(csvPlan(), {
        year: 2031,
        cashFlow: {
          ...csvCashFlow(),
          reconciliation: {
            ...reconciled(),
            status: 'notReconciled',
            reasonCodes: ['cashIdentityMismatch', 'invalidAmount'],
            diagnostics: [{ reasonCode: 'cashIdentityMismatch', lineIds: ['source:wages:w-pat'] }],
          },
        },
      } as unknown as YearResult),
    )
    expect(failed).toContain('notReconciled')
    expect(failed).toContain('cashIdentityMismatch;invalidAmount')
    expect(failed.trimEnd().split('\n')).toHaveLength(2)
    expect(failed).not.toContain('source:wages:w-pat')
  })
})
