import { describe, expect, it } from 'vitest'

import type { AnnualIraBasisAllocationEntryInput } from './annualIraBasisAllocation.js'
import { buildAnnualOwnedNonRothIraPoolCapacity } from './annualOwnedNonRothIraPoolCapacity.js'
import {
  asAccountId,
  asActionId,
  asAllocationId,
  asPersonId,
} from './identity.js'
import { asUsdCents } from './money.js'
import type {
  ClassifyOwnedNonRothIraAnnualWithdrawalsInput,
  OwnedNonRothIraPoolMemberEvidence,
} from './ownedNonRothIraWithdrawalCharacter.js'

function member(
  suffix: string,
  balance: number,
): OwnedNonRothIraPoolMemberEvidence {
  return {
    sourceAccountId: asAccountId(`ira-${suffix}`),
    ownerPersonId: asPersonId('owner'),
    accountType: 'traditional',
    accountKind: 'ira',
    inheritanceStatus: 'owned',
    subtype: suffix === 'sep' ? 'sep' : 'traditional',
    yearEndApplicableBalanceAmount: asUsdCents(balance),
    iraClassificationEvidenceId: `classification-${suffix}`,
    accountOwnershipEvidenceId: `ownership-${suffix}`,
  }
}

function activity(
  suffix: string,
  source: string,
  amount: number,
  date: string,
): AnnualIraBasisAllocationEntryInput {
  return {
    actionId: asActionId(`action-${suffix}`),
    allocationId: asAllocationId(`allocation-${suffix}`),
    sourceAccountId: asAccountId(source),
    scheduledDate: date,
    scheduledSequence: 1,
    grossAmount: asUsdCents(amount),
  }
}

function input(): ClassifyOwnedNonRothIraAnnualWithdrawalsInput {
  return {
    ownerPersonId: asPersonId('owner'),
    ownerWideNonRothIraPoolId: 'owner-pool',
    completePoolEvidence: {
      predicate: 'completeOwnedNonRothIraPoolForOwnerAndTaxYear',
      ownerPersonId: asPersonId('owner'),
      ownerWideNonRothIraPoolId: 'owner-pool',
      taxYear: 2030,
      accountIds: [asAccountId('ira-traditional'), asAccountId('ira-sep')],
      yearEndApplicablePoolBalanceAmount: asUsdCents(200),
      evidenceId: 'complete-pool-evidence',
    },
    annualBasisRecordEvidenceId: 'annual-basis-record',
    taxYear: 2030,
    poolMembers: [member('traditional', 150), member('sep', 50)],
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
      activity('distribution', 'ira-traditional', 10, '2030-04-01'),
    ],
    line8Conversions: [
      activity('conversion', 'ira-sep', 5, '2030-08-01'),
    ],
  }
}

