import { describe, expect, it } from 'vitest'

import type { AnnualIraBasisAllocationEntryInput } from './annualIraBasisAllocation.js'
import {
  classifyBeneficiaryTraditionalIraWithdrawal,
  type ClassifyBeneficiaryTraditionalIraWithdrawalInput,
} from './beneficiaryTraditionalIraWithdrawalCharacter.js'
import {
  asAccountId,
  asActionId,
  asAllocationId,
  asPersonId,
} from './identity.js'
import { asUsdCents } from './money.js'

const actionId = asActionId('withdrawal-a')
const allocationId = asAllocationId('allocation-a')
const sourceAccountId = asAccountId('inherited-ira-a')
const otherAccountId = asAccountId('inherited-ira-b')
const beneficiaryPersonId = asPersonId('beneficiary')
const decedentPersonId = asPersonId('decedent')

function line7Entry(
  grossAmount = 60,
  overrides: Partial<AnnualIraBasisAllocationEntryInput> = {},
): AnnualIraBasisAllocationEntryInput {
  return {
    actionId,
    allocationId,
    sourceAccountId,
    scheduledDate: '2030-06-15',
    scheduledSequence: 1,
    grossAmount: asUsdCents(grossAmount),
    ...overrides,
  }
}

function validInput(
  executedAmount = 60,
  openingBasis = 40,
  yearEndBalance = 40,
  line7Amount = executedAmount,
): ClassifyBeneficiaryTraditionalIraWithdrawalInput {
  return {
    actionId,
    allocationId,
    sourceAccountId,
    beneficiaryPersonId,
    decedentPersonId,
    evaluationDate: '2030-06-15',
    taxYear: 2030,
    executedAmount: asUsdCents(executedAmount),
    inheritanceEvidence: {
      predicate: 'beneficiaryTraditionalIraInheritance',
      actionId,
      allocationId,
      sourceAccountId,
      beneficiaryPersonId,
      decedentPersonId,
      evaluationDate: '2030-06-15',
      accountType: 'traditional',
      accountKind: 'ira',
      ownershipKind: 'beneficiary',
      deathDate: '2029-12-31',
      inheritanceEvidenceId: 'inheritance-record',
    },
    basisPoolEvidence: {
      predicate:
        'completeBeneficiaryTraditionalIraBasisPoolForBeneficiaryDecedentAndTaxYear',
      beneficiaryPersonId,
      inheritedFromPersonId: decedentPersonId,
      poolId: 'basis-pool',
      taxYear: 2030,
      accountIds: [otherAccountId, sourceAccountId],
      openingInheritedBasisAmount: asUsdCents(openingBasis),
      yearEndApplicablePoolBalanceAmount: asUsdCents(yearEndBalance),
      form8606Line7DistributionAmount: asUsdCents(line7Amount),
      form8606Line8NetConversionAmount: asUsdCents(0),
      evidenceId: 'basis-pool-record',
    },
    line7Distributions: [line7Entry(executedAmount)],
    rmdPoolEvidence: {
      predicate:
        'completeBeneficiaryTraditionalIraRmdPoolForBeneficiaryDecedentAndTaxYear',
      actionId,
      allocationId,
      sourceAccountId,
      evaluationDate: '2030-06-15',
      beneficiaryPersonId,
      inheritedFromPersonId: decedentPersonId,
      poolId: 'rmd-pool',
      taxYear: 2030,
      accountIds: [otherAccountId, sourceAccountId],
      requiredAmount: asUsdCents(100),
      satisfiedBeforeExecution: asUsdCents(25),
      remainingBeforeExecution: asUsdCents(75),
      evidenceId: 'rmd-pool-record',
    },
  }
}

