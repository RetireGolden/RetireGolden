import { describe, expect, it } from 'vitest'

import type { AnnualIraBasisAllocationEntryInput } from './annualIraBasisAllocation.js'
import {
  prepareBeneficiaryTraditionalIraAnnualPhysicalTransaction,
  type PrepareBeneficiaryTraditionalIraAnnualPhysicalTransactionInput,
} from './beneficiaryTraditionalIraAnnualPhysicalTransaction.js'
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
const sourceA = asAccountId('inherited-ira-a')
const sourceB = asAccountId('inherited-ira-b')
const sourceC = asAccountId('inherited-ira-c-zero')
const actionA = asActionId('withdrawal-a')
const actionB = asActionId('withdrawal-b')
const allocationA = asAllocationId('allocation-a')
const allocationB = asAllocationId('allocation-b')
const allocationC = asAllocationId('allocation-c')

type Mutable<T> = T extends string | number | boolean | null | undefined
  ? T
  : T extends readonly [infer Head, ...infer Tail]
    ? [Mutable<Head>, ...{ -readonly [Key in keyof Tail]: Mutable<Tail[Key]> }]
    : T extends readonly (infer Item)[]
      ? Mutable<Item>[]
      : { -readonly [Key in keyof T]: Mutable<T[Key]> }
type MutableInput = Mutable<
  PrepareBeneficiaryTraditionalIraAnnualPhysicalTransactionInput
>

