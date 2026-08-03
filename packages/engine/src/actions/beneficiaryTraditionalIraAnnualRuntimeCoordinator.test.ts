import { describe, expect, it } from 'vitest'

import type { AnnualIraBasisAllocationEntryInput } from './annualIraBasisAllocation.js'
import {
  coordinateBeneficiaryTraditionalIraAnnualRuntime,
  type CoordinateBeneficiaryTraditionalIraAnnualRuntimeInput,
} from './beneficiaryTraditionalIraAnnualRuntimeCoordinator.js'
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
type MutableInput = Mutable<CoordinateBeneficiaryTraditionalIraAnnualRuntimeInput>

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
      form8606Line8NetConversionAmount: asUsdCents(0),
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
    spousalElection: {
      status: 'spousalElectionNotApplicable',
      relationship: 'notSurvivingSpouse',
      evidenceId: 'spousal-election-not-applicable',
    } as const,
    characterizationInput: characterizationInput(index),
    deathBeneficiaryEvidence: deathEvidence(index),
  }
  const penalty = evaluateBeneficiaryTraditionalIraDeathPenalty(penaltyInput)
  if (penalty.status !== 'accepted') throw new Error('Invalid fixture')
  const source = penalty.characterization.acceptedSourceEligibility
  const snapshot: BeneficiaryTraditionalIraPhysicalSourceSnapshotEvidence = {
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
  return { penaltyInput, sourceSnapshots: [snapshot] }
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
    members: members as MutableInput['members'],
  }
}

function expectUnsupported(
  input: CoordinateBeneficiaryTraditionalIraAnnualRuntimeInput,
): void {
  expect(coordinateBeneficiaryTraditionalIraAnnualRuntime(input)).toMatchObject({
    status: 'unsupported',
    movement: 'notCommitted',
    committed: false,
    actionability: 'notEstablished',
    inventoryBinding: null,
    annualEvidence: null,
    reasons: [{ code: 'withdrawal-inherited-facts-missing' }],
  })
}

