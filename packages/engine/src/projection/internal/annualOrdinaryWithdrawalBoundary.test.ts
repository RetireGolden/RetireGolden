import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Account, Plan } from '../../model/plan.js'
import {
  asAccountId,
  asActionId,
  asAllocationId,
  asPersonId,
  asPositiveUsdCents,
  asUsdCents,
  parseRetirementActionRequest,
  type ExecuteOrdinaryWithdrawalsInput,
  type ExecuteOrdinaryWithdrawalsResult,
  type OrdinaryWithdrawalPlanBoundaryAssessment,
  type OrdinaryWithdrawalRequest,
} from '../../actions/index.js'
import { singlePersonPlan } from '../../testing/planFixtures.js'

const seam = vi.hoisted(() => ({
  active: false,
  executorInputs: [] as unknown[],
  executions: [] as unknown[],
  boundaries: [] as unknown[],
}))

vi.mock('../../actions/index.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../actions/index.js')>()
  return {
    ...original,
    executeOrdinaryWithdrawals: (
      input: Parameters<typeof original.executeOrdinaryWithdrawals>[0],
    ) => {
      seam.executorInputs.push(input)
      if (!seam.active) return original.executeOrdinaryWithdrawals(input)
      const execution = seam.executions.shift()
      if (execution === undefined) throw new Error('missing synthetic execution')
      return execution
    },
    assessOrdinaryWithdrawalPlanBoundary: (
      result: Parameters<typeof original.assessOrdinaryWithdrawalPlanBoundary>[0],
    ) => {
      if (!seam.active) return original.assessOrdinaryWithdrawalPlanBoundary(result)
      const boundary = seam.boundaries.shift()
      if (boundary === undefined) throw new Error('missing synthetic boundary')
      return boundary
    },
  }
})

import {
  annualOrdinaryWithdrawalBoundary,
  type AnnualOrdinaryWithdrawalBalanceState,
  type AnnualOrdinaryWithdrawalBoundaryInput,
} from './annualOrdinaryWithdrawalBoundary.js'

const YEAR = 2026
type BalanceAccount = AnnualOrdinaryWithdrawalBalanceState['account']

function cash(id: string, balance = 100): Extract<Account, { type: 'cash' }> {
  return {
    type: 'cash',
    id,
    name: id,
    ownerPersonId: 'p1',
    annualReturnPct: 0,
    balance,
    annualContribution: 0,
  }
}

function taxable(
  id: string,
  balance = 100,
  costBasis = 40,
  ownerPersonId: string | null = 'p1',
): Extract<Account, { type: 'taxable' }> {
  return {
    type: 'taxable',
    id,
    name: id,
    ownerPersonId,
    annualReturnPct: 0,
    balance,
    costBasis,
    annualContribution: 0,
    interestYieldPct: 0,
    dividendYieldPct: 0,
    qualifiedRatio: 0,
    reinvestDividends: true,
  }
}

function equity(
  id: string,
  balance = 100,
  costBasis = 40,
): Extract<Account, { type: 'equityComp' }> {
  return {
    type: 'equityComp',
    id,
    name: id,
    ownerPersonId: 'p1',
    annualReturnPct: 0,
    balance,
    costBasis,
    annualContribution: 0,
    vestingMode: 'final',
    vestDate: null,
  }
}

function state(
  account: BalanceAccount,
  balance = account.balance,
  costBasis = 'costBasis' in account ? account.costBasis : 0,
): AnnualOrdinaryWithdrawalBalanceState {
  return { account, balance, costBasis }
}

function withdrawal(
  id: string,
  accountIds: readonly string[],
  perAllocationCents = 100,
): OrdinaryWithdrawalRequest {
  const perAllocation = asPositiveUsdCents(perAllocationCents)
  return {
    actionId: asActionId(id),
    kind: 'ordinaryWithdrawal',
    personId: asPersonId('p1'),
    year: YEAR,
    executionSequence: 1,
    requestedAmount: asPositiveUsdCents(
      accountIds.length * perAllocationCents,
    ),
    allocations: accountIds.map((accountId, index) => ({
      allocationId: asAllocationId(`${id}-${index}`),
      sourceAccountId: asAccountId(accountId),
      requestedAmount: perAllocation,
    })),
    purpose: { kind: 'spending' },
    provenance: { source: 'manual' },
  }
}

