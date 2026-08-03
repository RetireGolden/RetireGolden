import { describe, expect, it } from 'vitest'

import type { AnnualIraBasisAllocationEntryInput } from './annualIraBasisAllocation.js'
import {
  evaluateBeneficiaryTraditionalIraDeathPenalty,
  type BeneficiaryTraditionalIraDeathBeneficiaryEvidence,
  type EvaluateBeneficiaryTraditionalIraDeathPenaltyInput,
} from './beneficiaryTraditionalIraDeathPenalty.js'
import {
  stageBeneficiaryTraditionalIraMovementCandidate,
  type BeneficiaryTraditionalIraPhysicalSourceSnapshotEvidence,
  type StageBeneficiaryTraditionalIraMovementCandidateInput,
} from './beneficiaryTraditionalIraMovementCandidate.js'
import type { ClassifyBeneficiaryTraditionalIraWithdrawalInput } from './beneficiaryTraditionalIraWithdrawalCharacter.js'
import {
  asAccountId,
  asActionId,
  asAllocationId,
  asPersonId,
} from './identity.js'
import { asPositiveUsdCents, asUsdCents } from './money.js'

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
    scheduledSequence: 3,
    grossAmount: asUsdCents(grossAmount),
    ...overrides,
  }
}

function characterizationInput(): ClassifyBeneficiaryTraditionalIraWithdrawalInput {
  return {
    actionId,
    allocationId,
    sourceAccountId,
    beneficiaryPersonId,
    decedentPersonId,
    evaluationDate: '2030-06-15',
    taxYear: 2030,
    executedAmount: asUsdCents(60),
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
      openingInheritedBasisAmount: asUsdCents(40),
      yearEndApplicablePoolBalanceAmount: asUsdCents(40),
      form8606Line7DistributionAmount: asUsdCents(60),
      form8606Line8NetConversionAmount: 0,
      evidenceId: 'basis-pool-record',
    },
    line7Distributions: [line7Entry()],
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

function penaltyInput(): EvaluateBeneficiaryTraditionalIraDeathPenaltyInput {
  return {
    characterizationInput: characterizationInput(),
    deathBeneficiaryEvidence: deathEvidence(),
    spousalElection: {
      status: 'spousalElectionNotApplicable',
      relationship: 'notSurvivingSpouse',
      evidenceId: 'spousal-election-not-applicable',
    },
  }
}

function sourceSnapshot(
  penalty: ReturnType<typeof evaluateBeneficiaryTraditionalIraDeathPenalty>,
): BeneficiaryTraditionalIraPhysicalSourceSnapshotEvidence {
  if (penalty.status !== 'accepted') {
    throw new Error('Movement fixture penalty evidence was not accepted')
  }
  const source = penalty.characterization.acceptedSourceEligibility
  return {
    predicate: 'beneficiaryTraditionalIraPhysicalSourceBeforeWithdrawal',
    actionId,
    allocationId,
    sourceAccountId,
    beneficiaryPersonId,
    decedentPersonId,
    evaluationDate: '2030-06-15',
    executionSequence: 3,
    requestedAmount: asPositiveUsdCents(60),
    executedAmount: asPositiveUsdCents(60),
    openingBalanceAmount: asUsdCents(100),
    closingBalanceAmount: asUsdCents(40),
    inheritanceEvidenceId: source.inheritanceEvidenceId,
    basisEvidenceId: source.basisEvidence.evidenceId,
    sourceCharacterEvidenceId:
      penalty.penaltyEvidence.sourceCharacterEvidenceId,
    penaltyEvidenceId: penalty.penaltyEvidence.penaltyEvidenceId,
    rmdPoolId: source.rmdEvidence.poolId,
    rmdEvidenceId: source.rmdEvidence.evidenceId,
    rmdRequiredAmount: source.rmdEvidence.requiredAmount,
    rmdSatisfiedBeforeExecution:
      source.rmdEvidence.satisfiedBeforeExecution,
    rmdRemainingBeforeExecution:
      source.rmdEvidence.remainingBeforeExecution,
    physicalSourceEvidenceId: 'physical-source-record',
  }
}

function validInput(): StageBeneficiaryTraditionalIraMovementCandidateInput {
  const primitivePenaltyInput = penaltyInput()
  const penalty = evaluateBeneficiaryTraditionalIraDeathPenalty(
    primitivePenaltyInput,
  )
  return {
    penaltyInput: primitivePenaltyInput,
    sourceSnapshots: [sourceSnapshot(penalty)],
  }
}

function expectUnsupported(
  input: StageBeneficiaryTraditionalIraMovementCandidateInput,
): void {
  const result = stageBeneficiaryTraditionalIraMovementCandidate(input)
  expect(result).toEqual({
    status: 'unsupported',
    movement: 'notCommitted',
    committed: false,
    actionability: 'notEstablished',
    reasons: [{
      code: 'withdrawal-inherited-facts-missing',
      predicate: 'inheritedWithdrawalEligibility',
      outcome: 'unsupported',
      message:
        'Beneficiary, decedent, annual basis denominator, or inherited-distribution facts are incomplete.',
    }],
    movementCandidateId: null,
    characterization: null,
    deathPenaltyEvidence: null,
    candidate: null,
  })
  expect(Object.isFrozen(result)).toBe(true)
  expect(Object.isFrozen(result.reasons[0])).toBe(true)
}

function replaceSource(
  input: StageBeneficiaryTraditionalIraMovementCandidateInput,
  changes: Partial<BeneficiaryTraditionalIraPhysicalSourceSnapshotEvidence>,
): void {
  input.sourceSnapshots = [{ ...input.sourceSnapshots![0]!, ...changes }]
}

describe('beneficiary traditional IRA movement candidate', () => {
  it('stages one exact inherited-IRA debit without committing or mutating input', () => {
    const input = validInput()
    const before = structuredClone(input)
    const result = stageBeneficiaryTraditionalIraMovementCandidate(input)

    expect(result).toMatchObject({
      status: 'movementCandidateStaged',
      movement: 'notCommitted',
      committed: false,
      actionability: 'notEstablished',
      reasons: [],
      characterization: {
        status: 'accepted',
        acceptedSourceEligibility: {
          sourceAccountId: 'inherited-ira-a',
          beneficiaryPersonId: 'beneficiary',
          decedentPersonId: 'decedent',
        },
      },
      deathPenaltyEvidence: {
        treatment: 'deathBeneficiary',
        penaltyRate: 0,
        finalPenaltyAmount: 0,
      },
      candidate: {
        actionId: 'withdrawal-a',
        allocationId: 'allocation-a',
        sourceAccountId: 'inherited-ira-a',
        beneficiaryPersonId: 'beneficiary',
        decedentPersonId: 'decedent',
        executionDate: '2030-06-15',
        executionSequence: 3,
        requestedAmount: 60,
        executedAmount: 60,
        unexecutedAmount: 0,
        openingBalanceAmount: 100,
        candidateClosingBalanceAmount: 40,
        sourceDebit: {
          kind: 'beneficiaryTraditionalIraSourceDebit',
          sourceAccountId: 'inherited-ira-a',
          debitAmount: 60,
          balanceBefore: 100,
          balanceAfter: 40,
          physicalSourceEvidenceId: 'physical-source-record',
        },
        destinationCredits: [],
        rmdPoolId: 'rmd-pool',
        rmdEvidenceId: 'rmd-pool-record',
        rmdRequiredAmount: 100,
        rmdSatisfiedBeforeExecution: 25,
        rmdRemainingBeforeExecution: 75,
      },
    })
    expect(input).toEqual(before)
    expect(result).toEqual(stageBeneficiaryTraditionalIraMovementCandidate(validInput()))
    expect(Object.isFrozen(result)).toBe(true)
    if (result.status === 'movementCandidateStaged') {
      expect(result.movementCandidateId).toMatch(
        /^beneficiary-ira-movement-candidate:[0-9a-f]{64}$/,
      )
      expect(Object.isFrozen(result.candidate)).toBe(true)
      expect(Object.isFrozen(result.candidate.sourceDebit)).toBe(true)
      expect(Object.isFrozen(result.characterization)).toBe(true)
      expect(Object.isFrozen(result.deathPenaltyEvidence)).toBe(true)
    }
  })

  it('fails closed for missing or ambiguous physical source snapshots', () => {
    for (const snapshots of [null, [], [
      validInput().sourceSnapshots![0]!,
      validInput().sourceSnapshots![0]!,
    ]] as const) {
      const input = validInput()
      input.sourceSnapshots = snapshots
      expectUnsupported(input)
    }
  })

  it('requires a positive full execution supported by the opening source', () => {
    const cases: Array<Partial<BeneficiaryTraditionalIraPhysicalSourceSnapshotEvidence>> = [
      { requestedAmount: asPositiveUsdCents(61) },
      { executedAmount: asPositiveUsdCents(59) },
      {
        openingBalanceAmount: asUsdCents(59),
        closingBalanceAmount: asUsdCents(0),
      },
      { closingBalanceAmount: asUsdCents(41) },
      { executedAmount: 0 as never },
    ]
    for (const changes of cases) {
      const input = validInput()
      replaceSource(input, changes)
      expectUnsupported(input)
    }
  })

  it('binds every action, allocation, person, source, date, and sequence identity', () => {
    const cases: Array<Partial<BeneficiaryTraditionalIraPhysicalSourceSnapshotEvidence>> = [
      { actionId: asActionId('foreign-action') },
      { allocationId: asAllocationId('foreign-allocation') },
      { sourceAccountId: asAccountId('foreign-source') },
      { beneficiaryPersonId: asPersonId('foreign-beneficiary') },
      { decedentPersonId: asPersonId('foreign-decedent') },
      { evaluationDate: '2030-06-14' },
      { executionSequence: 0 },
      { executionSequence: 1.5 },
      { executionSequence: 4 },
    ]
    for (const changes of cases) {
      const input = validInput()
      replaceSource(input, changes)
      expectUnsupported(input)
    }
  })

  it('rejects foreign character, penalty, basis, inheritance, and RMD bindings', () => {
    const cases: Array<Partial<BeneficiaryTraditionalIraPhysicalSourceSnapshotEvidence>> = [
      { inheritanceEvidenceId: 'foreign-inheritance' },
      { basisEvidenceId: 'foreign-basis' },
      { sourceCharacterEvidenceId: 'foreign-character' },
      { penaltyEvidenceId: 'foreign-penalty' },
      { rmdPoolId: 'foreign-rmd-pool' },
      { rmdEvidenceId: 'foreign-rmd' },
      { rmdRequiredAmount: asUsdCents(101) },
      { rmdSatisfiedBeforeExecution: asUsdCents(26) },
      { rmdRemainingBeforeExecution: asUsdCents(74) },
    ]
    for (const changes of cases) {
      const input = validInput()
      replaceSource(input, changes)
      expectUnsupported(input)
    }
  })

  it('rejects cross-role evidence ID collisions', () => {
    for (const collisionField of [
      'inheritanceEvidenceId',
      'basisEvidenceId',
      'sourceCharacterEvidenceId',
      'penaltyEvidenceId',
      'rmdEvidenceId',
    ] as const) {
      const input = validInput()
      const collision = input.sourceSnapshots![0]![collisionField]
      replaceSource(input, { physicalSourceEvidenceId: collision })
      expectUnsupported(input)
    }
    const basisPoolCollision = validInput()
    replaceSource(basisPoolCollision, {
      physicalSourceEvidenceId:
        basisPoolCollision.penaltyInput.characterizationInput
          .basisPoolEvidence!.evidenceId,
    })
    expectUnsupported(basisPoolCollision)
  })

  it('fails closed for unsafe cents and unsafe identity values', () => {
    for (const [field, value] of [
      ['requestedAmount', -1],
      ['executedAmount', 1.5],
      ['openingBalanceAmount', Number.MAX_SAFE_INTEGER + 1],
      ['closingBalanceAmount', Number.NaN],
      ['rmdRequiredAmount', -0],
      ['actionId', 1],
      ['sourceAccountId', null],
      ['physicalSourceEvidenceId', '   '],
    ] as const) {
      const input = validInput()
      ;(input.sourceSnapshots![0] as unknown as Record<string, unknown>)[field] = value
      expect(() => expectUnsupported(input)).not.toThrow()
    }
  })

  it('rebuilds primitive character and death facts instead of trusting references', () => {
    const inputs = [validInput(), validInput(), validInput()]
    inputs[0]!.penaltyInput = {
      ...inputs[0]!.penaltyInput,
      characterizationInput: {
        ...inputs[0]!.penaltyInput.characterizationInput,
        basisPoolEvidence: null,
      },
    }
    inputs[1]!.penaltyInput = {
      ...inputs[1]!.penaltyInput,
      deathBeneficiaryEvidence: {
        ...inputs[1]!.penaltyInput.deathBeneficiaryEvidence!,
        deathDate: '2030-06-16',
      },
    }
    inputs[2]!.penaltyInput = {
      ...inputs[2]!.penaltyInput,
      characterizationInput: {
        ...inputs[2]!.penaltyInput.characterizationInput,
        executedAmount: asUsdCents(59),
      },
    }
    for (const input of inputs) expectUnsupported(input)
  })

  it('fails closed before invoking stateful physical-source getters', () => {
    const input = validInput()
    const source = { ...input.sourceSnapshots![0]! }
    let reads = 0
    Object.defineProperty(source, 'openingBalanceAmount', {
      enumerable: true,
      get: () => {
        reads += 1
        return reads === 1 ? 100 : 60
      },
    })
    input.sourceSnapshots = [source]
    expectUnsupported(input)
    expect(reads).toBe(0)
  })

  it('rejects exotic prototypes, proxies, cycles, and extra fields', () => {
    const inherited = validInput()
    inherited.sourceSnapshots = [Object.assign(
      Object.create({ hostile: true }),
      inherited.sourceSnapshots![0],
    ) as BeneficiaryTraditionalIraPhysicalSourceSnapshotEvidence]
    expectUnsupported(inherited)

    const proxied = validInput()
    proxied.sourceSnapshots = [new Proxy(proxied.sourceSnapshots![0]!, {
      ownKeys: () => {
        throw new Error('hostile ownKeys')
      },
    })]
    expect(() => expectUnsupported(proxied)).not.toThrow()

    const cyclic = validInput()
    ;(cyclic.sourceSnapshots![0] as unknown as Record<string, unknown>).cycle =
      cyclic.sourceSnapshots![0]
    expectUnsupported(cyclic)

    const extra = validInput()
    ;(extra.sourceSnapshots![0] as unknown as Record<string, unknown>).extra = true
    expectUnsupported(extra)
  })

  it('rejects sparse and decorated source snapshot arrays', () => {
    const sparse = validInput()
    ;(sparse.sourceSnapshots as unknown[]).length = 2
    expectUnsupported(sparse)

    const decorated = validInput()
    Object.defineProperty(decorated.sourceSnapshots!, 'extra', {
      enumerable: true,
      value: 'extra',
    })
    expectUnsupported(decorated)
  })

  it('canonicalizes upstream account order before deriving candidate identity', () => {
    const first = stageBeneficiaryTraditionalIraMovementCandidate(validInput())
    const reordered = validInput()
    reordered.penaltyInput = {
      ...reordered.penaltyInput,
      characterizationInput: {
        ...reordered.penaltyInput.characterizationInput,
        basisPoolEvidence: {
          ...reordered.penaltyInput.characterizationInput.basisPoolEvidence!,
          accountIds: [sourceAccountId, otherAccountId],
        },
        rmdPoolEvidence: {
          ...reordered.penaltyInput.characterizationInput.rmdPoolEvidence!,
          accountIds: [sourceAccountId, otherAccountId],
        },
      },
    }
    expect(stageBeneficiaryTraditionalIraMovementCandidate(reordered)).toEqual(
      first,
    )
  })
})
