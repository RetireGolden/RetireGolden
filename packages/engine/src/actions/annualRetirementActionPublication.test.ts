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
    const refused = createActionReason('source-account-not-found', {
      accountId: allocation.sourceAccountId,
      allocationId: allocation.allocationId,
    })
    const publish = (reasons: AnnualRetirementActionRecord['reasons']) =>
      publishAnnualRetirementActions({
        taxYear: 2030,
        requests: [action],
        sources: [source('ordinaryWithdrawalExecutor', [{
          ...record(action),
          reasons,
        }])],
      })

    const reordered = publish([unsupported, refused, required, unsupported])
    const canonical = publish([required, unsupported, refused])

    expect(reordered).toEqual(canonical)
    expect(reordered?.records[0]?.reasons.map((reason) => reason.code)).toEqual([
      'required-facts-missing',
      'withdrawal-source-type-unsupported',
      'source-account-not-found',
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

  it('binds every conversion and QCD date reason to the exact schedule state', () => {
    const scheduleStates = [
      { state: 'missingDate', executionDate: undefined },
      { state: 'invalidDate', executionDate: '2030-02-30' },
      { state: 'outsideActionYear', executionDate: '2031-01-01' },
      { state: 'valid', executionDate: '2030-06-15' },
    ] as const
    const families = [
      {
        name: 'conversion',
        executorSource: 'rothConversionExecutor' as const,
        reasons: [
          { state: 'missingDate', code: 'conversion-date-missing' },
          { state: 'invalidDate', code: 'conversion-date-invalid' },
          { state: 'outsideActionYear', code: 'conversion-date-outside-action-year' },
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
        ] as const,
        build: qcdRequest,
      },
    ] as const

    for (const family of families) {
      for (const schedule of scheduleStates) {
        for (const reasonCase of family.reasons) {
          const actionId = `${family.name}-${schedule.state}-${reasonCase.state}`
          const action = family.build(actionId, schedule.executionDate, 1)
          const reason = createActionReason(reasonCase.code)
          const publish = () => publishAnnualRetirementActions({
            taxYear: 2030,
            requests: [action],
            sources: [source(family.executorSource, [{
              ...record(action),
              outcome: reason.outcome === 'unsupported' ? 'unsupported' : 'refused',
              reasons: [reason],
            }])],
          })

          if (schedule.state === reasonCase.state) expect(publish).not.toThrow()
          else expect(publish).toThrow(/date reason differs/i)
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
      sources: [source('ordinaryWithdrawalExecutor', actions.map(record))],
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
      records: [conflictRecord(first), conflictRecord(second), record(invalid)],
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