function execution(
  overrides: Partial<ExecuteOrdinaryWithdrawalsResult> = {},
): ExecuteOrdinaryWithdrawalsResult {
  return {
    committed: false,
    requests: [],
    scheduleIssues: [],
    balances: [],
    taxableBases: [],
    evidence: [],
    ...overrides,
  }
}

function boundary(
  overrides: Partial<OrdinaryWithdrawalPlanBoundaryAssessment> = {},
): OrdinaryWithdrawalPlanBoundaryAssessment {
  return {
    unrepresentableClosingBalanceAccountIds: [],
    unrepresentableClosingBasisAccountIds: [],
    aggregateFailureSourceAccountIds: [],
    totals: {
      cash: 0,
      equityCompensation: 0,
      taxableProceeds: 0,
      proceeds: 0,
      capitalGainOrLoss: 0,
    },
    ...overrides,
  }
}

function input(
  overrides: Partial<AnnualOrdinaryWithdrawalBoundaryInput> = {},
): AnnualOrdinaryWithdrawalBoundaryInput {
  const request = withdrawal('withdraw', ['cash'])
  const plan = singlePersonPlan() as Plan
  return {
    year: YEAR,
    plan,
    ordinaryActions: [request],
    executionRequests: [request],
    balances: [state(cash('cash'))],
    taxUnit: {
      taxUnitId: 'tax-unit',
      taxUnitEvidenceId: 'tax-unit-evidence',
      stateFilingStatusId: 'state-single',
      federalFilingStatus: 'single',
      members: [asPersonId('p1')],
    },
    conversionLinkedWithdrawalGroups: { groups: [] },
    actionPersonAliveEvidence: (actionId, personId, actionDate) => ({
      evidenceId: `alive:${actionId}`,
      actionId,
      personId,
      actionYear: YEAR,
      actionDate,
      alive: true,
    }),
    ...overrides,
  }
}

function useSynthetic(
  executions: readonly ExecuteOrdinaryWithdrawalsResult[],
  boundaries: readonly OrdinaryWithdrawalPlanBoundaryAssessment[],
): void {
  seam.active = true
  seam.executions.push(...executions)
  seam.boundaries.push(...boundaries)
}

beforeEach(() => {
  seam.active = false
  seam.executorInputs.length = 0
  seam.executions.length = 0
  seam.boundaries.length = 0
})

