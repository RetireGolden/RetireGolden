import { describe, expect, it } from 'vitest'

import {
  asAccountId,
  asActionId,
  asAllocationId,
  asPersonId,
} from './identity.js'
import { asPositiveUsdCents, asUsdCents } from './money.js'
import {
  classifyIndividuallyOwnedTaxableWithdrawal,
  type ClassifyIndividuallyOwnedTaxableWithdrawalInput,
  type TaxableWithdrawalFederalFilingStatus,
} from './taxableWithdrawalCharacter.js'

function input(
  executedAmount: number,
  preExecutionFairMarketValue: number,
  remainingCostBasisBeforeExecution: number,
): ClassifyIndividuallyOwnedTaxableWithdrawalInput {
  return {
    actionId: asActionId('withdrawal'),
    allocationId: asAllocationId('allocation'),
    sourceAccountId: asAccountId('brokerage'),
    actingPersonId: asPersonId('owner'),
    evaluationDate: '2030-06-15',
    executedAmount: asUsdCents(executedAmount),
    preExecutionFairMarketValue: asPositiveUsdCents(
      preExecutionFairMarketValue,
    ),
    remainingCostBasisBeforeExecution: asUsdCents(
      remainingCostBasisBeforeExecution,
    ),
    ownership: {
      accountOwnerPersonIds: [asPersonId('owner')],
      accountOwnershipEvidenceId: 'ownership-record',
      beneficialOwnershipShare: {
        representation: 'exactRational',
        numerator: 1,
        denominator: 1,
        intermediateArithmetic: 'bigintRational',
      },
      attributionEvidenceId: 'recorded-owner-attribution',
    },
    taxUnit: {
      taxUnitId: 'tax-unit',
      taxUnitMemberPersonIds: [asPersonId('owner')],
      federalFilingStatus: 'single',
      stateFilingStatusId: 'state-single',
      taxUnitEvidenceId: 'tax-unit-record',
      taxYear: 2030,
    },
  }
}

function basisOf(
  result: ReturnType<typeof classifyIndividuallyOwnedTaxableWithdrawal>,
) {
  return result.acceptedSourceEligibility.basisEvidence
}

