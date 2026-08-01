import { describe, expect, it } from 'vitest'

import {
  ownedNonRothIraAnnualFilingSourceRecord,
  singlePersonPlan,
  traditionalAccount,
} from '../testing/planFixtures.js'
import type { Plan } from '../model/plan.js'
import {
  resolvePlanOwnedNonRothIraAnnualFilingSources,
  type ResolvePlanOwnedNonRothIraAnnualFilingSourcesInput,
} from './ownedNonRothIraAnnualFilingSourceResolver.js'

function filingPlan(): Plan {
  const plan = singlePersonPlan()
  plan.id = 'filing-plan'
  plan.accounts = [traditionalAccount('ira-1', 10_000, 'p1')]
  return plan
}

describe('Plan-owned annual filing-source resolver', () => {
  it('resolves persisted and call-boundary sources without callbacks or precedence', () => {
    const plan = filingPlan()
    const persisted = ownedNonRothIraAnnualFilingSourceRecord(
      plan,
      'p1',
      ['ira-1'],
      2030,
      'persisted-2030',
    )
    const runtime = ownedNonRothIraAnnualFilingSourceRecord(
      plan,
      'p1',
      ['ira-1'],
      2031,
      'runtime-2031',
    )
    plan.retirementActionAnnualTaxFacts = {
      ownedNonRothIraAnnualFilingSourceRecords: [persisted],
    }

    const result = resolvePlanOwnedNonRothIraAnnualFilingSources({
      plan,
      runtimeSourceRecords: [runtime],
    })

    expect(result.status).toBe('resolved')
    expect(result.sources.map((source) => [
      source.sourceOrigin,
      source.sourceRecord.taxYear,
    ])).toEqual([
      ['plan', 2030],
      ['runtime', 2031],
    ])
    expect(result.issues).toEqual([])
    expect(Object.isFrozen(result)).toBe(true)
    expect(Object.isFrozen(result.sources[0]!.sourceRecord.authority)).toBe(true)
  })

  it('removes every colliding Plan/owner/year candidate while preserving independent keys', () => {
    const plan = filingPlan()
    const persisted2030 = ownedNonRothIraAnnualFilingSourceRecord(
      plan,
      'p1',
      ['ira-1'],
      2030,
      'persisted-2030',
    )
    const persisted2031 = ownedNonRothIraAnnualFilingSourceRecord(
      plan,
      'p1',
      ['ira-1'],
      2031,
      'persisted-2031',
    )
    const runtimeCollision = ownedNonRothIraAnnualFilingSourceRecord(
      plan,
      'p1',
      ['ira-1'],
      2030,
      'runtime-2030',
    )
    plan.retirementActionAnnualTaxFacts = {
      ownedNonRothIraAnnualFilingSourceRecords: [persisted2031, persisted2030],
    }

    const result = resolvePlanOwnedNonRothIraAnnualFilingSources({
      plan,
      runtimeSourceRecords: [runtimeCollision],
    })

    expect(result.status).toBe('partiallyResolved')
    expect(result.sources).toEqual([
      expect.objectContaining({
        sourceOrigin: 'plan',
        sourceRecord: expect.objectContaining({ taxYear: 2031 }),
      }),
    ])
    expect(result.issues).toHaveLength(2)
    expect(result.issues.map((issue) => issue.kind)).toEqual([
      'duplicateOwnerYearSource',
      'duplicateOwnerYearSource',
    ])
    expect(result.issues.map((issue) => issue.sourceOrigin).sort()).toEqual([
      'plan',
      'runtime',
    ])
  })

  it('rejects invalid runtime records and exact-pool mismatches without mutating input', () => {
    const plan = filingPlan()
    const invalid = ownedNonRothIraAnnualFilingSourceRecord(
      plan,
      'p1',
      ['ira-1'],
      2030,
      'invalid',
    )
    invalid.openingBasis.asOfDate = '2030-02-01'
    const stalePool = ownedNonRothIraAnnualFilingSourceRecord(
      plan,
      'p1',
      ['stale-ira'],
      2031,
      'stale',
    )
    const before = structuredClone([invalid, stalePool])

    const result = resolvePlanOwnedNonRothIraAnnualFilingSources({
      plan,
      runtimeSourceRecords: [invalid, stalePool],
    })

    expect(result.status).toBe('blocked')
    expect(result.sources).toEqual([])
    expect(result.issues.map((issue) => issue.kind).sort()).toEqual([
      'runtimeSourceBindingMismatch',
      'runtimeSourceRecordInvalid',
    ])
    expect([invalid, stalePool]).toEqual(before)
  })

  it('reads the call-boundary array once and blocks uncloneable input atomically', () => {
    const plan = filingPlan()
    let reads = 0
    const input = {
      plan,
      get runtimeSourceRecords() {
        reads += 1
        return [() => undefined]
      },
    } as unknown as ResolvePlanOwnedNonRothIraAnnualFilingSourcesInput

    expect(resolvePlanOwnedNonRothIraAnnualFilingSources(input)).toEqual({
      status: 'blocked',
      sources: [],
      issues: [{
        kind: 'runtimeInputInvalid',
        detail:
          'runtime annual filing source input must be one cloneable immutable array',
      }],
    })
    expect(reads).toBe(1)
  })

  it('blocks an invalid current Plan before considering runtime facts', () => {
    const plan = filingPlan()
    plan.schemaVersion = 3 as never

    expect(resolvePlanOwnedNonRothIraAnnualFilingSources({ plan })).toEqual({
      status: 'blocked',
      sources: [],
      issues: [{
        kind: 'planInvalid',
        detail: 'annual filing sources require a valid current Plan',
      }],
    })
  })

  it('rejects every candidate sharing any stable source identifier across years', () => {
    const plan = filingPlan()
    const first = ownedNonRothIraAnnualFilingSourceRecord(
      plan,
      'p1',
      ['ira-1'],
      2030,
      'first',
    )
    const second = ownedNonRothIraAnnualFilingSourceRecord(
      plan,
      'p1',
      ['ira-1'],
      2031,
      'second',
    )
    second.sourceRecordId = first.sourceRecordId

    const result = resolvePlanOwnedNonRothIraAnnualFilingSources({
      plan,
      runtimeSourceRecords: [first, second],
    })

    expect(result.status).toBe('blocked')
    expect(result.sources).toEqual([])
    expect(result.issues).toEqual([
      expect.objectContaining({
        kind: 'duplicateSourceIdentifier',
        identifier: first.sourceRecordId,
        sourceIndex: 0,
      }),
      expect.objectContaining({
        kind: 'duplicateSourceIdentifier',
        identifier: first.sourceRecordId,
        sourceIndex: 1,
      }),
    ])
  })

  it('rejects runtime source identifiers reserved by the Plan', () => {
    const plan = filingPlan()
    const runtime = ownedNonRothIraAnnualFilingSourceRecord(
      plan,
      'p1',
      ['ira-1'],
    )
    runtime.sourceRecordId = plan.id

    const result = resolvePlanOwnedNonRothIraAnnualFilingSources({
      plan,
      runtimeSourceRecords: [runtime],
    })

    expect(result.status).toBe('blocked')
    expect(result.issues).toEqual([
      expect.objectContaining({
        kind: 'runtimeSourceBindingMismatch',
        detail: expect.stringContaining('Plan identity namespace'),
      }),
    ])
  })

  it('canonicalizes set-like and contribution ordering', () => {
    const plan = filingPlan()
    plan.accounts.push(traditionalAccount('ira-2', 5_000, 'p1'))
    const source = ownedNonRothIraAnnualFilingSourceRecord(
      plan,
      'p1',
      ['ira-2', 'ira-1'],
    )
    source.nondeductibleContributionFacts.contributions = [{
      sourceRecordId: 'contribution-b',
      sourceEvidenceId: 'contribution-evidence-b',
      sourceAccountId: 'ira-2' as never,
      designatedTaxYear: 2030,
      contributionDate: '2031-04-10',
      nondeductibleContributionAmount: 200 as never,
    }, {
      sourceRecordId: 'contribution-a',
      sourceEvidenceId: 'contribution-evidence-a',
      sourceAccountId: 'ira-1' as never,
      designatedTaxYear: 2030,
      contributionDate: '2031-02-01',
      nondeductibleContributionAmount: 100 as never,
    }]
    const permuted = structuredClone(source)
    permuted.reviewedSourceAccountIds.reverse()
    permuted.nondeductibleContributionFacts.contributions.reverse()

    const first = resolvePlanOwnedNonRothIraAnnualFilingSources({
      plan,
      runtimeSourceRecords: [source],
    })
    const second = resolvePlanOwnedNonRothIraAnnualFilingSources({
      plan,
      runtimeSourceRecords: [permuted],
    })

    expect(first).toEqual(second)
    expect(first.sources[0]!.sourceRecord.reviewedSourceAccountIds).toEqual([
      'ira-1',
      'ira-2',
    ])
    expect(first.sources[0]!.sourceRecord.nondeductibleContributionFacts
      .contributions.map((contribution) => contribution.sourceRecordId)).toEqual([
      'contribution-a',
      'contribution-b',
    ])
  })

  it('rejects a canonical but incorrect ordinary filing deadline', () => {
    const plan = filingPlan()
    const runtime = ownedNonRothIraAnnualFilingSourceRecord(
      plan,
      'p1',
      ['ira-1'],
      2023,
      'wrong-deadline',
    )
    runtime.authority.finalizedDate = '2024-04-18'
    runtime.nondeductibleContributionFacts.completedThroughDate = '2024-04-18'
    runtime.nondeductibleContributionFacts.deadlineAuthority.deadlineDate = '2024-04-18'

    const result = resolvePlanOwnedNonRothIraAnnualFilingSources({
      plan,
      runtimeSourceRecords: [runtime],
    })

    expect(result.status).toBe('blocked')
    expect(result.issues.map((issue) => issue.kind)).toEqual([
      'runtimeSourceRecordInvalid',
    ])
  })

  it('fails closed when hostile Plan access throws', () => {
    const input = Object.defineProperty({}, 'plan', {
      enumerable: true,
      get: () => {
        throw new Error('hostile getter')
      },
    }) as ResolvePlanOwnedNonRothIraAnnualFilingSourcesInput

    expect(resolvePlanOwnedNonRothIraAnnualFilingSources(input)).toEqual({
      status: 'blocked',
      sources: [],
      issues: [{
        kind: 'planInvalid',
        detail: 'annual filing sources require a valid current Plan',
      }],
    })
  })
})