describe('annualOrdinaryWithdrawalBoundary — snapshots', () => {
  it('fails loudly before execution when tax-unit evidence violates the boundary contract', () => {
    const validTaxUnit = input().taxUnit
    if (validTaxUnit === null) throw new Error('missing fixture tax unit')

    for (const field of [
      'members',
      'taxUnitId',
      'taxUnitEvidenceId',
      'stateFilingStatusId',
    ] as const) {
      expect(() => annualOrdinaryWithdrawalBoundary(input({
        taxUnit: {
          ...validTaxUnit,
          [field]: null,
        } as unknown as NonNullable<AnnualOrdinaryWithdrawalBoundaryInput['taxUnit']>,
      }))).toThrow('Ordinary-withdrawal tax-unit evidence is malformed')
    }

    expect(seam.executorInputs).toEqual([])
  })

  it('uses strict ordinary actions for sorted source inventory and constructs exact taxable evidence', () => {
    const request = withdrawal('named', [
      'z-cash',
      'a-taxable',
      'unsafe',
      'bad-basis',
      'other-owner',
    ])
    const parsedLegacy = parseRetirementActionRequest({
      actionId: 'legacy',
      kind: 'legacyAggregateWithdrawal',
      year: YEAR,
      requestedAmount: 100,
      legacyCategory: 'cash',
      provenance: { source: 'migration' },
    })
    if (!parsedLegacy.ok) throw new Error(parsedLegacy.issues.join('; '))
    const final = execution()
    useSynthetic([final], [boundary()])
    const balances = [
      state(cash('z-cash', 50)),
      state(taxable('a-taxable', 100, 40)),
      state(cash('unrelated', 75)),
      state(cash('unsafe', 90_071_992_547_410)),
      state(taxable('bad-basis', 80, 90_071_992_547_410)),
      state(taxable('other-owner', 80, 20, 'p2')),
    ]

    const boundaryInput = input({
      ordinaryActions: [request],
      executionRequests: [request, parsedLegacy.request],
      balances,
    })
    const result = annualOrdinaryWithdrawalBoundary(boundaryInput)
    const call = seam.executorInputs[0] as ExecuteOrdinaryWithdrawalsInput

    expect(result.execution).toBe(final)
    expect(call.openingBalances).toEqual([
      { accountId: 'a-taxable', openingBalance: 10_000 },
      { accountId: 'bad-basis', openingBalance: 8_000 },
      { accountId: 'other-owner', openingBalance: 8_000 },
      { accountId: 'z-cash', openingBalance: 5_000 },
    ])
    expect(call.taxableAccountSnapshots).toEqual([{
      accountId: 'a-taxable',
      openingCostBasis: 4_000,
      ownership: {
        accountOwnerPersonIds: ['p1'],
        accountOwnershipEvidenceId:
          'projection-account-ownership:["a-taxable","p1",2026,"single",["p1"]]',
        beneficialOwnershipShare: {
          representation: 'exactRational',
          numerator: 1,
          denominator: 1,
          intermediateArithmetic: 'bigintRational',
        },
        attributionEvidenceId:
          'projection-taxable-attribution:["a-taxable","p1",2026,"single",["p1"]]',
      },
      taxUnit: {
        taxUnitId: 'tax-unit',
        taxUnitMemberPersonIds: ['p1'],
        federalFilingStatus: 'single',
        stateFilingStatusId: 'state-single',
        taxUnitEvidenceId: 'tax-unit-evidence',
        taxYear: YEAR,
      },
    }])
    expect(call.plan).toBe(boundaryInput.plan)
    expect(call.requests).toBe(boundaryInput.executionRequests)
    expect(call.runtimeEvidence?.personAliveEvidence).toEqual([{
      evidenceId: 'alive:named',
      actionId: 'named',
      personId: 'p1',
      actionYear: YEAR,
      actionDate: null,
      alive: true,
    }])
    expect(call.runtimeEvidence?.conversionLinkedWithdrawalGroups).toBe(
      boundaryInput.conversionLinkedWithdrawalGroups,
    )
  })

  it('omits taxable evidence without a complete tax unit but retains balance facts', () => {
    const request = withdrawal('taxable', ['taxable'])
    useSynthetic([execution()], [boundary()])

    annualOrdinaryWithdrawalBoundary(input({
      ordinaryActions: [request],
      executionRequests: [request],
      balances: [state(taxable('taxable'))],
      taxUnit: null,
    }))
    const call = seam.executorInputs[0] as ExecuteOrdinaryWithdrawalsInput
    expect(call.openingBalances).toHaveLength(1)
    expect(call.taxableAccountSnapshots).toEqual([])
  })
})

