import { describe, expect, it } from 'vitest'

import type { Account } from '../../model/plan.js'
import {
  annualWithdrawalApplyFlowPlan,
  type AnnualWithdrawalApplyFlowBalanceState,
} from './annualWithdrawalApplyFlowPlan.js'

function state(
  account: Account,
  balance: number,
  costBasis = 0,
): AnnualWithdrawalApplyFlowBalanceState {
  if (
    account.type !== 'cash' &&
    account.type !== 'taxable' &&
    account.type !== 'equityComp' &&
    account.type !== 'traditional' &&
    account.type !== 'roth' &&
    account.type !== 'hsa'
  ) throw new Error('fixture account is not a balance account')
  return { account, balance, costBasis }
}

function account(
  id: string,
  type: 'cash' | 'taxable' | 'traditional' | 'roth' | 'hsa',
): Account {
  const common = {
    id,
    name: id,
    ownerPersonId: 'owner',
    annualReturnPct: 0,
    balance: 0,
    annualContribution: 0,
  }
  if (type === 'traditional' || type === 'roth') {
    return { ...common, type, kind: 'ira' }
  }
  if (type === 'taxable') return { ...common, type, costBasis: 0 }
  if (type === 'hsa') return { ...common, type }
  return { ...common, type: 'cash' }
}

function equity(id: string): Account {
  return {
    type: 'equityComp',
    id,
    name: id,
    ownerPersonId: 'owner',
    annualReturnPct: 0,
    balance: 0,
    costBasis: 0,
    annualContribution: 0,
    vestingMode: 'final',
    vestDate: null,
  }
}

