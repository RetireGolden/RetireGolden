import { describe, expect, it } from 'vitest'

import type { AnnualIraBasisAllocationEntryInput } from './annualIraBasisAllocation.js'
import {
  evaluateBeneficiaryTraditionalIraDeathPenalty,
  type BeneficiaryTraditionalIraDeathBeneficiaryEvidence,
  type EvaluateBeneficiaryTraditionalIraDeathPenaltyInput,
} from './beneficiaryTraditionalIraDeathPenalty.js'
import type { ClassifyBeneficiaryTraditionalIraWithdrawalInput } from './beneficiaryTraditionalIraWithdrawalCharacter.js'
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

function characterizationInput(
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
      form8606Line8NetConversionAmount: 0,
      evidenceId: 'basis-pool-record',
    },
    line7Distributions: [line7Entry(line7Amount)],
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

function deathEvidence(): BeneficiaryTraditionalIraDeathBeneficiaryEvidence {
  return {
    predicate: 'beneficiaryTraditionalIraDeathBeneficiary',
    actionId,
    allocationId,
    sourceAccountId,
    beneficiaryPersonId,
    decedentPersonId,
    evaluationDate: '2030-06-15',
    deathDate: '2029-12-31',
    inheritanceEvidenceId: 'inheritance-record',
  }
}

function validInput(): EvaluateBeneficiaryTraditionalIraDeathPenaltyInput {
  return {
    characterizationInput: characterizationInput(),
    deathBeneficiaryEvidence: deathEvidence(),
  }
}

function expectUnsupported(input: EvaluateBeneficiaryTraditionalIraDeathPenaltyInput): void {
  const result = evaluateBeneficiaryTraditionalIraDeathPenalty(input)
  expect(result).toEqual({
    status: 'unsupported',
    reasons: [{
      code: 'withdrawal-inherited-facts-missing',
      predicate: 'inheritedWithdrawalEligibility',
      outcome: 'unsupported',
      message:
        'Beneficiary, decedent, annual basis denominator, or inherited-distribution facts are incomplete.',
    }],
    characterization: null,
    penaltyEvidence: null,
  })
  expect(Object.isFrozen(result)).toBe(true)
  expect(Object.isFrozen(result.reasons)).toBe(true)
  expect(Object.isFrozen(result.reasons[0])).toBe(true)
}