const schedules = [
  {
    actionId: actionA, allocationId: allocationA, sourceAccountId: sourceA,
    date: '2030-03-01', sequence: 1, amount: 20, opening: 100, closing: 80,
    satisfied: 0, remaining: 100,
  },
  {
    actionId: actionA, allocationId: allocationB, sourceAccountId: sourceB,
    date: '2030-03-01', sequence: 1, amount: 15, opening: 50, closing: 35,
    satisfied: 20, remaining: 80,
  },
  {
    actionId: actionB, allocationId: allocationC, sourceAccountId: sourceA,
    date: '2030-07-01', sequence: 2, amount: 35, opening: 80, closing: 45,
    satisfied: 35, remaining: 65,
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
      accountIds: [sourceA, sourceB, sourceC],
      openingInheritedBasisAmount: asUsdCents(70),
      yearEndApplicablePoolBalanceAmount: asUsdCents(89),
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
      accountIds: [sourceA, sourceB, sourceC],
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

function primitiveMember(
  index: number,
): StageBeneficiaryTraditionalIraMovementCandidateInput {
  const item = schedules[index]!
  const penaltyInput = {
    characterizationInput: characterizationInput(index),
    deathBeneficiaryEvidence: deathEvidence(index),
  }
  const penalty = evaluateBeneficiaryTraditionalIraDeathPenalty(penaltyInput)
  if (penalty.status !== 'accepted') throw new Error('Invalid fixture')
  const source = penalty.characterization.acceptedSourceEligibility
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
    basisEvidenceId: source.basisEvidence.evidenceId,
    sourceCharacterEvidenceId: penalty.penaltyEvidence.sourceCharacterEvidenceId,
    penaltyEvidenceId: penalty.penaltyEvidence.penaltyEvidenceId,
    rmdPoolId: 'rmd-pool',
    rmdEvidenceId: `rmd-${index}`,
    rmdRequiredAmount: asUsdCents(100),
    rmdSatisfiedBeforeExecution: asUsdCents(item.satisfied),
    rmdRemainingBeforeExecution: asUsdCents(item.remaining),
    physicalSourceEvidenceId: `physical-source-${index}`,
  }
  return { penaltyInput, sourceSnapshots: [sourceSnapshot] }
}

function validInput(): MutableInput {
  const members = [primitiveMember(0), primitiveMember(1), primitiveMember(2)]
  const staged = members.map(stageBeneficiaryTraditionalIraMovementCandidate)
  if (staged.some((member) => member.status !== 'movementCandidateStaged')) {
    throw new Error('Invalid staged fixture')
  }
  const accepted = staged as Array<Extract<
    (typeof staged)[number],
    { status: 'movementCandidateStaged' }
  >>
  const first = accepted[0]!.characterization.acceptedSourceEligibility
  return {
    runtimeInput: {
      attestation: {
        predicate: 'completeBeneficiaryTraditionalIraAnnualRuntimeInventory',
        inventoryStatus: 'completeIncludingExplicitEmpty',
        inventoryEvidenceId: 'runtime-inventory',
        upstreamInventoryEvidenceId: 'runtime-upstream',
        beneficiaryPersonId: beneficiary,
        decedentPersonId: decedent,
        taxYear: 2030,
        basisPoolId: 'basis-pool',
        basisPoolEvidenceId: 'basis-pool-record',
        annualAllocationEvidenceId:
          first.basisEvidence.annualDistributionBasisAllocation.allocationEvidenceId,
        rmdPoolId: 'rmd-pool',
        rmdRequiredAmount: asUsdCents(100),
        sourceAccountIds: [sourceA, sourceB, sourceC],
        sourceBalances: [
          {
            sourceAccountId: sourceA,
            annualOpeningBalanceAmount: asUsdCents(100),
            annualFinalBalanceAmount: asUsdCents(45),
          },
          {
            sourceAccountId: sourceB,
            annualOpeningBalanceAmount: asUsdCents(50),
            annualFinalBalanceAmount: asUsdCents(35),
          },
          {
            sourceAccountId: sourceC,
            annualOpeningBalanceAmount: asUsdCents(9),
            annualFinalBalanceAmount: asUsdCents(9),
          },
        ],
        members: accepted.map((member) => ({
          actionId: member.candidate.actionId,
          allocationId: member.candidate.allocationId,
          sourceAccountId: member.candidate.sourceAccountId,
          executionDate: member.candidate.executionDate,
          executionSequence: member.candidate.executionSequence,
          requestedAmount: member.candidate.requestedAmount,
          executedAmount: member.candidate.executedAmount,
          openingBalanceAmount: member.candidate.openingBalanceAmount,
          closingBalanceAmount: member.candidate.candidateClosingBalanceAmount,
          physicalSourceEvidenceId: member.candidate.physicalSourceEvidenceId,
        })),
      },
      members: members as MutableInput['runtimeInput']['members'],
    },
  }
}

function expectUnsupported(input: unknown): void {
  expect(prepareBeneficiaryTraditionalIraAnnualPhysicalTransaction(
    input as PrepareBeneficiaryTraditionalIraAnnualPhysicalTransactionInput,
  )).toEqual(expect.objectContaining({
    status: 'unsupported',
    movement: 'notCommitted',
    committed: false,
    actionability: 'notEstablished',
    transactionStatus: 'notEstablished',
    applications: [],
    sourceBalanceTransitions: [],
    rmdTransition: null,
    transactionEvidenceId: null,
  }))
}

describe('prepareBeneficiaryTraditionalIraAnnualPhysicalTransaction', () => {
  it('prepares immutable detached applications without movement authority', () => {
    const result = prepareBeneficiaryTraditionalIraAnnualPhysicalTransaction(
      validInput(),
    )
    expect(result).toMatchObject({
      status: 'annualPhysicalTransactionPrepared',
      movement: 'notCommitted',
      committed: false,
      actionability: 'notEstablished',
      transactionStatus: 'appliedToDetachedSnapshotOnly',
      reasons: [],
    })
    if (result.status !== 'annualPhysicalTransactionPrepared') return
    expect(result.applications).toHaveLength(3)
    expect(result.sourceBalanceTransitions).toHaveLength(3)
    expect(Object.isFrozen(result)).toBe(true)
    expect(Object.isFrozen(result.applications[0])).toBe(true)
    expect(JSON.stringify(result)).not.toContain('planId')
  })

  it('emits canonical exact source transitions including an unchanged source', () => {
    const result = prepareBeneficiaryTraditionalIraAnnualPhysicalTransaction(
      validInput(),
    )
    if (result.status !== 'annualPhysicalTransactionPrepared') return
    expect(result.sourceBalanceTransitions.map((entry) => ({
      source: entry.sourceAccountId,
      opening: entry.annualOpeningBalanceAmount,
      executed: entry.totalExecutedAmount,
      closing: entry.annualFinalBalanceAmount,
      applications: entry.applicationEvidenceIds.length,
    }))).toEqual([
      { source: sourceA, opening: 100, executed: 55, closing: 45, applications: 2 },
      { source: sourceB, opening: 50, executed: 15, closing: 35, applications: 1 },
      { source: sourceC, opening: 9, executed: 0, closing: 9, applications: 0 },
    ])
  })

  it('derives every per-application and annual RMD transition exactly', () => {
    const result = prepareBeneficiaryTraditionalIraAnnualPhysicalTransaction(
      validInput(),
    )
    if (result.status !== 'annualPhysicalTransactionPrepared') return
    expect(result.applications.map((entry) => [
      entry.rmdSatisfiedBefore,
      entry.rmdSatisfiedByApplication,
      entry.rmdSatisfiedAfter,
      entry.rmdRemainingAfter,
    ])).toEqual([
      [0, 20, 20, 80],
      [20, 15, 35, 65],
      [35, 35, 70, 30],
    ])
    expect(result.rmdTransition).toMatchObject({
      rmdRequiredAmount: 100,
      initialRmdSatisfiedAmount: 0,
      rmdSatisfiedByTransaction: 70,
      finalRmdSatisfiedAmount: 70,
      finalRmdRemainingAmount: 30,
    })
  })

  it('binds every application and transition to final runtime evidence', () => {
    const result = prepareBeneficiaryTraditionalIraAnnualPhysicalTransaction(
      validInput(),
    )
    if (result.status !== 'annualPhysicalTransactionPrepared') return
    const annualId = result.runtimeEvidence.annualEvidence.finalAnnualEvidenceId
    const coordinatorId = result.runtimeEvidence.inventoryBinding.coordinatorEvidenceId
    expect(result.applications.every((entry) =>
      entry.finalAnnualEvidenceId === annualId &&
      entry.coordinatorEvidenceId === coordinatorId,
    )).toBe(true)
    expect(result.sourceBalanceTransitions.every((entry) =>
      entry.finalAnnualEvidenceId === annualId &&
      entry.coordinatorEvidenceId === coordinatorId,
    )).toBe(true)
    const ids = [
      ...result.applications.map((entry) => entry.applicationEvidenceId),
      ...result.sourceBalanceTransitions.map((entry) => entry.transitionEvidenceId),
      result.rmdTransition.transitionEvidenceId,
      result.transactionEvidenceId,
    ]
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids.every((id) => /^[a-z0-9-]+:[0-9a-f]{64}$/u.test(id))).toBe(true)
  })

  it('is independent of primitive, declaration, balance, and property order', () => {
    const original = validInput()
    const permuted = validInput()
    permuted.runtimeInput.members.reverse()
    permuted.runtimeInput.attestation.members.reverse()
    permuted.runtimeInput.attestation.sourceBalances.reverse()
    const reordered = {
      runtimeInput: {
        members: original.runtimeInput.members,
        attestation: original.runtimeInput.attestation,
      },
    }
    expect(prepareBeneficiaryTraditionalIraAnnualPhysicalTransaction(permuted))
      .toEqual(prepareBeneficiaryTraditionalIraAnnualPhysicalTransaction(original))
    expect(prepareBeneficiaryTraditionalIraAnnualPhysicalTransaction(reordered))
      .toEqual(prepareBeneficiaryTraditionalIraAnnualPhysicalTransaction(original))

    const proxyOrdered = validInput()
    proxyOrdered.runtimeInput.members = new Proxy(
      proxyOrdered.runtimeInput.members,
      { ownKeys: () => ['2', '1', '0', 'length'] },
    )
    expect(prepareBeneficiaryTraditionalIraAnnualPhysicalTransaction(proxyOrdered))
      .toEqual(prepareBeneficiaryTraditionalIraAnnualPhysicalTransaction(original))
  })

  it('rebuilds runtime evidence instead of trusting altered primitive facts', () => {
    const input = validInput()
    input.runtimeInput.members[0]!.sourceSnapshots![0]!.closingBalanceAmount =
      asUsdCents(79)
    expectUnsupported(input)
  })

  it('requires complete source arithmetic and unchanged empty-source boundaries', () => {
    const brokenTotal = validInput()
    brokenTotal.runtimeInput.attestation.sourceBalances[0]!
      .annualFinalBalanceAmount = asUsdCents(44)
    expectUnsupported(brokenTotal)
    const brokenEmpty = validInput()
    brokenEmpty.runtimeInput.attestation.sourceBalances[2]!
      .annualFinalBalanceAmount = asUsdCents(8)
    expectUnsupported(brokenEmpty)
  })

  it('requires exact RMD progression and final pool arithmetic', () => {
    const input = validInput()
    input.runtimeInput.members[2]!.penaltyInput.characterizationInput
      .rmdPoolEvidence!.satisfiedBeforeExecution = asUsdCents(34)
    input.runtimeInput.members[2]!.penaltyInput.characterizationInput
      .rmdPoolEvidence!.remainingBeforeExecution = asUsdCents(66)
    expectUnsupported(input)
  })

  it('does not retain caller-owned data before freezing the result', () => {
    const input = validInput()
    const result = prepareBeneficiaryTraditionalIraAnnualPhysicalTransaction(input)
    expect(result.status).toBe('annualPhysicalTransactionPrepared')
    input.runtimeInput.attestation.members[0]!.physicalSourceEvidenceId = 'changed'
    if (result.status !== 'annualPhysicalTransactionPrepared') return
    expect(result.runtimeEvidence.annualEvidence.canonicalMembers[0]!.candidate
      .physicalSourceEvidenceId).toBe('physical-source-0')
    expect(() => {
      ;(result.applications as unknown[]).push('mutation')
    }).toThrow()
  })

  it('rejects extra wrapper keys, getters, symbols, exotic values, and cycles', () => {
    expectUnsupported({ ...validInput(), extra: true })
    const getter = validInput()
    Object.defineProperty(getter, 'runtimeInput', {
      enumerable: true,
      get: () => validInput().runtimeInput,
    })
    expectUnsupported(getter)
    const symbol = validInput()
    Object.defineProperty(symbol, Symbol('hidden'), { value: true })
    expectUnsupported(symbol)
    expectUnsupported(new Map([['runtimeInput', validInput().runtimeInput]]))
    const cycle = validInput() as MutableInput & { self?: unknown }
    cycle.self = cycle
    expectUnsupported(cycle)
  })

  it('never throws for proxies, sparse arrays, or decorated arrays', () => {
    const revoked = Proxy.revocable(validInput(), {})
    revoked.revoke()
    expect(() => expectUnsupported(revoked.proxy)).not.toThrow()
    const sparse = validInput()
    delete sparse.runtimeInput.members[1]
    expect(() => expectUnsupported(sparse)).not.toThrow()
    const decorated = validInput()
    Object.defineProperty(decorated.runtimeInput.members, 'extra', {
      enumerable: true,
      value: 'extra',
    })
    expect(() => expectUnsupported(decorated)).not.toThrow()
  })

  it('fails closed when a stateful proxy changes between descriptor reads', () => {
    const input = validInput()
    let reads = 0
    const target = input.runtimeInput.attestation
    input.runtimeInput.attestation = new Proxy(target, {
      getOwnPropertyDescriptor(object, property) {
        reads += 1
        if (reads > 1 && property === 'taxYear') return undefined
        return Reflect.getOwnPropertyDescriptor(object, property)
      },
    })
    expectUnsupported(input)
  })
})