function expectInheritedFactsMissing(
  value: ClassifyBeneficiaryTraditionalIraWithdrawalInput,
): void {
  expect(classifyBeneficiaryTraditionalIraWithdrawal(value)).toEqual({
    status: 'unsupported',
    reasons: [{
      code: 'withdrawal-inherited-facts-missing',
      predicate: 'inheritedWithdrawalEligibility',
      outcome: 'unsupported',
      message:
        'Beneficiary, decedent, annual basis denominator, or inherited-distribution facts are incomplete.',
      personId: 'beneficiary',
      accountId: 'inherited-ira-a',
      allocationId: 'allocation-a',
    }],
    acceptedSourceEligibility: null,
    taxCharacter: [],
  })
}

describe('beneficiary traditional IRA withdrawal character', () => {
  it('accepts immutable inheritance, basis, and RMD evidence and classifies cents', () => {
    const value = validInput()
    const before = structuredClone(value)
    const result = classifyBeneficiaryTraditionalIraWithdrawal(value)

    expect(result).toMatchObject({
      status: 'accepted',
      reasons: [],
      acceptedSourceEligibility: {
        predicate: 'inheritedWithdrawalEligibility',
        allocationId: 'allocation-a',
        sourceAccountId: 'inherited-ira-a',
        beneficiaryPersonId: 'beneficiary',
        decedentPersonId: 'decedent',
        evaluationDate: '2030-06-15',
        sourceClass: 'beneficiaryTraditionalIra',
        ownershipKind: 'beneficiary',
        inheritanceEvidenceId: 'inheritance-record',
        basisEvidence: {
          poolId: 'basis-pool',
          taxYear: 2030,
          beneficiaryPersonId: 'beneficiary',
          inheritedFromPersonId: 'decedent',
          accountIds: ['inherited-ira-a', 'inherited-ira-b'],
          openingInheritedBasisAmount: 40,
          basisNumeratorAmount: 40,
          yearEndApplicablePoolBalanceAmount: 40,
          form8606Line7DistributionAmount: 60,
          form8606Line8NetConversionAmount: asUsdCents(0),
          annualBasisDenominatorAmount: 100,
          annualBasisRatio: {
            representation: 'exactMinorUnitRational',
            numeratorMinorUnits: 40,
            denominatorMinorUnits: 100,
            intermediateArithmetic: 'bigintRational',
          },
          executedAmount: 60,
          basisRecoveredAmount: 24,
          ordinaryIncomeAmount: 36,
          basisRecoveryQuantization: 'nearestCentHalfUp',
        },
        rmdEvidence: {
          poolId: 'rmd-pool',
          requiredAmount: 100,
          satisfiedBeforeExecution: 25,
          remainingBeforeExecution: 75,
          evidenceId: 'rmd-pool-record',
        },
      },
      taxCharacter: [
        {
          kind: 'basisReturn',
          amount: 24,
          characterEvidence: {
            rule: 'beneficiaryAnnualIraBasisAllocation',
            allocationId: 'allocation-a',
            segmentAmount: 24,
          },
        },
        {
          kind: 'ordinaryIncome',
          amount: 36,
          characterEvidence: {
            rule: 'beneficiaryAnnualIraBasisAllocation',
            allocationId: 'allocation-a',
            segmentAmount: 36,
          },
        },
      ],
    })
    expect(result).toEqual(expect.objectContaining({ status: 'accepted' }))
    if (result.status !== 'accepted') return
    const basisEvidence = result.acceptedSourceEligibility.basisEvidence
    for (const character of result.taxCharacter) {
      expect(character.characterEvidence.basisEvidenceId).toBe(
        basisEvidence.evidenceId,
      )
      expect(character.characterEvidence.allocationEvidenceId).toBe(
        basisEvidence.annualDistributionBasisAllocation.allocationEvidenceId,
      )
    }
    expect(value).toEqual(before)
    expect(Object.isFrozen(result)).toBe(true)
    expect(
      result.status === 'accepted' &&
      Object.isFrozen(result.acceptedSourceEligibility.basisEvidence),
    ).toBe(true)
  })

  it('emits fully ordinary income when explicit opening basis is zero', () => {
    const result = classifyBeneficiaryTraditionalIraWithdrawal(
      validInput(60, 0, 40),
    )
    expect(result.status).toBe('accepted')
    if (result.status !== 'accepted') return
    expect(result.acceptedSourceEligibility.basisEvidence).toMatchObject({
      basisNumeratorAmount: 0,
      basisRecoveredAmount: 0,
      ordinaryIncomeAmount: 60,
    })
    expect(result.taxCharacter.map(({ kind, amount }) => [kind, amount])).toEqual([
      ['ordinaryIncome', 60],
    ])
  })

  it('caps only the ratio numerator while memorializing the full opening basis', () => {
    const first = classifyBeneficiaryTraditionalIraWithdrawal(
      validInput(60, 200, 40),
    )
    const second = classifyBeneficiaryTraditionalIraWithdrawal(
      validInput(60, 300, 40),
    )
    expect(first.status).toBe('accepted')
    expect(second.status).toBe('accepted')
    if (first.status !== 'accepted' || second.status !== 'accepted') return
    expect(first.acceptedSourceEligibility.basisEvidence).toMatchObject({
      basisNumeratorAmount: 200,
      annualBasisRatio: { numeratorMinorUnits: 100 },
      basisRecoveredAmount: 60,
      ordinaryIncomeAmount: 0,
    })
    expect(first.acceptedSourceEligibility.basisEvidence.evidenceId).not.toBe(
      second.acceptedSourceEligibility.basisEvidence.evidenceId,
    )
  })

  it('uses one annual half-up amount and deterministic residual cents', () => {
    const value = validInput(1, 1, 0, 2)
    value.line7Distributions = [
      line7Entry(1),
      line7Entry(1, {
        actionId: asActionId('withdrawal-b'),
        allocationId: asAllocationId('allocation-b'),
        sourceAccountId: otherAccountId,
        scheduledDate: '2030-07-01',
        scheduledSequence: 2,
      }),
    ]
    const result = classifyBeneficiaryTraditionalIraWithdrawal(value)
    expect(result.status).toBe('accepted')
    if (result.status !== 'accepted') return
    const evidence = result.acceptedSourceEligibility.basisEvidence
      .annualDistributionBasisAllocation
    expect(evidence).toMatchObject({
      annualNontaxableBasisAmount: 1,
      annualTaxableAmount: 1,
      annualBasisQuantization: 'nearestCentHalfUp',
      allocations: [
        { allocationId: 'allocation-a', allocatedBasisAmount: 1 },
        { allocationId: 'allocation-b', allocatedBasisAmount: 0 },
      ],
    })
  })

  it('handles repeating ratios with exact BigInt allocation arithmetic', () => {
    const result = classifyBeneficiaryTraditionalIraWithdrawal(
      validInput(1, 1, 2, 1),
    )
    expect(result.status).toBe('accepted')
    if (result.status !== 'accepted') return
    expect(result.acceptedSourceEligibility.basisEvidence).toMatchObject({
      annualBasisDenominatorAmount: 3,
      annualBasisRatio: {
        numeratorMinorUnits: 1,
        denominatorMinorUnits: 3,
      },
      basisRecoveredAmount: 0,
      ordinaryIncomeAmount: 1,
    })
  })

  it('accepts an explicit zero-denominator zero entry before allocator omission', () => {
    const result = classifyBeneficiaryTraditionalIraWithdrawal(
      validInput(0, 50, 0, 0),
    )
    expect(result.status).toBe('accepted')
    if (result.status !== 'accepted') return
    expect(result.acceptedSourceEligibility.basisEvidence).toMatchObject({
      basisNumeratorAmount: 50,
      annualBasisDenominatorAmount: 0,
      annualBasisRatio: {
        representation: 'notApplicableZeroDenominator',
        numeratorMinorUnits: 0,
        denominatorMinorUnits: 0,
      },
      annualDistributionBasisAllocation: {
        annualGrossAmount: 0,
        annualNontaxableBasisAmount: 0,
        allocations: [],
      },
      executedAmount: 0,
      basisRecoveredAmount: 0,
      ordinaryIncomeAmount: 0,
    })
    expect(result.taxCharacter).toEqual([])
  })

  it('omits a zero current entry before a later positive residual recipient', () => {
    const value = validInput(0, 1, 1, 1)
    value.line7Distributions = [
      line7Entry(0),
      line7Entry(1, {
        actionId: asActionId('withdrawal-b'),
        allocationId: asAllocationId('allocation-b'),
        sourceAccountId: otherAccountId,
        scheduledDate: '2030-07-01',
        scheduledSequence: 2,
      }),
    ]
    const result = classifyBeneficiaryTraditionalIraWithdrawal(value)
    expect(result.status).toBe('accepted')
    if (result.status !== 'accepted') return
    expect(result.taxCharacter).toEqual([])
    expect(
      result.acceptedSourceEligibility.basisEvidence
        .annualDistributionBasisAllocation.allocations,
    ).toEqual([
      expect.objectContaining({
        allocationId: 'allocation-b',
        grossAmount: 1,
        allocatedBasisAmount: 1,
      }),
    ])
  })

  it('rejects positive or incomplete line-7 facts in the zero-denominator arm', () => {
    const positive = validInput(1, 50, 0, 0)
    const missingCurrent = validInput(0, 50, 0, 0)
    missingCurrent.line7Distributions = []
    expectInheritedFactsMissing(positive)
    expectInheritedFactsMissing(missingCurrent)
  })

  it('rejects a denominator outside the safe cent range', () => {
    const value = validInput(1, 1, Number.MAX_SAFE_INTEGER, 1)
    expectInheritedFactsMissing(value)
  })

  it('requires explicit complete inheritance, basis, line-7, and RMD evidence', () => {
    const mutations: Array<(
      value: ClassifyBeneficiaryTraditionalIraWithdrawalInput,
    ) => void> = [
      (value) => { value.inheritanceEvidence = null },
      (value) => { value.basisPoolEvidence = null },
      (value) => { value.line7Distributions = null },
      (value) => { value.rmdPoolEvidence = null },
    ]
    for (const mutate of mutations) {
      const value = validInput()
      mutate(value)
      expectInheritedFactsMissing(value)
    }
  })

  it('returns typed unsupported for omitted or wrong-shaped nested evidence', () => {
    const invalidNested = [
      { field: 'inheritanceEvidence', value: undefined },
      { field: 'inheritanceEvidence', value: [] },
      { field: 'basisPoolEvidence', value: undefined },
      { field: 'basisPoolEvidence', value: [] },
      { field: 'rmdPoolEvidence', value: undefined },
      { field: 'rmdPoolEvidence', value: [] },
      { field: 'line7Distributions', value: undefined },
      { field: 'line7Distributions', value: {} },
    ] as const
    for (const { field, value: replacement } of invalidNested) {
      const value = validInput()
      Object.assign(value, { [field]: replacement })
      expectInheritedFactsMissing(value)
    }
  })

  it('rejects mismatched inheritance identity, classification, and dates', () => {
    const mutations: Array<(
      evidence: NonNullable<
        ClassifyBeneficiaryTraditionalIraWithdrawalInput['inheritanceEvidence']
      >,
    ) => object> = [
      (evidence) => ({ ...evidence, actionId: asActionId('wrong') }),
      (evidence) => ({ ...evidence, sourceAccountId: otherAccountId }),
      (evidence) => ({ ...evidence, beneficiaryPersonId: decedentPersonId }),
      (evidence) => ({ ...evidence, accountType: 'roth' }),
      (evidence) => ({ ...evidence, ownershipKind: 'owned' }),
      (evidence) => ({ ...evidence, deathDate: '2030-06-16' }),
      (evidence) => ({ ...evidence, deathDate: '2030-6-01' }),
    ]
    for (const mutate of mutations) {
      const value = validInput()
      value.inheritanceEvidence = mutate(value.inheritanceEvidence!) as
        typeof value.inheritanceEvidence
      expectInheritedFactsMissing(value)
    }
  })

  it('rejects the same person as both beneficiary and decedent', () => {
    const value = validInput()
    value.decedentPersonId = beneficiaryPersonId
    value.inheritanceEvidence = {
      ...value.inheritanceEvidence!,
      decedentPersonId: beneficiaryPersonId,
    }
    value.basisPoolEvidence = {
      ...value.basisPoolEvidence!,
      inheritedFromPersonId: beneficiaryPersonId,
    }
    value.rmdPoolEvidence = {
      ...value.rmdPoolEvidence!,
      inheritedFromPersonId: beneficiaryPersonId,
    }
    expectInheritedFactsMissing(value)
  })

  it('requires each pool identity, year, nonempty account set, and source membership', () => {
    const values = [validInput(), validInput(), validInput(), validInput()]
    values[0]!.basisPoolEvidence = {
      ...values[0]!.basisPoolEvidence!,
      taxYear: 2029,
    }
    values[1]!.rmdPoolEvidence = {
      ...values[1]!.rmdPoolEvidence!,
      inheritedFromPersonId: beneficiaryPersonId,
    }
    values[2]!.basisPoolEvidence = {
      ...values[2]!.basisPoolEvidence!,
      accountIds: [otherAccountId],
    }
    values[3]!.rmdPoolEvidence = {
      ...values[3]!.rmdPoolEvidence!,
      accountIds: [sourceAccountId, sourceAccountId],
    }
    for (const value of values) expectInheritedFactsMissing(value)
  })

  it('requires every line-7 source to belong to the complete basis pool', () => {
    const value = validInput(60, 40, 50, 70)
    value.line7Distributions = [
      line7Entry(60),
      line7Entry(10, {
        actionId: asActionId('outside-action'),
        allocationId: asAllocationId('outside-allocation'),
        sourceAccountId: asAccountId('outside-pool'),
        scheduledDate: '2030-08-01',
        scheduledSequence: 2,
      }),
    ]
    expectInheritedFactsMissing(value)
  })

  it('requires authoritative line-7 total and exact current allocation binding', () => {
    const values = [validInput(), validInput(), validInput(), validInput()]
    values[0]!.basisPoolEvidence = {
      ...values[0]!.basisPoolEvidence!,
      form8606Line7DistributionAmount: asUsdCents(61),
    }
    values[1]!.line7Distributions = [
      line7Entry(60, { scheduledDate: '2030-06-16' }),
    ]
    values[2]!.line7Distributions = [line7Entry(59)]
    values[3]!.line7Distributions = [line7Entry(), line7Entry()]
    for (const value of values) expectInheritedFactsMissing(value)
  })

  it('rejects duplicate annual action and source pairs across allocations', () => {
    const value = validInput(60, 40, 50, 70)
    value.line7Distributions = [
      line7Entry(60),
      line7Entry(10, {
        allocationId: asAllocationId('allocation-b'),
      }),
    ]
    expectInheritedFactsMissing(value)
  })

  it('binds the RMD snapshot to the exact current execution record', () => {
    const mutations = [
      { actionId: asActionId('wrong-action') },
      { allocationId: asAllocationId('wrong-allocation') },
      { sourceAccountId: otherAccountId },
      { evaluationDate: '2030-06-14' },
      { evaluationDate: '2030-6-15' },
    ]
    for (const mutation of mutations) {
      const value = validInput()
      value.rmdPoolEvidence = {
        ...value.rmdPoolEvidence!,
        ...mutation,
      }
      expectInheritedFactsMissing(value)
    }
  })

  it('requires explicit line 8 zero, correct RMD arithmetic, and separate pools', () => {
    const line8 = validInput()
    line8.basisPoolEvidence = {
      ...line8.basisPoolEvidence!,
      form8606Line8NetConversionAmount: 1,
    } as unknown as typeof line8.basisPoolEvidence
    const arithmetic = validInput()
    arithmetic.rmdPoolEvidence = {
      ...arithmetic.rmdPoolEvidence!,
      remainingBeforeExecution: asUsdCents(74),
    }
    const samePool = validInput()
    samePool.rmdPoolEvidence = {
      ...samePool.rmdPoolEvidence!,
      poolId: 'basis-pool',
    }
    const negativeZero = validInput()
    negativeZero.basisPoolEvidence = {
      ...negativeZero.basisPoolEvidence!,
      form8606Line8NetConversionAmount: -0,
    } as unknown as typeof negativeZero.basisPoolEvidence
    // Negative zero is rejected as unparseable money before line 8 is read, so
    // it stays "facts missing" -- it is malformed evidence, not a conversion.
    for (const value of [negativeZero, arithmetic, samePool]) {
      expectInheritedFactsMissing(value)
    }
    // A present-but-unmodelled line 8 conversion is different: the evidence is
    // there and is refused on its own terms. Reporting "facts missing" would
    // send a caller hunting for evidence they already supplied.
    const conversion = classifyBeneficiaryTraditionalIraWithdrawal(line8)
    expect(conversion.status).toBe('unsupported')
    expect(conversion.reasons[0]?.code).toBe('withdrawal-spousal-conversion-unsupported')
  })

  it('requires nonblank distinct stable evidence IDs', () => {
    const blank = validInput()
    blank.basisPoolEvidence = {
      ...blank.basisPoolEvidence!,
      evidenceId: '   ',
    }
    const duplicate = validInput()
    duplicate.rmdPoolEvidence = {
      ...duplicate.rmdPoolEvidence!,
      evidenceId: 'basis-pool-record',
    }
    expectInheritedFactsMissing(blank)
    expectInheritedFactsMissing(duplicate)
  })

  it('returns unsupported for malformed nested money and schedules', () => {
    const badMoney = validInput()
    badMoney.rmdPoolEvidence = {
      ...badMoney.rmdPoolEvidence!,
      requiredAmount: -1,
    } as typeof badMoney.rmdPoolEvidence
    const badSchedule = validInput()
    badSchedule.line7Distributions = [
      line7Entry(60, { scheduledSequence: 0 }),
    ]
    const badNestedId = validInput()
    badNestedId.line7Distributions = [{
      ...line7Entry(),
      actionId: 1n,
    } as unknown as AnnualIraBasisAllocationEntryInput]
    expectInheritedFactsMissing(badMoney)
    expectInheritedFactsMissing(badSchedule)
    expectInheritedFactsMissing(badNestedId)
  })

  it('derives deterministic evidence IDs from all canonical basis facts', () => {
    const first = classifyBeneficiaryTraditionalIraWithdrawal(validInput())
    const repeated = classifyBeneficiaryTraditionalIraWithdrawal(validInput())
    expect(first.status).toBe('accepted')
    expect(repeated.status).toBe('accepted')
    if (first.status !== 'accepted' || repeated.status !== 'accepted') return
    expect(first.acceptedSourceEligibility.basisEvidence.evidenceId).toBe(
      repeated.acceptedSourceEligibility.basisEvidence.evidenceId,
    )
  })

  it('throws only for malformed top-level boundary fields', () => {
    const invalidValues = [
      { field: 'actionId', value: '   ' },
      { field: 'allocationId', value: '' },
      { field: 'sourceAccountId', value: '' },
      { field: 'beneficiaryPersonId', value: '' },
      { field: 'evaluationDate', value: '2030-6-15' },
      { field: 'taxYear', value: 2029 },
      { field: 'executedAmount', value: -1 },
    ] as const
    for (const { field, value: replacement } of invalidValues) {
      const value = validInput()
      Object.assign(value, { [field]: replacement })
      expect(() => classifyBeneficiaryTraditionalIraWithdrawal(value)).toThrow()
    }
  })
})
