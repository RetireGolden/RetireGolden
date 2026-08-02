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
import { ACTION_REASON_REGISTRY, createActionReason } from './reasons.js'
import type { ExecuteOrdinaryWithdrawalsResult } from './execution.js'
import {
  ordinaryWithdrawalPublicationSource,
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

function qcdRequest(
  actionId: string,
  executionDate: string | undefined,
  sequence: number,
): RetirementActionRequest {
  return {
    actionId: asActionId(actionId),
    kind: 'qcd',
    donorPersonId: asPersonId('person-1'),
    year: 2030,
    ...(executionDate === undefined ? {} : { executionDate }),
    executionSequence: sequence,
    requestedAmount: asPositiveUsdCents(10_000),
    allocation: {
      allocationId: asAllocationId(`allocation-${actionId}`),
      sourceAccountId: asAccountId(`source-${actionId}`),
      requestedAmount: asPositiveUsdCents(10_000),
    },
    charity: {
      designationId: `charity-${actionId}`,
      name: 'Eligible charity',
      designationKind: 'eligiblePublicCharity',
      directFromCustodianAttested: true,
      eligibleOrganizationAttested: true,
      notDonorAdvisedFundOrSupportingOrganizationAttested: true,
      notSplitInterestEntityAttested: true,
      entireDistributionOtherwiseDeductibleAttested: true,
    },
    provenance: { source: 'manual' },
  }
}

function legacyRequest(
  kind:
    | 'legacyAggregateWithdrawal'
    | 'legacyAggregateRothConversion'
    | 'legacyAggregateQcd',
  actionId: string,
): RetirementActionRequest {
  const common = {
    actionId: asActionId(actionId),
    year: 2030,
    requestedAmount: asPositiveUsdCents(10_000),
    provenance: { source: 'migration' as const },
  }
  if (kind === 'legacyAggregateWithdrawal') {
    return { ...common, kind, legacyCategory: 'cash' }
  }
  if (kind === 'legacyAggregateRothConversion') return { ...common, kind }
  return { ...common, kind, legacyField: 'qcdAnnual' }
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

function executedRecord(
  action: RetirementActionRequest,
): Omit<AnnualRetirementActionRecord, 'executorSource'> {
  const baseRecord = record(action)
  return {
    ...baseRecord,
    readiness: 'actionable',
    outcome: 'executed',
    executedDate: baseRecord.scheduledDate,
    executedSequence: baseRecord.scheduledSequence,
    executedAmount: baseRecord.requestedAmount,
    unexecutedAmount: asUsdCents(0),
    allocations: baseRecord.allocations.map((allocation) => ({
      ...allocation,
      resolution: 'resolved',
      executedAmount: allocation.requestedAmount,
      unexecutedAmount: asUsdCents(0),
    })),
    reasons: [],
  }
}

function partialRecord(
  action: RetirementActionRequest,
): Omit<AnnualRetirementActionRecord, 'executorSource'> {
  if (action.kind !== 'ordinaryWithdrawal' && action.kind !== 'rothConversion') {
    throw new Error('fixture drift')
  }
  const baseRecord = record(action)
  const allocation = baseRecord.allocations[0]!
  const executedAmount = asUsdCents(Number(action.requestedAmount) / 2)
  return {
    ...baseRecord,
    readiness: 'actionable',
    outcome: 'partial',
    executedDate: baseRecord.scheduledDate,
    executedSequence: baseRecord.scheduledSequence,
    executedAmount,
    unexecutedAmount: executedAmount,
    allocations: [{
      ...allocation,
      resolution: 'resolved',
      executedAmount,
      unexecutedAmount: executedAmount,
    }],
    reasons: [createActionReason(
      action.kind === 'ordinaryWithdrawal'
        ? 'source-balance-trimmed'
        : 'conversion-balance-trimmed',
      {
        accountId: allocation.sourceAccountId,
        allocationId: allocation.allocationId,
      },
    )],
  }
}

function refusedRecord(
  action: RetirementActionRequest,
): Omit<AnnualRetirementActionRecord, 'executorSource'> {
  const baseRecord = record(action)
  const allocation = baseRecord.allocations[0]
  if (allocation === undefined) throw new Error('fixture drift')
  return {
    ...baseRecord,
    outcome: 'refused',
    reasons: [createActionReason('source-account-not-found', {
      accountId: allocation.sourceAccountId,
      allocationId: allocation.allocationId,
    })],
  }
}

function recordForReason(
  action: RetirementActionRequest,
  reason: AnnualRetirementActionRecord['reasons'][number],
): Omit<AnnualRetirementActionRecord, 'executorSource'> {
  if (reason.outcome === 'adjusted') {
    return { ...executedRecord(action), reasons: [reason] }
  }
  if (reason.outcome === 'partial') {
    const baseRecord = record(action)
    const allocation = baseRecord.allocations[0]
    if (allocation === undefined) throw new Error('fixture drift')
    const executedAmount = asUsdCents(Number(allocation.requestedAmount) / 2)
    return {
      ...baseRecord,
      readiness: 'actionable',
      outcome: 'partial',
      executedDate: baseRecord.scheduledDate,
      executedSequence: baseRecord.scheduledSequence,
      executedAmount,
      unexecutedAmount: executedAmount,
      allocations: [{
        ...allocation,
        resolution: 'resolved',
        executedAmount,
        unexecutedAmount: executedAmount,
      }],
      reasons: [reason],
    }
  }
  return {
    ...record(action),
    outcome: reason.outcome,
    reasons: [reason],
  }
}

function recordForBlockingReasons(
  action: RetirementActionRequest,
  reasons: readonly AnnualRetirementActionRecord['reasons'][number][],
): Omit<AnnualRetirementActionRecord, 'executorSource'> {
  if (
    reasons.length === 0 ||
    reasons.some((reason) => reason.outcome === 'adjusted' || reason.outcome === 'partial')
  ) {
    throw new Error('fixture requires blocking reasons')
  }
  const outcome = reasons.some((reason) => reason.outcome === 'unsupported')
    ? 'unsupported'
    : 'refused'
  const orderedReasons = [...reasons].sort((left, right) => {
    const leftGroup = outcome === 'unsupported' && left.outcome === 'unsupported' ? 0 : 1
    const rightGroup = outcome === 'unsupported' && right.outcome === 'unsupported' ? 0 : 1
    return leftGroup - rightGroup ||
      (left.code < right.code ? -1 : left.code > right.code ? 1 : 0)
  })
  const baseRecord = record(action)
  return {
    ...baseRecord,
    outcome,
    allocations: baseRecord.allocations.map((allocation) => ({
      ...allocation,
      resolution: 'resolved',
    })),
    reasons: orderedReasons,
  }
}

function linkedConversionPair(
  conversionActionId = 'linked-conversion',
  withdrawalActionId = 'linked-withdrawal',
): readonly [
  withdrawal: RetirementActionRequest,
  conversion: RetirementActionRequest,
] {
  const withdrawal = request(
    'ordinaryWithdrawal',
    withdrawalActionId,
    '2030-05-01',
    1,
  )
  const conversion = request(
    'rothConversion',
    conversionActionId,
    '2030-06-01',
    1,
  )
  if (
    withdrawal.kind !== 'ordinaryWithdrawal' ||
    conversion.kind !== 'rothConversion'
  ) throw new Error('fixture drift')
  withdrawal.purpose = {
    kind: 'taxPayment',
    referenceId: conversion.actionId,
  }
  conversion.taxFunding = {
    kind: 'linkedWithdrawal',
    withdrawalActionId: withdrawal.actionId,
  }
  return [withdrawal, conversion]
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

  it('binds ordinary publication adaptation to the executor commit state', () => {
    const action = request(
      'ordinaryWithdrawal',
      'adapter-commit-state',
      '2030-06-15',
      1,
    )
    const issue = {
      kind: 'executionSequenceConflict' as const,
      year: 2030,
      scheduledDate: '2030-06-15',
      executionSequence: 1,
      collidingActionIds: [
        action.actionId,
        asActionId('adapter-commit-peer'),
      ] as [ReturnType<typeof asActionId>, ReturnType<typeof asActionId>],
      reason: createActionReason('action-sequence-conflict'),
    }
    const execution = (
      committed: boolean,
      scheduleIssues: readonly typeof issue[],
      hasEvidence: boolean,
    ) => ({
      committed,
      requests: [action],
      scheduleIssues,
      balances: [],
      taxableBases: [],
      evidence: hasEvidence ? [executedRecord(action)] : [],
    }) as unknown as ExecuteOrdinaryWithdrawalsResult

    expect(() => ordinaryWithdrawalPublicationSource(
      execution(false, [], true),
    )).toThrow(/commit state differs/i)
    expect(() => ordinaryWithdrawalPublicationSource(
      execution(true, [issue], false),
    )).toThrow(/commit state differs/i)
    expect(() => ordinaryWithdrawalPublicationSource(
      execution(false, [issue], true),
    )).toThrow(/commit state differs/i)
    expect(() => ordinaryWithdrawalPublicationSource(
      execution(false, [issue], false),
    )).not.toThrow()
  })

  it('rejects a conversion whose destination aliases a source', () => {
    const conversion = request(
      'rothConversion',
      'aliased-conversion-destination',
      '2030-06-15',
      1,
    )
    if (conversion.kind !== 'rothConversion') throw new Error('fixture drift')
    conversion.destinationRothAccountId =
      conversion.allocations[0]!.sourceAccountId

    expect(() => publishAnnualRetirementActions({
      taxYear: 2030,
      requests: [conversion],
      sources: [source('rothConversionExecutor', [executedRecord(conversion)])],
    })).toThrow(/destination aliases a source/i)
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

  it('deduplicates and canonically groups blocking reasons', () => {
    const action = request(
      'ordinaryWithdrawal',
      'reason-order',
      '2030-06-15',
      1,
    )
    if (action.kind !== 'ordinaryWithdrawal') {
      throw new Error('expected ordinary withdrawal')
    }
    const allocation = action.allocations[0]!
    const required = createActionReason('required-facts-missing', {
      personId: action.personId,
      accountId: allocation.sourceAccountId,
      allocationId: allocation.allocationId,
    })
    const unsupported = createActionReason('withdrawal-source-type-unsupported', {
      accountId: allocation.sourceAccountId,
      allocationId: allocation.allocationId,
    })
    const refused = createActionReason('person-not-found', {
      personId: action.personId,
    })
    const publish = (reasons: AnnualRetirementActionRecord['reasons']) =>
      publishAnnualRetirementActions({
        taxYear: 2030,
        requests: [action],
        sources: [source('ordinaryWithdrawalExecutor', [{
          ...record(action),
          allocations: record(action).allocations.map((entry) => ({
            ...entry,
            resolution: 'resolved' as const,
          })),
          reasons,
        }])],
      })

    const reordered = publish([unsupported, refused, required, unsupported])
    const canonical = publish([required, unsupported, refused])

    expect(reordered).toEqual(canonical)
    expect(reordered?.records[0]?.reasons.map((reason) => reason.code)).toEqual([
      'required-facts-missing',
      'withdrawal-source-type-unsupported',
      'person-not-found',
    ])
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

  it('preserves omitted ordinary-withdrawal dates as valid year-end schedules', () => {
    const action = request(
      'ordinaryWithdrawal',
      'ordinary-omitted-date-blocker',
      '2030-01-01',
      1,
    )
    if (action.kind !== 'ordinaryWithdrawal') throw new Error('fixture drift')
    delete (action as { executionDate?: string }).executionDate

    expect(publishAnnualRetirementActions({
      taxYear: 2030,
      requests: [action],
      sources: [source('ordinaryWithdrawalExecutor', [refusedRecord(action)])],
    })?.records).toHaveLength(1)
  })

  it.each([
    ['empty', ''],
    ['malformed', '2030-02-30'],
    ['outside', '2029-06-15'],
  ] as const)(
    'requires the ordinary-withdrawal %s-date blocker',
    (_label, executionDate) => {
      const action = request(
        'ordinaryWithdrawal',
        `ordinary-${_label}-date-blocker`,
        executionDate,
        1,
      )
      if (action.kind !== 'ordinaryWithdrawal') throw new Error('fixture drift')

      expect(() => publishAnnualRetirementActions({
        taxYear: 2030,
        requests: [action],
        sources: [source('ordinaryWithdrawalExecutor', [refusedRecord(action)])],
      })).toThrow(/date reason missing/i)

      expect(() => publishAnnualRetirementActions({
        taxYear: 2030,
        requests: [action],
        sources: [source('ordinaryWithdrawalExecutor', [
          recordForBlockingReasons(action, [
            createActionReason('required-facts-missing'),
          ]),
        ])],
      })).toThrow(/date reason missing/i)

      expect(publishAnnualRetirementActions({
        taxYear: 2030,
        requests: [action],
        sources: [source('ordinaryWithdrawalExecutor', [
          recordForBlockingReasons(action, [
            createActionReason('required-facts-missing', {
              personId: action.personId,
            }),
          ]),
        ])],
      })?.records).toHaveLength(1)
    },
  )

  it.each([
    ['ownedNonRothIraExecutor', 'qcd'],
    ['rothConversionExecutor', 'qcd'],
    ['qcdExecutor', 'rothConversion'],
  ] as const)('rejects %s ownership of a %s record', (executorSource, kind) => {
    const action = kind === 'qcd'
      ? qcdRequest(`foreign-${executorSource}`, '2030-06-15', 1)
      : request('rothConversion', `foreign-${executorSource}`, '2030-06-15', 1)

    expect(() => publishAnnualRetirementActions({
      taxYear: 2030,
      requests: [action],
      sources: [source(executorSource, [record(action)])],
    })).toThrow(/executor source kind differs/i)
  })

  it.each(['rothConversion', 'qcd'] as const)(
    'accepts the ordinary executor canonical %s unsupported-scope fallback',
    (kind) => {
      const action = kind === 'qcd'
        ? qcdRequest('canonical-ordinary-scope-fallback', '2030-06-15', 1)
        : request('rothConversion', 'canonical-ordinary-scope-fallback', '2030-06-15', 1)
      const fallbackRecord = {
        ...record(action),
        reasons: [createActionReason('required-facts-missing', {
          personId: asPersonId('person-1'),
        })],
      }

      expect(publishAnnualRetirementActions({
        taxYear: 2030,
        requests: [action],
        sources: [source('ordinaryWithdrawalExecutor', [fallbackRecord])],
      })?.records).toHaveLength(1)
    },
  )

  it('accepts validated preflight blockers beside a canonical mixed-kind scope reason', () => {
    const action = request(
      'rothConversion',
      'canonical-ordinary-multireason-fallback',
      '2030-02-30',
      1,
    )
    const fallbackRecord = recordForBlockingReasons(action, [
      createActionReason('required-facts-missing', {
        personId: asPersonId('person-1'),
      }),
      createActionReason('conversion-date-invalid'),
    ])

    expect(publishAnnualRetirementActions({
      taxYear: 2030,
      requests: [action],
      sources: [source('ordinaryWithdrawalExecutor', [fallbackRecord])],
    })?.records).toHaveLength(1)
  })

  it('requires the canonical destination role on mixed-kind conversion preflight reasons', () => {
    const action = request(
      'rothConversion',
      'canonical-ordinary-destination-fallback',
      '2030-06-15',
      1,
    )
    if (action.kind !== 'rothConversion') throw new Error('fixture drift')
    const scopeReason = createActionReason('required-facts-missing', {
      personId: action.personId,
    })
    const publish = (destinationReason: ReturnType<typeof createActionReason>) =>
      publishAnnualRetirementActions({
        taxYear: 2030,
        requests: [action],
        sources: [source('ordinaryWithdrawalExecutor', [
          recordForBlockingReasons(action, [scopeReason, destinationReason]),
        ])],
      })

    expect(() => publish(createActionReason('conversion-destination-not-found', {
      personId: action.personId,
    }))).toThrow(/executor source kind differs/i)
    expect(() => publish(createActionReason('conversion-destination-not-found')))
      .toThrow(/executor source kind differs/i)
    expect(publish(createActionReason('conversion-destination-not-found', {
      accountId: action.destinationRothAccountId,
    }))?.records).toHaveLength(1)
  })

  it('accepts a canonical QCD charity preflight blocker beside its scope reason', () => {
    const action = qcdRequest(
      'canonical-ordinary-qcd-multireason-fallback',
      '2030-06-15',
      1,
    )
    if (action.kind !== 'qcd') throw new Error('fixture drift')
    action.charity.directFromCustodianAttested = false
    const fallbackRecord = recordForBlockingReasons(action, [
      createActionReason('required-facts-missing', {
        personId: action.donorPersonId,
      }),
      createActionReason('qcd-direct-charity-unconfirmed'),
    ])

    expect(publishAnnualRetirementActions({
      taxYear: 2030,
      requests: [action],
      sources: [source('ordinaryWithdrawalExecutor', [fallbackRecord])],
    })?.records).toHaveLength(1)
  })

  it.each([
    ['rothConversion', 'conversion-basis-evidence-missing'],
    ['qcd', 'qcd-rmd-evidence-missing'],
  ] as const)(
    'rejects the ordinary executor %s fallback with later-stage %s evidence',
    (kind, laterStageReasonCode) => {
      const action = kind === 'qcd'
        ? qcdRequest('foreign-later-stage-reason', '2030-06-15', 1)
        : request('rothConversion', 'foreign-later-stage-reason', '2030-06-15', 1)
      const actionPersonId = action.kind === 'qcd'
        ? action.donorPersonId
        : action.kind === 'rothConversion'
          ? action.personId
          : undefined
      if (actionPersonId === undefined) throw new Error('fixture drift')
      const fallbackRecord = recordForBlockingReasons(action, [
        createActionReason('required-facts-missing', {
          personId: actionPersonId,
        }),
        createActionReason(laterStageReasonCode),
      ])

      expect(() => publishAnnualRetirementActions({
        taxYear: 2030,
        requests: [action],
        sources: [source('ordinaryWithdrawalExecutor', [fallbackRecord])],
      })).toThrow(/executor source kind differs/i)
    },
  )

  it('rejects malformed allocation structure before mixed-kind fallback ownership', () => {
    const duplicateSource = request(
      'rothConversion',
      'mixed-fallback-duplicate-source',
      '2030-06-15',
      1,
    )
    const duplicateAllocation = request(
      'rothConversion',
      'mixed-fallback-duplicate-allocation',
      '2030-06-15',
      1,
    )
    const amountMismatch = request(
      'rothConversion',
      'mixed-fallback-amount-mismatch',
      '2030-06-15',
      1,
    )
    if (
      duplicateSource.kind !== 'rothConversion' ||
      duplicateAllocation.kind !== 'rothConversion' ||
      amountMismatch.kind !== 'rothConversion'
    ) {
      throw new Error('fixture drift')
    }
    duplicateSource.allocations = [
      {
        allocationId: asAllocationId('duplicate-source-first'),
        sourceAccountId: asAccountId('duplicate-source'),
        requestedAmount: asPositiveUsdCents(5_000),
      },
      {
        allocationId: asAllocationId('duplicate-source-second'),
        sourceAccountId: asAccountId('duplicate-source'),
        requestedAmount: asPositiveUsdCents(5_000),
      },
    ]
    duplicateAllocation.allocations = [
      {
        allocationId: asAllocationId('duplicate-allocation'),
        sourceAccountId: asAccountId('duplicate-allocation-first'),
        requestedAmount: asPositiveUsdCents(5_000),
      },
      {
        allocationId: asAllocationId('duplicate-allocation'),
        sourceAccountId: asAccountId('duplicate-allocation-second'),
        requestedAmount: asPositiveUsdCents(5_000),
      },
    ]
    amountMismatch.allocations = [{
      allocationId: asAllocationId('amount-mismatch'),
      sourceAccountId: asAccountId('amount-mismatch'),
      requestedAmount: asPositiveUsdCents(9_000),
    }]

    for (const malformedAction of [
      duplicateSource,
      duplicateAllocation,
      amountMismatch,
    ]) {
      expect(() => publishAnnualRetirementActions({
        taxYear: 2030,
        requests: [malformedAction],
        sources: [source('ordinaryWithdrawalExecutor', [record(malformedAction)])],
      })).toThrow(/duplicate source|duplicate allocation|exactly sum/i)
    }
  })

  it('rejects non-canonical ordinary-executor mixed-kind evidence', () => {
    const action = request(
      'rothConversion',
      'noncanonical-ordinary-mixed-kind',
      '2030-06-15',
      1,
    )
    const baseRecord = record(action)
    const invalidRecords = [
      executedRecord(action),
      partialRecord(action),
      { ...baseRecord, reasons: [] },
      {
        ...baseRecord,
        outcome: 'refused' as const,
        reasons: [createActionReason('person-not-found')],
      },
    ]

    for (const invalidRecord of invalidRecords) {
      expect(() => publishAnnualRetirementActions({
        taxYear: 2030,
        requests: [action],
        sources: [source('ordinaryWithdrawalExecutor', [invalidRecord])],
      })).toThrow(/executor source kind differs/i)
    }
  })

  it('rejects ordinary-executor ownership of a non-conflict legacy record', () => {
    const action = legacyRequest(
      'legacyAggregateRothConversion',
      'foreign-ordinary-legacy',
    )

    expect(() => publishAnnualRetirementActions({
      taxYear: 2030,
      requests: [action],
      sources: [source('ordinaryWithdrawalExecutor', [record(action)])],
    })).toThrow(/executor source kind differs/i)
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
      sources: [
        source('rothConversionExecutor', [
          recordForReason(
            missingDateA,
            createActionReason('conversion-date-missing'),
          ),
          recordForReason(
            missingDateB,
            createActionReason('conversion-date-missing'),
          ),
        ]),
        source('ordinaryWithdrawalExecutor', [
          recordForReason(
            malformedA,
            createActionReason('required-facts-missing', {
              personId: malformedA.kind === 'ordinaryWithdrawal'
                ? malformedA.personId
                : undefined,
            }),
          ),
          recordForReason(
            malformedB,
            createActionReason('required-facts-missing', {
              personId: malformedB.kind === 'ordinaryWithdrawal'
                ? malformedB.personId
                : undefined,
            }),
          ),
        ]),
      ],
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

  it.each(['2030-02-30', '2031-01-01'])(
    'rejects positive movement on invalid civil schedule %s',
    (executionDate) => {
      const action = request(
        'ordinaryWithdrawal',
        `invalid-movement-${executionDate}`,
        executionDate,
        1,
      )
      const baseRecord = record(action)
      const executedRecord = {
        ...baseRecord,
        readiness: 'actionable' as const,
        outcome: 'executed' as const,
        executedDate: baseRecord.scheduledDate,
        executedSequence: baseRecord.scheduledSequence,
        executedAmount: baseRecord.requestedAmount,
        unexecutedAmount: asUsdCents(0),
        allocations: baseRecord.allocations.map((allocation) => ({
          ...allocation,
          resolution: 'resolved' as const,
          executedAmount: allocation.requestedAmount,
          unexecutedAmount: asUsdCents(0),
        })),
        reasons: [],
      }

      expect(() => publishAnnualRetirementActions({
        taxYear: 2030,
        requests: [action],
        sources: [source('ordinaryWithdrawalExecutor', [executedRecord])],
      })).toThrow(/movement chronology differs/i)
    },
  )

  it('rejects action-specific reasons on an unrelated request kind', () => {
    const action = request(
      'ordinaryWithdrawal',
      'wrong-reason-kind',
      '2030-06-15',
      1,
    )
    const baseRecord = record(action)
    const executedRecord = {
      ...baseRecord,
      readiness: 'actionable' as const,
      outcome: 'executed' as const,
      executedDate: baseRecord.scheduledDate,
      executedSequence: baseRecord.scheduledSequence,
      executedAmount: baseRecord.requestedAmount,
      unexecutedAmount: asUsdCents(0),
      allocations: baseRecord.allocations.map((allocation) => ({
        ...allocation,
        resolution: 'resolved' as const,
        executedAmount: allocation.requestedAmount,
        unexecutedAmount: asUsdCents(0),
      })),
      reasons: [createActionReason('qcd-person-limit-trimmed')],
    }

    expect(() => publishAnnualRetirementActions({
      taxYear: 2030,
      requests: [action],
      sources: [source('ordinaryWithdrawalExecutor', [executedRecord])],
    })).toThrow(/reason kind differs/i)
  })

  it('reserves ordinary source-balance reasons for ordinary withdrawals', () => {
    const action = request(
      'rothConversion',
      'conversion-ordinary-balance-reason',
      '2030-06-15',
      1,
    )
    const baseRecord = record(action)
    const partialRecord = {
      ...baseRecord,
      readiness: 'actionable' as const,
      outcome: 'partial' as const,
      executedDate: baseRecord.scheduledDate,
      executedSequence: baseRecord.scheduledSequence,
      executedAmount: asUsdCents(5_000),
      unexecutedAmount: asUsdCents(5_000),
      allocations: baseRecord.allocations.map((allocation) => ({
        ...allocation,
        resolution: 'resolved' as const,
        executedAmount: asUsdCents(5_000),
        unexecutedAmount: asUsdCents(5_000),
      })),
      reasons: [createActionReason('source-balance-trimmed')],
    }

    expect(() => publishAnnualRetirementActions({
      taxYear: 2030,
      requests: [action],
      sources: [source('rothConversionExecutor', [partialRecord])],
    })).toThrow(/reason kind differs/i)
  })

  it.each([
    ['legacyAggregateWithdrawal', 'withdrawal-aggregate-unallocated', true],
    ['legacyAggregateWithdrawal', 'conversion-aggregate-unallocated', false],
    ['legacyAggregateWithdrawal', 'qcd-aggregate-unallocated', false],
    ['legacyAggregateRothConversion', 'withdrawal-aggregate-unallocated', false],
    ['legacyAggregateRothConversion', 'conversion-aggregate-unallocated', true],
    ['legacyAggregateRothConversion', 'qcd-aggregate-unallocated', false],
    ['legacyAggregateQcd', 'withdrawal-aggregate-unallocated', false],
    ['legacyAggregateQcd', 'conversion-aggregate-unallocated', false],
    ['legacyAggregateQcd', 'qcd-aggregate-unallocated', true],
  ] as const)(
    'binds legacy kind %s to aggregate reason %s',
    (kind, reasonCode, accepted) => {
      const action = legacyRequest(kind, `${kind}-${reasonCode}`)
      const publish = () => publishAnnualRetirementActions({
        taxYear: 2030,
        requests: [action],
        sources: [source('ordinaryWithdrawalExecutor', [{
          ...record(action),
          reasons: [createActionReason(reasonCode)],
        }])],
      })

      if (accepted) expect(publish).not.toThrow()
      else expect(publish).toThrow(/executor source kind differs/i)
    },
  )

  it.each([
    'legacyAggregateWithdrawal',
    'legacyAggregateRothConversion',
    'legacyAggregateQcd',
  ] as const)(
    'rejects generic executor reasons for legacy kind %s despite identifiers',
    (kind) => {
      const action = legacyRequest(kind, `${kind}-generic-reason`)
      for (const reason of [
        createActionReason('required-facts-missing'),
        createActionReason('required-facts-missing', {
          personId: asPersonId('foreign-person'),
          accountId: asAccountId('foreign-account'),
          allocationId: asAllocationId('foreign-allocation'),
        }),
        createActionReason('person-not-found'),
        createActionReason('person-not-found', {
          personId: asPersonId('foreign-person'),
        }),
        createActionReason('source-account-not-found'),
        createActionReason('source-account-not-found', {
          accountId: asAccountId('foreign-account'),
          allocationId: asAllocationId('foreign-allocation'),
        }),
      ]) {
        expect(() => publishAnnualRetirementActions({
          taxYear: 2030,
          requests: [action],
          sources: [source('ordinaryWithdrawalExecutor', [{
            ...record(action),
            outcome: reason.code === 'required-facts-missing'
              ? 'unsupported'
              : 'refused',
            reasons: [reason],
          }])],
        }), reason.code).toThrow(/executor source kind differs/i)
      }
    },
  )

  it.each([
    'duplicate-source-account',
    'duplicate-allocation-id',
    'allocation-total-mismatch',
  ] as const)(
    'rejects the pre-canonical allocation reason %s from executor publication',
    (reasonCode) => {
      const action = request(
        'ordinaryWithdrawal',
        `pre-canonical-reason-${reasonCode}`,
        '2030-06-15',
        1,
      )
      const allocation = action.kind === 'ordinaryWithdrawal'
        ? action.allocations[0]!
        : undefined
      if (allocation === undefined) throw new Error('fixture drift')

      expect(() => publishAnnualRetirementActions({
        taxYear: 2030,
        requests: [action],
        sources: [source('ordinaryWithdrawalExecutor', [{
          ...record(action),
          outcome: 'refused',
          reasons: [createActionReason(reasonCode, {
            accountId: allocation.sourceAccountId,
            allocationId: allocation.allocationId,
          })],
        }])],
      })).toThrow(/reason phase differs/i)
    },
  )

  it('continues to publish post-canonical source-resolution reasons', () => {
    const action = request(
      'ordinaryWithdrawal',
      'runtime-source-resolution-reason',
      '2030-06-15',
      1,
    )
    if (action.kind !== 'ordinaryWithdrawal') throw new Error('fixture drift')
    const allocation = action.allocations[0]!

    const publication = publishAnnualRetirementActions({
      taxYear: 2030,
      requests: [action],
      sources: [source('ordinaryWithdrawalExecutor', [{
        ...record(action),
        outcome: 'refused',
        reasons: [createActionReason('source-account-not-found', {
          accountId: allocation.sourceAccountId,
          allocationId: allocation.allocationId,
        })],
      }])],
    })

    expect(publication?.records[0]?.reasons).toEqual([
      createActionReason('source-account-not-found', {
        accountId: allocation.sourceAccountId,
        allocationId: allocation.allocationId,
      }),
    ])
  })

  const resolvedSourceReasonCodes = [
      'source-owner-mismatch',
      'joint-source-acting-person-mismatch',
      'source-balance-trimmed',
      'source-balance-unavailable',
      'withdrawal-taxable-basis-unsupported',
      'withdrawal-employer-basis-unsupported',
      'withdrawal-roth-ira-character-unsupported',
      'withdrawal-designated-roth-character-unsupported',
      'withdrawal-source-not-spendable',
      'withdrawal-penalty-evidence-missing',
      'withdrawal-plan-availability-unknown',
      'withdrawal-plan-not-available',
      'withdrawal-rule-of-55-evidence-missing',
      'withdrawal-sepp-evidence-missing',
      'withdrawal-inherited-facts-missing',
      'withdrawal-hsa-qualification-unknown',
      'withdrawal-source-type-unsupported',
      'conversion-source-owner-mismatch',
      'conversion-source-not-convertible',
      'conversion-ira-subtype-unknown',
      'conversion-simple-two-year-rule-unknown',
      'conversion-simple-two-year-period-open',
      'conversion-plan-availability-unknown',
      'conversion-plan-not-available',
      'conversion-employer-basis-unsupported',
      'conversion-inherited-source',
      'conversion-rmd-reserve-unavailable',
      'conversion-basis-evidence-missing',
      'conversion-balance-trimmed',
      'conversion-balance-unavailable',
      'qcd-source-owner-mismatch',
      'qcd-source-not-ira',
      'qcd-sep-simple-activity-unknown',
      'qcd-ongoing-sep-simple',
      'qcd-roth-source-unsupported',
      'qcd-taxable-amount-trimmed',
      'qcd-inherited-basis-unsupported',
      'qcd-rmd-evidence-missing',
      'qcd-balance-trimmed',
      'qcd-balance-unavailable',
  ] as const
  const sourceResolutionCases: ReadonlyArray<readonly [
    reasonCode: keyof typeof ACTION_REASON_REGISTRY,
    outcome: 'adjusted' | 'partial' | 'refused' | 'unsupported',
    requiredResolution: 'resolved' | 'unresolved' | 'either',
  ]> = [
    ['source-account-not-found', 'refused', 'unresolved'],
    ['required-facts-missing', 'unsupported', 'either'],
    ...resolvedSourceReasonCodes.map((reasonCode) => [
      reasonCode,
      ACTION_REASON_REGISTRY[reasonCode].outcome,
      'resolved' as const,
    ] as const),
  ]

  it.each(sourceResolutionCases)(
    'binds source predicate %s to %s allocation evidence',
    (reasonCode, outcome, requiredResolution) => {
      const action = reasonCode.startsWith('conversion-')
        ? request(
            'rothConversion',
            `resolution-${reasonCode}`,
            '2030-06-15',
            1,
          )
        : reasonCode.startsWith('qcd-')
          ? qcdRequest(`resolution-${reasonCode}`, '2030-06-15', 1)
          : request(
              'ordinaryWithdrawal',
              `resolution-${reasonCode}`,
              '2030-06-15',
              1,
            )
      const allocation = action.kind === 'qcd'
        ? action.allocation
        : action.kind === 'ordinaryWithdrawal' || action.kind === 'rothConversion'
          ? action.allocations[0]!
          : undefined
      if (allocation === undefined) throw new Error('fixture drift')
      const personId = action.kind === 'qcd'
        ? action.donorPersonId
        : action.kind === 'ordinaryWithdrawal' || action.kind === 'rothConversion'
          ? action.personId
          : undefined
      const reason = createActionReason(reasonCode, {
        personId,
        accountId: allocation.sourceAccountId,
        allocationId: allocation.allocationId,
      })
      expect(reason.outcome).toBe(outcome)
      const executorSource = action.kind === 'qcd'
        ? 'qcdExecutor'
        : action.kind === 'rothConversion'
          ? 'rothConversionExecutor'
          : 'ordinaryWithdrawalExecutor'

      for (const resolution of ['resolved', 'unresolved'] as const) {
        const reasonRecord = recordForReason(action, reason)
        const publish = () => publishAnnualRetirementActions({
          taxYear: 2030,
          requests: [action],
          sources: [source(executorSource, [{
            ...reasonRecord,
            allocations: reasonRecord.allocations.map((entry) => ({
              ...entry,
              resolution,
            })),
          }])],
        })
        if (
          requiredResolution === 'either' ||
          requiredResolution === resolution
        ) expect(publish).not.toThrow()
        else expect(publish).toThrow(/resolution differs/i)
      }
    },
  )

  it('requires a missing-source reason to identify an allocation', () => {
    const action = request(
      'ordinaryWithdrawal',
      'unbound-missing-source-reason',
      '2030-06-15',
      1,
    )
    expect(() => publishAnnualRetirementActions({
      taxYear: 2030,
      requests: [action],
      sources: [source('ordinaryWithdrawalExecutor', [{
        ...record(action),
        outcome: 'refused',
        reasons: [createActionReason('source-account-not-found')],
      }])],
    })).toThrow(/reason resolution differs/i)
  })

  it('requires identifier-free balance reasons to have a resolved source', () => {
    const action = request(
      'ordinaryWithdrawal',
      'unbound-post-resolution-reason',
      '2030-06-15',
      1,
    )
    const publish = (resolution: 'resolved' | 'unresolved') =>
      publishAnnualRetirementActions({
        taxYear: 2030,
        requests: [action],
        sources: [source('ordinaryWithdrawalExecutor', [{
          ...record(action),
          outcome: 'refused',
          allocations: record(action).allocations.map((entry) => ({
            ...entry,
            resolution,
          })),
          reasons: [createActionReason('source-balance-unavailable')],
        }])],
      })

    expect(() => publish('unresolved')).toThrow(/reason resolution differs/i)
    expect(publish('resolved')?.records).toHaveLength(1)
  })

  it('requires every source to resolve before an identifier-free balance refusal', () => {
    const action = request(
      'ordinaryWithdrawal',
      'mixed-resolution-balance-reason',
      '2030-06-15',
      1,
    )
    if (action.kind !== 'ordinaryWithdrawal') throw new Error('fixture drift')
    action.allocations = [
      {
        allocationId: asAllocationId('resolved-allocation'),
        sourceAccountId: asAccountId('resolved-source'),
        requestedAmount: asPositiveUsdCents(5_000),
      },
      {
        allocationId: asAllocationId('unresolved-allocation'),
        sourceAccountId: asAccountId('unresolved-source'),
        requestedAmount: asPositiveUsdCents(5_000),
      },
    ]
    const baseRecord = record(action)

    expect(() => publishAnnualRetirementActions({
      taxYear: 2030,
      requests: [action],
      sources: [source('ordinaryWithdrawalExecutor', [{
        ...baseRecord,
        outcome: 'refused',
        allocations: baseRecord.allocations.map((allocation, index) => ({
          ...allocation,
          resolution: index === 0 ? 'resolved' as const : 'unresolved' as const,
        })),
        reasons: [createActionReason('source-balance-unavailable')],
      }])],
    })).toThrow(/reason resolution differs/i)
  })

  it('rejects an identifier-free resolved source reason across multiple allocations', () => {
    const action = request(
      'rothConversion',
      'ambiguous-resolved-source-reason',
      '2030-06-15',
      1,
    )
    if (action.kind !== 'rothConversion') throw new Error('fixture drift')
    action.allocations = [
      {
        allocationId: asAllocationId('ambiguous-first'),
        sourceAccountId: asAccountId('ambiguous-source-first'),
        requestedAmount: asPositiveUsdCents(5_000),
      },
      {
        allocationId: asAllocationId('ambiguous-second'),
        sourceAccountId: asAccountId('ambiguous-source-second'),
        requestedAmount: asPositiveUsdCents(5_000),
      },
    ]
    const baseRecord = record(action)

    expect(() => publishAnnualRetirementActions({
      taxYear: 2030,
      requests: [action],
      sources: [source('rothConversionExecutor', [{
        ...baseRecord,
        outcome: 'refused',
        allocations: baseRecord.allocations.map((allocation) => ({
          ...allocation,
          resolution: 'resolved' as const,
        })),
        reasons: [createActionReason('conversion-source-not-convertible')],
      }])],
    })).toThrow(/reason identifiers differ/i)
  })

  it.each([
    ['ordinaryWithdrawal', 'source-balance-trimmed'],
    ['rothConversion', 'conversion-balance-trimmed'],
  ] as const)(
    'binds %s trim evidence to the exact partial allocation',
    (kind, reasonCode) => {
      const action = request(
        kind,
        `allocation-amount-${kind}`,
        '2030-06-15',
        1,
      )
      if (action.kind !== kind) throw new Error('fixture drift')
      action.allocations = [
        {
          allocationId: asAllocationId('allocation-full'),
          sourceAccountId: asAccountId('source-full'),
          requestedAmount: asPositiveUsdCents(4_000),
        },
        {
          allocationId: asAllocationId('allocation-partial'),
          sourceAccountId: asAccountId('source-partial'),
          requestedAmount: asPositiveUsdCents(3_000),
        },
        {
          allocationId: asAllocationId('allocation-zero'),
          sourceAccountId: asAccountId('source-zero'),
          requestedAmount: asPositiveUsdCents(3_000),
        },
      ]
      const baseRecord = record(action)
      const evidenceById = new Map(baseRecord.allocations.map((allocation) => [
        allocation.allocationId,
        allocation,
      ]))
      const allocations = [
        {
          ...evidenceById.get(asAllocationId('allocation-full'))!,
          resolution: 'resolved' as const,
          executedAmount: asUsdCents(4_000),
          unexecutedAmount: asUsdCents(0),
        },
        {
          ...evidenceById.get(asAllocationId('allocation-partial'))!,
          resolution: 'resolved' as const,
          executedAmount: asUsdCents(1_500),
          unexecutedAmount: asUsdCents(1_500),
        },
        {
          ...evidenceById.get(asAllocationId('allocation-zero'))!,
          resolution: 'resolved' as const,
          executedAmount: asUsdCents(0),
          unexecutedAmount: asUsdCents(3_000),
        },
      ]
      const executorSource = kind === 'rothConversion'
        ? 'rothConversionExecutor'
        : 'ordinaryWithdrawalExecutor'
      const publish = (allocationId: 'allocation-full' | 'allocation-partial' | 'allocation-zero') => {
        const allocation = evidenceById.get(asAllocationId(allocationId))!
        return publishAnnualRetirementActions({
          taxYear: 2030,
          requests: [action],
          sources: [source(executorSource, [{
            ...baseRecord,
            readiness: 'actionable',
            outcome: 'partial',
            executedDate: baseRecord.scheduledDate,
            executedSequence: baseRecord.scheduledSequence,
            executedAmount: asUsdCents(5_500),
            unexecutedAmount: asUsdCents(4_500),
            allocations,
            reasons: [createActionReason(reasonCode, {
              accountId: allocation.sourceAccountId,
              allocationId: allocation.allocationId,
            })],
          }])],
        })
      }

      expect(publish('allocation-partial')?.records).toHaveLength(1)
      expect(() => publish('allocation-full')).toThrow(/reason amounts differ/i)
      expect(() => publish('allocation-zero')).toThrow(/reason amounts differ/i)
    },
  )

  it('publishes an identifier-free aggregate trim across full and empty sources', () => {
    const action = request(
      'ordinaryWithdrawal',
      'aggregate-full-empty-trim',
      '2030-06-15',
      1,
    )
    if (action.kind !== 'ordinaryWithdrawal') throw new Error('fixture drift')
    action.allocations = [
      {
        allocationId: asAllocationId('allocation-full'),
        sourceAccountId: asAccountId('source-full'),
        requestedAmount: asPositiveUsdCents(5_000),
      },
      {
        allocationId: asAllocationId('allocation-empty'),
        sourceAccountId: asAccountId('source-empty'),
        requestedAmount: asPositiveUsdCents(5_000),
      },
    ]
    const baseRecord = record(action)
    const publication = publishAnnualRetirementActions({
      taxYear: 2030,
      requests: [action],
      sources: [source('ordinaryWithdrawalExecutor', [{
        ...baseRecord,
        readiness: 'actionable',
        outcome: 'partial',
        executedDate: baseRecord.scheduledDate,
        executedSequence: baseRecord.scheduledSequence,
        executedAmount: asUsdCents(5_000),
        unexecutedAmount: asUsdCents(5_000),
        allocations: baseRecord.allocations.map((allocation, index) => ({
          ...allocation,
          resolution: 'resolved' as const,
          executedAmount: asUsdCents(index === 0 ? 5_000 : 0),
          unexecutedAmount: asUsdCents(index === 0 ? 0 : 5_000),
        })),
        reasons: [createActionReason('source-balance-trimmed')],
      }])],
    })

    expect(publication?.records[0]?.outcome).toBe('partial')
  })

  it('binds QCD balance reasons without constraining non-balance adjustments', () => {
    const action = qcdRequest('qcd-allocation-amounts', '2030-06-15', 1)
    if (action.kind !== 'qcd') throw new Error('fixture drift')
    const allocation = action.allocation
    const trimReason = createActionReason('qcd-balance-trimmed', {
      accountId: allocation.sourceAccountId,
      allocationId: allocation.allocationId,
    })
    const unavailableReason = createActionReason('qcd-balance-unavailable', {
      accountId: allocation.sourceAccountId,
      allocationId: allocation.allocationId,
    })

    expect(publishAnnualRetirementActions({
      taxYear: 2030,
      requests: [action],
      sources: [source('qcdExecutor', [recordForReason(action, trimReason)])],
    })?.records).toHaveLength(1)
    expect(publishAnnualRetirementActions({
      taxYear: 2030,
      requests: [action],
      sources: [source('qcdExecutor', [{
        ...recordForReason(action, trimReason),
        reasons: [trimReason, createActionReason('qcd-person-limit-trimmed')],
      }])],
    })?.records).toHaveLength(1)
    expect(publishAnnualRetirementActions({
      taxYear: 2030,
      requests: [action],
      sources: [source('qcdExecutor', [{
        ...recordForReason(action, unavailableReason),
        allocations: recordForReason(action, unavailableReason).allocations.map(
          (entry) => ({ ...entry, resolution: 'resolved' as const }),
        ),
      }])],
    })?.records).toHaveLength(1)
    expect(publishAnnualRetirementActions({
      taxYear: 2030,
      requests: [action],
      sources: [source('qcdExecutor', [{
        ...executedRecord(action),
        reasons: [createActionReason('qcd-person-limit-trimmed')],
      }])],
    })?.records).toHaveLength(1)
  })

  it.each([
    [{ kind: 'noneExpected' } as const, false],
    [{
      kind: 'linkedWithdrawal',
      withdrawalActionId: asActionId('linked-tax-withdrawal'),
    } as const, false],
    [{
      kind: 'externalCash',
      amount: asPositiveUsdCents(1_000),
      attested: true,
    } as const, false],
    [{
      kind: 'conversionPrincipalWithholding',
      amount: asPositiveUsdCents(1_000),
    } as const, true],
  ])(
    'binds principal-withholding reasons to conversion funding mode %#',
    (taxFunding, accepted) => {
      const action = request(
        'rothConversion',
        `principal-reason-${taxFunding.kind}`,
        '2030-06-15',
        1,
      )
      if (action.kind !== 'rothConversion') throw new Error('fixture drift')
      action.taxFunding = taxFunding
      const linkedWithdrawal = taxFunding.kind === 'linkedWithdrawal'
        ? request(
            'ordinaryWithdrawal',
            taxFunding.withdrawalActionId,
            '2030-05-01',
            1,
          )
        : null
      if (linkedWithdrawal?.kind === 'ordinaryWithdrawal') {
        linkedWithdrawal.purpose = {
          kind: 'taxPayment',
          referenceId: action.actionId,
        }
      }
      const publish = () => publishAnnualRetirementActions({
        taxYear: 2030,
        requests: linkedWithdrawal === null
          ? [action]
          : [action, linkedWithdrawal],
        sources: [
          source('rothConversionExecutor', [{
            ...record(action),
            reasons: [createActionReason(
              'conversion-principal-withholding-unsupported',
            )],
          }]),
          ...(linkedWithdrawal === null
            ? []
            : [source('ordinaryWithdrawalExecutor', [record(linkedWithdrawal)])]),
        ],
      })

      if (accepted) expect(publish).not.toThrow()
      else expect(publish).toThrow(/funding reason differs/i)
    },
  )

  it('requires principal-withholding conversions to publish their blocking reason', () => {
    const action = request(
      'rothConversion',
      'principal-withholding-reason-required',
      '2030-06-15',
      1,
    )
    if (action.kind !== 'rothConversion') throw new Error('fixture drift')
    action.taxFunding = {
      kind: 'conversionPrincipalWithholding',
      amount: asPositiveUsdCents(1_000),
    }

    expect(() => publishAnnualRetirementActions({
      taxYear: 2030,
      requests: [action],
      sources: [source('rothConversionExecutor', [executedRecord(action)])],
    })).toThrow(/funding reason missing/i)
  })

  it.each([
    [{ kind: 'noneExpected' } as const, false],
    [{
      kind: 'linkedWithdrawal',
      withdrawalActionId: asActionId('linked-tax-withdrawal'),
    } as const, true],
    [{
      kind: 'externalCash',
      amount: asPositiveUsdCents(1_000),
      attested: true,
    } as const, true],
    [{
      kind: 'conversionPrincipalWithholding',
      amount: asPositiveUsdCents(1_000),
    } as const, true],
  ])(
    'binds unallocated-funding reasons to conversion funding mode %#',
    (taxFunding, accepted) => {
      const action = request(
        'rothConversion',
        `unallocated-reason-${taxFunding.kind}`,
        '2030-06-15',
        1,
      )
      if (action.kind !== 'rothConversion') throw new Error('fixture drift')
      action.taxFunding = taxFunding
      const linkedWithdrawal = taxFunding.kind === 'linkedWithdrawal'
        ? request(
            'ordinaryWithdrawal',
            taxFunding.withdrawalActionId,
            '2030-05-01',
            1,
          )
        : null
      if (linkedWithdrawal?.kind === 'ordinaryWithdrawal') {
        linkedWithdrawal.purpose = {
          kind: 'taxPayment',
          referenceId: action.actionId,
        }
      }
      const publish = () => publishAnnualRetirementActions({
        taxYear: 2030,
        requests: linkedWithdrawal === null
          ? [action]
          : [action, linkedWithdrawal],
        sources: [
          source('rothConversionExecutor', [recordForBlockingReasons(action, [
            createActionReason('conversion-tax-funding-unallocated'),
            ...(taxFunding.kind === 'conversionPrincipalWithholding'
              ? [createActionReason('conversion-principal-withholding-unsupported')]
              : []),
          ])]),
          ...(linkedWithdrawal === null
            ? []
            : [source('ordinaryWithdrawalExecutor', [record(linkedWithdrawal)])]),
        ],
      })

      if (accepted) expect(publish).not.toThrow()
      else expect(publish).toThrow(/funding reason differs/i)
    },
  )

  it('binds ordinary conversion-funding reasons to the exact linked withdrawal', () => {
    const withdrawal = request(
      'ordinaryWithdrawal',
      'linked-tax-withdrawal',
      '2030-06-15',
      1,
    )
    const conversion = request(
      'rothConversion',
      'funded-conversion',
      '2030-07-01',
      1,
    )
    if (conversion.kind !== 'rothConversion') throw new Error('fixture drift')
    if (withdrawal.kind !== 'ordinaryWithdrawal') throw new Error('fixture drift')
    withdrawal.purpose = {
      kind: 'taxPayment',
      referenceId: conversion.actionId,
    }
    const withdrawalRecord = {
      ...record(withdrawal),
      reasons: [createActionReason(
        'conversion-tax-funding-evidence-unsupported',
      )],
    }
    const publish = (withdrawalActionId: ReturnType<typeof asActionId>) => {
      conversion.taxFunding = { kind: 'linkedWithdrawal', withdrawalActionId }
      return publishAnnualRetirementActions({
        taxYear: 2030,
        requests: [withdrawal, conversion],
        sources: [
          source('ordinaryWithdrawalExecutor', [withdrawalRecord]),
          source('rothConversionExecutor', [record(conversion)]),
        ],
      })
    }

    expect(() => publish(withdrawal.actionId)).not.toThrow()
    expect(() => publish(asActionId('foreign-withdrawal')))
      .toThrow(/linked conversion funding differs|funding linkage differs/i)
    conversion.taxFunding = { kind: 'noneExpected' }
    expect(() => publishAnnualRetirementActions({
      taxYear: 2030,
      requests: [withdrawal, conversion],
      sources: [
        source('ordinaryWithdrawalExecutor', [withdrawalRecord]),
        source('rothConversionExecutor', [record(conversion)]),
      ],
    })).toThrow(/funding linkage differs/i)
  })

  it('publishes executed linked funding from generic sources independent of order', () => {
    const [withdrawal, conversion] = linkedConversionPair(
      'executed-linked-conversion',
      'executed-linked-withdrawal',
    )
    const forward = publishAnnualRetirementActions({
      taxYear: 2030,
      requests: [withdrawal, conversion],
      sources: [
        source('ordinaryWithdrawalExecutor', [executedRecord(withdrawal)]),
        source('rothConversionExecutor', [executedRecord(conversion)]),
      ],
    })
    const reverse = publishAnnualRetirementActions({
      taxYear: 2030,
      requests: [conversion, withdrawal],
      sources: [
        source('rothConversionExecutor', [executedRecord(conversion)]),
        source('ordinaryWithdrawalExecutor', [executedRecord(withdrawal)]),
      ],
    })

    expect(reverse).toEqual(forward)
    expect(forward?.records.every((entry) => entry.outcome === 'executed'))
      .toBe(true)
  })

  it('publishes linked refusal evidence independent of order', () => {
    const [withdrawal, conversion] = linkedConversionPair(
      'refused-linked-conversion',
      'refused-linked-withdrawal',
    )
    const withdrawalRecord = {
      ...record(withdrawal),
      reasons: [createActionReason(
        'conversion-tax-funding-evidence-unsupported',
      )],
    }
    const conversionRecord = record(conversion)
    const forward = publishAnnualRetirementActions({
      taxYear: 2030,
      requests: [withdrawal, conversion],
      sources: [
        source('ordinaryWithdrawalExecutor', [withdrawalRecord]),
        source('rothConversionExecutor', [conversionRecord]),
      ],
    })
    const reverse = publishAnnualRetirementActions({
      taxYear: 2030,
      requests: [conversion, withdrawal],
      sources: [
        source('rothConversionExecutor', [conversionRecord]),
        source('ordinaryWithdrawalExecutor', [withdrawalRecord]),
      ],
    })

    expect(reverse).toEqual(forward)
    expect(forward?.records.find((entry) =>
      entry.actionId === withdrawal.actionId)?.reasons).toEqual([
      createActionReason('conversion-tax-funding-evidence-unsupported'),
    ])
  })

  it.each([
    ['executed', 'executed', true],
    ['executed', 'partial', true],
    ['partial', 'executed', true],
    ['partial', 'partial', true],
    ['executed', 'refused', false],
    ['refused', 'executed', false],
    ['partial', 'unsupported', false],
    ['unsupported', 'partial', false],
    ['refused', 'unsupported', true],
    ['unsupported', 'refused', true],
    ['unsupported', 'unsupported', true],
  ] as const)(
    'binds linked withdrawal %s and conversion %s movement atomically',
    (withdrawalDisposition, conversionDisposition, accepted) => {
      const [withdrawal, conversion] = linkedConversionPair(
        `atomic-${withdrawalDisposition}-${conversionDisposition}-conversion`,
        `atomic-${withdrawalDisposition}-${conversionDisposition}-withdrawal`,
      )
      const dispositionRecord = (
        action: RetirementActionRequest,
        disposition: 'executed' | 'partial' | 'refused' | 'unsupported',
      ) => disposition === 'executed'
        ? executedRecord(action)
        : disposition === 'partial'
          ? partialRecord(action)
          : disposition === 'refused'
            ? refusedRecord(action)
            : record(action)
      const withdrawalRecord = dispositionRecord(
        withdrawal,
        withdrawalDisposition,
      )
      const conversionRecord = dispositionRecord(
        conversion,
        conversionDisposition,
      )
      const forward = () => publishAnnualRetirementActions({
        taxYear: 2030,
        requests: [withdrawal, conversion],
        sources: [
          source('ordinaryWithdrawalExecutor', [withdrawalRecord]),
          source('rothConversionExecutor', [conversionRecord]),
        ],
      })
      const reverse = () => publishAnnualRetirementActions({
        taxYear: 2030,
        requests: [conversion, withdrawal],
        sources: [
          source('rothConversionExecutor', [conversionRecord]),
          source('ordinaryWithdrawalExecutor', [withdrawalRecord]),
        ],
      })

      if (accepted) expect(reverse()).toEqual(forward())
      else {
        expect(forward).toThrow(/linked conversion funding disposition differs/i)
        expect(reverse).toThrow(/linked conversion funding disposition differs/i)
      }
    },
  )

  it.each([
    ['externalCash', {
      kind: 'externalCash',
      amount: asPositiveUsdCents(1_000),
      attested: true,
    }],
    ['conversionPrincipalWithholding', {
      kind: 'conversionPrincipalWithholding',
      amount: asPositiveUsdCents(1_000),
    }],
    ['noneExpected', { kind: 'noneExpected' }],
  ] as const)(
    'does not require a linked request for %s conversion funding',
    (_label, taxFunding) => {
      const conversion = request(
        'rothConversion',
        `unlinked-${taxFunding.kind}`,
        '2030-06-01',
        1,
      )
      if (conversion.kind !== 'rothConversion') throw new Error('fixture drift')
      conversion.taxFunding = taxFunding
      const conversionRecord = taxFunding.kind === 'conversionPrincipalWithholding'
        ? recordForBlockingReasons(conversion, [
            createActionReason('conversion-principal-withholding-unsupported'),
          ])
        : record(conversion)

      expect(() => publishAnnualRetirementActions({
        taxYear: 2030,
        requests: [conversion],
        sources: [source('rothConversionExecutor', [conversionRecord])],
      })).not.toThrow()
    },
  )

  it('rejects malformed linked funding independent of request order', () => {
    const malformedCases: Array<readonly [
      label: string,
      requests: readonly RetirementActionRequest[],
    ]> = []

    const [, absentConversion] = linkedConversionPair(
      'absent-link-conversion',
      'absent-link-withdrawal',
    )
    malformedCases.push(['absent target', [absentConversion]])

    const [, wrongKindConversion] = linkedConversionPair(
      'wrong-kind-conversion',
      'wrong-kind-target',
    )
    malformedCases.push([
      'wrong target kind',
      [wrongKindConversion, qcdRequest('wrong-kind-target', '2030-05-01', 1)],
    ])

    const [wrongPersonWithdrawal, wrongPersonConversion] = linkedConversionPair(
      'wrong-person-conversion',
      'wrong-person-withdrawal',
    )
    if (wrongPersonWithdrawal.kind !== 'ordinaryWithdrawal') {
      throw new Error('fixture drift')
    }
    wrongPersonWithdrawal.personId = asPersonId('person-2')
    malformedCases.push([
      'wrong person',
      [wrongPersonWithdrawal, wrongPersonConversion],
    ])

    const [wrongYearWithdrawal, wrongYearConversion] = linkedConversionPair(
      'wrong-year-conversion',
      'wrong-year-withdrawal',
    )
    wrongYearWithdrawal.year = 2031
    malformedCases.push([
      'wrong year',
      [wrongYearWithdrawal, wrongYearConversion],
    ])

    const [wrongPurposeWithdrawal, wrongPurposeConversion] =
      linkedConversionPair('wrong-purpose-conversion', 'wrong-purpose-withdrawal')
    if (wrongPurposeWithdrawal.kind !== 'ordinaryWithdrawal') {
      throw new Error('fixture drift')
    }
    wrongPurposeWithdrawal.purpose = { kind: 'spending' }
    malformedCases.push([
      'nonreciprocal purpose',
      [wrongPurposeWithdrawal, wrongPurposeConversion],
    ])

    const [wrongReferenceWithdrawal, wrongReferenceConversion] =
      linkedConversionPair('wrong-reference-conversion', 'wrong-reference-withdrawal')
    if (wrongReferenceWithdrawal.kind !== 'ordinaryWithdrawal') {
      throw new Error('fixture drift')
    }
    wrongReferenceWithdrawal.purpose = {
      kind: 'taxPayment',
      referenceId: asActionId('foreign-conversion'),
    }
    malformedCases.push([
      'nonreciprocal reference',
      [wrongReferenceWithdrawal, wrongReferenceConversion],
    ])

    const [sharedWithdrawal, firstConversion] = linkedConversionPair(
      'first-shared-conversion',
      'shared-withdrawal',
    )
    const [, secondConversion] = linkedConversionPair(
      'second-shared-conversion',
      'shared-withdrawal',
    )
    malformedCases.push([
      'ambiguous target',
      [sharedWithdrawal, firstConversion, secondConversion],
    ])

    for (const [label, requests] of malformedCases) {
      for (const orderedRequests of [requests, [...requests].reverse()]) {
        expect(() => publishAnnualRetirementActions({
          taxYear: 2030,
          requests: orderedRequests,
          sources: [source('rothConversionExecutor', [])],
        }), label).toThrow(/linked conversion funding differs|belongs to/i)
      }
    }
  })

  it.each([
    ['qcd-direct-charity-unconfirmed', {}, false],
    ['qcd-direct-charity-unconfirmed', {
      directFromCustodianAttested: false,
    }, true],
    ['qcd-direct-charity-unconfirmed', {
      eligibleOrganizationAttested: false,
    }, true],
    ['qcd-direct-charity-unconfirmed', {
      notDonorAdvisedFundOrSupportingOrganizationAttested: false,
    }, true],
    ['qcd-direct-charity-unconfirmed', {
      designationKind: 'donorAdvisedFund',
    }, true],
    ['qcd-split-interest-unsupported', {}, false],
    ['qcd-split-interest-unsupported', {
      notSplitInterestEntityAttested: false,
    }, true],
    ['qcd-split-interest-unsupported', {
      designationKind: 'splitInterestEntity',
    }, true],
    ['qcd-entire-distribution-deductibility-unconfirmed', {}, false],
    ['qcd-entire-distribution-deductibility-unconfirmed', {
      entireDistributionOtherwiseDeductibleAttested: false,
    }, true],
  ] as const)(
    'binds QCD charity reason %s to canonical evidence %#',
    (reasonCode, charityPatch, accepted) => {
      const action = qcdRequest('qcd-charity-reason', '2030-06-15', 1)
      if (action.kind !== 'qcd') throw new Error('fixture drift')
      Object.assign(action.charity, charityPatch)
      const reasons = [createActionReason(reasonCode)]
      if (
        reasonCode === 'qcd-split-interest-unsupported' &&
        action.charity.designationKind === 'splitInterestEntity'
      ) {
        reasons.push(createActionReason('qcd-direct-charity-unconfirmed'))
      }
      const publish = () => publishAnnualRetirementActions({
        taxYear: 2030,
        requests: [action],
        sources: [source('qcdExecutor', [recordForBlockingReasons(action, reasons)])],
      })

      if (accepted) expect(publish).not.toThrow()
      else expect(publish).toThrow(/charity reason differs/i)
    },
  )

  it.each([
    [{ designationKind: 'donorAdvisedFund' }],
    [{ designationKind: 'splitInterestEntity' }],
    [{ directFromCustodianAttested: false }],
    [{ eligibleOrganizationAttested: false }],
    [{ notDonorAdvisedFundOrSupportingOrganizationAttested: false }],
    [{ notSplitInterestEntityAttested: false }],
    [{ entireDistributionOtherwiseDeductibleAttested: false }],
  ] as const)(
    'requires blocking QCD charity reasons for ineligible request evidence %#',
    (charityPatch) => {
      const action = qcdRequest('qcd-charity-reason-required', '2030-06-15', 1)
      if (action.kind !== 'qcd') throw new Error('fixture drift')
      Object.assign(action.charity, charityPatch)

      expect(() => publishAnnualRetirementActions({
        taxYear: 2030,
        requests: [action],
        sources: [source('qcdExecutor', [executedRecord(action)])],
      })).toThrow(/charity reason missing/i)
    },
  )

  it.each([
    ['source-owner-mismatch', 'ordinaryWithdrawal', true],
    ['source-owner-mismatch', 'rothConversion', false],
    ['source-owner-mismatch', 'qcd', false],
    ['joint-source-acting-person-mismatch', 'ordinaryWithdrawal', true],
    ['joint-source-acting-person-mismatch', 'rothConversion', false],
    ['joint-source-acting-person-mismatch', 'qcd', false],
  ] as const)(
    'binds generic ownership reason %s to %s',
    (reasonCode, kind, accepted) => {
      const action = kind === 'qcd'
        ? qcdRequest(`ownership-${reasonCode}-${kind}`, '2030-06-15', 1)
        : request(kind, `ownership-${reasonCode}-${kind}`, '2030-06-15', 1)
      const allocation = action.kind === 'qcd'
        ? action.allocation
        : action.kind === 'ordinaryWithdrawal' || action.kind === 'rothConversion'
          ? action.allocations[0]!
          : undefined
      if (allocation === undefined) throw new Error('fixture drift')
      const executorSource = action.kind === 'qcd'
        ? 'qcdExecutor'
        : action.kind === 'rothConversion'
          ? 'rothConversionExecutor'
          : 'ordinaryWithdrawalExecutor'
      const publish = () => publishAnnualRetirementActions({
        taxYear: 2030,
        requests: [action],
        sources: [source(executorSource, [{
          ...record(action),
          outcome: 'refused',
          allocations: record(action).allocations.map((entry) => ({
            ...entry,
            resolution: 'resolved' as const,
          })),
          reasons: [createActionReason(reasonCode, {
            accountId: allocation.sourceAccountId,
            allocationId: allocation.allocationId,
          })],
        }])],
      })

      if (accepted) expect(publish).not.toThrow()
      else expect(publish).toThrow(/reason kind differs/i)
    },
  )

  it('binds reason account identifiers to source and destination roles', () => {
    const action = request(
      'rothConversion',
      'conversion-account-role',
      '2030-06-15',
      1,
    )
    if (action.kind !== 'rothConversion') throw new Error('expected conversion')
    const sourceAccountId = action.allocations[0]!.sourceAccountId
    const destinationAccountId = action.destinationRothAccountId
    const publishReason = (reason: AnnualRetirementActionRecord['reasons'][number]) =>
      publishAnnualRetirementActions({
        taxYear: 2030,
        requests: [action],
        sources: [source('rothConversionExecutor', [{
          ...record(action),
          outcome: 'refused',
          reasons: [reason],
        }])],
      })

    expect(publishReason(createActionReason('source-account-not-found', {
      accountId: sourceAccountId,
    }))?.records).toHaveLength(1)
    expect(publishReason(createActionReason('conversion-destination-not-found', {
      accountId: destinationAccountId,
    }))?.records).toHaveLength(1)
    expect(() => publishReason(createActionReason('source-account-not-found', {
      accountId: destinationAccountId,
    }))).toThrow(/reason account differs/i)
    expect(() => publishReason(createActionReason('conversion-destination-not-found', {
      accountId: sourceAccountId,
    }))).toThrow(/reason account differs/i)
  })

  it.each([
    'conversion-destination-owner-mismatch',
    'conversion-destination-incompatible',
    'conversion-roth-simple-destination-unsupported',
    'conversion-employer-destination-unsupported',
  ] as const)('rejects a missing conversion destination paired with %s', (reasonCode) => {
    const action = request(
      'rothConversion',
      'conversion-destination-resolution',
      '2030-06-15',
      1,
    )
    if (action.kind !== 'rothConversion') throw new Error('expected conversion')
    const destinationAccountId = action.destinationRothAccountId
    const missingReason = createActionReason('conversion-destination-not-found', {
      accountId: destinationAccountId,
    })
    const inspectionReason = createActionReason(reasonCode, {
      ...(reasonCode === 'conversion-destination-owner-mismatch'
        ? { personId: action.personId }
        : {}),
      accountId: destinationAccountId,
    })

    expect(() => publishAnnualRetirementActions({
      taxYear: 2030,
      requests: [action],
      sources: [source('rothConversionExecutor', [{
        ...record(action),
        outcome: inspectionReason.outcome === 'unsupported' ? 'unsupported' : 'refused',
        reasons: inspectionReason.outcome === 'unsupported'
          ? [inspectionReason, missingReason]
          : [missingReason, inspectionReason],
      }])],
    })).toThrow(/destination resolution differs/i)
  })

  it.each([
    ['conversion-destination-incompatible', 'conversion-roth-simple-destination-unsupported'],
    ['conversion-destination-incompatible', 'conversion-employer-destination-unsupported'],
    [
      'conversion-roth-simple-destination-unsupported',
      'conversion-employer-destination-unsupported',
    ],
  ] as const)(
    'rejects mutually exclusive destination classifications %s and %s',
    (leftCode, rightCode) => {
      const action = request(
        'rothConversion',
        `destination-classification-${leftCode}-${rightCode}`,
        '2030-06-15',
        1,
      )
      if (action.kind !== 'rothConversion') throw new Error('expected conversion')
      const destination = action.destinationRothAccountId

      expect(() => publishAnnualRetirementActions({
        taxYear: 2030,
        requests: [action],
        sources: [source('rothConversionExecutor', [recordForBlockingReasons(action, [
          createActionReason(leftCode, { accountId: destination }),
          createActionReason(rightCode, { accountId: destination }),
        ])])],
      })).toThrow(/destination classification differs/i)
    },
  )

  it.each([
    ['ordinaryWithdrawal', 'person-not-found', 'person-not-alive'],
    ['qcd', 'person-not-found', 'qcd-before-age-70-half'],
    ['qcd', 'person-not-found', 'qcd-contribution-history-unknown'],
    ['qcd', 'qcd-before-age-70-half', 'qcd-contribution-history-unknown'],
  ] as const)(
    'rejects mutually exclusive person states %s and %s for %s',
    (kind, leftCode, rightCode) => {
      const action = kind === 'qcd'
        ? qcdRequest(`person-state-${leftCode}-${rightCode}`, '2030-06-15', 1)
        : request(
            'ordinaryWithdrawal',
            `person-state-${leftCode}-${rightCode}`,
            '2030-06-15',
            1,
          )
      if (action.kind !== 'qcd' && action.kind !== 'ordinaryWithdrawal') {
        throw new Error('fixture drift')
      }
      const personId = action.kind === 'qcd' ? action.donorPersonId : action.personId
      const executorSource = action.kind === 'qcd'
        ? 'qcdExecutor'
        : 'ordinaryWithdrawalExecutor'

      expect(() => publishAnnualRetirementActions({
        taxYear: 2030,
        requests: [action],
        sources: [source(executorSource, [recordForBlockingReasons(action, [
          createActionReason(leftCode, { personId }),
          createActionReason(rightCode, { personId }),
        ])])],
      })).toThrow(/person resolution differs/i)
    },
  )

  const mutuallyExclusiveAllocationReasonGroups = [
    {
      kind: 'ordinaryWithdrawal' as const,
      codes: [
        'source-owner-mismatch',
        'joint-source-acting-person-mismatch',
      ] as const,
    },
    {
      kind: 'ordinaryWithdrawal' as const,
      codes: [
        'withdrawal-plan-availability-unknown',
        'withdrawal-plan-not-available',
      ] as const,
    },
    {
      kind: 'rothConversion' as const,
      codes: [
        'conversion-source-not-convertible',
        'conversion-inherited-source',
        'conversion-plan-availability-unknown',
        'conversion-plan-not-available',
        'conversion-ira-subtype-unknown',
        'conversion-simple-two-year-rule-unknown',
        'conversion-simple-two-year-period-open',
      ] as const,
    },
    {
      kind: 'qcd' as const,
      codes: [
        'qcd-source-not-ira',
        'qcd-roth-source-unsupported',
        'qcd-inherited-basis-unsupported',
        'qcd-sep-simple-activity-unknown',
        'qcd-ongoing-sep-simple',
      ] as const,
    },
  ]
  const mutuallyExclusiveAllocationReasonCases = mutuallyExclusiveAllocationReasonGroups.flatMap(
    ({ kind, codes }) => codes.flatMap((leftCode, leftIndex) =>
      codes.slice(leftIndex + 1).map((rightCode) => [kind, leftCode, rightCode] as const)),
  )

  it.each(mutuallyExclusiveAllocationReasonCases)(
    'rejects mutually exclusive %s source classifications %s and %s on one allocation',
    (kind, leftCode, rightCode) => {
      const action = kind === 'qcd'
        ? qcdRequest(`source-state-${leftCode}-${rightCode}`, '2030-06-15', 1)
        : request(kind, `source-state-${leftCode}-${rightCode}`, '2030-06-15', 1)
      if (
        action.kind !== 'qcd' &&
        action.kind !== 'rothConversion' &&
        action.kind !== 'ordinaryWithdrawal'
      ) throw new Error('fixture drift')
      const allocation = action.kind === 'qcd'
        ? action.allocation
        : action.allocations[0]!
      const executorSource = action.kind === 'qcd'
        ? 'qcdExecutor'
        : action.kind === 'rothConversion'
          ? 'rothConversionExecutor'
          : 'ordinaryWithdrawalExecutor'

      expect(() => publishAnnualRetirementActions({
        taxYear: 2030,
        requests: [action],
        sources: [source(executorSource, [recordForBlockingReasons(action, [
          createActionReason(leftCode, {
            accountId: allocation.sourceAccountId,
            allocationId: allocation.allocationId,
          }),
          createActionReason(rightCode, {
            accountId: allocation.sourceAccountId,
            allocationId: allocation.allocationId,
          }),
        ])])],
      })).toThrow(/source classification differs/i)
    },
  )

  it('permits different conversion source classifications on disjoint allocations', () => {
    const action = request(
      'rothConversion',
      'disjoint-source-classifications',
      '2030-06-15',
      1,
    )
    if (action.kind !== 'rothConversion') throw new Error('expected conversion')
    action.allocations = [
      {
        allocationId: asAllocationId('nonconvertible-allocation'),
        sourceAccountId: asAccountId('nonconvertible-source'),
        requestedAmount: asPositiveUsdCents(5_000),
      },
      {
        allocationId: asAllocationId('inherited-allocation'),
        sourceAccountId: asAccountId('inherited-source'),
        requestedAmount: asPositiveUsdCents(5_000),
      },
    ]
    const [nonconvertible, inherited] = action.allocations
    if (nonconvertible === undefined || inherited === undefined) throw new Error('fixture drift')

    expect(publishAnnualRetirementActions({
      taxYear: 2030,
      requests: [action],
      sources: [source('rothConversionExecutor', [recordForBlockingReasons(action, [
        createActionReason('conversion-source-not-convertible', {
          accountId: nonconvertible.sourceAccountId,
          allocationId: nonconvertible.allocationId,
        }),
        createActionReason('conversion-inherited-source', {
          accountId: inherited.sourceAccountId,
          allocationId: inherited.allocationId,
        }),
      ])])],
    })?.records).toHaveLength(1)
  })

  it.each([
    ['ordinaryWithdrawal', 'source-balance-unavailable', 'source-owner-mismatch'],
    ['rothConversion', 'conversion-balance-unavailable', 'conversion-inherited-source'],
    ['qcd', 'qcd-balance-unavailable', 'qcd-source-not-ira'],
  ] as const)(
    'rejects %s physical reason %s after blocking reason %s',
    (kind, balanceCode, blockingCode) => {
      const action = kind === 'qcd'
        ? qcdRequest(`physical-phase-${kind}`, '2030-06-15', 1)
        : request(kind, `physical-phase-${kind}`, '2030-06-15', 1)
      if (
        action.kind !== 'qcd' &&
        action.kind !== 'rothConversion' &&
        action.kind !== 'ordinaryWithdrawal'
      ) throw new Error('fixture drift')
      const allocation = action.kind === 'qcd'
        ? action.allocation
        : action.allocations[0]!
      const executorSource = action.kind === 'qcd'
        ? 'qcdExecutor'
        : action.kind === 'rothConversion'
          ? 'rothConversionExecutor'
          : 'ordinaryWithdrawalExecutor'
      const identifiers = {
        accountId: allocation.sourceAccountId,
        allocationId: allocation.allocationId,
      }

      expect(() => publishAnnualRetirementActions({
        taxYear: 2030,
        requests: [action],
        sources: [source(executorSource, [recordForBlockingReasons(action, [
          createActionReason(balanceCode, identifiers),
          createActionReason(blockingCode, identifiers),
        ])])],
      })).toThrow(/reason phase differs/i)
    },
  )

  it.each([
    ['rothConversion', 'missing', undefined],
    ['rothConversion', 'invalid', '2030-02-30'],
    ['rothConversion', 'outside', '2029-06-15'],
    ['qcd', 'missing', undefined],
    ['qcd', 'invalid', '2030-02-30'],
    ['qcd', 'outside', '2029-06-15'],
  ] as const)(
    'requires the canonical %s %s-date blocker even when another refusal is present',
    (kind, label, executionDate) => {
      const actionId = `required-${kind}-${label}-date-reason`
      const action = kind === 'qcd'
        ? qcdRequest(actionId, executionDate, 1)
        : request('rothConversion', actionId, executionDate ?? '2030-01-01', 1)
      if (executionDate === undefined && action.kind === 'rothConversion') {
        delete (action as { executionDate?: string }).executionDate
      }
      const executorSource = kind === 'qcd'
        ? 'qcdExecutor' as const
        : 'rothConversionExecutor' as const

      expect(() => publishAnnualRetirementActions({
        taxYear: 2030,
        requests: [action],
        sources: [source(executorSource, [{
          ...record(action),
          outcome: 'refused',
          reasons: [createActionReason('person-not-found', {
            personId: asPersonId('person-1'),
          })],
        }])],
      })).toThrow(/date reason missing/i)
    },
  )

  it('binds every conversion and QCD date reason to the exact schedule state', () => {
    const scheduleStates = [
      { label: 'omitted', state: 'missingDate', executionDate: undefined },
      { label: 'empty', state: 'missingDate', executionDate: '' },
      { label: 'whitespace', state: 'invalidDate', executionDate: ' ' },
      { label: 'malformed', state: 'invalidDate', executionDate: '2030-02-30' },
      { label: 'outside', state: 'outsideActionYear', executionDate: '2031-01-01' },
      { label: 'valid', state: 'valid', executionDate: '2030-06-15' },
    ] as const
    const families = [
      {
        name: 'conversion',
        executorSource: 'rothConversionExecutor' as const,
        reasons: [
          { state: 'missingDate', code: 'conversion-date-missing' },
          { state: 'invalidDate', code: 'conversion-date-invalid' },
          { state: 'outsideActionYear', code: 'conversion-date-outside-action-year' },
          { state: 'valid', code: 'conversion-simple-two-year-period-open' },
        ] as const,
        build: (actionId: string, executionDate: string | undefined) => {
          const action = request(
            'rothConversion',
            actionId,
            executionDate ?? '2030-01-01',
            1,
          )
          if (executionDate === undefined) {
            delete (action as { executionDate?: string }).executionDate
          }
          return action
        },
      },
      {
        name: 'qcd',
        executorSource: 'qcdExecutor' as const,
        reasons: [
          { state: 'missingDate', code: 'qcd-date-missing' },
          { state: 'invalidDate', code: 'qcd-date-invalid' },
          { state: 'outsideActionYear', code: 'qcd-date-outside-action-year' },
          { state: 'valid', code: 'qcd-before-age-70-half' },
          { state: 'valid', code: 'qcd-contribution-history-unknown' },
        ] as const,
        build: qcdRequest,
      },
    ] as const

    for (const family of families) {
      for (const schedule of scheduleStates) {
        for (const reasonCase of family.reasons) {
          const actionId = `${family.name}-${schedule.label}-${reasonCase.state}`
          const action = family.build(actionId, schedule.executionDate, 1)
          const reason = createActionReason(reasonCase.code)
          const secondaryOutsideYearReason =
            schedule.state === 'outsideActionYear' &&
            (reasonCase.code === 'qcd-before-age-70-half' ||
              reasonCase.code === 'conversion-simple-two-year-period-open')
              ? createActionReason(
                  family.name === 'qcd'
                    ? 'qcd-date-outside-action-year'
                    : 'conversion-date-outside-action-year',
                )
              : null
          const reasons = secondaryOutsideYearReason === null
            ? [reason]
            : [secondaryOutsideYearReason, reason]
          const publish = () => publishAnnualRetirementActions({
            taxYear: 2030,
            requests: [action],
            sources: [source(
              family.executorSource,
              [recordForBlockingReasons(action, reasons)],
            )],
          })

          const expectedState = schedule.state === reasonCase.state ||
            ((reasonCase.code === 'qcd-before-age-70-half' ||
              reasonCase.code === 'conversion-simple-two-year-period-open') &&
              schedule.state === 'outsideActionYear')
          if (expectedState) expect(publish).not.toThrow()
          else expect(publish).toThrow(/date reason (?:differs|missing)/i)
        }
      }
    }
  })

  it('orders only valid schedule states in canonical chronology', () => {
    const validDated = request(
      'rothConversion',
      'valid-dated',
      '2030-06-15',
      1,
    )
    const validUndated = request(
      'ordinaryWithdrawal',
      'valid-undated',
      '2030-01-01',
      1,
    )
    delete (validUndated as { executionDate?: string }).executionDate
    const invalid = request(
      'rothConversion',
      'a-invalid',
      '2030-02-30',
      1,
    )
    const outside = request(
      'rothConversion',
      'b-outside',
      '2029-01-01',
      1,
    )
    const actions = [outside, invalid, validUndated, validDated]
    const publication = publishAnnualRetirementActions({
      taxYear: 2030,
      requests: actions,
      sources: [
        source('ordinaryWithdrawalExecutor', [record(validUndated)]),
        source('rothConversionExecutor', [
          recordForReason(
            outside,
            createActionReason('conversion-date-outside-action-year'),
          ),
          recordForReason(
            invalid,
            createActionReason('conversion-date-invalid'),
          ),
          record(validDated),
        ]),
      ],
    })

    expect(publication?.records.map(({ actionId }) => actionId)).toEqual([
      'valid-dated',
      'valid-undated',
      'a-invalid',
      'b-outside',
    ])
  })

  it('rejects a conflict reason without a matching diagnostic', () => {
    const action = request(
      'ordinaryWithdrawal',
      'unsubstantiated-conflict',
      '2030-06-15',
      1,
    )
    expect(() => publishAnnualRetirementActions({
      taxYear: 2030,
      requests: [action],
      sources: [source('ordinaryWithdrawalExecutor', [conflictRecord(action)])],
    })).toThrow(/conflict reason has no source diagnostic/i)
  })

  it('does not let a foreign same-source diagnostic authorize a conflict reason', () => {
    const first = request(
      'ordinaryWithdrawal',
      'diagnosed-conflict-first',
      '2030-06-15',
      1,
    )
    const second = request(
      'ordinaryWithdrawal',
      'diagnosed-conflict-second',
      '2030-06-15',
      1,
    )
    const foreign = request(
      'ordinaryWithdrawal',
      'foreign-reason-bearing-record',
      '2030-07-01',
      1,
    )
    const diagnostic = (actionId: ReturnType<typeof asActionId>) => ({
      kind: 'executionSequenceConflict' as const,
      actionId,
      year: 2030,
      scheduledDate: '2030-06-15',
      executionSequence: 1,
      collidingActionIds: [first.actionId, second.actionId] as [
        ReturnType<typeof asActionId>,
        ReturnType<typeof asActionId>,
      ],
      reason: createActionReason('action-sequence-conflict'),
    })
    const batchRecord = {
      ...conflictRecord(foreign),
      reasons: [createActionReason('action-batch-schedule-conflict')],
    }
    const validBatchSource = {
      executorSource: 'ordinaryWithdrawalExecutor' as const,
      records: [
        conflictRecord(first),
        conflictRecord(second),
        batchRecord,
      ],
      scheduleDiagnostics: [
        diagnostic(first.actionId),
        diagnostic(second.actionId),
      ],
    }

    const publication = publishAnnualRetirementActions({
      taxYear: 2030,
      requests: [first, second, foreign],
      sources: [validBatchSource],
    })
    expect(publication?.records.find((entry) =>
      entry.actionId === foreign.actionId)?.reasons).toEqual([
      createActionReason('action-batch-schedule-conflict'),
    ])

    if (foreign.kind !== 'ordinaryWithdrawal') throw new Error('fixture drift')
    const allocation = foreign.allocations[0]!
    const half = asUsdCents(Number(foreign.requestedAmount) / 2)
    const invalidBatchRecords = [
      ['executed', {
        ...record(foreign),
        readiness: 'actionable' as const,
        outcome: 'executed' as const,
        executedDate: foreign.executionDate ?? null,
        executedSequence: foreign.executionSequence,
        executedAmount: asUsdCents(foreign.requestedAmount),
        unexecutedAmount: asUsdCents(0),
        allocations: record(foreign).allocations.map((entry) => ({
          ...entry,
          resolution: 'resolved' as const,
          executedAmount: entry.requestedAmount,
          unexecutedAmount: asUsdCents(0),
        })),
        reasons: [],
      }],
      ['partial', {
        ...record(foreign),
        readiness: 'actionable' as const,
        outcome: 'partial' as const,
        executedDate: foreign.executionDate ?? null,
        executedSequence: foreign.executionSequence,
        executedAmount: half,
        unexecutedAmount: half,
        allocations: record(foreign).allocations.map((entry) => ({
          ...entry,
          resolution: 'resolved' as const,
          executedAmount: half,
          unexecutedAmount: half,
        })),
        reasons: [createActionReason('source-balance-trimmed', {
          accountId: allocation.sourceAccountId,
          allocationId: allocation.allocationId,
        })],
      }],
      ['unsupported', record(foreign)],
      ['wrong-reason', {
        ...conflictRecord(foreign),
        reasons: [createActionReason('source-account-not-found', {
          accountId: allocation.sourceAccountId,
          allocationId: allocation.allocationId,
        })],
      }],
      ['missing-reason', {
        ...conflictRecord(foreign),
        reasons: [],
      }],
    ] as const
    for (const [label, invalidRecord] of invalidBatchRecords) {
      expect(() => publishAnnualRetirementActions({
        taxYear: 2030,
        requests: [first, second, foreign],
        sources: [{
          ...validBatchSource,
          records: [...validBatchSource.records.slice(0, 2), invalidRecord],
        }],
      }), label).toThrow(/batch conflict disposition differs|invalid_type|expected object/i)
    }

    expect(() => publishAnnualRetirementActions({
      taxYear: 2030,
      requests: [first, second, foreign],
      sources: [{
        ...validBatchSource,
        records: [...validBatchSource.records.slice(0, 2), conflictRecord(foreign)],
      }],
    })).toThrow(/batch conflict disposition differs|conflict reason has no source diagnostic/i)

    expect(() => publishAnnualRetirementActions({
      taxYear: 2030,
      requests: [first, second, foreign],
      sources: [{
        ...validBatchSource,
        executorSource: 'rothConversionExecutor',
      }],
    })).toThrow(/executor source kind differs/i)

    expect(() => publishAnnualRetirementActions({
      taxYear: 2030,
      requests: [foreign],
      sources: [{
        executorSource: 'ordinaryWithdrawalExecutor',
        records: [batchRecord],
        scheduleDiagnostics: [],
      }],
    })).toThrow(/batch conflict reason differs/i)

    const conversion = request(
      'rothConversion',
      'unrelated-conversion-batch-reason',
      '2030-07-01',
      1,
    )
    expect(() => publishAnnualRetirementActions({
      taxYear: 2030,
      requests: [conversion],
      sources: [source('rothConversionExecutor', [{
        ...conflictRecord(conversion),
        reasons: [createActionReason('action-batch-schedule-conflict')],
      }])],
    })).toThrow(/batch conflict reason differs/i)
  })

  it('does not let a wrong-slot diagnostic authorize a conflict reason', () => {
    const first = request(
      'ordinaryWithdrawal',
      'wrong-slot-first',
      '2030-06-15',
      1,
    )
    const second = request(
      'ordinaryWithdrawal',
      'wrong-slot-second',
      '2030-06-15',
      1,
    )
    const wrongSlotDiagnostic = (actionId: ReturnType<typeof asActionId>) => ({
      kind: 'executionSequenceConflict' as const,
      actionId,
      year: 2030,
      scheduledDate: '2030-06-16',
      executionSequence: 1,
      collidingActionIds: [first.actionId, second.actionId] as [
        ReturnType<typeof asActionId>,
        ReturnType<typeof asActionId>,
      ],
      reason: createActionReason('action-sequence-conflict'),
    })

    expect(() => publishAnnualRetirementActions({
      taxYear: 2030,
      requests: [first, second],
      sources: [{
        executorSource: 'ordinaryWithdrawalExecutor',
        records: [conflictRecord(first), conflictRecord(second)],
        scheduleDiagnostics: [
          wrongSlotDiagnostic(first.actionId),
          wrongSlotDiagnostic(second.actionId),
        ],
      }],
    })).toThrow(/diagnostic differs|conflict reason has no source diagnostic/i)
  })

  it('validates diagnostic slots and excludes invalid records from membership', () => {
    const first = request('ordinaryWithdrawal', 'undated-first', '2030-01-01', 1)
    const second = request('ordinaryWithdrawal', 'undated-second', '2030-01-01', 1)
    const invalid = request('rothConversion', 'undated-conversion', '2030-01-01', 1)
    delete (first as { executionDate?: string }).executionDate
    delete (second as { executionDate?: string }).executionDate
    delete (invalid as { executionDate?: string }).executionDate
    const diagnostic = (actionId: string, members: readonly string[]) => ({
      kind: 'executionSequenceConflict' as const,
      actionId: asActionId(actionId),
      year: 2030,
      scheduledDate: null,
      executionSequence: 1,
      collidingActionIds: members.map(asActionId) as [
        ReturnType<typeof asActionId>,
        ReturnType<typeof asActionId>,
        ...ReturnType<typeof asActionId>[],
      ],
      reason: createActionReason('action-sequence-conflict'),
    })
    const validConflictSource = {
      executorSource: 'ordinaryWithdrawalExecutor',
      records: [
        conflictRecord(first),
        conflictRecord(second),
        {
          ...record(invalid),
          outcome: 'refused',
          reasons: [createActionReason('action-batch-schedule-conflict')],
        },
      ],
      scheduleDiagnostics: [
        diagnostic(first.actionId, [first.actionId, second.actionId]),
        diagnostic(second.actionId, [first.actionId, second.actionId]),
      ],
    } as unknown as AnnualRetirementActionPublicationSource

    expect(publishAnnualRetirementActions({
      taxYear: 2030,
      requests: [first, second, invalid],
      sources: [validConflictSource],
    })?.scheduleDiagnostics).toHaveLength(2)

    const invalidPeer = request('rothConversion', 'undated-conversion-peer', '2030-01-01', 1)
    delete (invalidPeer as { executionDate?: string }).executionDate
    const invalidConflictSource = {
      executorSource: 'rothConversionExecutor',
      records: [conflictRecord(invalid), conflictRecord(invalidPeer)],
      scheduleDiagnostics: [
        diagnostic(invalid.actionId, [invalid.actionId, invalidPeer.actionId]),
        diagnostic(invalidPeer.actionId, [invalid.actionId, invalidPeer.actionId]),
      ],
    } as unknown as AnnualRetirementActionPublicationSource
    expect(() => publishAnnualRetirementActions({
      taxYear: 2030,
      requests: [invalid, invalidPeer],
      sources: [invalidConflictSource],
    })).toThrow(/diagnostic differs/i)
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
      records: [{
        ...conflictRecord(first),
        reasons: [
          createActionReason('action-sequence-conflict'),
          createActionReason('person-not-found'),
        ],
      }, conflictRecord(second)],
    })).toThrow(/conflict record remains actionable/i)
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

  it.each(['principal-withholding', 'ineligible-qcd-charity'] as const)(
    'lets canonical conflict fallback own %s request eligibility',
    (caseKind) => {
      const first = caseKind === 'ineligible-qcd-charity'
        ? qcdRequest('eligibility-conflict-first', '2030-06-15', 1)
        : request('rothConversion', 'eligibility-conflict-first', '2030-06-15', 1)
      const second = caseKind === 'ineligible-qcd-charity'
        ? qcdRequest('eligibility-conflict-second', '2030-06-15', 1)
        : request('rothConversion', 'eligibility-conflict-second', '2030-06-15', 1)
      for (const action of [first, second]) {
        if (action.kind === 'qcd') {
          action.charity.designationKind = 'donorAdvisedFund'
        } else if (action.kind === 'rothConversion') {
          action.taxFunding = {
            kind: 'conversionPrincipalWithholding',
            amount: asPositiveUsdCents(1_000),
          }
        } else {
          throw new Error('fixture drift')
        }
      }
      const diagnostic = (actionId: ReturnType<typeof asActionId>) => ({
        kind: 'executionSequenceConflict' as const,
        actionId,
        year: 2030,
        scheduledDate: '2030-06-15',
        executionSequence: 1,
        collidingActionIds: [first.actionId, second.actionId],
        reason: createActionReason('action-sequence-conflict'),
      })
      const conflictSource = {
        executorSource: 'ordinaryWithdrawalExecutor',
        records: [conflictRecord(first), conflictRecord(second)],
        scheduleDiagnostics: [diagnostic(first.actionId), diagnostic(second.actionId)],
      } as unknown as AnnualRetirementActionPublicationSource

      expect(publishAnnualRetirementActions({
        taxYear: 2030,
        requests: [first, second],
        sources: [conflictSource],
      })?.records).toHaveLength(2)
    },
  )

  it.each(['rothConversion', 'qcd'] as const)(
    'rejects extra %s refusal reasons on diagnosed conflict records',
    (kind) => {
      const first = kind === 'qcd'
        ? qcdRequest('specialized-conflict-first', '2030-06-15', 1)
        : request('rothConversion', 'specialized-conflict-first', '2030-06-15', 1)
      const second = kind === 'qcd'
        ? qcdRequest('specialized-conflict-second', '2030-06-15', 1)
        : request('rothConversion', 'specialized-conflict-second', '2030-06-15', 1)
      const executorSource = kind === 'qcd'
        ? 'qcdExecutor' as const
        : 'rothConversionExecutor' as const
      if (first.kind !== 'qcd' && first.kind !== 'rothConversion') {
        throw new Error('fixture drift')
      }
      const extraReason = first.kind === 'qcd'
        ? createActionReason('qcd-spouse-pooling-refused')
        : createActionReason('conversion-destination-incompatible', {
            accountId: first.destinationRothAccountId,
          })
      const diagnostic = (actionId: ReturnType<typeof asActionId>) => ({
        kind: 'executionSequenceConflict' as const,
        actionId,
        year: 2030,
        scheduledDate: '2030-06-15',
        executionSequence: 1,
        collidingActionIds: [first.actionId, second.actionId],
        reason: createActionReason('action-sequence-conflict'),
      })
      const conflictSource = {
        executorSource,
        records: [{
          ...conflictRecord(first),
          reasons: [createActionReason('action-sequence-conflict'), extraReason],
        }, conflictRecord(second)],
        scheduleDiagnostics: [diagnostic(first.actionId), diagnostic(second.actionId)],
      } as unknown as AnnualRetirementActionPublicationSource

      expect(() => publishAnnualRetirementActions({
        taxYear: 2030,
        requests: [first, second],
        sources: [conflictSource],
      })).toThrow(/conflict record remains actionable/i)
    },
  )
})