describe('annualWithdrawalApplyFlowPlan', () => {
  it('returns ordered explicit writes for every balance shape without mutation', () => {
    const balances = [
      state(account('cash', 'cash'), 100),
      state(account('taxable', 'taxable'), 200, 80),
      state(equity('equity'), 100, 30),
      state(account('traditional', 'traditional'), 90),
      state(account('roth', 'roth'), 70),
      state(account('hsa', 'hsa'), 60),
      state(account('untouched', 'cash'), 50),
    ]
    const before = balances.map(({ balance, costBasis }) => ({
      balance,
      costBasis,
    }))
    const applicationChecks: string[] = []
    const result = annualWithdrawalApplyFlowPlan({
      year: 2026,
      balances,
      inheritedEvidence: [],
      withdrawnByAccountId: new Map([
        ['cash', 10],
        ['taxable', 50],
        ['equity', 20],
        ['traditional', 10],
        ['roth', 6],
        ['hsa', 5],
        ['untouched', 0],
      ]),
      taxableSales: new Map([['taxable', {
        remainingCostBasis: 60,
        remainingFairMarketValue: 150,
      }]]),
      recordsOwnedIraApplicationFor: (value) => {
        applicationChecks.push(value.id)
        return value.type === 'traditional' && value.id === 'traditional'
      },
    })

    expect(result.balanceOperations).toEqual([
      expect.objectContaining({
        balanceIndex: 0,
        accountId: 'cash',
        sourceBalanceBefore: 100,
        sourceBalanceAfter: 90,
        costBasisAfter: null,
        recordsTraditionalRuntimeOccurrence: false,
        recordsOwnedIraApplication: false,
      }),
      expect.objectContaining({
        balanceIndex: 1,
        accountId: 'taxable',
        sourceBalanceBefore: 200,
        sourceBalanceAfter: 150,
        costBasisAfter: 60,
        taxableSaleMissing: false,
      }),
      expect.objectContaining({
        balanceIndex: 2,
        accountId: 'equity',
        sourceBalanceBefore: 100,
        sourceBalanceAfter: 80,
        costBasisAfter: 24,
      }),
      expect.objectContaining({
        balanceIndex: 3,
        accountId: 'traditional',
        sourceBalanceBefore: 90,
        sourceBalanceAfter: 80,
        recordsTraditionalRuntimeOccurrence: true,
        recordsOwnedIraApplication: true,
      }),
      expect.objectContaining({
        balanceIndex: 4,
        accountId: 'roth',
        sourceBalanceBefore: 70,
        sourceBalanceAfter: 64,
        recordsTraditionalRuntimeOccurrence: false,
      }),
      expect.objectContaining({
        balanceIndex: 5,
        accountId: 'hsa',
        sourceBalanceBefore: 60,
        sourceBalanceAfter: 55,
      }),
    ])
    expect(balances.map(({ balance, costBasis }) => ({
      balance,
      costBasis,
    }))).toEqual(before)
    expect(applicationChecks).toEqual(['traditional'])
  })

  it('uses last-wins evidence identity and suppresses post-flip S2 voluntary character', () => {
    const inherited = {
      ...account('duplicate', 'traditional'),
      inherited: {
        ownerDeathYear: 2024,
        decedentHadStartedRmds: true,
        beneficiary: {
          beneficiaryClass: 'designated-individual' as const,
          edbCategory: 'surviving-spouse' as const,
          beneficiaryBirthYear: 1970,
          soleBeneficiary: true,
          election: 'treat-as-own' as const,
          ownerBirthYear: 1940,
          ownerYearOfDeathRmdSatisfied: true,
          spouseUnlimitedWithdrawalRight: true,
          treatAsOwnElectionYear: 2026,
          provenance: { source: 'test', asOf: '2026-01-01' },
        },
      },
    }
    const balances = [
      state(account('duplicate', 'cash'), 10),
      state(inherited, 100),
    ]
    const result = annualWithdrawalApplyFlowPlan({
      year: 2026,
      balances,
      inheritedEvidence: [
        { accountId: 'missing' },
        { accountId: 'duplicate' },
      ],
      withdrawnByAccountId: new Map([
        ['missing', 3],
        ['duplicate', 4],
      ]),
      taxableSales: new Map(),
      recordsOwnedIraApplicationFor:
        (value) => value.type === 'traditional',
    })

    expect(result.evidenceWrites).toEqual([{
      evidenceIndex: 0,
      accountId: 'missing',
      voluntaryAmount: 3,
    }])
    expect(result.balanceOperations.map((operation) => ({
      balanceIndex: operation.balanceIndex,
      accountId: operation.accountId,
      before: operation.sourceBalanceBefore,
      after: operation.sourceBalanceAfter,
      application: operation.recordsOwnedIraApplication,
    }))).toEqual([
      {
        balanceIndex: 0,
        accountId: 'duplicate',
        before: 10,
        after: 6,
        application: false,
      },
      {
        balanceIndex: 1,
        accountId: 'duplicate',
        before: 100,
        after: 96,
        application: true,
      },
    ])
  })

  it('returns a missing-sale operation for caller-timed failure and fresh outputs', () => {
    const input = {
      year: 2026,
      balances: [state(account('taxable', 'taxable'), 100, 40)],
      inheritedEvidence: [{ accountId: 'taxable' }],
      withdrawnByAccountId: new Map([['taxable', 10]]),
      taxableSales: new Map(),
      recordsOwnedIraApplicationFor: () => false,
    }
    const first = annualWithdrawalApplyFlowPlan(input)
    const second = annualWithdrawalApplyFlowPlan(input)

    expect(first.balanceOperations[0]).toMatchObject({
      taxableSaleMissing: true,
      sourceBalanceBefore: 100,
      sourceBalanceAfter: 100,
      costBasisAfter: null,
    })
    expect(second).toEqual(first)
    expect(second).not.toBe(first)
    expect(second.balanceOperations).not.toBe(first.balanceOperations)
    expect(second.balanceOperations[0]).not.toBe(first.balanceOperations[0])
    expect(second.evidenceWrites[0]).not.toBe(first.evidenceWrites[0])
  })

  it('shadows repeated state identity in the same subtraction order', () => {
    const repeated = state(account('same', 'traditional'), 10)
    const result = annualWithdrawalApplyFlowPlan({
      year: 2026,
      balances: [repeated, repeated],
      inheritedEvidence: [],
      withdrawnByAccountId: new Map([['same', 3]]),
      taxableSales: new Map(),
      recordsOwnedIraApplicationFor: () => true,
    })

    expect(result.balanceOperations.map((operation) => [
      operation.sourceBalanceBefore,
      operation.sourceBalanceAfter,
    ])).toEqual([[10, 7], [7, 4]])
  })

  it('preserves the original equity-basis arithmetic association exactly', () => {
    const result = annualWithdrawalApplyFlowPlan({
      year: 2026,
      balances: [state(equity('fp-equity'), 0.1, 0.01)],
      inheritedEvidence: [],
      withdrawnByAccountId: new Map([['fp-equity', 0.03]]),
      taxableSales: new Map(),
      recordsOwnedIraApplicationFor: () => false,
    })
    const originalAssociation =
      0.01 - 0.03 * Math.min(1, 0.01 / 0.1)
    const regrouped = 0.01 * (1 - 0.03 / 0.1)

    expect(originalAssociation).toBe(0.007000000000000001)
    expect(regrouped).toBe(0.006999999999999999)
    expect(originalAssociation).not.toBe(regrouped)
    expect(result.balanceOperations[0]?.costBasisAfter)
      .toBe(originalAssociation)
  })
})