describe('annualOrdinaryWithdrawalBoundary — retry', () => {
  it('removes each failed fact from its exact scope and returns the final result with carried totals', () => {
    const request = withdrawal('many', ['a-balance', 'b-basis', 'c-aggregate', 'd-safe'])
    const first = execution()
    const final = execution()
    useSynthetic(
      [first, final],
      [
        boundary({
          unrepresentableClosingBalanceAccountIds: [asAccountId('a-balance')],
          unrepresentableClosingBasisAccountIds: [asAccountId('b-basis')],
          aggregateFailureSourceAccountIds: [asAccountId('c-aggregate')],
          totals: {
            cash: 11,
            equityCompensation: null,
            taxableProceeds: 13,
            proceeds: null,
            capitalGainOrLoss: 17,
          },
        }),
        boundary({
          totals: {
            cash: null,
            equityCompensation: 12,
            taxableProceeds: null,
            proceeds: 14,
            capitalGainOrLoss: null,
          },
        }),
      ],
    )

    const result = annualOrdinaryWithdrawalBoundary(input({
      ordinaryActions: [request],
      executionRequests: [request],
      balances: [
        state(cash('a-balance')),
        state(taxable('b-basis')),
        state(taxable('c-aggregate')),
        state(taxable('d-safe')),
      ],
    }))
    const second = seam.executorInputs[1] as ExecuteOrdinaryWithdrawalsInput

    expect(result.execution).toBe(final)
    expect(result.totals).toEqual({
      cash: 11,
      equityCompensation: 12,
      taxableProceeds: 13,
      proceeds: 14,
      capitalGainOrLoss: 17,
    })
    expect(second.openingBalances.map(({ accountId }) => accountId)).toEqual([
      'b-basis',
      'd-safe',
    ])
    expect(second.taxableAccountSnapshots?.map(({ accountId }) => accountId)).toEqual([
      'd-safe',
    ])
  })

  it('retains an exact opening balance when only its independently assessed taxable basis is unsafe', () => {
    // Exact-cent worksheet: a three-cent sale from $100 with
    // $90,071,992,547,409.90 of opening basis leaves exact closing basis cents
    // that cannot round-trip through a Plan number. The balance remains a
    // separate, exactly representable fact, so the retry must retain it while
    // withholding only the independently rejected basis snapshot.
    const account = taxable(
      'basis-only',
      100,
      90_071_992_547_409.9,
    )
    const plan = singlePersonPlan() as Plan
    plan.accounts = [account]
    const request = withdrawal('basis-only-sale', ['basis-only'], 3)

    const result = annualOrdinaryWithdrawalBoundary(input({
      plan,
      ordinaryActions: [request],
      executionRequests: [request],
      balances: [state(account)],
    }))

    expect(seam.executorInputs).toHaveLength(2)
    const first = seam.executorInputs[0] as ExecuteOrdinaryWithdrawalsInput
    const retry = seam.executorInputs[1] as ExecuteOrdinaryWithdrawalsInput
    expect(first.openingBalances).toEqual([{
      accountId: 'basis-only',
      openingBalance: 10_000,
    }])
    expect(first.taxableAccountSnapshots).toHaveLength(1)
    expect(retry.openingBalances).toEqual(first.openingBalances)
    expect(retry.taxableAccountSnapshots).toEqual([])
    expect(result.execution?.committed).toBe(true)
    expect(result.balanceOperations).toEqual([{ kind: 'none' }])
  })
})

