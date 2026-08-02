import { describe, expect, it } from 'vitest'

import {
  type RetirementActionRequest,
} from './contract.js'
import {
  asAccountId,
  asActionId,
  asAllocationId,
  asPersonId,
} from './identity.js'
import { asPositiveUsdCents, asUsdCents } from './money.js'
import { createActionReason } from './reasons.js'
import {
  publishAnnualRetirementActions,
  type AnnualRetirementActionPublicationSource,
  type AnnualRetirementActionRecord,
  type AnnualRetirementActionExecutorSource,
} from './annualRetirementActionPublication.js'

function request(
  kind: 'ordinaryWithdrawal' | 'rothConversion',
  actionId: string,
  executionDate: string,
  sequence: number,
): RetirementActionRequest {
  const common = {
    actionId: asActionId(actionId),
    personId: asPersonId('person-1'),
    year: 2030,
    executionDate,
    executionSequence: sequence,
    requestedAmount: asPositiveUsdCents(10_000),
    allocations: [{
      allocationId: asAllocationId(`allocation-${actionId}`),
      sourceAccountId: asAccountId(`source-${actionId}`),
      requestedAmount: asPositiveUsdCents(10_000),
    }],
    provenance: { source: 'manual' as const },
  }
  return kind === 'ordinaryWithdrawal'
    ? {
        ...common,
        kind,
        purpose: { kind: 'spending' },
      }
    : {
        ...common,
        kind,
        destinationRothAccountId: asAccountId('roth-destination'),
        taxFunding: { kind: 'noneExpected' },
      }
}

function record(
  action: RetirementActionRequest,
): Omit<AnnualRetirementActionRecord, 'executorSource'> {
  const allocations = action.kind === 'qcd'
    ? [action.allocation]
    : action.kind === 'ordinaryWithdrawal' || action.kind === 'rothConversion'
      ? action.allocations
      : []
  return {
    request: action,
    actionId: action.actionId,
    kind: action.kind,
    personId:
      action.kind === 'qcd'
        ? action.donorPersonId
        : action.kind === 'ordinaryWithdrawal' || action.kind === 'rothConversion'
          ? action.personId
          : null,
    year: action.year,
    scheduledDate:
      'executionDate' in action ? (action.executionDate ?? null) : null,
    scheduledSequence:
      'executionSequence' in action ? action.executionSequence : null,
    executedDate: null,
    executedSequence: null,
    requestedAmount: action.requestedAmount,
    executedAmount: asUsdCents(0),
    unexecutedAmount: action.requestedAmount,
    readiness: 'nonActionable',
    outcome: 'unsupported',
    allocations: allocations.map((allocation) => ({
      allocationId: allocation.allocationId,
      sourceAccountId: allocation.sourceAccountId,
      resolution: 'unresolved',
      requestedAmount: allocation.requestedAmount,
      executedAmount: asUsdCents(0),
      unexecutedAmount: allocation.requestedAmount,
    })),
    reasons: [createActionReason('required-facts-missing')],
  }
}

function source(
  executorSource: AnnualRetirementActionExecutorSource,
  records: readonly Omit<AnnualRetirementActionRecord, 'executorSource'>[],
): AnnualRetirementActionPublicationSource {
  return { executorSource, records, scheduleDiagnostics: [] }
}

function conflictRecord(
  action: RetirementActionRequest,
): Omit<AnnualRetirementActionRecord, 'executorSource'> {
  return {
    ...record(action),
    outcome: 'refused',
    reasons: [createActionReason('action-sequence-conflict')],
  }
}

