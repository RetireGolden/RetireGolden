import { describe, expect, it } from 'vitest'

import { asAccountId, asActionId, asAllocationId, asPersonId } from './identity.js'
import { asPositiveUsdCents, asUsdCents } from './money.js'
import {
  establishAnnualHsaOpeningAuthority,
  type EstablishAnnualHsaOpeningAuthorityInput,
} from './annualHsaOpeningAuthority.js'
import { stageAnnualHsaPhysicalMovementCandidate } from './annualHsaPhysicalMovementCandidate.js'

function source(id: string, owner: string, suffix = id) {
  return {
    predicate: 'ownedHsaOrdinaryWithdrawalPhysicalSource' as const,
    sourceAccountId: asAccountId(id),
    ownerPersonId: asPersonId(owner),
    accountType: 'hsa' as const,
    ownership: 'individual' as const,
    accountOwnershipEvidenceId: `ownership-${suffix}`,
    hsaClassificationEvidenceId: `classification-${suffix}`,
    authoritative: true as const,
  }
}

function annualStart(id: string, owner: string, balance: number, suffix = id) {
  return {
    predicate: 'authoritativeHsaAnnualStartBalance' as const,
    boundary: 'annualStart' as const,
    sourceAccountId: asAccountId(id),
    ownerPersonId: asPersonId(owner),
    taxYear: 2030,
    annualStartBalance: asUsdCents(balance),
    annualStartBalanceEvidenceId: `annual-start-${suffix}`,
    authoritative: true as const,
  }
}

function credit(id: string, sourceId: string, owner: string, amount: number) {
  return {
    predicate: 'settledHsaRuntimeCreditBeforeDetachedBatch' as const,
    sourceAccountId: asAccountId(sourceId),
    ownerPersonId: asPersonId(owner),
    taxYear: 2030,
    settlementPhase: 'simulatorPreActionContributionPhase' as const,
    boundaryRelation: 'beforeDetachedHsaActionBatch' as const,
    amount: asPositiveUsdCents(amount),
    settled: true as const,
    runtimeEventId: `event-${id}`,
    runtimeMovementEvidenceId: `movement-${id}`,
    upstreamEvidenceId: `upstream-${id}`,
  }
}

function input(): EstablishAnnualHsaOpeningAuthorityInput {
  return {
    taxYear: 2030,
    detachedBatchStart: 'afterSimulatorPreActionContributionPhaseBeforeDetachedHsaActionBatch',
    sourceEvidenceInventoryComplete: true,
    sourceEvidence: [source('hsa-b', 'owner-b'), source('hsa-a', 'owner-a')],
    annualStartBalanceInventoryComplete: true,
    annualStartBalances: [annualStart('hsa-b', 'owner-b', 0), annualStart('hsa-a', 'owner-a', 1_000)],
    runtimeInflowInventory: {
      predicate: 'completeSettledHsaRuntimeInflowsBeforeDetachedBatch',
      taxYear: 2030,
      detachedBatchStart: 'afterSimulatorPreActionContributionPhaseBeforeDetachedHsaActionBatch',
      complete: true,
      status: 'completeWithCredits',
      inflows: [
        credit('a-z', 'hsa-a', 'owner-a', 200),
        credit('b-only', 'hsa-b', 'owner-b', 50),
        credit('a-a', 'hsa-a', 'owner-a', 100),
      ],
    },
  }
}

function clone<T>(value: T): T {
  return structuredClone(value)
}

type MutableFixture = Record<string, unknown> & {
  taxYear: number
  detachedBatchStart: string
  sourceEvidenceInventoryComplete: boolean
  sourceEvidence: Record<string, unknown>[]
  annualStartBalanceInventoryComplete: boolean
  annualStartBalances: Record<string, unknown>[]
  runtimeInflowInventory: Record<string, unknown> & {
    inflows: Record<string, unknown>[]
  }
}

function mutableInput(): MutableFixture {
  return clone(input()) as unknown as MutableFixture
}

