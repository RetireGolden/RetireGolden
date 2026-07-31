import { describe, expect, it } from 'vitest'

import {
  asAccountId,
  asActionId,
  asAllocationId,
  asPersonId,
} from './identity.js'
import { asUsdCents } from './money.js'
import type { AnnualIraBasisAllocationEntryInput } from './annualIraBasisAllocation.js'
import {
  classifyOwnedNonRothIraAnnualWithdrawals,
  type ClassifyOwnedNonRothIraAnnualWithdrawalsInput,
  type OwnedNonRothIraPoolMemberEvidence,
} from './ownedNonRothIraWithdrawalCharacter.js'

function member(
  suffix: string,
  subtype: 'traditional' | 'sep' | 'simple',
): OwnedNonRothIraPoolMemberEvidence {
  return {
    sourceAccountId: asAccountId(`ira-${suffix}`),
    ownerPersonId: asPersonId('owner'),
    accountType: 'traditional',
    accountKind: 'ira',
    inheritanceStatus: 'owned',
    subtype,
    yearEndApplicableBalanceAmount: asUsdCents(1),
    iraClassificationEvidenceId: `classification-${suffix}`,
    accountOwnershipEvidenceId: `ownership-${suffix}`,
  }
}

function activity(
  suffix: string,
  sourceAccountId: string,
  grossAmount = 1,
  scheduledDate: string | null = '2030-06-01',
): AnnualIraBasisAllocationEntryInput {
  return {
    actionId: asActionId(`action-${suffix}`),
    allocationId: asAllocationId(`allocation-${suffix}`),
    sourceAccountId: asAccountId(sourceAccountId),
    scheduledDate,
    scheduledSequence: 1,
    grossAmount: asUsdCents(grossAmount),
  }
}

function input(
  overrides: Partial<ClassifyOwnedNonRothIraAnnualWithdrawalsInput> = {},
): ClassifyOwnedNonRothIraAnnualWithdrawalsInput {
  return {
    ownerPersonId: asPersonId('owner'),
    ownerWideNonRothIraPoolId: 'owner-pool',
    completePoolEvidence: {
      predicate: 'completeOwnedNonRothIraPoolForOwnerAndTaxYear',
      ownerPersonId: asPersonId('owner'),
      ownerWideNonRothIraPoolId: 'owner-pool',
      taxYear: 2030,
      accountIds: [
        asAccountId('ira-traditional'),
        asAccountId('ira-sep'),
        asAccountId('ira-simple'),
      ],
      yearEndApplicablePoolBalanceAmount: asUsdCents(3),
      evidenceId: 'complete-pool-evidence',
    },
    annualBasisRecordEvidenceId: 'annual-basis-record',
    taxYear: 2030,
    poolMembers: [
      member('traditional', 'traditional'),
      member('sep', 'sep'),
      member('simple', 'simple'),
    ],
    annualFacts: {
      openingBasisAmount: asUsdCents(3),
      taxYearNondeductibleContributionAmount: asUsdCents(0),
      postYearNondeductibleContributionExcludedAmount: asUsdCents(0),
      yearEndApplicablePoolBalanceAmount: asUsdCents(3),
      outstandingRolloverAmount: asUsdCents(0),
      rolloverRepaymentAdjustmentAmount: asUsdCents(0),
      form8606Line7DistributionAmount: asUsdCents(3),
      form8606Line8NetConversionAmount: asUsdCents(0),
    },
    line7Distributions: [
      activity('traditional', 'ira-traditional', 1, '2030-01-01'),
      activity('sep', 'ira-sep', 1, '2030-02-01'),
      activity('simple', 'ira-simple', 1, null),
    ],
    line8Conversions: [],
    ...overrides,
  }
}