describe('annualOrdinaryWithdrawalBoundary — commit operations', () => {
  it('returns one positional operation per balance with paired taxable and proportional equity basis', () => {
    const final = execution({
      committed: true,
      balances: [
        { accountId: asAccountId('cash'), openingBalance: asUsdCents(10_000), closingBalance: asUsdCents(7_500) },
        { accountId: asAccountId('taxable'), openingBalance: asUsdCents(10_000), closingBalance: asUsdCents(5_000) },
        { accountId: asAccountId('equity'), openingBalance: asUsdCents(10_000), closingBalance: asUsdCents(5_000) },
        { accountId: asAccountId('equity-zero'), openingBalance: asUsdCents(0), closingBalance: asUsdCents(100) },
        { accountId: asAccountId('unchanged'), openingBalance: asUsdCents(100), closingBalance: asUsdCents(100) },
      ],
      taxableBases: [{
        accountId: asAccountId('taxable'),
        openingCostBasis: asUsdCents(4_000),
        closingCostBasis: asUsdCents(2_000),
        ownership: {
          accountOwnerPersonIds: [asPersonId('p1')],
          accountOwnershipEvidenceId: 'ownership',
          beneficialOwnershipShare: {
            representation: 'exactRational', numerator: 1, denominator: 1,
            intermediateArithmetic: 'bigintRational',
          },
          attributionEvidenceId: 'attribution',
        },
        taxUnit: {
          taxUnitId: 'unit', taxUnitMemberPersonIds: [asPersonId('p1')],
          federalFilingStatus: 'single', stateFilingStatusId: 'state',
          taxUnitEvidenceId: 'evidence', taxYear: YEAR,
        },
      }],
    })
    useSynthetic([final], [boundary()])
    const balances = [
      state(cash('cash'), 100, 0),
      state(taxable('taxable'), 100, 40),
      state(equity('equity'), 100, 40),
      state(equity('equity-zero', 0, 9), 0, 9),
      state(cash('unchanged'), 1, 0),
      state(cash('unrelated'), 8, 0),
    ]
    const before = balances.map((entry) => ({
      balance: entry.balance,
      costBasis: entry.costBasis,
    }))

    const result = annualOrdinaryWithdrawalBoundary(input({ balances }))

    expect(result.balanceOperations).toEqual([
      { kind: 'write', accountId: 'cash', closingBalance: 75, closingCostBasis: null },
      { kind: 'write', accountId: 'taxable', closingBalance: 50, closingCostBasis: 20 },
      { kind: 'write', accountId: 'equity', closingBalance: 50, closingCostBasis: 20 },
      { kind: 'write', accountId: 'equity-zero', closingBalance: 1, closingCostBasis: null },
      { kind: 'none' },
      { kind: 'none' },
    ])
    expect(result.balanceOperations).toHaveLength(balances.length)
    expect(balances.map((entry) => ({
      balance: entry.balance,
      costBasis: entry.costBasis,
    }))).toEqual(before)
  })

  it('clamps underwater and floating-point full-liquidation equity basis', () => {
    const final = execution({
      committed: true,
      balances: [
        {
          accountId: asAccountId('underwater'),
          openingBalance: asUsdCents(10_000),
          closingBalance: asUsdCents(5_000),
        },
        {
          accountId: asAccountId('fully-liquidated'),
          openingBalance: asUsdCents(14),
          closingBalance: asUsdCents(0),
        },
      ],
      taxableBases: [],
    })
    useSynthetic([final], [boundary()])

    const result = annualOrdinaryWithdrawalBoundary(input({
      balances: [
        state(equity('underwater', 100, 120), 100, 120),
        // 0.11 - 0.14 * (0.11 / 0.14) is a tiny negative IEEE-754 value.
        state(equity('fully-liquidated', 0.14, 0.11), 0.14, 0.11),
      ],
    }))

    expect(result.balanceOperations).toEqual([
      {
        kind: 'write',
        accountId: 'underwater',
        closingBalance: 50,
        closingCostBasis: 70,
      },
      {
        kind: 'write',
        accountId: 'fully-liquidated',
        closingBalance: 0,
        closingCostBasis: 0,
      },
    ])
  })

  it('throws when a committed taxable balance loses its paired basis', () => {
    const final = execution({
      committed: true,
      balances: [{
        accountId: asAccountId('taxable'),
        openingBalance: asUsdCents(10_000),
        closingBalance: asUsdCents(5_000),
      }],
    })
    useSynthetic([final], [boundary()])

    expect(() => annualOrdinaryWithdrawalBoundary(input({
      balances: [state(taxable('taxable'))],
    }))).toThrow('Committed taxable closing balance lost its paired basis')
  })

  it('returns fresh no-op rows without calling the executor for an empty request set', () => {
    const balances = [state(cash('cash'))]
    const first = annualOrdinaryWithdrawalBoundary(input({
      ordinaryActions: [], executionRequests: [], balances,
    }))
    const second = annualOrdinaryWithdrawalBoundary(input({
      ordinaryActions: [], executionRequests: [], balances,
    }))

    expect(seam.executorInputs).toEqual([])
    expect(first.execution).toBeUndefined()
    expect(first.totals).toEqual({
      cash: 0,
      equityCompensation: 0,
      taxableProceeds: 0,
      proceeds: 0,
      capitalGainOrLoss: 0,
    })
    expect(first.balanceOperations).toEqual([{ kind: 'none' }])
    expect(first.balanceOperations).not.toBe(second.balanceOperations)
    expect(first.balanceOperations[0]).not.toBe(second.balanceOperations[0])
  })
})