function establishHostile(raw: MutableFixture) {
  return establishAnnualHsaOpeningAuthority(raw as unknown as EstablishAnnualHsaOpeningAuthorityInput)
}

describe('establishAnnualHsaOpeningAuthority', () => {
  it('canonically sums exact-cent same-phase credits and preserves every source sibling', () => {
    const result = establishAnnualHsaOpeningAuthority(input())

    expect(result.status).toBe('annualHsaDetachedBatchOpeningAuthorityEstablished')
    expect(result).toMatchObject({
      committed: false,
      movement: 'notCommitted',
      actionability: 'notEstablished',
      publication: 'notEstablished',
      planMutation: 'notPerformed',
      simulatorIntegration: 'notPerformed',
      runtimeInflows: 'completeBeforeDetachedHsaActionBatch',
      runtimeInflowInventoryStatus: 'completeWithCredits',
    })
    expect(result.openingBalances.map((entry) => [entry.sourceAccountId, entry.openingBalance])).toEqual([
      ['hsa-a', 1_300],
      ['hsa-b', 50],
    ])
    expect(result.settledRuntimeCredits.map((entry) => [entry.runtimeEventId, entry.amount])).toEqual([
      ['event-a-a', 100],
      ['event-a-z', 200],
      ['event-b-only', 50],
    ])
    expect(result.settledRuntimeCredits.every((entry) => !('sequenceWithinSource' in entry) && !('sourceBalanceBefore' in entry) && !('sourceBalanceAfter' in entry))).toBe(true)
    expect(result.openingBalances.every((entry) => /^hsa-detached-batch-opening-balance:[0-9a-f]{64}$/.test(entry.openingBalanceEvidenceId))).toBe(true)
    expect(result.runtimeInflowInventoryEvidenceId).toMatch(/^annual-hsa-runtime-inflow-inventory:[0-9a-f]{64}$/)
    expect(result.openingAuthorityId).toMatch(/^annual-hsa-detached-batch-opening-authority:[0-9a-f]{64}$/)
  })

  it('requires a first-class explicit-empty inventory and retains zero balances', () => {
    const raw = input()
    raw.runtimeInflowInventory = {
      predicate: 'completeSettledHsaRuntimeInflowsBeforeDetachedBatch',
      taxYear: 2030,
      detachedBatchStart: 'afterSimulatorPreActionContributionPhaseBeforeDetachedHsaActionBatch',
      complete: true,
      status: 'explicitEmpty',
      inflows: [],
    }
    const result = establishAnnualHsaOpeningAuthority(raw)
    expect(result.runtimeInflowInventoryStatus).toBe('explicitEmpty')
    expect(result.settledRuntimeCredits).toEqual([])
    expect(result.openingBalances.map((entry) => entry.openingBalance)).toEqual([1_000, 0])
  })

  it('hands derived post-credit openings directly to the detached physical candidate', () => {
    const raw = input()
    raw.runtimeInflowInventory = {
      predicate: 'completeSettledHsaRuntimeInflowsBeforeDetachedBatch',
      taxYear: 2030,
      detachedBatchStart: 'afterSimulatorPreActionContributionPhaseBeforeDetachedHsaActionBatch',
      complete: true,
      status: 'completeWithCredits',
      inflows: raw.runtimeInflowInventory.inflows.filter((entry) => entry.sourceAccountId === 'hsa-a') as [ReturnType<typeof credit>, ...ReturnType<typeof credit>[]],
    }
    const authority = establishAnnualHsaOpeningAuthority(raw)
    const candidate = stageAnnualHsaPhysicalMovementCandidate({
      taxYear: 2030,
      requestInventoryComplete: true,
      requests: [{
        actionId: asActionId('consume-authorized-hsa-a'),
        kind: 'ordinaryWithdrawal',
        year: 2030,
        executionDate: '2030-07-01',
        executionSequence: 1,
        personId: asPersonId('owner-a'),
        requestedAmount: asPositiveUsdCents(1_200),
        provenance: { source: 'manual' },
        purpose: { kind: 'spending' },
        allocations: [{
          allocationId: asAllocationId('consume-hsa-a'),
          sourceAccountId: asAccountId('hsa-a'),
          requestedAmount: asPositiveUsdCents(1_200),
        }],
      }, {
        actionId: asActionId('consume-authorized-zero-hsa-b'),
        kind: 'ordinaryWithdrawal',
        year: 2030,
        executionDate: '2030-07-01',
        executionSequence: 2,
        personId: asPersonId('owner-b'),
        requestedAmount: asPositiveUsdCents(1),
        provenance: { source: 'manual' },
        purpose: { kind: 'spending' },
        allocations: [{
          allocationId: asAllocationId('consume-zero-hsa-b'),
          sourceAccountId: asAccountId('hsa-b'),
          requestedAmount: asPositiveUsdCents(1),
        }],
      }],
      sourceEvidenceInventoryComplete: true,
      sourceEvidence: raw.sourceEvidence,
      openingBalanceInventoryComplete: true,
      openingBalances: authority.openingBalances,
    })
    expect(candidate.applications.map((entry) => [entry.sourceAccountId, entry.sourceBalanceBefore, entry.stagedAmount, entry.applicationStatus])).toEqual([
      ['hsa-a', 1_300, 1_200, 'full'],
      ['hsa-b', 0, 0, 'zero'],
    ])
  })

  it('is independent of array and object property insertion order', () => {
    const left = input()
    const right = {
      runtimeInflowInventory: {
        inflows: [...left.runtimeInflowInventory.inflows].reverse().map((entry) => ({
          upstreamEvidenceId: entry.upstreamEvidenceId,
          runtimeMovementEvidenceId: entry.runtimeMovementEvidenceId,
          runtimeEventId: entry.runtimeEventId,
          settled: entry.settled,
          amount: entry.amount,
          boundaryRelation: entry.boundaryRelation,
          settlementPhase: entry.settlementPhase,
          taxYear: entry.taxYear,
          ownerPersonId: entry.ownerPersonId,
          sourceAccountId: entry.sourceAccountId,
          predicate: entry.predicate,
        })),
        status: left.runtimeInflowInventory.status,
        complete: true,
        detachedBatchStart: 'afterSimulatorPreActionContributionPhaseBeforeDetachedHsaActionBatch',
        taxYear: 2030,
        predicate: 'completeSettledHsaRuntimeInflowsBeforeDetachedBatch',
      },
      annualStartBalances: [...left.annualStartBalances].reverse().map((entry) => ({
        authoritative: entry.authoritative,
        annualStartBalanceEvidenceId: entry.annualStartBalanceEvidenceId,
        annualStartBalance: entry.annualStartBalance,
        taxYear: entry.taxYear,
        ownerPersonId: entry.ownerPersonId,
        sourceAccountId: entry.sourceAccountId,
        boundary: entry.boundary,
        predicate: entry.predicate,
      })),
      annualStartBalanceInventoryComplete: true,
      sourceEvidence: [...left.sourceEvidence].reverse().map((entry) => ({
        authoritative: entry.authoritative,
        hsaClassificationEvidenceId: entry.hsaClassificationEvidenceId,
        accountOwnershipEvidenceId: entry.accountOwnershipEvidenceId,
        ownership: entry.ownership,
        accountType: entry.accountType,
        ownerPersonId: entry.ownerPersonId,
        sourceAccountId: entry.sourceAccountId,
        predicate: entry.predicate,
      })),
      sourceEvidenceInventoryComplete: true,
      detachedBatchStart: 'afterSimulatorPreActionContributionPhaseBeforeDetachedHsaActionBatch',
      taxYear: 2030,
    } as unknown as EstablishAnnualHsaOpeningAuthorityInput
    expect(establishAnnualHsaOpeningAuthority(right)).toEqual(establishAnnualHsaOpeningAuthority(left))
  })

  it.each([
    ['source completeness', (raw: MutableFixture) => { raw.sourceEvidenceInventoryComplete = false }],
    ['annual-start completeness', (raw: MutableFixture) => { raw.annualStartBalanceInventoryComplete = false }],
    ['runtime completeness', (raw: MutableFixture) => { raw.runtimeInflowInventory.complete = false }],
    ['runtime scope year', (raw: MutableFixture) => { raw.runtimeInflowInventory.taxYear = 2029 }],
    ['runtime scope boundary', (raw: MutableFixture) => { raw.runtimeInflowInventory.detachedBatchStart = 'beforeContributionPhase' }],
  ])('rejects false or mismatched %s', (_label, mutate) => {
    const raw = mutableInput()
    mutate(raw)
    expect(() => establishHostile(raw)).toThrow()
  })

  it('rejects absence instead of treating it as an empty inflow inventory', () => {
    const raw = mutableInput()
    delete (raw as Record<string, unknown>).runtimeInflowInventory
    expect(() => establishHostile(raw)).toThrow(/exact shape/)
  })

  it.each([
    ['omitted opening', (raw: MutableFixture) => { raw.annualStartBalances.pop() }],
    ['extra opening', (raw: MutableFixture) => { raw.annualStartBalances.push(annualStart('hsa-c', 'owner-c', 0)) }],
    ['duplicate opening', (raw: MutableFixture) => { raw.annualStartBalances[1] = raw.annualStartBalances[0] as Record<string, unknown> }],
    ['omitted source', (raw: MutableFixture) => { raw.sourceEvidence.pop() }],
    ['duplicate source', (raw: MutableFixture) => { raw.sourceEvidence[1] = raw.sourceEvidence[0] as Record<string, unknown> }],
    ['foreign inflow source', (raw: MutableFixture) => { (raw.runtimeInflowInventory.inflows[0] as Record<string, unknown>).sourceAccountId = 'hsa-foreign' }],
  ])('rejects an %s', (_label, mutate) => {
    const raw = mutableInput()
    mutate(raw)
    expect(() => establishHostile(raw)).toThrow()
  })

  it.each([
    ['owner', (raw: MutableFixture) => { (raw.runtimeInflowInventory.inflows[0] as Record<string, unknown>).ownerPersonId = 'owner-b' }],
    ['tax year', (raw: MutableFixture) => { (raw.runtimeInflowInventory.inflows[0] as Record<string, unknown>).taxYear = 2029 }],
    ['settlement phase', (raw: MutableFixture) => { (raw.runtimeInflowInventory.inflows[0] as Record<string, unknown>).settlementPhase = 'generalRuntimePhase' }],
    ['boundary relation', (raw: MutableFixture) => { (raw.runtimeInflowInventory.inflows[0] as Record<string, unknown>).boundaryRelation = 'afterDetachedHsaActionBatch' }],
    ['zero credit', (raw: MutableFixture) => { (raw.runtimeInflowInventory.inflows[0] as Record<string, unknown>).amount = 0 }],
    ['unsafe credit', (raw: MutableFixture) => { (raw.runtimeInflowInventory.inflows[0] as Record<string, unknown>).amount = Number.MAX_SAFE_INTEGER + 1 }],
  ])('rejects a credit with invalid %s', (_label, mutate) => {
    const raw = mutableInput()
    mutate(raw)
    expect(() => establishHostile(raw)).toThrow()
  })

  it('rejects arithmetic overflow', () => {
    const raw = mutableInput()
    const opening = raw.annualStartBalances.find((entry) => entry.sourceAccountId === 'hsa-a')
    if (opening === undefined) throw new Error('test fixture opening missing')
    opening.annualStartBalance = Number.MAX_SAFE_INTEGER
    expect(() => establishHostile(raw)).toThrow(/safe-integer cents/)
  })

  it.each(['runtimeEventId', 'runtimeMovementEvidenceId', 'upstreamEvidenceId'])('rejects duplicate %s values', (field) => {
    const raw = mutableInput()
    const first = raw.runtimeInflowInventory.inflows[0] as Record<string, unknown>
    const second = raw.runtimeInflowInventory.inflows[1] as Record<string, unknown>
    second[field] = first[field]
    expect(() => establishHostile(raw)).toThrow()
  })

  it('rejects cross-role identifiers while allowing stable account and person references', () => {
    const valid = establishAnnualHsaOpeningAuthority(input())
    expect(valid.status).toBe('annualHsaDetachedBatchOpeningAuthorityEstablished')
    const raw = mutableInput()
    const firstCredit = raw.runtimeInflowInventory.inflows[0] as Record<string, unknown>
    firstCredit.runtimeEventId = (raw.sourceEvidence[0] as Record<string, unknown>).sourceAccountId
    expect(() => establishHostile(raw)).toThrow(/Identifier collision/)
  })

  it.each([
    ['ownership evidence', (raw: MutableFixture) => { (raw.sourceEvidence[1] as Record<string, unknown>).accountOwnershipEvidenceId = (raw.sourceEvidence[0] as Record<string, unknown>).accountOwnershipEvidenceId }],
    ['classification evidence', (raw: MutableFixture) => { (raw.sourceEvidence[1] as Record<string, unknown>).hsaClassificationEvidenceId = (raw.sourceEvidence[0] as Record<string, unknown>).hsaClassificationEvidenceId }],
    ['annual-start evidence', (raw: MutableFixture) => { (raw.annualStartBalances[1] as Record<string, unknown>).annualStartBalanceEvidenceId = (raw.annualStartBalances[0] as Record<string, unknown>).annualStartBalanceEvidenceId }],
  ])('rejects same-role cross-source reuse of %s', (_label, mutate) => {
    const raw = mutableInput()
    mutate(raw)
    expect(() => establishHostile(raw)).toThrow(/Identifier collision/)
  })

  it('rejects exact-shape violations, getters, cycles, and exotic prototypes without invoking code', () => {
    const extra = mutableInput()
    extra.runtimeInflowInventory.extra = true
    expect(() => establishHostile(extra)).toThrow(/exact.shape/)

    let calls = 0
    const getter = mutableInput()
    Object.defineProperty(getter.runtimeInflowInventory.inflows[0], 'amount', {
      enumerable: true,
      get() { calls += 1; return 100 },
    })
    expect(() => establishHostile(getter)).toThrow(/plain data/)
    expect(calls).toBe(0)

    const cyclic = mutableInput()
    cyclic.self = cyclic
    expect(() => establishHostile(cyclic)).toThrow(/plain data/)

    const exotic = mutableInput()
    exotic.runtimeInflowInventory.inflows[0] = Object.assign(Object.create({ inherited: true }), exotic.runtimeInflowInventory.inflows[0])
    expect(() => establishHostile(exotic)).toThrow(/plain data/)
  })

  it('does not mutate the caller and returns deeply frozen evidence', () => {
    const raw = input()
    const before = clone(raw)
    const result = establishAnnualHsaOpeningAuthority(raw)
    expect(raw).toEqual(before)
    expect(Object.isFrozen(result)).toBe(true)
    expect(Object.isFrozen(result.sources[0]?.sourceEvidence)).toBe(true)
    expect(() => { (result.openingBalances as unknown[]).push({}) }).toThrow()
  })

  it('makes all derived evidence sensitive to the complete credit set', () => {
    const first = establishAnnualHsaOpeningAuthority(input())
    const raw = mutableInput()
    const firstCredit = raw.runtimeInflowInventory.inflows[0] as Record<string, unknown>
    firstCredit.amount = Number(firstCredit.amount) + 1
    const second = establishHostile(raw)
    expect(second.runtimeInflowInventoryEvidenceId).not.toBe(first.runtimeInflowInventoryEvidenceId)
    expect(second.openingBalances[0]?.openingBalanceEvidenceId).not.toBe(first.openingBalances[0]?.openingBalanceEvidenceId)
    expect(second.openingBalances[1]?.openingBalanceEvidenceId).not.toBe(first.openingBalances[1]?.openingBalanceEvidenceId)
    expect(second.openingAuthorityId).not.toBe(first.openingAuthorityId)
  })
})
