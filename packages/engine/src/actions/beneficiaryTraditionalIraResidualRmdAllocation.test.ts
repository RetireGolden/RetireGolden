import { describe, expect, it } from 'vitest'

import { describeRule } from '../rules/describeRule.js'
import {
  prepareBeneficiaryTraditionalIraResidualRmdAllocation,
  type PrepareBeneficiaryTraditionalIraResidualRmdAllocationInput,
} from './beneficiaryTraditionalIraResidualRmdAllocation.js'
import type {
  BeneficiaryTraditionalIraDetachedRmdTransition,
  BeneficiaryTraditionalIraDetachedSourceBalanceTransition,
} from './beneficiaryTraditionalIraAnnualPhysicalTransaction.js'
import { asAccountId, asPersonId } from './identity.js'
import { asUsdCents } from './money.js'
import { deriveActionStructuralId } from './structuralId.js'

const beneficiaryPersonId = asPersonId('beneficiary')
const decedentPersonId = asPersonId('decedent')

function rmd(
  overrides: Partial<BeneficiaryTraditionalIraDetachedRmdTransition> = {},
): BeneficiaryTraditionalIraDetachedRmdTransition {
  const {
    transitionEvidenceId: suppliedTransitionEvidenceId,
    ...fieldOverrides
  } = overrides
  const transition = {
    predicate: 'beneficiaryTraditionalIraDetachedRmdTransition',
    beneficiaryPersonId,
    decedentPersonId,
    taxYear: 2026,
    rmdPoolId: 'pool:beneficiary:decedent',
    rmdRequiredAmount: asUsdCents(10_000),
    initialRmdSatisfiedAmount: asUsdCents(1_000),
    rmdSatisfiedByTransaction: asUsdCents(4_000),
    finalRmdSatisfiedAmount: asUsdCents(5_000),
    finalRmdRemainingAmount: asUsdCents(5_000),
    applicationEvidenceIds: ['application:a', 'application:b'],
    finalAnnualEvidenceId: 'annual:final',
    coordinatorEvidenceId: 'coordinator',
    ...fieldOverrides,
  } satisfies Omit<
    BeneficiaryTraditionalIraDetachedRmdTransition,
    'transitionEvidenceId'
  >
  return {
    ...transition,
    transitionEvidenceId: suppliedTransitionEvidenceId ??
      deriveActionStructuralId(
        'beneficiary-ira-detached-rmd-transition',
        [transition],
      ),
  }
}

function source(
  id: string,
  opening: number,
  executed: number,
  applicationEvidenceId: string,
  overrides:
    Partial<BeneficiaryTraditionalIraDetachedSourceBalanceTransition> = {},
): BeneficiaryTraditionalIraDetachedSourceBalanceTransition {
  const {
    transitionEvidenceId: suppliedTransitionEvidenceId,
    ...fieldOverrides
  } = overrides
  const transition = {
    predicate:
      'beneficiaryTraditionalIraDetachedSourceBalanceTransition',
    beneficiaryPersonId,
    decedentPersonId,
    taxYear: 2026,
    sourceAccountId: asAccountId(id),
    annualOpeningBalanceAmount: asUsdCents(opening),
    totalExecutedAmount: asUsdCents(executed),
    annualFinalBalanceAmount: asUsdCents(opening - executed),
    applicationEvidenceIds: [applicationEvidenceId],
    finalAnnualEvidenceId: 'annual:final',
    coordinatorEvidenceId: 'coordinator',
    ...fieldOverrides,
  } satisfies Omit<
    BeneficiaryTraditionalIraDetachedSourceBalanceTransition,
    'transitionEvidenceId'
  >
  return {
    ...transition,
    transitionEvidenceId: suppliedTransitionEvidenceId ??
      deriveActionStructuralId(
        'beneficiary-ira-detached-source-balance-transition',
        [transition],
      ),
  }
}

function input(
  overrides: Partial<PrepareBeneficiaryTraditionalIraResidualRmdAllocationInput> = {},
): PrepareBeneficiaryTraditionalIraResidualRmdAllocationInput {
  return {
    rmdTransition: rmd(),
    sourceBalanceTransitions: [
      source('account:b', 7_000, 2_000, 'application:b'),
      source('account:a', 4_000, 2_000, 'application:a'),
    ],
    ...overrides,
  }
}

function rederiveRawTransition(
  transition: Record<string, unknown>,
  prefix:
    | 'beneficiary-ira-detached-rmd-transition'
    | 'beneficiary-ira-detached-source-balance-transition',
): void {
  const withoutId = { ...transition }
  Reflect.deleteProperty(withoutId, 'transitionEvidenceId')
  transition['transitionEvidenceId'] =
    deriveActionStructuralId(prefix, [withoutId])
}