describe('beneficiary traditional IRA death penalty evidence', () => {
  it('rebuilds character and emits exact death-beneficiary zero-penalty evidence', () => {
    const input = validInput()
    const before = structuredClone(input)
    const result = evaluateBeneficiaryTraditionalIraDeathPenalty(input)

    expect(result).toMatchObject({
      status: 'accepted',
      reasons: [],
      characterization: {
        status: 'accepted',
        acceptedSourceEligibility: {
          allocationId: 'allocation-a',
          sourceAccountId: 'inherited-ira-a',
          beneficiaryPersonId: 'beneficiary',
          decedentPersonId: 'decedent',
          inheritanceEvidenceId: 'inheritance-record',
        },
      },
      penaltyEvidence: {
        predicate: 'withdrawalPenaltyEvidence',
        treatment: 'deathBeneficiary',
        actionId: 'withdrawal-a',
        allocationId: 'allocation-a',
        sourceAccountId: 'inherited-ira-a',
        beneficiaryPersonId: 'beneficiary',
        decedentPersonId: 'decedent',
        evaluationDate: '2030-06-15',
        sourceClass: 'beneficiaryTraditionalIra',
        executedAmount: 60,
        basisReturnExcludedAmount: 24,
        taxableAmountExposed: 36,
        penaltyRate: 0,
        finalPenaltyAmount: 0,
        acceptedEvidence: {
          evaluationDate: '2030-06-15',
          deathDate: '2029-12-31',
          sourceAccountId: 'inherited-ira-a',
          beneficiaryPersonId: 'beneficiary',
          decedentPersonId: 'decedent',
          inheritanceEvidenceId: 'inheritance-record',
        },
        characterBindings: [
          {
            characterIndex: 0,
            kind: 'basisReturn',
            amount: 24,
            actionId: 'withdrawal-a',
            allocationId: 'allocation-a',
            sourceAccountId: 'inherited-ira-a',
          },
          {
            characterIndex: 1,
            kind: 'ordinaryIncome',
            amount: 36,
            actionId: 'withdrawal-a',
            allocationId: 'allocation-a',
            sourceAccountId: 'inherited-ira-a',
          },
        ],
      },
    })
    expect(result).toEqual(evaluateBeneficiaryTraditionalIraDeathPenalty(validInput()))
    expect(input).toEqual(before)
    expect(Object.isFrozen(result)).toBe(true)
    if (result.status === 'accepted') {
      expect(Object.isFrozen(result.characterization)).toBe(true)
      expect(Object.isFrozen(result.penaltyEvidence)).toBe(true)
      expect(Object.isFrozen(result.penaltyEvidence.acceptedEvidence)).toBe(true)
      expect(Object.isFrozen(result.penaltyEvidence.characterBindings)).toBe(true)
      expect(result.penaltyEvidence.sourceCharacterEvidenceId).toMatch(
        /^beneficiary-ira-penalty-character-coverage:[0-9a-f]{64}$/,
      )
      expect(result.penaltyEvidence.penaltyEvidenceId).toMatch(
        /^beneficiary-ira-death-penalty:[0-9a-f]{64}$/,
      )
      for (const binding of result.penaltyEvidence.characterBindings) {
        expect(binding.characterEvidenceId).toMatch(
          /^beneficiary-ira-penalty-character:[0-9a-f]{64}$/,
        )
      }
    }
  })

  it('preserves literal-zero treatment for an empty zero-execution pool', () => {
    const input = validInput()
    input.characterizationInput = characterizationInput(0, 0, 0, 0)
    const result = evaluateBeneficiaryTraditionalIraDeathPenalty(input)

    expect(result).toMatchObject({
      status: 'accepted',
      characterization: { taxCharacter: [] },
      penaltyEvidence: {
        executedAmount: 0,
        basisReturnExcludedAmount: 0,
        taxableAmountExposed: 0,
        penaltyRate: 0,
        finalPenaltyAmount: 0,
        characterBindings: [],
      },
    })
  })

  it('fails closed when death occurs after the exact evaluation date', () => {
    const input = validInput()
    input.deathBeneficiaryEvidence = {
      ...deathEvidence(),
      deathDate: '2030-06-16',
    }
    expectUnsupported(input)

    const sameDay = validInput()
    sameDay.characterizationInput = {
      ...sameDay.characterizationInput,
      inheritanceEvidence: {
        ...sameDay.characterizationInput.inheritanceEvidence!,
        deathDate: '2030-06-15',
      },
    }
    sameDay.deathBeneficiaryEvidence = {
      ...deathEvidence(),
      deathDate: '2030-06-15',
    }
    expect(evaluateBeneficiaryTraditionalIraDeathPenalty(sameDay).status).toBe(
      'accepted',
    )
  })

  it('requires every death fact identity and inheritance binding to match', () => {
    const mismatches: Array<Partial<BeneficiaryTraditionalIraDeathBeneficiaryEvidence>> = [
      { actionId: asActionId('other-action') },
      { allocationId: asAllocationId('other-allocation') },
      { sourceAccountId: asAccountId('other-source') },
      { beneficiaryPersonId: asPersonId('other-beneficiary') },
      { decedentPersonId: asPersonId('other-decedent') },
      { evaluationDate: '2030-06-14' },
      { deathDate: '2029-12-30' },
      { inheritanceEvidenceId: 'other-inheritance-record' },
      { predicate: 'wrong' as never },
    ]
    for (const mismatch of mismatches) {
      const input = validInput()
      input.deathBeneficiaryEvidence = { ...deathEvidence(), ...mismatch }
      expectUnsupported(input)
    }
  })

  it('fails closed when the rebuilt annual character evidence is incomplete', () => {
    const cases = [
      (input: ClassifyBeneficiaryTraditionalIraWithdrawalInput) => ({
        ...input,
        basisPoolEvidence: null,
      }),
      (input: ClassifyBeneficiaryTraditionalIraWithdrawalInput) => ({
        ...input,
        line7Distributions: [],
      }),
      (input: ClassifyBeneficiaryTraditionalIraWithdrawalInput) => ({
        ...input,
        rmdPoolEvidence: null,
      }),
      (input: ClassifyBeneficiaryTraditionalIraWithdrawalInput) => ({
        ...input,
        executedAmount: asUsdCents(61),
      }),
    ]
    for (const change of cases) {
      const input = validInput()
      input.characterizationInput = change(input.characterizationInput)
      expectUnsupported(input)
    }
  })

  it('rejects cross-role duplicate evidence IDs before publishing treatment', () => {
    const input = validInput()
    input.characterizationInput = {
      ...input.characterizationInput,
      rmdPoolEvidence: {
        ...input.characterizationInput.rmdPoolEvidence!,
        evidenceId: 'basis-pool-record',
      },
    }
    expectUnsupported(input)

    const allocationCollision = validInput()
    allocationCollision.characterizationInput = {
      ...allocationCollision.characterizationInput,
      inheritanceEvidence: {
        ...allocationCollision.characterizationInput.inheritanceEvidence!,
        inheritanceEvidenceId: 'basis-pool-record',
      },
    }
    allocationCollision.deathBeneficiaryEvidence = {
      ...deathEvidence(),
      inheritanceEvidenceId: 'basis-pool-record',
    }
    expectUnsupported(allocationCollision)
  })

  it('fails closed for unsafe identity values without throwing', () => {
    for (const [target, field, value] of [
      ['death', 'actionId', 1],
      ['death', 'sourceAccountId', null],
      ['death', 'beneficiaryPersonId', '   '],
      ['character', 'allocationId', {}],
      ['character', 'decedentPersonId', undefined],
    ] as const) {
      const input = validInput()
      if (target === 'death') {
        ;(input.deathBeneficiaryEvidence as unknown as Record<string, unknown>)[field] = value
      } else {
        ;(input.characterizationInput as unknown as Record<string, unknown>)[field] = value
      }
      expect(() => expectUnsupported(input)).not.toThrow()
    }
  })

  it('rejects extra fields, inherited prototypes, accessors, and hostile proxies', () => {
    const extra = validInput()
    extra.deathBeneficiaryEvidence = {
      ...deathEvidence(),
      extra: true,
    } as BeneficiaryTraditionalIraDeathBeneficiaryEvidence
    expectUnsupported(extra)

    const inherited = validInput()
    inherited.deathBeneficiaryEvidence = Object.assign(
      Object.create({ inherited: true }),
      deathEvidence(),
    ) as BeneficiaryTraditionalIraDeathBeneficiaryEvidence
    expectUnsupported(inherited)

    const accessor = validInput()
    const accessorEvidence = { ...deathEvidence() }
    Object.defineProperty(accessorEvidence, 'inheritanceEvidenceId', {
      enumerable: true,
      get: () => {
        throw new Error('must not invoke hostile getter')
      },
    })
    accessor.deathBeneficiaryEvidence = accessorEvidence
    expect(() => expectUnsupported(accessor)).not.toThrow()

    const proxy = validInput()
    proxy.deathBeneficiaryEvidence = new Proxy(deathEvidence(), {
      ownKeys: () => {
        throw new Error('hostile ownKeys')
      },
    })
    expect(() => expectUnsupported(proxy)).not.toThrow()
  })

  it('fails closed before invoking hostile or stateful characterization getters', () => {
    const getter = validInput()
    let actionReads = 0
    Object.defineProperty(getter.characterizationInput, 'actionId', {
      enumerable: true,
      get: () => {
        actionReads += 1
        return actionReads === 1 ? actionId : asActionId('swapped-action')
      },
    })
    expect(() => expectUnsupported(getter)).not.toThrow()
    expect(actionReads).toBe(0)

    const nestedGetter = validInput()
    const inheritanceEvidence = {
      ...nestedGetter.characterizationInput.inheritanceEvidence!,
    }
    let deathDateReads = 0
    Object.defineProperty(inheritanceEvidence, 'deathDate', {
      enumerable: true,
      get: () => {
        deathDateReads += 1
        return deathDateReads === 1 ? '2029-12-31' : '2030-06-15'
      },
    })
    nestedGetter.characterizationInput = {
      ...nestedGetter.characterizationInput,
      inheritanceEvidence,
    }
    expect(() => expectUnsupported(nestedGetter)).not.toThrow()
    expect(deathDateReads).toBe(0)

    const evidenceIdGetter = validInput()
    const rmdPoolEvidence = {
      ...evidenceIdGetter.characterizationInput.rmdPoolEvidence!,
    }
    let evidenceIdReads = 0
    Object.defineProperty(rmdPoolEvidence, 'evidenceId', {
      enumerable: true,
      get: () => {
        evidenceIdReads += 1
        return evidenceIdReads === 1
          ? 'rmd-pool-record'
          : 'basis-pool-record'
      },
    })
    evidenceIdGetter.characterizationInput = {
      ...evidenceIdGetter.characterizationInput,
      rmdPoolEvidence,
    }
    expect(() => expectUnsupported(evidenceIdGetter)).not.toThrow()
    expect(evidenceIdReads).toBe(0)
  })

  it('canonicalizes account order without changing death penalty identity', () => {
    const first = evaluateBeneficiaryTraditionalIraDeathPenalty(validInput())
    const reordered = validInput()
    reordered.characterizationInput = {
      ...reordered.characterizationInput,
      basisPoolEvidence: {
        ...reordered.characterizationInput.basisPoolEvidence!,
        accountIds: [sourceAccountId, otherAccountId],
      },
      rmdPoolEvidence: {
        ...reordered.characterizationInput.rmdPoolEvidence!,
        accountIds: [sourceAccountId, otherAccountId],
      },
    }
    const second = evaluateBeneficiaryTraditionalIraDeathPenalty(reordered)

    expect(second).toEqual(first)
  })
})