describe('individually owned taxable-withdrawal character', () => {
  it('classifies zero execution without inventing character or attribution entries', () => {
    const result = classifyIndividuallyOwnedTaxableWithdrawal(input(0, 100, 40))
    const basis = basisOf(result)

    expect(basis).toMatchObject({
      method: 'planningAggregateBasisRatio',
      basisRecoveryQuantization: 'nearestCentHalfUp',
      basisRecoveredAmount: 0,
      realizedCapitalGainOrLossAmount: 0,
      aggregateBasisRatio: {
        representation: 'exactMinorUnitRational',
        numeratorMinorUnits: 40,
        denominatorMinorUnits: 100,
        intermediateArithmetic: 'bigintRational',
      },
      taxAttributionEvidence: {
        allocationRule: 'recordedBeneficialOwnership',
        realizedCapitalGainOrLossAmount: 0,
        entries: [],
      },
    })
    expect(result.taxCharacter).toEqual([])
  })

  it('classifies zero basis as full gain without a zero basis segment', () => {
    const result = classifyIndividuallyOwnedTaxableWithdrawal(input(40, 100, 0))

    expect(basisOf(result)).toMatchObject({
      basisRecoveredAmount: 0,
      realizedCapitalGainOrLossAmount: 40,
    })
    expect(result.taxCharacter).toMatchObject([{
      sourceClass: 'taxable',
      kind: 'capitalGain',
      amount: 40,
      characterEvidence: {
        rule: 'planningAggregateBasisRatio',
        allocationId: 'allocation',
        segmentAmount: 40,
      },
      taxAttribution: {
        incomeRecipientPersonId: 'owner',
        attributedSegmentAmount: 40,
      },
    }])
  })

  it('classifies a full sale as basis return plus the exact residual gain', () => {
    const result = classifyIndividuallyOwnedTaxableWithdrawal(
      input(100, 100, 40),
    )
    const basis = basisOf(result)

    expect(basis).toMatchObject({
      basisRecoveredAmount: 40,
      realizedCapitalGainOrLossAmount: 60,
    })
    expect(result.taxCharacter.map((character) => ({
      kind: character.kind,
      amount: character.amount,
    }))).toEqual([
      { kind: 'basisReturn', amount: 40 },
      { kind: 'capitalGain', amount: 60 },
    ])
    expect(basis.taxAttributionEvidence).toMatchObject({
      allocationId: 'allocation',
      sourceAccountId: 'brokerage',
      evaluationDate: '2030-06-15',
      taxYear: 2030,
      accountOwnerPersonIds: ['owner'],
      accountOwnershipEvidenceId: 'ownership-record',
      entries: [{
        incomeRecipientPersonId: 'owner',
        taxUnitMemberPersonIds: ['owner'],
        federalFilingStatus: 'single',
        stateFilingStatusId: 'state-single',
        beneficialOwnershipShare: {
          representation: 'exactRational',
          numerator: 1,
          denominator: 1,
          intermediateArithmetic: 'bigintRational',
        },
        attributedGainOrLossAmount: 60,
        attributionEvidenceId: 'recorded-owner-attribution',
      }],
    })
    expect(result.taxCharacter[0]?.taxAttribution).toBeNull()
    expect(Object.isFrozen(result)).toBe(true)
    expect(Object.isFrozen(basis.taxAttributionEvidence)).toBe(true)
  })

  it('uses integer one-third math without binary floating-point division', () => {
    const result = classifyIndividuallyOwnedTaxableWithdrawal(input(1, 3, 1))

    expect(basisOf(result).basisRecoveredAmount).toBe(0)
    expect(basisOf(result).realizedCapitalGainOrLossAmount).toBe(1)
    expect(result.taxCharacter).toMatchObject([
      { kind: 'capitalGain', amount: 1 },
    ])
  })

  it('rounds a half-cent basis recovery up exactly once', () => {
    const result = classifyIndividuallyOwnedTaxableWithdrawal(input(1, 2, 1))

    expect(basisOf(result).basisRecoveredAmount).toBe(1)
    expect(basisOf(result).realizedCapitalGainOrLossAmount).toBe(0)
    expect(result.taxCharacter).toMatchObject([
      { kind: 'basisReturn', amount: 1 },
    ])
  })

  it('supports basis above fair market value and emits the signed loss residual', () => {
    const result = classifyIndividuallyOwnedTaxableWithdrawal(
      input(40, 100, 150),
    )
    const basis = basisOf(result)

    expect(basis).toMatchObject({
      basisRecoveredAmount: 60,
      realizedCapitalGainOrLossAmount: -20,
    })
    expect(result.taxCharacter.map((character) => ({
      kind: character.kind,
      amount: character.amount,
    }))).toEqual([
      { kind: 'basisReturn', amount: 60 },
      { kind: 'capitalLoss', amount: 20 },
    ])
    expect(basis.taxAttributionEvidence.entries[0]).toMatchObject({
      attributedGainOrLossAmount: -20,
    })
    expect(result.taxCharacter[1]?.taxAttribution).toMatchObject({
      attributedSegmentAmount: 20,
    })
  })

  it('recovers every remaining basis cent on a full loss-position sale', () => {
    const result = classifyIndividuallyOwnedTaxableWithdrawal(
      input(100, 100, 150),
    )
    const basis = basisOf(result)

    expect(basis).toMatchObject({
      basisRecoveredAmount: 150,
      realizedCapitalGainOrLossAmount: -50,
    })
    expect(result.taxCharacter.map((character) => ({
      kind: character.kind,
      amount: character.amount,
    }))).toEqual([
      { kind: 'basisReturn', amount: 150 },
      { kind: 'capitalLoss', amount: 50 },
    ])
  })

  it('uses bigint when the safe inputs have an unsafe product', () => {
    const max = Number.MAX_SAFE_INTEGER
    const result = classifyIndividuallyOwnedTaxableWithdrawal(
      input(max - 2, max, max - 1),
    )
    const expected =
      (BigInt(max - 2) * BigInt(max - 1) * 2n + BigInt(max)) /
      (2n * BigInt(max))
    const basis = basisOf(result)

    expect(BigInt(basis.basisRecoveredAmount)).toBe(expected)
    expect(
      BigInt(basis.basisRecoveredAmount) +
        BigInt(basis.realizedCapitalGainOrLossAmount),
    ).toBe(BigInt(max - 2))
  })

  it('rejects unsafe, foreign, and duplicate ownership or tax-unit evidence', () => {
    const unsafeShare = input(1, 2, 1)
    ;(unsafeShare.ownership.beneficialOwnershipShare as {
      numerator: number
    }).numerator = Number.MAX_SAFE_INTEGER + 1
    expect(() =>
      classifyIndividuallyOwnedTaxableWithdrawal(unsafeShare),
    ).toThrow(/safe-integer rational 1\/1/)

    const foreignTaxUnit = input(1, 2, 1)
    ;(foreignTaxUnit.taxUnit as unknown as {
      taxUnitMemberPersonIds: ReturnType<typeof asPersonId>[]
    }).taxUnitMemberPersonIds = [asPersonId('foreign')]
    expect(() =>
      classifyIndividuallyOwnedTaxableWithdrawal(foreignTaxUnit),
    ).toThrow(/recipient must belong/)

    const duplicateTaxUnit = input(1, 2, 1)
    ;(duplicateTaxUnit.taxUnit as unknown as {
      taxUnitMemberPersonIds: ReturnType<typeof asPersonId>[]
    }).taxUnitMemberPersonIds = [
      asPersonId('owner'),
      asPersonId('owner'),
    ]
    expect(() =>
      classifyIndividuallyOwnedTaxableWithdrawal(duplicateTaxUnit),
    ).toThrow(/duplicate-free/)

    const foreignOwner = input(1, 2, 1)
    ;(foreignOwner.ownership as unknown as {
      accountOwnerPersonIds: ReturnType<typeof asPersonId>[]
    }).accountOwnerPersonIds = [asPersonId('foreign')]
    expect(() =>
      classifyIndividuallyOwnedTaxableWithdrawal(foreignOwner),
    ).toThrow(/must match/)
  })

  it('rejects unsafe money, over-execution, wrong year, and blank state status', () => {
    const unsafeMoney = input(1, 2, 1)
    ;(unsafeMoney as { executedAmount: number }).executedAmount =
      Number.MAX_SAFE_INTEGER + 1
    expect(() =>
      classifyIndividuallyOwnedTaxableWithdrawal(unsafeMoney),
    ).toThrow()

    expect(() =>
      classifyIndividuallyOwnedTaxableWithdrawal(input(3, 2, 1)),
    ).toThrow(/cannot exceed/)

    const wrongYear = input(1, 2, 1)
    ;(wrongYear.taxUnit as { taxYear: number }).taxYear = 2031
    expect(() =>
      classifyIndividuallyOwnedTaxableWithdrawal(wrongYear),
    ).toThrow(/must equal/)

    const blankStateStatus = input(1, 2, 1)
    ;(blankStateStatus.taxUnit as {
      stateFilingStatusId: string
    }).stateFilingStatusId = '  '
    expect(() =>
      classifyIndividuallyOwnedTaxableWithdrawal(blankStateStatus),
    ).toThrow(/State filing-status ID/)
  })

  it('canonicalizes tax-unit member order into stable evidence IDs', () => {
    const first = input(100, 100, 40)
    ;(first.taxUnit as unknown as {
      taxUnitMemberPersonIds: ReturnType<typeof asPersonId>[]
    }).taxUnitMemberPersonIds = [
      asPersonId('spouse'),
      asPersonId('owner'),
    ]
    ;(first.taxUnit as {
      federalFilingStatus: TaxableWithdrawalFederalFilingStatus
    }).federalFilingStatus = 'marriedFilingJointly'
    const second = structuredClone(first)
    ;(second.taxUnit as unknown as {
      taxUnitMemberPersonIds: ReturnType<typeof asPersonId>[]
    }).taxUnitMemberPersonIds.reverse()

    expect(
      classifyIndividuallyOwnedTaxableWithdrawal(second),
    ).toEqual(classifyIndividuallyOwnedTaxableWithdrawal(first))
  })

  it.each([
    'single',
    'marriedFilingJointly',
    'marriedFilingSeparately',
    'headOfHousehold',
    'qualifyingSurvivingSpouse',
  ] satisfies TaxableWithdrawalFederalFilingStatus[])(
    'accepts the locked federal filing status %s',
    (federalFilingStatus) => {
      const value = input(1, 3, 1)
      ;(value.taxUnit as {
        federalFilingStatus: TaxableWithdrawalFederalFilingStatus
      }).federalFilingStatus = federalFilingStatus

      expect(
        basisOf(classifyIndividuallyOwnedTaxableWithdrawal(value))
          .taxAttributionEvidence.entries[0]?.federalFilingStatus,
      ).toBe(federalFilingStatus)
    },
  )

  it('mints the three taxable evidence IDs with the hardened structural minter', () => {
    const result = classifyIndividuallyOwnedTaxableWithdrawal(
      input(40_000, 100_000, 60_000),
    )
    const gain = result.taxCharacter.find((item) => item.kind === 'capitalGain')

    expect(basisOf(result).basisEvidenceId).toBe(
      'taxable-basis:cafcf69dca718b2a8809f30d0a0e0d4381c0804d06c3837' +
        '9875f2a53b1748ac2',
    )
    expect(gain?.taxAttribution?.taxAttributionEvidenceId).toBe(
      'taxable-tax-attribution:7b9c54e433571fd20fa722e0f04b515b6fc5a10c' +
        '6aba77210742e1bd82e168b1',
    )
    expect(gain?.taxAttribution?.taxAttributionEntryId).toBe(
      'taxable-tax-attribution-entry:9763f6a847318f252bafcbf874af06dc' +
        '755433488e5f4f1055ff611394441596',
    )
    expect(
      basisOf(classifyIndividuallyOwnedTaxableWithdrawal(
        input(40_000, 100_000, 60_000),
      )).basisEvidenceId,
    ).toBe(basisOf(result).basisEvidenceId)
    expect(
      basisOf(classifyIndividuallyOwnedTaxableWithdrawal(
        input(40_001, 100_000, 60_000),
      )).basisEvidenceId,
    ).not.toBe(basisOf(result).basisEvidenceId)
  })
})