describe('annual retirement-action publication', () => {
  it('composes detached multi-kind records in canonical chronology', () => {
    const withdrawal = request(
      'ordinaryWithdrawal',
      'withdrawal',
      '2030-06-15',
      2,
    )
    const conversion = request(
      'rothConversion',
      'conversion',
      '2030-03-01',
      1,
    )
    const publication = publishAnnualRetirementActions({
      taxYear: 2030,
      requests: [withdrawal, conversion],
      sources: [
        source('rothConversionExecutor', [record(conversion)]),
        source('ordinaryWithdrawalExecutor', [record(withdrawal)]),
      ],
    })!

    expect(publication.executorSources).toEqual([
      'ordinaryWithdrawalExecutor',
      'rothConversionExecutor',
    ])
    expect(publication.taxYear).toBe(2030)
    expect(publication.records.map((entry) => entry.actionId)).toEqual([
      'conversion',
      'withdrawal',
    ])
    expect(publication.records[0]?.executorSource)
      .toBe('rothConversionExecutor')
    expect(publication.records[0]?.request).not.toBe(conversion)
    expect(Object.isFrozen(publication)).toBe(true)
    expect(Object.isFrozen(publication.records[0]?.request)).toBe(true)
  })

  it('publishes a conversion-only year without an ordinary executor', () => {
    const conversion = request(
      'rothConversion',
      'conversion-only',
      '2030-03-01',
      1,
    )
    const publication = publishAnnualRetirementActions({
      taxYear: 2030,
      requests: [conversion],
      sources: [source('rothConversionExecutor', [record(conversion)])],
    })

    expect(publication?.records).toEqual([
      expect.objectContaining({
        actionId: 'conversion-only',
        executorSource: 'rothConversionExecutor',
      }),
    ])
    expect(() => publishAnnualRetirementActions({
      taxYear: 0,
      requests: [],
      sources: [],
    })).toThrow(/1 through 9999/i)
  })

  it('is invariant to request and source order', () => {
    const withdrawal = request(
      'ordinaryWithdrawal',
      'withdrawal-order',
      '2030-06-15',
      2,
    )
    const conversion = request(
      'rothConversion',
      'conversion-order',
      '2030-03-01',
      1,
    )
    const forward = publishAnnualRetirementActions({
      taxYear: 2030,
      requests: [withdrawal, conversion],
      sources: [
        source('ordinaryWithdrawalExecutor', [record(withdrawal)]),
        source('rothConversionExecutor', [record(conversion)]),
      ],
    })
    const reverse = publishAnnualRetirementActions({
      taxYear: 2030,
      requests: [conversion, withdrawal],
      sources: [
        source('rothConversionExecutor', [record(conversion)]),
        source('ordinaryWithdrawalExecutor', [record(withdrawal)]),
      ],
    })
    expect(reverse).toEqual(forward)
  })

  it('canonicalizes request and execution allocation order', () => {
    const action = request(
      'ordinaryWithdrawal',
      'allocation-order',
      '2030-06-15',
      1,
    )
    const allocations = [
      {
        allocationId: asAllocationId('allocation-z'),
        sourceAccountId: asAccountId('source-z'),
        requestedAmount: asPositiveUsdCents(6_000),
      },
      {
        allocationId: asAllocationId('allocation-a'),
        sourceAccountId: asAccountId('source-a'),
        requestedAmount: asPositiveUsdCents(4_000),
      },
    ]
    const unsorted = { ...action, allocations }
    const executorRequest = { ...unsorted, allocations: [...allocations].reverse() }
    const executorRecord = {
      ...record(executorRequest),
      request: executorRequest,
      allocations: [...record(executorRequest).allocations].reverse(),
    }

    const publication = publishAnnualRetirementActions({
      taxYear: 2030,
      requests: [unsorted],
      sources: [source('ordinaryWithdrawalExecutor', [executorRecord])],
    })!

    expect(publication.records[0]?.request).toMatchObject({
      allocations: [
        expect.objectContaining({ allocationId: 'allocation-a' }),
        expect.objectContaining({ allocationId: 'allocation-z' }),
      ],
    })
    expect(publication.records[0]?.allocations.map(({ allocationId }) => allocationId))
      .toEqual(['allocation-a', 'allocation-z'])
  })

  it('orders same-date execution sequences numerically', () => {
    const second = request(
      'ordinaryWithdrawal',
      'second',
      '2030-06-15',
      2,
    )
    const tenth = request(
      'rothConversion',
      'tenth',
      '2030-06-15',
      10,
    )
    const publication = publishAnnualRetirementActions({
      taxYear: 2030,
      requests: [tenth, second],
      sources: [
        source('rothConversionExecutor', [record(tenth)]),
        source('ordinaryWithdrawalExecutor', [record(second)]),
      ],
    })

    expect(publication?.records.map((entry) => entry.actionId)).toEqual([
      'second',
      'tenth',
    ])
  })

  it('rejects missing and overlapping executor coverage', () => {
    const withdrawal = request(
      'ordinaryWithdrawal',
      'withdrawal-coverage',
      '2030-06-15',
      2,
    )
    expect(() => publishAnnualRetirementActions({
      taxYear: 2030,
      requests: [withdrawal],
      sources: [source('ordinaryWithdrawalExecutor', [])],
    })).toThrow(/too small/i)
    expect(() => publishAnnualRetirementActions({
      taxYear: 2030,
      requests: [withdrawal],
      sources: [
        source('ordinaryWithdrawalExecutor', [record(withdrawal)]),
        source('ownedNonRothIraExecutor', [record(withdrawal)]),
      ],
    })).toThrow(/multiple executors/i)
  })

  it('rejects undiagnosed cross-executor schedule collisions', () => {
    const withdrawal = request(
      'ordinaryWithdrawal',
      'withdrawal-collision',
      '2030-06-15',
      1,
    )
    const conversion = request(
      'rothConversion',
      'conversion-collision',
      '2030-06-15',
      1,
    )
    expect(() => publishAnnualRetirementActions({
      taxYear: 2030,
      requests: [withdrawal, conversion],
      sources: [
        source('ordinaryWithdrawalExecutor', [record(withdrawal)]),
        source('rothConversionExecutor', [record(conversion)]),
      ],
    })).toThrow(/schedule collision/i)
  })

  it('does not invent collisions for executor-refused invalid schedules', () => {
    const missingDateA = request('rothConversion', 'missing-date-a', '2030-01-01', 1)
    const missingDateB = request('rothConversion', 'missing-date-b', '2030-01-01', 1)
    delete (missingDateA as { executionDate?: string }).executionDate
    delete (missingDateB as { executionDate?: string }).executionDate
    const malformedA = request('ordinaryWithdrawal', 'malformed-a', '2030-99-99', 2)
    const malformedB = request('ordinaryWithdrawal', 'malformed-b', '2030-99-99', 2)

    const publication = publishAnnualRetirementActions({
      taxYear: 2030,
      requests: [missingDateA, missingDateB, malformedA, malformedB],
      sources: [source('ordinaryWithdrawalExecutor', [
        record(missingDateA),
        record(missingDateB),
        record(malformedA),
        record(malformedB),
      ])],
    })

    expect(publication?.records).toHaveLength(4)
    expect(publication?.scheduleDiagnostics).toEqual([])
  })

  it('rejects foreign or malformed normalized records', () => {
    const withdrawal = request(
      'ordinaryWithdrawal',
      'withdrawal-binding',
      '2030-06-15',
      1,
    )
    const foreign = request(
      'ordinaryWithdrawal',
      'foreign',
      '2030-07-01',
      2,
    )
    expect(() => publishAnnualRetirementActions({
      taxYear: 2030,
      requests: [withdrawal],
      sources: [
        source('ordinaryWithdrawalExecutor', [record(foreign)]),
      ],
    })).toThrow(/foreign action/i)
    expect(() => publishAnnualRetirementActions({
      taxYear: 2030,
      requests: [withdrawal],
      sources: [source('ordinaryWithdrawalExecutor', [{
        ...record(withdrawal),
        requestedAmount: asPositiveUsdCents(9_999),
      }])],
    })).toThrow(/identity differs/i)
  })

  it('rejects requests and records outside the publication tax year', () => {
    const withdrawal = request(
      'ordinaryWithdrawal',
      'withdrawal-year',
      '2030-06-15',
      1,
    )
    const nextYear = { ...withdrawal, year: 2031 }
    expect(() => publishAnnualRetirementActions({
      taxYear: 2030,
      requests: [nextYear],
      sources: [
        source('ordinaryWithdrawalExecutor', [record(nextYear)]),
      ],
    })).toThrow(/belongs to 2031, not 2030/i)
    expect(() => publishAnnualRetirementActions({
      taxYear: 2030,
      requests: [withdrawal],
      sources: [
        source('ordinaryWithdrawalExecutor', [{
          ...record(withdrawal),
          year: 2031,
        }]),
      ],
    })).toThrow(/belongs to 2031, not 2030/i)
  })

  it('runtime-validates generic sources and allocation evidence', () => {
    const withdrawal = request(
      'ordinaryWithdrawal',
      'withdrawal-runtime',
      '2030-06-15',
      1,
    )
    const validRecord = record(withdrawal)
    const publish = (candidate: unknown) => publishAnnualRetirementActions({
      taxYear: 2030,
      requests: [withdrawal],
      sources: [candidate as AnnualRetirementActionPublicationSource],
    })

    expect(() => publish({
      ...source('ordinaryWithdrawalExecutor', [validRecord]),
      executorSource: 'forgedExecutor',
    })).toThrow(/invalid option/i)
    expect(() => publish({
      ...source('ordinaryWithdrawalExecutor', [validRecord]),
      records: [{
        ...validRecord,
        allocations: validRecord.allocations.map((allocation) => ({
          ...allocation,
          resolution: 'forged',
        })),
      }],
    })).toThrow(/invalid option/i)
    expect(() => publish({
      ...source('ordinaryWithdrawalExecutor', [validRecord]),
      records: [{
        ...validRecord,
        allocations: validRecord.allocations.map((allocation) => ({
          ...allocation,
          executedAmount: -1,
          unexecutedAmount: 10_001,
        })),
      }],
    })).toThrow(/too small/i)
    expect(() => publish({
      ...source('ordinaryWithdrawalExecutor', [validRecord]),
      records: [{
        ...validRecord,
        readiness: 'actionable',
        outcome: 'executed',
        executedDate: validRecord.scheduledDate,
        executedSequence: validRecord.scheduledSequence,
        executedAmount: validRecord.requestedAmount,
        unexecutedAmount: asUsdCents(0),
        allocations: validRecord.allocations.map((allocation) => ({
          ...allocation,
          resolution: 'unresolved',
          executedAmount: allocation.requestedAmount,
          unexecutedAmount: asUsdCents(0),
        })),
        reasons: [],
      }],
    })).toThrow(/allocation resolution differs/i)
    expect(() => publish({
      ...source('ordinaryWithdrawalExecutor', [validRecord]),
      scheduleDiagnostics: [{
        kind: 'duplicateActionId',
        actionId: withdrawal.actionId,
        inputIndexes: [0, 1],
      }],
    })).toThrow(/invalid value|executionSequenceConflict/i)
    expect(() => publish({
      ...source('ordinaryWithdrawalExecutor', [validRecord]),
      records: [{
        ...validRecord,
        executedDate: validRecord.scheduledDate,
      }],
    })).toThrow(/movement chronology differs/i)
    expect(() => publish({
      ...source('ordinaryWithdrawalExecutor', [validRecord]),
      records: [{
        ...validRecord,
        reasons: [createActionReason('required-facts-missing', {
          personId: asPersonId('foreign-person'),
        })],
      }],
    })).toThrow(/reason person differs/i)
    expect(() => publish({
      ...source('ordinaryWithdrawalExecutor', [validRecord]),
      records: [{
        ...validRecord,
        reasons: [createActionReason('required-facts-missing', {
          accountId: asAccountId('foreign-account'),
        })],
      }],
    })).toThrow(/reason account differs/i)
    expect(() => publish({
      ...source('ordinaryWithdrawalExecutor', [validRecord]),
      records: [{
        ...validRecord,
        reasons: [createActionReason('required-facts-missing', {
          allocationId: asAllocationId('foreign-allocation'),
        })],
      }],
    })).toThrow(/reason allocation differs/i)
  })

  it('binds canonical conflict diagnostics to the complete schedule group', () => {
    const first = request(
      'ordinaryWithdrawal',
      'conflict-first',
      '2030-06-15',
      1,
    )
    const second = request(
      'ordinaryWithdrawal',
      'conflict-second',
      '2030-06-15',
      1,
    )
    const firstDiagnostic = {
      kind: 'executionSequenceConflict' as const,
      actionId: first.actionId,
      year: 2030,
      scheduledDate: '2030-06-15',
      executionSequence: 1,
      collidingActionIds: [first.actionId, second.actionId],
      reason: createActionReason('action-sequence-conflict'),
    }
    const secondDiagnostic = {
      ...firstDiagnostic,
      actionId: second.actionId,
    }
    const conflictSource = {
      executorSource: 'ordinaryWithdrawalExecutor',
      records: [conflictRecord(first), conflictRecord(second)],
      scheduleDiagnostics: [{
        ...firstDiagnostic,
        collidingActionIds: [second.actionId, first.actionId],
      }, secondDiagnostic],
    } as unknown as AnnualRetirementActionPublicationSource
    const publish = (candidate: unknown) =>
      publishAnnualRetirementActions({
        taxYear: 2030,
        requests: [first, second],
        sources: [candidate as AnnualRetirementActionPublicationSource],
      })

    const publication = publish(conflictSource)!
    expect(publication.scheduleDiagnostics).toHaveLength(2)
    expect(publication.scheduleDiagnostics[0]?.collidingActionIds)
      .toEqual([first.actionId, second.actionId])
    expect(() => publish({
      ...conflictSource,
      scheduleDiagnostics: [{
        ...firstDiagnostic,
        collidingActionIds: [first.actionId, asActionId('foreign')],
      }],
    })).toThrow(/members differ|per-action diagnostic/i)
    expect(() => publish({
      ...conflictSource,
      scheduleDiagnostics: [{
        ...firstDiagnostic,
        reason: createActionReason('required-facts-missing'),
      }],
    }))
      .toThrow(/differs|action-sequence-conflict/i)
    const executedFirst = {
      ...record(first),
      readiness: 'actionable' as const,
      outcome: 'executed' as const,
      executedDate: record(first).scheduledDate,
      executedSequence: record(first).scheduledSequence,
      executedAmount: first.requestedAmount,
      unexecutedAmount: asUsdCents(0),
      allocations: record(first).allocations.map((allocation) => ({
        ...allocation,
        resolution: 'resolved' as const,
        executedAmount: allocation.requestedAmount,
        unexecutedAmount: asUsdCents(0),
      })),
      reasons: [],
    }
    expect(() => publish({
      ...conflictSource,
      records: [executedFirst, conflictRecord(second)],
    })).toThrow(/remains actionable/i)
  })
})