describe('classifyOwnedNonRothIraAnnualWithdrawals', () => {
  it('uses one owner-wide ratio across traditional, SEP, and SIMPLE IRAs', () => {
    const result = classifyOwnedNonRothIraAnnualWithdrawals(input())

    expect(result.annualBasisEvidence.annualBasisRatio).toEqual({
      representation: 'exactMinorUnitRational',
      numeratorMinorUnits: 3,
      denominatorMinorUnits: 6,
      intermediateArithmetic: 'bigintRational',
    })
    expect(result.line7AllocationEvidence.annualNontaxableBasisAmount).toBe(2)
    expect(result.withdrawals.map((item) => item.subtype)).toEqual([
      'traditional',
      'sep',
      'simple',
    ])
    expect(result.withdrawals.map((item) => item.basisRecoveredAmount)).toEqual([
      1, 1, 0,
    ])
    expect(result.withdrawals[0]?.taxCharacter.map((item) => item.kind)).toEqual([
      'basisReturn',
    ])
    expect(result.withdrawals[2]?.taxCharacter.map((item) => item.kind)).toEqual([
      'ordinaryIncome',
    ])
  })

  it('derives the complete Form 8606 numerator, line 6, and denominator', () => {
    const result = classifyOwnedNonRothIraAnnualWithdrawals(
      input({
        poolMembers: [
          {
            ...member('traditional', 'traditional'),
            yearEndApplicableBalanceAmount: asUsdCents(100),
          },
          {
            ...member('sep', 'sep'),
            yearEndApplicableBalanceAmount: asUsdCents(50),
          },
          {
            ...member('simple', 'simple'),
            yearEndApplicableBalanceAmount: asUsdCents(50),
          },
        ],
        completePoolEvidence: {
          ...input().completePoolEvidence,
          yearEndApplicablePoolBalanceAmount: asUsdCents(200),
        },
        annualFacts: {
          openingBasisAmount: asUsdCents(100),
          taxYearNondeductibleContributionAmount: asUsdCents(20),
          postYearNondeductibleContributionExcludedAmount: asUsdCents(5),
          yearEndApplicablePoolBalanceAmount: asUsdCents(200),
          outstandingRolloverAmount: asUsdCents(10),
          rolloverRepaymentAdjustmentAmount: asUsdCents(5),
          form8606Line7DistributionAmount: asUsdCents(10),
          form8606Line8NetConversionAmount: asUsdCents(5),
        },
        line7Distributions: [
          activity('traditional', 'ira-traditional', 10),
        ],
        line8Conversions: [
          activity('conversion', 'ira-sep', 5, '2030-07-01'),
        ],
      }),
    )

    expect(result.annualBasisEvidence.basisNumeratorAmount).toBe(115)
    expect(
      result.annualBasisEvidence.line6AdjustedYearEndAndRolloverAmount,
    ).toBe(205)
    expect(result.annualBasisEvidence.annualBasisDenominatorAmount).toBe(220)
    expect(result.annualBasisEvidence.annualBasisRatio).toMatchObject({
      numeratorMinorUnits: 115,
      denominatorMinorUnits: 220,
    })
    expect(result.line7AllocationEvidence.annualNontaxableBasisAmount).toBe(5)
    expect(result.line8AllocationEvidence.annualNontaxableBasisAmount).toBe(3)
  })

  it('caps the basis numerator at the denominator', () => {
    const result = classifyOwnedNonRothIraAnnualWithdrawals(
      input({
        annualFacts: {
          ...input().annualFacts,
          openingBasisAmount: asUsdCents(100),
        },
      }),
    )

    expect(result.annualBasisEvidence.basisNumeratorAmount).toBe(100)
    expect(result.annualBasisEvidence.annualBasisRatio).toMatchObject({
      numeratorMinorUnits: 6,
      denominatorMinorUnits: 6,
    })
    expect(result.withdrawals.every((item) => item.ordinaryIncomeAmount === 0)).toBe(
      true,
    )
  })

  it('preserves unused basis in the zero-denominator no-character arm', () => {
    const result = classifyOwnedNonRothIraAnnualWithdrawals(
      input({
        poolMembers: input().poolMembers.map((poolMember) => ({
          ...poolMember,
          yearEndApplicableBalanceAmount: asUsdCents(0),
        })),
        completePoolEvidence: {
          ...input().completePoolEvidence,
          yearEndApplicablePoolBalanceAmount: asUsdCents(0),
        },
        annualFacts: {
          openingBasisAmount: asUsdCents(100),
          taxYearNondeductibleContributionAmount: asUsdCents(0),
          postYearNondeductibleContributionExcludedAmount: asUsdCents(0),
          yearEndApplicablePoolBalanceAmount: asUsdCents(0),
          outstandingRolloverAmount: asUsdCents(0),
          rolloverRepaymentAdjustmentAmount: asUsdCents(0),
          form8606Line7DistributionAmount: asUsdCents(0),
          form8606Line8NetConversionAmount: asUsdCents(0),
        },
        line7Distributions: [],
      }),
    )

    expect(result.annualBasisEvidence.basisNumeratorAmount).toBe(100)
    expect(result.annualBasisEvidence.annualBasisRatio.representation).toBe(
      'notApplicableZeroDenominator',
    )
    expect(result.withdrawals).toEqual([])
  })

  it('fails closed when independent line rounding would recover basis twice', () => {
    expect(() =>
      classifyOwnedNonRothIraAnnualWithdrawals(
        input({
          poolMembers: input().poolMembers.map((poolMember) => ({
            ...poolMember,
            yearEndApplicableBalanceAmount: asUsdCents(0),
          })),
          completePoolEvidence: {
            ...input().completePoolEvidence,
            yearEndApplicablePoolBalanceAmount: asUsdCents(0),
          },
          annualFacts: {
            openingBasisAmount: asUsdCents(1),
            taxYearNondeductibleContributionAmount: asUsdCents(0),
            postYearNondeductibleContributionExcludedAmount: asUsdCents(0),
            yearEndApplicablePoolBalanceAmount: asUsdCents(0),
            outstandingRolloverAmount: asUsdCents(0),
            rolloverRepaymentAdjustmentAmount: asUsdCents(0),
            form8606Line7DistributionAmount: asUsdCents(1),
            form8606Line8NetConversionAmount: asUsdCents(1),
          },
          line7Distributions: [
            activity('distribution', 'ira-traditional', 1, '2030-06-01'),
          ],
          line8Conversions: [
            activity('conversion', 'ira-sep', 1, '2030-07-01'),
          ],
        }),
      ),
    ).toThrow('cannot recover more than annual IRA basis')
  })

  it('range-checks the adjusted line-6 result after bigint subtraction', () => {
    const maximum = Number.MAX_SAFE_INTEGER
    const result = classifyOwnedNonRothIraAnnualWithdrawals(
      input({
        poolMembers: [
          {
            ...member('traditional', 'traditional'),
            yearEndApplicableBalanceAmount: asUsdCents(maximum),
          },
          {
            ...member('sep', 'sep'),
            yearEndApplicableBalanceAmount: asUsdCents(0),
          },
          {
            ...member('simple', 'simple'),
            yearEndApplicableBalanceAmount: asUsdCents(0),
          },
        ],
        completePoolEvidence: {
          ...input().completePoolEvidence,
          yearEndApplicablePoolBalanceAmount: asUsdCents(maximum),
        },
        annualFacts: {
          openingBasisAmount: asUsdCents(0),
          taxYearNondeductibleContributionAmount: asUsdCents(0),
          postYearNondeductibleContributionExcludedAmount: asUsdCents(0),
          yearEndApplicablePoolBalanceAmount: asUsdCents(maximum),
          outstandingRolloverAmount: asUsdCents(1),
          rolloverRepaymentAdjustmentAmount: asUsdCents(1),
          form8606Line7DistributionAmount: asUsdCents(0),
          form8606Line8NetConversionAmount: asUsdCents(0),
        },
        line7Distributions: [],
      }),
    )

    expect(
      result.annualBasisEvidence.line6AdjustedYearEndAndRolloverAmount,
    ).toBe(maximum)
  })

  it('omits zero line-7 activity and emits only positive character segments', () => {
    const result = classifyOwnedNonRothIraAnnualWithdrawals(
      input({
        annualFacts: {
          ...input().annualFacts,
          form8606Line7DistributionAmount: asUsdCents(1),
        },
        line7Distributions: [
          activity('zero', 'ira-traditional', 0, '2030-01-01'),
          activity('positive', 'ira-simple', 1, '2030-02-01'),
        ],
      }),
    )

    expect(result.withdrawals).toHaveLength(1)
    expect(result.withdrawals[0]?.actionId).toBe('action-positive')
    expect(
      result.withdrawals[0]?.taxCharacter.every((item) => item.amount > 0),
    ).toBe(true)
  })

  it('canonicalizes pool and activity input order with stable evidence IDs', () => {
    const source = input()
    const reversed = input({
      poolMembers: [...source.poolMembers].reverse(),
      line7Distributions: [...source.line7Distributions].reverse(),
    })
    const first = classifyOwnedNonRothIraAnnualWithdrawals(source)
    const second = classifyOwnedNonRothIraAnnualWithdrawals(reversed)

    expect(first).toEqual(second)
    expect(first.annualBasisEvidence.basisEvidenceId).toBe(
      second.annualBasisEvidence.basisEvidenceId,
    )
  })

  it('binds every character to the shared basis and line-7 evidence', () => {
    const result = classifyOwnedNonRothIraAnnualWithdrawals(input())
    const character = result.withdrawals[0]?.taxCharacter[0]

    expect(character?.characterEvidence.basisEvidenceId).toBe(
      result.annualBasisEvidence.basisEvidenceId,
    )
    expect(character?.characterEvidence.allocationEvidenceId).toBe(
      result.line7AllocationEvidence.allocationEvidenceId,
    )
    expect(character?.characterEvidence.segmentAmount).toBe(character?.amount)
  })

  it('changes evidence identity when a complete annual fact changes', () => {
    const baseline = classifyOwnedNonRothIraAnnualWithdrawals(input())
    const changed = classifyOwnedNonRothIraAnnualWithdrawals(
      input({
        poolMembers: [
          {
            ...member('traditional', 'traditional'),
            yearEndApplicableBalanceAmount: asUsdCents(2),
          },
          member('sep', 'sep'),
          member('simple', 'simple'),
        ],
        completePoolEvidence: {
          ...input().completePoolEvidence,
          yearEndApplicablePoolBalanceAmount: asUsdCents(4),
        },
        annualFacts: {
          ...input().annualFacts,
          yearEndApplicablePoolBalanceAmount: asUsdCents(4),
        },
      }),
    )

    expect(changed.annualBasisEvidence.basisEvidenceId).not.toBe(
      baseline.annualBasisEvidence.basisEvidenceId,
    )
    expect(changed.line7AllocationEvidence.allocationEvidenceId).not.toBe(
      baseline.line7AllocationEvidence.allocationEvidenceId,
    )
  })

  it('deep-freezes detached annual evidence and character', () => {
    const source = input()
    const result = classifyOwnedNonRothIraAnnualWithdrawals(source)
    ;(source.poolMembers[0] as OwnedNonRothIraPoolMemberEvidence).subtype = 'simple'

    expect(
      result.annualBasisEvidence.poolMembers.find(
        (item) => item.sourceAccountId === 'ira-traditional',
      )?.subtype,
    ).toBe('traditional')
    expect(Object.isFrozen(result)).toBe(true)
    expect(Object.isFrozen(result.annualBasisEvidence)).toBe(true)
    expect(Object.isFrozen(result.withdrawals[0]?.taxCharacter)).toBe(true)
  })

  it.each([
    {
      name: 'excluded contributions above current contributions',
      change: {
        annualFacts: {
          ...input().annualFacts,
          postYearNondeductibleContributionExcludedAmount: asUsdCents(1),
        },
      },
      message: 'cannot exceed',
    },
    {
      name: 'rollover repayment above available line-6 amounts',
      change: {
        annualFacts: {
          ...input().annualFacts,
          rolloverRepaymentAdjustmentAmount: asUsdCents(4),
        },
      },
      message: 'repayment adjustment',
    },
    {
      name: 'incomplete line-7 activity',
      change: {
        line7Distributions: [activity('short', 'ira-traditional', 2)],
      },
      message: 'line-7 activity',
    },
    {
      name: 'foreign activity source',
      change: {
        line7Distributions: [activity('foreign', 'ira-foreign', 3)],
      },
      message: 'owner-wide pool',
    },
    {
      name: 'omitted sibling from authoritative pool',
      change: {
        poolMembers: [
          member('traditional', 'traditional'),
          member('sep', 'sep'),
        ],
      },
      message: 'account set',
    },
    {
      name: 'member balances below authoritative aggregate',
      change: {
        poolMembers: input().poolMembers.map((poolMember) => ({
          ...poolMember,
          yearEndApplicableBalanceAmount: asUsdCents(0),
        })),
      },
      message: 'authoritative aggregate',
    },
    {
      name: 'duplicate pool account',
      change: {
        poolMembers: [
          member('traditional', 'traditional'),
          member('traditional', 'traditional'),
        ],
      },
      message: 'account IDs',
    },
    {
      name: 'mismatched pool owner',
      change: {
        poolMembers: [
          {
            ...member('traditional', 'traditional'),
            ownerPersonId: asPersonId('someone-else'),
          },
        ],
      },
      message: 'share its owner',
    },
    {
      name: 'allocation repeated across line 7 and line 8',
      change: {
        annualFacts: {
          ...input().annualFacts,
          form8606Line8NetConversionAmount: asUsdCents(1),
        },
        line8Conversions: [input().line7Distributions[0]!],
      },
      message: 'both annual line ledgers',
    },
    {
      name: 'one action repeats a source account',
      change: {
        annualFacts: {
          ...input().annualFacts,
          form8606Line7DistributionAmount: asUsdCents(2),
        },
        line7Distributions: [
          activity('first', 'ira-traditional', 1),
          {
            ...activity('second', 'ira-traditional', 1),
            actionId: asActionId('action-first'),
          },
        ],
      },
      message: 'same source account',
    },
    {
      name: 'one action split across line 7 and line 8',
      change: {
        annualFacts: {
          ...input().annualFacts,
          form8606Line8NetConversionAmount: asUsdCents(1),
        },
        line8Conversions: [
          {
            ...activity('conversion', 'ira-sep', 1),
            actionId: input().line7Distributions[0]!.actionId,
          },
        ],
      },
      message: 'both annual line scopes',
    },
  ])('rejects $name', ({ change, message }) => {
    expect(() =>
      classifyOwnedNonRothIraAnnualWithdrawals(input(change)),
    ).toThrow(message)
  })
})
