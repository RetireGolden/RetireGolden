import { describe, expect, it } from 'vitest'

import type { AnnualIraBasisAllocationEntryInput } from './annualIraBasisAllocation.js'
import {
  finalizeBeneficiaryTraditionalIraAnnualEvidence,
  type BeneficiaryTraditionalIraAnnualBatchMemberManifest,
  type FinalizeBeneficiaryTraditionalIraAnnualEvidenceInput,
} from './beneficiaryTraditionalIraAnnualFinalization.js'
import {
  evaluateBeneficiaryTraditionalIraDeathPenalty,
  type BeneficiaryTraditionalIraDeathBeneficiaryEvidence,
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

const beneficiary = asPersonId('beneficiary')
const decedent = asPersonId('decedent')
const source = asAccountId('inherited-ira')
const otherSource = asAccountId('other-inherited-ira')
const thirdSource = asAccountId('third-inherited-ira')
const actionA = asActionId('withdrawal-a')
const actionB = asActionId('withdrawal-b')
const allocationA = asAllocationId('allocation-a')
const allocationB = asAllocationId('allocation-b')
const allocationC = asAllocationId('allocation-c')

const schedules = [
  {
    actionId: actionA,
    allocationId: allocationA,
    date: '2030-03-01',
    sequence: 1,
    sourceAccountId: source,
    amount: 20,
    opening: 100,
    closing: 80,
    satisfied: 0,
    remaining: 100,
  },
  {
    actionId: actionA,
    allocationId: allocationB,
    date: '2030-03-01',
    sequence: 1,
    sourceAccountId: otherSource,
    amount: 15,
    opening: 50,
    closing: 35,
    satisfied: 20,
    remaining: 80,
  },
  {
    actionId: actionB,
    allocationId: allocationC,
    date: '2030-07-01',
    sequence: 2,
    sourceAccountId: source,
    amount: 35,
    opening: 80,
    closing: 45,
    satisfied: 35,
    remaining: 65,
  },
] as const

function line7Entries(): AnnualIraBasisAllocationEntryInput[] {
  return schedules.map((item) => ({
    actionId: item.actionId,
    allocationId: item.allocationId,
    sourceAccountId: item.sourceAccountId,
    scheduledDate: item.date,
    scheduledSequence: item.sequence,
    grossAmount: asUsdCents(item.amount),
  }))
}

function characterizationInput(
  index: number,
): ClassifyBeneficiaryTraditionalIraWithdrawalInput {
  const item = schedules[index]!
  return {
    actionId: item.actionId,
    allocationId: item.allocationId,
    sourceAccountId: item.sourceAccountId,
    beneficiaryPersonId: beneficiary,
    decedentPersonId: decedent,
    evaluationDate: item.date,
    taxYear: 2030,
    executedAmount: asUsdCents(item.amount),
    inheritanceEvidence: {
      predicate: 'beneficiaryTraditionalIraInheritance',
      actionId: item.actionId,
      allocationId: item.allocationId,
      sourceAccountId: item.sourceAccountId,
      beneficiaryPersonId: beneficiary,
      decedentPersonId: decedent,
      evaluationDate: item.date,
      accountType: 'traditional',
      accountKind: 'ira',
      ownershipKind: 'beneficiary',
      deathDate: '2029-12-31',
      inheritanceEvidenceId: `inheritance-${index}`,
    },
    basisPoolEvidence: {
      predicate:
        'completeBeneficiaryTraditionalIraBasisPoolForBeneficiaryDecedentAndTaxYear',
      beneficiaryPersonId: beneficiary,
      inheritedFromPersonId: decedent,
      poolId: 'basis-pool',
      taxYear: 2030,
      accountIds: [source, otherSource],
      openingInheritedBasisAmount: asUsdCents(70),
      yearEndApplicablePoolBalanceAmount: asUsdCents(60),
      form8606Line7DistributionAmount: asUsdCents(70),
      form8606Line8NetConversionAmount: 0,
      evidenceId: 'basis-pool-record',
    },
    line7Distributions: line7Entries(),
    rmdPoolEvidence: {
      predicate:
        'completeBeneficiaryTraditionalIraRmdPoolForBeneficiaryDecedentAndTaxYear',
      actionId: item.actionId,
      allocationId: item.allocationId,
      sourceAccountId: item.sourceAccountId,
      evaluationDate: item.date,
      beneficiaryPersonId: beneficiary,
      inheritedFromPersonId: decedent,
      poolId: 'rmd-pool',
      taxYear: 2030,
      accountIds: [source, otherSource],
      requiredAmount: asUsdCents(100),
      satisfiedBeforeExecution: asUsdCents(item.satisfied),
      remainingBeforeExecution: asUsdCents(item.remaining),
      evidenceId: `rmd-${index}`,
    },
  }
}

function deathEvidence(
  index: number,
): BeneficiaryTraditionalIraDeathBeneficiaryEvidence {
  const item = schedules[index]!
  return {
    predicate: 'beneficiaryTraditionalIraDeathBeneficiary',
    actionId: item.actionId,
    allocationId: item.allocationId,
    sourceAccountId: item.sourceAccountId,
    beneficiaryPersonId: beneficiary,
    decedentPersonId: decedent,
    evaluationDate: item.date,
    deathDate: '2029-12-31',
    inheritanceEvidenceId: `inheritance-${index}`,
  }
}

function primitiveMember(index: number): StageBeneficiaryTraditionalIraMovementCandidateInput {
  const item = schedules[index]!
  const penaltyInput = {
    characterizationInput: characterizationInput(index),
    deathBeneficiaryEvidence: deathEvidence(index),
  }
  const sourceCharacter = penaltyIds(index)
  const sourceSnapshot: BeneficiaryTraditionalIraPhysicalSourceSnapshotEvidence = {
    predicate: 'beneficiaryTraditionalIraPhysicalSourceBeforeWithdrawal',
    actionId: item.actionId,
    allocationId: item.allocationId,
    sourceAccountId: item.sourceAccountId,
    beneficiaryPersonId: beneficiary,
    decedentPersonId: decedent,
    evaluationDate: item.date,
    executionSequence: item.sequence,
    requestedAmount: asPositiveUsdCents(item.amount),
    executedAmount: asPositiveUsdCents(item.amount),
    openingBalanceAmount: asUsdCents(item.opening),
    closingBalanceAmount: asUsdCents(item.closing),
    inheritanceEvidenceId: `inheritance-${index}`,
    basisEvidenceId: sourceCharacter.basisEvidenceId,
    sourceCharacterEvidenceId: sourceCharacter.sourceCharacterEvidenceId,
    penaltyEvidenceId: sourceCharacter.penaltyEvidenceId,
    rmdPoolId: 'rmd-pool',
    rmdEvidenceId: `rmd-${index}`,
    rmdRequiredAmount: asUsdCents(100),
    rmdSatisfiedBeforeExecution: asUsdCents(item.satisfied),
    rmdRemainingBeforeExecution: asUsdCents(item.remaining),
    physicalSourceEvidenceId: `physical-source-${index}`,
  }
  return { penaltyInput, sourceSnapshots: [sourceSnapshot] }
}

function penaltyIds(index: number): {
  basisEvidenceId: string
  sourceCharacterEvidenceId: string
  penaltyEvidenceId: string
} {
  const result = evaluateBeneficiaryTraditionalIraDeathPenalty({
    characterizationInput: characterizationInput(index),
    deathBeneficiaryEvidence: deathEvidence(index),
  })
  if (result.status !== 'accepted') throw new Error('Invalid annual fixture')
  return {
    basisEvidenceId:
      result.characterization.acceptedSourceEligibility.basisEvidence.evidenceId,
    sourceCharacterEvidenceId: result.penaltyEvidence.sourceCharacterEvidenceId,
    penaltyEvidenceId: result.penaltyEvidence.penaltyEvidenceId,
  }
}

function validInput(): FinalizeBeneficiaryTraditionalIraAnnualEvidenceInput {
  const members = [primitiveMember(0), primitiveMember(1), primitiveMember(2)]
  const staged = members.map((member) =>
    stageBeneficiaryTraditionalIraMovementCandidate(member),
  )
  if (staged.some((member) => member.status !== 'movementCandidateStaged')) {
    throw new Error('Invalid annual movement fixture')
  }
  const accepted = staged as Array<Extract<
    (typeof staged)[number],
    { status: 'movementCandidateStaged' }
  >>
  const first = accepted[0]!.characterization.acceptedSourceEligibility
  const manifestMembers: BeneficiaryTraditionalIraAnnualBatchMemberManifest[] =
    accepted.map((member) => ({
      actionId: member.candidate.actionId,
      allocationId: member.candidate.allocationId,
      sourceAccountId: member.candidate.sourceAccountId,
      executionDate: member.candidate.executionDate,
      executionSequence: member.candidate.executionSequence,
      requestedAmount: member.candidate.requestedAmount,
      executedAmount: member.candidate.executedAmount,
      openingBalanceAmount: member.candidate.openingBalanceAmount,
      closingBalanceAmount: member.candidate.candidateClosingBalanceAmount,
      movementCandidateId: member.movementCandidateId,
    }))
  return {
    manifest: {
      predicate:
        'completeBeneficiaryTraditionalIraAnnualBatchForBeneficiaryDecedentAndTaxYear',
      batchManifestId: 'annual-batch-manifest',
      beneficiaryPersonId: beneficiary,
      decedentPersonId: decedent,
      taxYear: 2030,
      basisPoolId: 'basis-pool',
      basisPoolEvidenceId: 'basis-pool-record',
      annualAllocationEvidenceId:
        first.basisEvidence.annualDistributionBasisAllocation
          .allocationEvidenceId,
      rmdPoolId: 'rmd-pool',
      rmdRequiredAmount: asUsdCents(100),
      members: manifestMembers,
    },
    members,
  }
}

function rebuildMember(
  input: FinalizeBeneficiaryTraditionalIraAnnualEvidenceInput,
  index: number,
): void {
  const member = input.members[index]!
  const penalty = evaluateBeneficiaryTraditionalIraDeathPenalty(
    member.penaltyInput,
  )
  if (penalty.status !== 'accepted') throw new Error('Invalid rebuilt fixture')
  const sourceEvidence = penalty.characterization.acceptedSourceEligibility
  member.sourceSnapshots = [{
    ...member.sourceSnapshots![0]!,
    basisEvidenceId: sourceEvidence.basisEvidence.evidenceId,
    sourceCharacterEvidenceId: penalty.penaltyEvidence.sourceCharacterEvidenceId,
    penaltyEvidenceId: penalty.penaltyEvidence.penaltyEvidenceId,
    rmdEvidenceId: sourceEvidence.rmdEvidence.evidenceId,
  }]
  const staged = stageBeneficiaryTraditionalIraMovementCandidate(member)
  if (staged.status !== 'movementCandidateStaged') {
    throw new Error('Invalid rebuilt movement fixture')
  }
  input.manifest.members[index]!.movementCandidateId = staged.movementCandidateId
}

function expectUnsupported(input: FinalizeBeneficiaryTraditionalIraAnnualEvidenceInput): void {
  const result = finalizeBeneficiaryTraditionalIraAnnualEvidence(input)
  expect(result).toMatchObject({
    status: 'unsupported',
    movement: 'notCommitted',
    committed: false,
    actionability: 'notEstablished',
    annualEvidence: null,
  })
  expect(result.reasons).toHaveLength(1)
  expect(result.reasons[0]?.code).toBe('withdrawal-inherited-facts-missing')
  expect(Object.isFrozen(result)).toBe(true)
}

describe('beneficiary traditional IRA annual evidence finalization', () => {
  it('finalizes canonical immutable annual evidence without movement or mutation', () => {
    const canonicalExpected =
      finalizeBeneficiaryTraditionalIraAnnualEvidence(validInput())
    const input = validInput()
    input.manifest.members = [
      input.manifest.members[2]!,
      input.manifest.members[1]!,
      input.manifest.members[0]!,
    ]
    input.members = [input.members[2]!, input.members[1]!, input.members[0]!]
    const before = structuredClone(input)
    const result = finalizeBeneficiaryTraditionalIraAnnualEvidence(input)

    expect(result).toMatchObject({
      status: 'annualEvidenceFinalized',
      movement: 'notCommitted',
      committed: false,
      actionability: 'notEstablished',
      reasons: [],
      annualEvidence: {
        beneficiaryPersonId: 'beneficiary',
        decedentPersonId: 'decedent',
        taxYear: 2030,
        initialRmdSatisfiedAmount: 0,
        finalRmdSatisfiedAmount: 70,
        finalRmdRemainingAmount: 30,
      },
    })
    expect(input).toEqual(before)
    expect(result).toEqual(canonicalExpected)
    if (result.status === 'annualEvidenceFinalized') {
      expect(result.annualEvidence.canonicalMembers.map(
        (member) => [member.candidate.actionId, member.candidate.allocationId],
      )).toEqual([
        ['withdrawal-a', 'allocation-a'],
        ['withdrawal-a', 'allocation-b'],
        ['withdrawal-b', 'allocation-c'],
      ])
      expect(result.annualEvidence.finalMemberEvidenceIds).toHaveLength(3)
      expect(result.annualEvidence.finalAnnualEvidenceId).toMatch(
        /^beneficiary-ira-final-annual-evidence:[0-9a-f]{64}$/,
      )
      expect(Object.isFrozen(result.annualEvidence.canonicalMembers[0])).toBe(true)
    }
    expect(finalizeBeneficiaryTraditionalIraAnnualEvidence(validInput()))
      .toEqual(finalizeBeneficiaryTraditionalIraAnnualEvidence(validInput()))
  })

  it('requires an exact nonempty manifest-to-member bijection', () => {
    for (const mutate of [
      (input: FinalizeBeneficiaryTraditionalIraAnnualEvidenceInput) => {
        input.manifest.members = []
      },
      (input: FinalizeBeneficiaryTraditionalIraAnnualEvidenceInput) => {
        input.members = [input.members[0]!]
      },
      (input: FinalizeBeneficiaryTraditionalIraAnnualEvidenceInput) => {
        input.manifest.members = [
          input.manifest.members[0]!,
          input.manifest.members[0]!,
        ]
      },
      (input: FinalizeBeneficiaryTraditionalIraAnnualEvidenceInput) => {
        input.members = [input.members[0]!, input.members[0]!]
      },
    ]) {
      const input = validInput()
      mutate(input)
      expectUnsupported(input)
    }
  })

  it('binds every manifest member identity and amount to rebuilt evidence', () => {
    for (const [field, value] of [
      ['actionId', asActionId('foreign-action')],
      ['allocationId', asAllocationId('foreign-allocation')],
      ['sourceAccountId', otherSource],
      ['executionDate', '2030-03-02'],
      ['executionSequence', 9],
      ['requestedAmount', 41],
      ['executedAmount', 41],
      ['openingBalanceAmount', 101],
      ['closingBalanceAmount', 59],
      ['movementCandidateId', 'foreign-candidate'],
    ] as const) {
      const input = validInput()
      ;(input.manifest.members[0] as unknown as Record<string, unknown>)[field] = value
      expectUnsupported(input)
    }
  })

  it('requires one beneficiary, decedent, year, basis allocation, and RMD pool', () => {
    for (const [field, value] of [
      ['beneficiaryPersonId', asPersonId('foreign-beneficiary')],
      ['decedentPersonId', asPersonId('foreign-decedent')],
      ['taxYear', 2031],
      ['basisPoolId', 'foreign-basis-pool'],
      ['basisPoolEvidenceId', 'foreign-basis-evidence'],
      ['annualAllocationEvidenceId', 'foreign-allocation-evidence'],
      ['rmdPoolId', 'foreign-rmd'],
      ['rmdRequiredAmount', 101],
    ] as const) {
      const input = validInput()
      ;(input.manifest as unknown as Record<string, unknown>)[field] = value
      expectUnsupported(input)
    }
  })

  it('binds the second allocation to its exact primitive basis authority', () => {
    const input = validInput()
    ;(input.members[1]!.penaltyInput.characterizationInput
      .basisPoolEvidence as unknown as Record<string, unknown>).evidenceId =
        'foreign-second-basis-pool-record'
    rebuildMember(input, 1)
    expectUnsupported(input)
  })

  it('derives the same final identity from differently ordered manifest keys', () => {
    const expected = finalizeBeneficiaryTraditionalIraAnnualEvidence(validInput())
    const reordered = validInput()
    reordered.manifest.members = reordered.manifest.members.map((member) =>
      Object.fromEntries(Object.entries(member).reverse()) as unknown as
        BeneficiaryTraditionalIraAnnualBatchMemberManifest,
    )
    reordered.manifest = Object.fromEntries(
      Object.entries(reordered.manifest).reverse(),
    ) as unknown as typeof reordered.manifest
    expect(finalizeBeneficiaryTraditionalIraAnnualEvidence(reordered))
      .toEqual(expected)
  })

  it('rejects differing rebuilt basis and RMD account inventories', () => {
    const basis = validInput()
    ;(basis.members[1]!.penaltyInput.characterizationInput
      .basisPoolEvidence as unknown as Record<string, unknown>).accountIds =
        [source, otherSource, thirdSource]
    rebuildMember(basis, 1)
    expectUnsupported(basis)

    const rmd = validInput()
    ;(rmd.members[1]!.penaltyInput.characterizationInput
      .rmdPoolEvidence as unknown as Record<string, unknown>).accountIds =
        [source, otherSource, thirdSource]
    rebuildMember(rmd, 1)
    expectUnsupported(rmd)
  })

  it('requires annual allocation membership to equal the manifest exactly', () => {
    const omitted = validInput()
    ;(omitted.members[0]!.penaltyInput.characterizationInput as unknown as
      Record<string, unknown>).line7Distributions = [line7Entries()[0]!]
    expectUnsupported(omitted)

    const foreignSequence = validInput()
    ;(foreignSequence.members[0]!.penaltyInput.characterizationInput
      .line7Distributions as AnnualIraBasisAllocationEntryInput[])[1] = {
        ...line7Entries()[1]!,
        scheduledSequence: 3,
      }
    expectUnsupported(foreignSequence)

    const foreignGross = validInput()
    ;(foreignGross.members[1]!.penaltyInput.characterizationInput
      .line7Distributions as AnnualIraBasisAllocationEntryInput[])[0] = {
        ...line7Entries()[0]!,
        grossAmount: asUsdCents(41),
      }
    expectUnsupported(foreignGross)
  })

  it('enforces unambiguous member and action schedule identities', () => {
    const duplicateActionAllocation = validInput()
    duplicateActionAllocation.manifest.members[1]!.allocationId = allocationA
    expectUnsupported(duplicateActionAllocation)

    const duplicateActionSource = validInput()
    duplicateActionSource.manifest.members[1]!.sourceAccountId = source
    expectUnsupported(duplicateActionSource)

    const splitActionSchedule = validInput()
    splitActionSchedule.manifest.members[1]!.executionSequence = 2
    expectUnsupported(splitActionSchedule)

    const differentActionCollision = validInput()
    differentActionCollision.manifest.members[2]!.executionDate = '2030-03-01'
    differentActionCollision.manifest.members[2]!.executionSequence = 1
    expectUnsupported(differentActionCollision)
  })

  it('proves source opening and closing conservation in canonical order', () => {
    const input = validInput()
    const second = input.members[2]!.sourceSnapshots![0]!
    input.members[2]!.sourceSnapshots = [{
      ...second,
      openingBalanceAmount: asUsdCents(81),
      closingBalanceAmount: asUsdCents(46),
    }]
    input.manifest.members[2]!.openingBalanceAmount = asUsdCents(81)
    input.manifest.members[2]!.closingBalanceAmount = asUsdCents(46)
    const staged = stageBeneficiaryTraditionalIraMovementCandidate(input.members[2]!)
    if (staged.status === 'movementCandidateStaged') {
      input.manifest.members[2]!.movementCandidateId = staged.movementCandidateId
    }
    expectUnsupported(input)
  })

  it('requires the exact safe-cent RMD progression', () => {
    for (const [field, value] of [
      ['satisfiedBeforeExecution', 39],
      ['remainingBeforeExecution', 61],
      ['requiredAmount', 101],
    ] as const) {
      const input = validInput()
      const rmd = input.members[1]!.penaltyInput.characterizationInput
        .rmdPoolEvidence!
      ;(rmd as unknown as Record<string, unknown>)[field] = value
      expectUnsupported(input)
    }
  })

  it('rejects foreign character, penalty, movement, and physical evidence', () => {
    for (const mutate of [
      (input: FinalizeBeneficiaryTraditionalIraAnnualEvidenceInput) => {
        ;(input.members[0]!.penaltyInput.characterizationInput as unknown as
          Record<string, unknown>).basisPoolEvidence = null
      },
      (input: FinalizeBeneficiaryTraditionalIraAnnualEvidenceInput) => {
        ;(input.members[0]!.penaltyInput.deathBeneficiaryEvidence as unknown as
          Record<string, unknown>).deathDate = '2030-12-31'
      },
      (input: FinalizeBeneficiaryTraditionalIraAnnualEvidenceInput) => {
        ;(input.members[0]!.sourceSnapshots![0] as unknown as
          Record<string, unknown>).penaltyEvidenceId = 'foreign'
      },
      (input: FinalizeBeneficiaryTraditionalIraAnnualEvidenceInput) => {
        ;(input.members[0]!.sourceSnapshots![0] as unknown as
          Record<string, unknown>).physicalSourceEvidenceId = 'basis-pool-record'
      },
    ]) {
      const input = validInput()
      mutate(input)
      expectUnsupported(input)
    }
  })

  it('fails closed for unsafe cents, malformed years and dates, and blank IDs', () => {
    const cases = [validInput(), validInput(), validInput(), validInput()]
    cases[0]!.manifest.taxYear = 2030.5
    cases[1]!.manifest.rmdRequiredAmount = Number.MAX_SAFE_INTEGER as never
    cases[2]!.manifest.members[0]!.executionDate = '2030-02-30'
    cases[3]!.manifest.batchManifestId = '   '
    for (const input of cases) expectUnsupported(input)
  })

  it('rejects duplicate per-member evidence IDs even in the same role', () => {
    const input = validInput()
    ;(input.members[1]!.sourceSnapshots![0] as unknown as
      Record<string, unknown>).physicalSourceEvidenceId = 'physical-source-0'
    const staged = stageBeneficiaryTraditionalIraMovementCandidate(input.members[1]!)
    if (staged.status === 'movementCandidateStaged') {
      input.manifest.members[1]!.movementCandidateId = staged.movementCandidateId
    }
    expectUnsupported(input)
  })

  it('snapshots once and rejects getters, symbols, exotic objects, and cycles', () => {
    const getter = validInput()
    let reads = 0
    Object.defineProperty(getter.manifest, 'taxYear', {
      enumerable: true,
      get: () => {
        reads += 1
        return 2030
      },
    })
    expectUnsupported(getter)
    expect(reads).toBe(0)

    const symbol = validInput()
    ;(symbol.manifest as unknown as Record<symbol, unknown>)[Symbol('x')] = true
    expectUnsupported(symbol)

    const exotic = validInput()
    exotic.manifest = Object.assign(
      Object.create({ hostile: true }),
      exotic.manifest,
    ) as typeof exotic.manifest
    expectUnsupported(exotic)

    const cyclic = validInput()
    ;(cyclic as unknown as Record<string, unknown>).cycle = cyclic
    expectUnsupported(cyclic)
  })

  it('never throws for hostile proxies or extra keys', () => {
    const proxied = validInput()
    proxied.manifest = new Proxy(proxied.manifest, {
      ownKeys: () => {
        throw new Error('hostile')
      },
    })
    expect(() => expectUnsupported(proxied)).not.toThrow()

    const extra = validInput()
    ;(extra.manifest.members[0] as unknown as Record<string, unknown>).extra = true
    expect(() => expectUnsupported(extra)).not.toThrow()

    const decorated = validInput()
    ;(decorated.manifest.members as unknown as Record<string, unknown>).extra =
      true
    expectUnsupported(decorated)

    const sparse = validInput()
    sparse.manifest.members = new Array(3) as typeof sparse.manifest.members
    expectUnsupported(sparse)

    const proxiedArray = validInput()
    let lengthReads = 0
    const decoratedMembers = [...proxiedArray.manifest.members]
    ;(decoratedMembers as unknown as Record<string, unknown>).extra = true
    proxiedArray.manifest.members = new Proxy(decoratedMembers, {
      get: (target, property, receiver) => {
        if (property === 'length') lengthReads += 1
        return Reflect.get(target, property, receiver)
      },
    })
    expectUnsupported(proxiedArray)
    expect(lengthReads).toBe(0)
  })
})