describe('buildAnnualOwnedNonRothIraPoolCapacity', () => {
  it('emits only complete owner/pool/year capacity facts', () => {
    const result = buildAnnualOwnedNonRothIraPoolCapacity(input())

    expect(result).toMatchObject({
      predicate: 'annualOwnedNonRothIraPoolCapacity',
      ownerPersonId: 'owner',
      ownerWideNonRothIraPoolId: 'owner-pool',
      taxYear: 2030,
      scope: 'donorOwnedNonRothIras',
      inheritedFromPersonId: null,
      accountIds: ['ira-sep', 'ira-traditional'],
      form8606BaseDenominatorAmount: 220,
      basisNumeratorAmount: 115,
      form8606BaseEffectiveBasisAmount: 115,
      form8606BaseOtherwiseTaxableAmount: 105,
      completePoolEvidenceId: 'complete-pool-evidence',
      annualBasisRecordEvidenceId: 'annual-basis-record',
    })
    expect(Object.keys(result).sort()).toEqual([
      'accountIds',
      'annualBasisEvidenceId',
      'annualBasisRecordEvidenceId',
      'basisNumeratorAmount',
      'capacityEvidenceId',
      'completePoolEvidenceId',
      'form8606BaseDenominatorAmount',
      'form8606BaseEffectiveBasisAmount',
      'form8606BaseOtherwiseTaxableAmount',
      'inheritedFromPersonId',
      'ownerPersonId',
      'ownerWideNonRothIraPoolId',
      'predicate',
      'scope',
      'taxYear',
    ])
  })

  it('caps annual basis at gross capacity', () => {
    const source = input()
    source.annualFacts = {
      ...source.annualFacts,
      openingBasisAmount: asUsdCents(300),
    }

    expect(buildAnnualOwnedNonRothIraPoolCapacity(source)).toMatchObject({
      form8606BaseDenominatorAmount: 220,
      basisNumeratorAmount: 315,
      form8606BaseEffectiveBasisAmount: 220,
      form8606BaseOtherwiseTaxableAmount: 0,
    })
  })

  it('supports a zero-gross pool without manufacturing capacity', () => {
    const source = input()
    source.poolMembers = [member('traditional', 0)]
    source.completePoolEvidence = {
      ...source.completePoolEvidence,
      accountIds: [asAccountId('ira-traditional')],
      yearEndApplicablePoolBalanceAmount: asUsdCents(0),
    }
    source.annualFacts = {
      openingBasisAmount: asUsdCents(0),
      taxYearNondeductibleContributionAmount: asUsdCents(0),
      postYearNondeductibleContributionExcludedAmount: asUsdCents(0),
      yearEndApplicablePoolBalanceAmount: asUsdCents(0),
      outstandingRolloverAmount: asUsdCents(0),
      rolloverRepaymentAdjustmentAmount: asUsdCents(0),
      form8606Line7DistributionAmount: asUsdCents(0),
      form8606Line8NetConversionAmount: asUsdCents(0),
    }
    source.line7Distributions = []
    source.line8Conversions = []

    expect(buildAnnualOwnedNonRothIraPoolCapacity(source)).toMatchObject({
      form8606BaseDenominatorAmount: 0,
      basisNumeratorAmount: 0,
      form8606BaseEffectiveBasisAmount: 0,
      form8606BaseOtherwiseTaxableAmount: 0,
    })
  })

  it('is deterministic and permutation-invariant', () => {
    const source = input()
    const permuted = structuredClone(source)
    permuted.poolMembers = [...permuted.poolMembers].reverse()
    permuted.completePoolEvidence = {
      ...permuted.completePoolEvidence,
      accountIds: [...permuted.completePoolEvidence.accountIds].reverse() as [
        ReturnType<typeof asAccountId>,
        ...ReturnType<typeof asAccountId>[],
      ],
    }
    const extra = activity('second', 'ira-traditional', 2, '2030-05-01')
    source.line7Distributions = [
      { ...source.line7Distributions[0]!, grossAmount: asUsdCents(8) },
      extra,
    ]
    permuted.line7Distributions = [...source.line7Distributions].reverse()

    expect(buildAnnualOwnedNonRothIraPoolCapacity(permuted)).toEqual(
      buildAnnualOwnedNonRothIraPoolCapacity(source),
    )
  })

  it('returns a recursively frozen snapshot without mutating input', () => {
    const source = input()
    const before = structuredClone(source)
    const result = buildAnnualOwnedNonRothIraPoolCapacity(source)

    expect(source).toEqual(before)
    expect(Object.isFrozen(result)).toBe(true)
    expect(Object.isFrozen(result.accountIds)).toBe(true)
  })

  it.each([
    ['owner', (source: ClassifyOwnedNonRothIraAnnualWithdrawalsInput) => {
      source.completePoolEvidence = {
        ...source.completePoolEvidence,
        ownerPersonId: asPersonId('other'),
      }
    }],
    ['pool', (source: ClassifyOwnedNonRothIraAnnualWithdrawalsInput) => {
      source.completePoolEvidence = {
        ...source.completePoolEvidence,
        ownerWideNonRothIraPoolId: 'other-pool',
      }
    }],
    ['year', (source: ClassifyOwnedNonRothIraAnnualWithdrawalsInput) => {
      source.completePoolEvidence = {
        ...source.completePoolEvidence,
        taxYear: 2029,
      }
    }],
    ['accounts', (source: ClassifyOwnedNonRothIraAnnualWithdrawalsInput) => {
      source.completePoolEvidence = {
        ...source.completePoolEvidence,
        accountIds: [asAccountId('ira-traditional')],
      }
    }],
  ])('rejects forged complete-pool %s evidence', (_label, forge) => {
    const source = input()
    forge(source)
    expect(() => buildAnnualOwnedNonRothIraPoolCapacity(source)).toThrow()
  })

  it('rejects evidence IDs reused across roles', () => {
    const source = input()
    source.annualBasisRecordEvidenceId =
      source.completePoolEvidence.evidenceId

    expect(() => buildAnnualOwnedNonRothIraPoolCapacity(source)).toThrow(
      /unique across evidence roles/,
    )
  })

  it('rejects activity identity and schedule collisions', () => {
    const source = input()
    source.line8Conversions = [{
      ...source.line7Distributions[0]!,
      grossAmount: asUsdCents(5),
    }]

    expect(() => buildAnnualOwnedNonRothIraPoolCapacity(source)).toThrow(
      /both annual line ledgers|both annual line scopes/,
    )
  })

  it('rejects unsafe annual arithmetic', () => {
    const source = input()
    source.poolMembers = [
      member('traditional', Number.MAX_SAFE_INTEGER),
      member('sep', Number.MAX_SAFE_INTEGER),
    ]
    source.completePoolEvidence = {
      ...source.completePoolEvidence,
      yearEndApplicablePoolBalanceAmount: asUsdCents(Number.MAX_SAFE_INTEGER),
    }
    source.annualFacts = {
      ...source.annualFacts,
      yearEndApplicablePoolBalanceAmount: asUsdCents(Number.MAX_SAFE_INTEGER),
    }

    expect(() => buildAnnualOwnedNonRothIraPoolCapacity(source)).toThrow(
      /safe-integer range/,
    )
  })
})
