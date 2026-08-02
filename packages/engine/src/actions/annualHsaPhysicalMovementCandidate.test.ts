import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  asAccountId,
  asActionId,
  asAllocationId,
  asPersonId,
} from './identity.js'
import { asPositiveUsdCents, asUsdCents } from './money.js'
import {
  stageAnnualHsaPhysicalMovementCandidate,
  type StageAnnualHsaPhysicalMovementCandidateInput,
} from './annualHsaPhysicalMovementCandidate.js'
import * as structuralId from './structuralId.js'

type Input = StageAnnualHsaPhysicalMovementCandidateInput

function request(options: {
  actionId: string
  owner: string
  date: string
  sequence: number
  allocations: readonly { id: string; source: string; amount: number }[]
}): Input['requests'][number] {
  const total = options.allocations.reduce((sum, allocation) => sum + allocation.amount, 0)
  return {
    actionId: asActionId(options.actionId),
    kind: 'ordinaryWithdrawal',
    year: 2026,
    executionDate: options.date,
    executionSequence: options.sequence,
    personId: asPersonId(options.owner),
    requestedAmount: asPositiveUsdCents(total),
    provenance: { source: 'manual' },
    purpose: { kind: 'spending' },
    allocations: options.allocations.map((allocation) => ({
      allocationId: asAllocationId(allocation.id),
      sourceAccountId: asAccountId(allocation.source),
      requestedAmount: asPositiveUsdCents(allocation.amount),
    })),
  }
}

function source(sourceAccountId: string, ownerPersonId: string, suffix = sourceAccountId): Input['sourceEvidence'][number] {
  return {
    predicate: 'ownedHsaOrdinaryWithdrawalPhysicalSource',
    sourceAccountId: asAccountId(sourceAccountId),
    ownerPersonId: asPersonId(ownerPersonId),
    accountType: 'hsa',
    ownership: 'individual',
    accountOwnershipEvidenceId: `ownership-${suffix}`,
    hsaClassificationEvidenceId: `classification-${suffix}`,
    authoritative: true,
  }
}

function opening(sourceAccountId: string, ownerPersonId: string, amount: number, suffix = sourceAccountId): Input['openingBalances'][number] {
  return {
    predicate: 'authoritativeHsaDetachedBatchOpeningBalance',
    boundary: 'detachedBatchStart',
    sourceAccountId: asAccountId(sourceAccountId),
    ownerPersonId: asPersonId(ownerPersonId),
    taxYear: 2026,
    openingBalance: asUsdCents(amount),
    openingBalanceEvidenceId: `opening-${suffix}`,
    authoritative: true,
  }
}

function validInput(): Input {
  return {
    taxYear: 2026,
    requestInventoryComplete: true,
    requests: [
      request({ actionId: 'a-late', owner: 'owner-a', date: '2026-06-01', sequence: 2, allocations: [{ id: 'alloc-late', source: 'hsa-a', amount: 400 }] }),
      request({ actionId: 'b-zero', owner: 'owner-b', date: '2026-06-01', sequence: 1, allocations: [{ id: 'alloc-zero', source: 'hsa-b', amount: 100 }] }),
      request({ actionId: 'a-early', owner: 'owner-a', date: '2026-01-15', sequence: 1, allocations: [{ id: 'alloc-early', source: 'hsa-a', amount: 500 }] }),
    ],
    sourceEvidenceInventoryComplete: true,
    sourceEvidence: [source('hsa-b', 'owner-b'), source('hsa-a', 'owner-a')],
    openingBalanceInventoryComplete: true,
    openingBalances: [opening('hsa-b', 'owner-b', 0), opening('hsa-a', 'owner-a', 600)],
  }
}

function mutableCopy<T>(value: T): T {
  return structuredClone(value)
}

function replaceAt<T>(values: readonly T[], index: number, value: T): readonly T[] {
  return values.map((item, itemIndex) => itemIndex === index ? value : item)
}

function reverseKeys<T extends object>(value: T): T {
  return Object.fromEntries(Object.entries(value).reverse()) as T
}