describe('prepareBeneficiaryTraditionalIraResidualRmdAllocation', () => {
  // Treas. Reg. 1.408-8(e)(4)(i): each IRA distributes "a proportionate share of
  // the shortfall ... based on the account balances". With balances of 2,000c
  // and 5,000c against a 5,000c residual, the first account's proportionate
  // share is 5000 * 2000 / 7000 = 1,428.57c, which the largest-remainder split
  // rounds to 1,429c. Draining the lowest account id first would instead take
  // that account's whole 2,000c balance.
  describeRule('treas-reg-1-408-8-e-4-i-year-of-death-proportionate-shortfall', {
    readings: { proportionateByBalance: 1_429, drainLowestAccountIdFirst: 2_000 },
    accepted: 'proportionateByBalance',
  }, ({ accepted, readings }) => {
    it('splits the residual by balance rather than by account order', () => {
      const result = prepareBeneficiaryTraditionalIraResidualRmdAllocation(input())
      expect(result.status).toBe('residualRmdAllocationPrepared')
      if (result.status !== 'residualRmdAllocationPrepared') return
      expect(result.sourceAllocations[0]?.allocatedAmount).toBe(accepted)
      expect(result.sourceAllocations[0]?.allocatedAmount)
        .not.toBe(readings.drainLowestAccountIdFirst)
    })
  })

  it('counts identity actions first and allocates the residual proportionately to account balances', () => {
    const result =
      prepareBeneficiaryTraditionalIraResidualRmdAllocation(input())

    expect(result).toMatchObject({
      status: 'residualRmdAllocationPrepared',
      movement: 'notCommitted',
      committed: false,
      actionability: 'notEstablished',
      allocationPolicy: 'balanceProportionateLargestRemainder',
      rmdRequiredAmount: 10_000,
      rmdSatisfiedBeforeResidual: 5_000,
      residualRmdRequiredAmount: 5_000,
      residualRmdAllocatedAmount: 5_000,
      rmdSatisfiedAfterResidual: 10_000,
      residualRmdUnallocatedAmount: 0,
      residualRequirementSatisfied: true,
    })
    if (result.status !== 'residualRmdAllocationPrepared') return
    expect(result.sourceAllocations).toEqual([
      expect.objectContaining({
        sourceAccountId: 'account:a',
        sourceBalanceBefore: 2_000,
        allocatedAmount: 1_429,
        sourceBalanceAfter: 571,
        residualRmdBefore: 5_000,
        residualRmdAfter: 3_571,
      }),
      expect.objectContaining({
        sourceAccountId: 'account:b',
        sourceBalanceBefore: 5_000,
        allocatedAmount: 3_571,
        sourceBalanceAfter: 1_429,
        residualRmdBefore: 3_571,
        residualRmdAfter: 0,
      }),
    ])
    expect(result.sourceBalanceTransitionEvidenceIds).toEqual([
      input().sourceBalanceTransitions[1]!.transitionEvidenceId,
      input().sourceBalanceTransitions[0]!.transitionEvidenceId,
    ])
  })

  it('is invariant to source array order, including structural evidence IDs', () => {
    const original =
      prepareBeneficiaryTraditionalIraResidualRmdAllocation(input())
    const reversed = prepareBeneficiaryTraditionalIraResidualRmdAllocation(
      input({
        sourceBalanceTransitions: [...input().sourceBalanceTransitions]
          .reverse(),
      }),
    )

    expect(reversed).toEqual(original)
  })

  it('emits no residual allocation when explicit actions already satisfy the requirement', () => {
    const result = prepareBeneficiaryTraditionalIraResidualRmdAllocation(
      input({
        rmdTransition: rmd({
          rmdRequiredAmount: asUsdCents(5_000),
          finalRmdRemainingAmount: asUsdCents(0),
        }),
      }),
    )

    expect(result).toMatchObject({
      status: 'residualRmdAllocationPrepared',
      residualRmdRequiredAmount: 0,
      residualRmdAllocatedAmount: 0,
      rmdSatisfiedAfterResidual: 5_000,
      residualRmdUnallocatedAmount: 0,
      residualRequirementSatisfied: true,
      sourceAllocations: [],
    })
  })

  it('preserves a visible unallocated remainder when the pool lacks capacity', () => {
    const result = prepareBeneficiaryTraditionalIraResidualRmdAllocation(
      input({
        sourceBalanceTransitions: [
          source('account:b', 1_000, 500, 'application:b'),
          source('account:a', 2_000, 1_000, 'application:a'),
        ],
      }),
    )

    expect(result).toMatchObject({
      status: 'residualRmdAllocationPrepared',
      residualRmdRequiredAmount: 5_000,
      residualRmdAllocatedAmount: 1_500,
      rmdSatisfiedAfterResidual: 6_500,
      residualRmdUnallocatedAmount: 3_500,
      residualRequirementSatisfied: false,
    })
  })

  it.each([
    {
      name: 'broken RMD arithmetic',
      mutate: (value: Record<string, unknown>) => {
        const transition = value['rmdTransition'] as Record<string, unknown>
        transition['finalRmdRemainingAmount'] = 4_999
      },
    },
    {
      name: 'forged RMD transition lineage with locally valid arithmetic',
      mutate: (value: Record<string, unknown>) => {
        const transition = value['rmdTransition'] as Record<string, unknown>
        transition['rmdRequiredAmount'] = 11_000
        transition['finalRmdRemainingAmount'] = 6_000
      },
    },
    {
      name: 'foreign pool source',
      mutate: (value: Record<string, unknown>) => {
        const sources = value['sourceBalanceTransitions'] as
          Record<string, unknown>[]
        sources[0]!['decedentPersonId'] = 'other-decedent'
      },
    },
    {
      name: 'incomplete application lineage',
      mutate: (value: Record<string, unknown>) => {
        const transition = value['rmdTransition'] as Record<string, unknown>
        transition['applicationEvidenceIds'] = ['application:a']
      },
    },
    {
      name: 'forged source transition lineage with locally valid arithmetic',
      mutate: (value: Record<string, unknown>) => {
        const sources = value['sourceBalanceTransitions'] as
          Record<string, unknown>[]
        sources[0]!['annualOpeningBalanceAmount'] = 8_000
        sources[0]!['annualFinalBalanceAmount'] = 6_000
      },
    },
    {
      name: 'duplicate source identity',
      mutate: (value: Record<string, unknown>) => {
        const sources = value['sourceBalanceTransitions'] as
          Record<string, unknown>[]
        sources[1]!['sourceAccountId'] = sources[0]!['sourceAccountId']
      },
    },
    {
      name: 'unknown nested treatment field',
      mutate: (value: Record<string, unknown>) => {
        const sources = value['sourceBalanceTransitions'] as
          Record<string, unknown>[]
        sources[0]!['taxableAmount'] = 1
      },
    },
    {
      name: 'RMD and source transition cross-role ID reuse',
      mutate: (value: Record<string, unknown>) => {
        const rmdTransition = value['rmdTransition'] as Record<string, unknown>
        const sources = value['sourceBalanceTransitions'] as
          Record<string, unknown>[]
        rmdTransition['rmdPoolId'] =
          sources[0]!['transitionEvidenceId']
        rederiveRawTransition(
          rmdTransition,
          'beneficiary-ira-detached-rmd-transition',
        )
      },
    },
    {
      name: 'application and annual evidence cross-role ID reuse',
      mutate: (value: Record<string, unknown>) => {
        const rmdTransition = value['rmdTransition'] as Record<string, unknown>
        const ids = rmdTransition['applicationEvidenceIds'] as string[]
        rmdTransition['finalAnnualEvidenceId'] = ids[0]
        const sources = value['sourceBalanceTransitions'] as
          Record<string, unknown>[]
        for (const sourceTransition of sources) {
          sourceTransition['finalAnnualEvidenceId'] = ids[0]
          rederiveRawTransition(
            sourceTransition,
            'beneficiary-ira-detached-source-balance-transition',
          )
        }
        rederiveRawTransition(
          rmdTransition,
          'beneficiary-ira-detached-rmd-transition',
        )
      },
    },
    {
      name: 'source transition and account cross-role ID reuse',
      mutate: (value: Record<string, unknown>) => {
        const sources = value['sourceBalanceTransitions'] as
          Record<string, unknown>[]
        const rmdTransition = value['rmdTransition'] as Record<string, unknown>
        sources[0]!['sourceAccountId'] =
          rmdTransition['transitionEvidenceId']
        rederiveRawTransition(
          sources[0]!,
          'beneficiary-ira-detached-source-balance-transition',
        )
      },
    },
  ])('fails closed for $name', ({ mutate }) => {
    const hostile = structuredClone(input()) as unknown as
      Record<string, unknown>
    mutate(hostile)

    expect(prepareBeneficiaryTraditionalIraResidualRmdAllocation(
      hostile as unknown as PrepareBeneficiaryTraditionalIraResidualRmdAllocationInput,
    )).toEqual({
      status: 'unsupported',
      movement: 'notCommitted',
      committed: false,
      actionability: 'notEstablished',
      reasons: [{
        code: 'withdrawal-inherited-facts-missing',
        message: expect.any(String),
        outcome: 'unsupported',
        predicate: 'inheritedWithdrawalEligibility',
      }],
      sourceAllocations: [],
      allocationEvidenceId: null,
    })
  })

  it('returns detached, immutable evidence', () => {
    const result =
      prepareBeneficiaryTraditionalIraResidualRmdAllocation(input())

    expect(Object.isFrozen(result)).toBe(true)
    if (result.status !== 'residualRmdAllocationPrepared') return
    expect(Object.isFrozen(result.sourceAllocations)).toBe(true)
    expect(Object.isFrozen(result.sourceAllocations[0])).toBe(true)
  })
})