describe('beneficiary traditional IRA annual runtime coordinator', () => {
  it('coordinates an immutable complete multi-allocation batch without movement', () => {
    const input = validInput()
    const before = structuredClone(input)
    const result = coordinateBeneficiaryTraditionalIraAnnualRuntime(input)
    expect(result).toMatchObject({
      status: 'annualRuntimeEvidenceCoordinated',
      movement: 'notCommitted',
      committed: false,
      actionability: 'notEstablished',
      reasons: [],
      inventoryBinding: {
        inventoryEvidenceId: 'runtime-inventory',
        upstreamInventoryEvidenceId: 'runtime-upstream',
        beneficiaryPersonId: 'beneficiary',
        decedentPersonId: 'decedent',
        taxYear: 2030,
      },
      annualEvidence: {
        initialRmdSatisfiedAmount: 0,
        finalRmdSatisfiedAmount: 70,
        finalRmdRemainingAmount: 30,
      },
    })
    expect(input).toEqual(before)
    expect(Object.isFrozen(result)).toBe(true)
    if (result.status === 'annualRuntimeEvidenceCoordinated') {
      expect(Object.isFrozen(result.annualEvidence.canonicalMembers[0])).toBe(true)
      expect(result.annualEvidence.canonicalMembers.map((member) => [
        member.candidate.actionId,
        member.candidate.allocationId,
        member.candidate.sourceAccountId,
      ])).toEqual([
        ['withdrawal-a', 'allocation-a', 'inherited-ira-a'],
        ['withdrawal-a', 'allocation-b', 'inherited-ira-b'],
        ['withdrawal-b', 'allocation-c', 'inherited-ira-a'],
      ])
    }
  })

  it('is independent of primitive, declared-member, and balance record order', () => {
    const expected = coordinateBeneficiaryTraditionalIraAnnualRuntime(validInput())
    const input = validInput()
    input.members = [...input.members].reverse()
    input.attestation.members = [...input.attestation.members].reverse()
    input.attestation.sourceBalances = [...input.attestation.sourceBalances].reverse()
    expect(coordinateBeneficiaryTraditionalIraAnnualRuntime(input)).toEqual(expected)
  })

  it('is invariant to property insertion order', () => {
    const expected = coordinateBeneficiaryTraditionalIraAnnualRuntime(validInput())
    const input = validInput()
    input.attestation.members = input.attestation.members.map((member) =>
      Object.fromEntries(Object.entries(member).reverse()) as never,
    )
    input.attestation.sourceBalances = input.attestation.sourceBalances.map(
      (balance) => Object.fromEntries(Object.entries(balance).reverse()) as never,
    )
    input.attestation = Object.fromEntries(
      Object.entries(input.attestation).reverse(),
    ) as never
    expect(coordinateBeneficiaryTraditionalIraAnnualRuntime(input)).toEqual(expected)
  })

  it('requires an exact nonempty primitive-to-attested-member bijection', () => {
    for (const mutate of [
      (input: MutableInput) => {
        input.attestation.members = input.attestation.members.slice(1)
      },
      (input: MutableInput) => {
        input.members = input.members.slice(1)
      },
      (input: MutableInput) => {
        input.attestation.members = [
          input.attestation.members[0]!, input.attestation.members[0]!,
          input.attestation.members[2]!,
        ]
      },
      (input: MutableInput) => {
        input.attestation.members = []
        input.members = []
      },
    ]) {
      const input = validInput()
      mutate(input)
      expectUnsupported(input)
    }
  })

  it('requires a canonical complete source inventory and one boundary per source', () => {
    const cases = [validInput(), validInput(), validInput(), validInput()]
    cases[0]!.attestation.sourceAccountIds = [sourceB, sourceA, sourceC]
    cases[1]!.attestation.sourceAccountIds = [sourceA, sourceB] as never
    cases[2]!.attestation.sourceBalances =
      cases[2]!.attestation.sourceBalances.slice(1)
    cases[3]!.attestation.sourceBalances = [
      cases[3]!.attestation.sourceBalances[0]!,
      cases[3]!.attestation.sourceBalances[0]!,
      cases[3]!.attestation.sourceBalances[2]!,
    ]
    for (const input of cases) expectUnsupported(input)
  })

  it('binds every top-level identity, pool, and inventory lineage field', () => {
    for (const [field, value] of [
      ['inventoryEvidenceId', 'physical-source-0'],
      ['upstreamInventoryEvidenceId', 'runtime-inventory'],
      ['beneficiaryPersonId', asPersonId('foreign-beneficiary')],
      ['decedentPersonId', asPersonId('foreign-decedent')],
      ['taxYear', 2031],
      ['basisPoolId', 'foreign-basis'],
      ['basisPoolEvidenceId', 'foreign-basis-evidence'],
      ['annualAllocationEvidenceId', 'foreign-allocation'],
      ['rmdPoolId', 'foreign-rmd'],
      ['rmdRequiredAmount', 101],
    ] as const) {
      const input = validInput()
      ;(input.attestation as unknown as Record<string, unknown>)[field] = value
      expectUnsupported(input)
    }
  })

  it('exactly binds every attested member identity, amount, and physical ID', () => {
    for (const [field, value] of [
      ['actionId', asActionId('foreign-action')],
      ['allocationId', asAllocationId('foreign-allocation')],
      ['sourceAccountId', sourceB],
      ['executionDate', '2030-03-02'],
      ['executionSequence', 9],
      ['requestedAmount', 21],
      ['executedAmount', 21],
      ['openingBalanceAmount', 101],
      ['closingBalanceAmount', 79],
      ['physicalSourceEvidenceId', 'foreign-physical'],
    ] as const) {
      const input = validInput()
      ;(input.attestation.members[0] as unknown as Record<string, unknown>)[field] = value
      expectUnsupported(input)
    }
  })

  it('proves annual source endpoints including unchanged zero-event sources', () => {
    const opening = validInput()
    opening.attestation.sourceBalances[0]!.annualOpeningBalanceAmount =
      asUsdCents(101)
    expectUnsupported(opening)
    const closing = validInput()
    closing.attestation.sourceBalances[0]!.annualFinalBalanceAmount =
      asUsdCents(44)
    expectUnsupported(closing)
    const zero = validInput()
    zero.attestation.sourceBalances[2]!.annualFinalBalanceAmount = asUsdCents(8)
    expectUnsupported(zero)
  })

  it('rejects an internally broken exact-source balance chain', () => {
    const input = validInput()
    const raw = input.members[2]!.sourceSnapshots![0]!
    input.members[2]!.sourceSnapshots = [{
      ...raw,
      openingBalanceAmount: asUsdCents(81),
      closingBalanceAmount: asUsdCents(46),
    }]
    input.attestation.members[2]!.openingBalanceAmount = asUsdCents(81)
    input.attestation.members[2]!.closingBalanceAmount = asUsdCents(46)
    input.attestation.sourceBalances[0]!.annualFinalBalanceAmount = asUsdCents(46)
    expectUnsupported(input)
  })

  it('requires one action schedule and rejects a cross-action slot collision', () => {
    const split = validInput()
    split.attestation.members[1]!.executionSequence = 2
    expectUnsupported(split)
    const collision = validInput()
    collision.attestation.members[2]!.executionDate = '2030-03-01'
    collision.attestation.members[2]!.executionSequence = 1
    expectUnsupported(collision)
  })

  it('requires rebuilt basis and RMD account inventories to equal the attestation', () => {
    const basis = validInput()
    ;(basis.members[1]!.penaltyInput.characterizationInput
      .basisPoolEvidence as unknown as Record<string, unknown>).accountIds =
        [sourceA, sourceB]
    expectUnsupported(basis)
    const rmd = validInput()
    ;(rmd.members[1]!.penaltyInput.characterizationInput
      .rmdPoolEvidence as unknown as Record<string, unknown>).accountIds =
        [sourceA, sourceB]
    expectUnsupported(rmd)
  })

  it('rebuilds character, death penalty, movement, and annual allocation evidence', () => {
    for (const mutate of [
      (input: MutableInput) => {
        input.members[0]!.penaltyInput.characterizationInput.basisPoolEvidence = null
      },
      (input: MutableInput) => {
        ;(input.members[0]!.penaltyInput.deathBeneficiaryEvidence as unknown as
          Record<string, unknown>).deathDate = '2030-12-31'
      },
      (input: MutableInput) => {
        ;(input.members[0]!.sourceSnapshots![0] as unknown as
          Record<string, unknown>).penaltyEvidenceId = 'foreign'
      },
      (input: MutableInput) => {
        input.members[0]!.penaltyInput.characterizationInput.line7Distributions =
          [line7Entries()[0]!]
      },
    ]) {
      const input = validInput()
      mutate(input)
      expectUnsupported(input)
    }
  })

  it('requires exact safe-cent RMD progression across canonical members', () => {
    for (const [field, value] of [
      ['satisfiedBeforeExecution', 39],
      ['remainingBeforeExecution', 61],
      ['requiredAmount', 101],
    ] as const) {
      const input = validInput()
      ;(input.members[1]!.penaltyInput.characterizationInput
        .rmdPoolEvidence as unknown as Record<string, unknown>)[field] = value
      expectUnsupported(input)
    }
  })

  it('rejects cross-role and repeated derived authority IDs', () => {
    const inventory = validInput()
    inventory.attestation.inventoryEvidenceId = 'physical-source-0'
    expectUnsupported(inventory)
    const physical = validInput()
    ;(physical.members[1]!.sourceSnapshots![0] as unknown as
      Record<string, unknown>).physicalSourceEvidenceId = 'physical-source-0'
    physical.attestation.members[1]!.physicalSourceEvidenceId = 'physical-source-0'
    expectUnsupported(physical)
  })

  it('fails closed for invalid years, dates, sequences, cents, and blank IDs', () => {
    const cases = [validInput(), validInput(), validInput(), validInput(), validInput()]
    cases[0]!.attestation.taxYear = 2030.5
    cases[1]!.attestation.members[0]!.executionDate = '2030-02-30'
    cases[2]!.attestation.members[0]!.executionSequence = 0
    cases[3]!.attestation.rmdRequiredAmount = Number.MAX_SAFE_INTEGER as never
    cases[4]!.attestation.upstreamInventoryEvidenceId = '  '
    for (const input of cases) expectUnsupported(input)
  })

  it('snapshots once and rejects getters, symbols, exotic objects, and cycles', () => {
    const getter = validInput()
    let reads = 0
    Object.defineProperty(getter.attestation, 'taxYear', {
      enumerable: true,
      get: () => {
        reads += 1
        return 2030
      },
    })
    expectUnsupported(getter)
    expect(reads).toBe(0)
    const symbol = validInput()
    ;(symbol.attestation as unknown as Record<symbol, unknown>)[Symbol('x')] = true
    expectUnsupported(symbol)
    const exotic = validInput()
    exotic.attestation = Object.assign(
      Object.create({ hostile: true }), exotic.attestation,
    ) as never
    expectUnsupported(exotic)
    const cyclic = validInput()
    ;(cyclic as unknown as Record<string, unknown>).cycle = cyclic
    expectUnsupported(cyclic)
  })

  it('never throws for proxies, decorated arrays, sparse arrays, or extra keys', () => {
    const proxy = validInput()
    proxy.attestation = new Proxy(proxy.attestation, {
      ownKeys: () => { throw new Error('hostile') },
    })
    expect(() => expectUnsupported(proxy)).not.toThrow()
    const decorated = validInput()
    ;(decorated.attestation.members as unknown as Record<string, unknown>).x = true
    expectUnsupported(decorated)
    const proxiedArray = validInput()
    let lengthReads = 0
    const decoratedMembers = [...proxiedArray.attestation.members]
    ;(decoratedMembers as unknown as Record<string, unknown>).x = true
    proxiedArray.attestation.members = new Proxy(decoratedMembers, {
      get: (target, property, receiver) => {
        if (property === 'length') lengthReads += 1
        return Reflect.get(target, property, receiver)
      },
    })
    expectUnsupported(proxiedArray)
    expect(lengthReads).toBe(0)
    const sparse = validInput()
    sparse.members = new Array(3) as typeof sparse.members
    expectUnsupported(sparse)
    const extra = validInput()
    ;(extra.attestation.members[0] as unknown as Record<string, unknown>).x = true
    expectUnsupported(extra)
  })
})