describe('stageAnnualHsaPhysicalMovementCandidate', () => {
  afterEach(() => vi.restoreAllMocks())

  it('replays multiowner HSA sources chronologically and emits full, partial, and zero applications', () => {
    const result = stageAnnualHsaPhysicalMovementCandidate(validInput())

    expect(result.actions.map((action) => action.request.actionId)).toEqual(['a-early', 'b-zero', 'a-late'])
    expect(result.applications.map((application) => ({
      id: application.allocationId,
      status: application.applicationStatus,
      before: application.sourceBalanceBefore,
      staged: application.stagedAmount,
      unstaged: application.unstagedAmount,
      after: application.sourceBalanceAfter,
      allocationSequence: application.allocationSequenceWithinAction,
    }))).toEqual([
      { id: 'alloc-early', status: 'full', before: 600, staged: 500, unstaged: 0, after: 100, allocationSequence: 1 },
      { id: 'alloc-zero', status: 'zero', before: 0, staged: 0, unstaged: 100, after: 0, allocationSequence: 1 },
      { id: 'alloc-late', status: 'partial', before: 100, staged: 100, unstaged: 300, after: 0, allocationSequence: 1 },
    ])
    expect(result.actions.map((action) => action.status)).toEqual(['fullyStaged', 'notStaged', 'partiallyStaged'])
    expect(result.stagedDistributions.map((distribution) => [distribution.allocationId, distribution.stagedAmount])).toEqual([
      ['alloc-early', 500],
      ['alloc-late', 100],
    ])
    expect(result.candidateSourceBalances).toMatchObject([
      { sourceAccountId: 'hsa-a', ownerPersonId: 'owner-a', openingBalance: 600, requestedAmount: 900, stagedAmount: 600, unstagedAmount: 300, candidateClosingBalance: 0 },
      { sourceAccountId: 'hsa-b', ownerPersonId: 'owner-b', openingBalance: 0, requestedAmount: 100, stagedAmount: 0, unstagedAmount: 100, candidateClosingBalance: 0 },
    ])
    expect(result).toMatchObject({
      committed: false,
      movement: 'notCommitted',
      actionability: 'notEstablished',
      publication: 'notEstablished',
      taxCharacter: 'notEstablished',
      penalty: 'notEstablished',
      runtimeInflows: 'notInventoried',
      priorCharacterReusable: false,
      priorPenaltyReusable: false,
      downstreamRequirement: 'rebuildReimbursementThenCharacterThenPenaltyFromCandidate',
    })
  })

  it('canonicalizes request, allocation, source, and opening permutations deterministically', () => {
    const left = validInput()
    left.requests = [...left.requests].reverse()
    left.sourceEvidence = [...left.sourceEvidence].reverse()
    left.openingBalances = [...left.openingBalances].reverse()
    left.requests = left.requests.map((item) => ({ ...item, allocations: [...item.allocations].reverse() }))
    expect(stageAnnualHsaPhysicalMovementCandidate(left)).toEqual(stageAnnualHsaPhysicalMovementCandidate(validInput()))
  })

  it('canonicalizes request, source, and opening object property insertion order', () => {
    const input = validInput()
    input.requests = input.requests.map((item) => reverseKeys({ ...item, provenance: reverseKeys(item.provenance), purpose: reverseKeys(item.purpose), allocations: item.allocations.map(reverseKeys) }))
    input.sourceEvidence = input.sourceEvidence.map(reverseKeys)
    input.openingBalances = input.openingBalances.map(reverseKeys)
    expect(stageAnnualHsaPhysicalMovementCandidate(input)).toEqual(stageAnnualHsaPhysicalMovementCandidate(validInput()))
  })

  it('uses canonical allocation order and preserves zero siblings', () => {
    const input = validInput()
    input.requests = [request({
      actionId: 'split', owner: 'owner-a', date: '2026-02-01', sequence: 1,
      allocations: [
        { id: 'z-allocation', source: 'hsa-b', amount: 25 },
        { id: 'a-allocation', source: 'hsa-a', amount: 50 },
      ],
    })]
    input.sourceEvidence = [source('hsa-a', 'owner-a'), source('hsa-b', 'owner-a')]
    input.openingBalances = [opening('hsa-a', 'owner-a', 50), opening('hsa-b', 'owner-a', 0)]
    const result = stageAnnualHsaPhysicalMovementCandidate(input)
    expect(result.applications.map((application) => [application.allocationId, application.allocationSequenceWithinAction, application.applicationStatus])).toEqual([
      ['a-allocation', 1, 'full'],
      ['z-allocation', 2, 'zero'],
    ])
    expect(result.stagedDistributions).toHaveLength(1)
  })

  it.each([
    ['missing source evidence', (input: Input) => { input.sourceEvidence = input.sourceEvidence.slice(1) }],
    ['extra source evidence', (input: Input) => { input.sourceEvidence = [...input.sourceEvidence, source('hsa-extra', 'owner-a')] }],
    ['duplicate source evidence', (input: Input) => { input.sourceEvidence = [...input.sourceEvidence, source('hsa-a', 'owner-a', 'duplicate')] }],
    ['missing opening balance', (input: Input) => { input.openingBalances = input.openingBalances.slice(1) }],
    ['extra opening balance', (input: Input) => { input.openingBalances = [...input.openingBalances, opening('hsa-extra', 'owner-a', 1)] }],
    ['duplicate opening balance', (input: Input) => { input.openingBalances = [...input.openingBalances, opening('hsa-a', 'owner-a', 1, 'duplicate')] }],
  ])('rejects %s rather than widening the detached batch', (_label, mutate) => {
    const input = validInput()
    mutate(input)
    expect(() => stageAnnualHsaPhysicalMovementCandidate(input)).toThrow()
  })

  it.each([
    ['request owner conflict', (input: Input) => { input.requests = replaceAt(input.requests, 0, { ...input.requests[0]!, personId: asPersonId('owner-b') }) }],
    ['opening owner conflict', (input: Input) => { input.openingBalances = replaceAt(input.openingBalances, 0, { ...input.openingBalances[0]!, ownerPersonId: asPersonId('owner-a') }) }],
    ['source class conflict', (input: Input) => { (input.sourceEvidence[0] as { accountType: string }).accountType = 'traditional' }],
    ['opening boundary conflict', (input: Input) => { (input.openingBalances[0] as { boundary: string }).boundary = 'taxYearOpening' }],
    ['opening year conflict', (input: Input) => { input.openingBalances = replaceAt(input.openingBalances, 0, { ...input.openingBalances[0]!, taxYear: 2025 }) }],
    ['request year conflict', (input: Input) => { input.requests = replaceAt(input.requests, 0, { ...input.requests[0]!, year: 2025 }) }],
    ['missing execution date', (input: Input) => { input.requests = replaceAt(input.requests, 0, { ...input.requests[0]!, executionDate: undefined }) }],
    ['invalid execution date', (input: Input) => { input.requests = replaceAt(input.requests, 0, { ...input.requests[0]!, executionDate: '2026-02-30' }) }],
    ['date year conflict', (input: Input) => { input.requests = replaceAt(input.requests, 0, { ...input.requests[0]!, executionDate: '2025-06-01' }) }],
    ['schedule slot conflict', (input: Input) => { input.requests = replaceAt(input.requests, 0, { ...input.requests[0]!, executionSequence: 1 }) }],
    ['duplicate action ID', (input: Input) => { input.requests = replaceAt(input.requests, 0, { ...input.requests[0]!, actionId: input.requests[1]!.actionId }) }],
    ['duplicate allocation ID', (input: Input) => { input.requests = replaceAt(input.requests, 0, { ...input.requests[0]!, allocations: [{ ...input.requests[0]!.allocations[0]!, allocationId: input.requests[1]!.allocations[0]!.allocationId }] }) }],
  ])('rejects %s', (_label, mutate) => {
    const input = validInput()
    mutate(input)
    expect(() => stageAnnualHsaPhysicalMovementCandidate(input)).toThrow()
  })

  it.each([
    ['negative zero', -0],
    ['fractional cents', 1.5],
    ['unsafe cents', Number.MAX_SAFE_INTEGER + 1],
  ])('rejects %s opening balances', (_label, amount) => {
    const input = validInput()
    ;(input.openingBalances[0] as { openingBalance: number }).openingBalance = amount
    expect(() => stageAnnualHsaPhysicalMovementCandidate(input)).toThrow()
  })

  it('rejects malformed shapes, getters, cycles, and reused evidence identifiers', () => {
    const extra = validInput() as Input & { extra?: boolean }
    extra.extra = true
    expect(() => stageAnnualHsaPhysicalMovementCandidate(extra)).toThrow(/exact shape/)

    const getter = validInput()
    Object.defineProperty(getter, 'taxYear', { enumerable: true, get: () => 2026 })
    expect(() => stageAnnualHsaPhysicalMovementCandidate(getter)).toThrow(/plain data/)

    const cycle = validInput() as Input & { self?: unknown }
    cycle.self = cycle
    expect(() => stageAnnualHsaPhysicalMovementCandidate(cycle)).toThrow(/plain data/)

    const reused = validInput()
    reused.sourceEvidence = replaceAt(reused.sourceEvidence, 0, { ...reused.sourceEvidence[0]!, accountOwnershipEvidenceId: reused.sourceEvidence[1]!.hsaClassificationEvidenceId })
    expect(() => stageAnnualHsaPhysicalMovementCandidate(reused)).toThrow(/collision/)
  })

  it('detects structural identifier collisions', () => {
    vi.spyOn(structuralId, 'deriveActionStructuralId').mockReturnValue('collision')
    expect(() => stageAnnualHsaPhysicalMovementCandidate(validInput())).toThrow(/identifier collision/)
  })

  it('rejects a derived identifier that aliases any caller-supplied string', () => {
    const input = validInput()
    input.requests = replaceAt(input.requests, 0, {
      ...input.requests[0]!,
      purpose: { kind: 'other', referenceId: 'external-reference' },
    })
    vi.spyOn(structuralId, 'deriveActionStructuralId').mockReturnValue('external-reference')
    expect(() => stageAnnualHsaPhysicalMovementCandidate(input)).toThrow(/identifier collision/)
  })

  it('returns an immutable snapshot without mutating caller input and binds the candidate ID to evidence', () => {
    const input = validInput()
    const before = mutableCopy(input)
    const result = stageAnnualHsaPhysicalMovementCandidate(input)
    expect(input).toEqual(before)
    expect(Object.isFrozen(result)).toBe(true)
    expect(Object.isFrozen(result.actions[0]?.request)).toBe(true)
    expect(Object.isFrozen(result.applications[0]?.sourceEvidence)).toBe(true)
    expect(() => { (result.applications as unknown as unknown[]).push('bad') }).toThrow()

    const changed = validInput()
    changed.openingBalances = replaceAt(changed.openingBalances, 1, { ...changed.openingBalances[1]!, openingBalance: asUsdCents(601), openingBalanceEvidenceId: 'opening-hsa-a-changed' })
    expect(stageAnnualHsaPhysicalMovementCandidate(changed).movementCandidateId).not.toBe(result.movementCandidateId)
  })
})
