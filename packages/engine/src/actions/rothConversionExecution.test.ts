import { describe, expect, it } from 'vitest'

import type { Plan } from '../model/plan.js'
import { singlePersonPlan, traditionalAccount } from '../testing/planFixtures.js'
import {
  actionExecutionDispositionSchema,
  rothConversionRequestSchema,
  type RothConversionRequest,
} from './contract.js'
import { asPersonId } from './identity.js'
import { asUsdCents } from './money.js'
import type {
  NonpersistedOwnerIraRmdSatisfactionEvidence,
} from '../strategies/accountEligibility.js'
import {
  executeRothConversions,
  type ExecuteRothConversionsInput,
} from './rothConversionExecution.js'
import {
  publishAnnualRetirementActions,
  rothConversionPublicationSource,
} from './annualRetirementActionPublication.js'

const year = 2030

function plan(): Plan {
  const value = singlePersonPlan({ dob: '1960-01-01', planningAge: 100 })
  value.accounts = [
    traditionalAccount('traditional-a', 100, 'p1'),
    traditionalAccount('traditional-b', 100, 'p1'),
    {
      id: 'roth-a',
      name: 'Roth A',
      type: 'roth',
      kind: 'ira',
      ownerPersonId: 'p1',
      balance: 0,
      annualContribution: 0,
      annualReturnPct: 0,
    },
  ]
  value.retirementActionEligibilityFacts = {
    iraClassifications: ['traditional-a', 'traditional-b'].map((sourceAccountId) => ({
      sourceAccountId,
      subtype: 'traditional' as const,
      evidenceId: `classification-${sourceAccountId}`,
      provenance: { source: 'manual' as const },
    })),
    sepSimpleActivities: [],
    deductibleIraContributions: [],
  }
  return value
}

function request(
  actionId = 'conversion-a',
  sequence = 1,
  allocations = [
    { allocationId: 'allocation-a', sourceAccountId: 'traditional-a', requestedAmount: 6_000 },
    { allocationId: 'allocation-b', sourceAccountId: 'traditional-b', requestedAmount: 4_000 },
  ],
): RothConversionRequest {
  return rothConversionRequestSchema.parse({
    actionId,
    kind: 'rothConversion',
    personId: 'p1',
    year,
    executionDate: '2030-12-15',
    executionSequence: sequence,
    requestedAmount: allocations.reduce((sum, allocation) => sum + allocation.requestedAmount, 0),
    allocations,
    destinationRothAccountId: 'roth-a',
    taxFunding: { kind: 'noneExpected' },
    provenance: { source: 'manual' },
  })
}

function input(requests: readonly RothConversionRequest[] = [request()]): ExecuteRothConversionsInput {
  return {
    year,
    plan: plan(),
    requests,
    openingBalances: [
      { accountId: 'traditional-a', openingBalance: asUsdCents(8_000) },
      { accountId: 'traditional-b', openingBalance: asUsdCents(5_000) },
      { accountId: 'roth-a', openingBalance: asUsdCents(1_000) },
    ],
    runtimeEvidence: {
      personAliveEvidence: requests.map((value) => ({
        evidenceId: `alive-${value.actionId}`,
        actionId: value.actionId,
        personId: value.personId,
        actionYear: value.year,
        actionDate: value.executionDate ?? null,
        alive: true,
      })),
    },
  }
}

function setAtPath(
  value: unknown,
  path: readonly (string | number)[],
  replacement: unknown,
): void {
  let cursor: unknown = value
  for (const segment of path.slice(0, -1)) {
    if (cursor === null || typeof cursor !== 'object') {
      throw new Error('Fixture path does not resolve to an object')
    }
    cursor = Reflect.get(cursor, segment)
  }
  if (cursor === null || typeof cursor !== 'object') {
    throw new Error('Fixture path does not resolve to an object')
  }
  Reflect.set(cursor, path.at(-1)!, replacement)
}

describe('executeRothConversions', () => {
  it('publishes request-keyed prerequisite evidence without moving money', () => {
    const result = executeRothConversions(input())

    expect(result).toMatchObject({
      committed: false,
      requests: [expect.objectContaining({ actionId: 'conversion-a' })],
      scheduleIssues: [],
      balances: [
        { accountId: 'roth-a', openingBalance: 1_000, closingBalance: 1_000 },
        { accountId: 'traditional-a', openingBalance: 8_000, closingBalance: 8_000 },
        { accountId: 'traditional-b', openingBalance: 5_000, closingBalance: 5_000 },
      ],
      evidence: [{
        actionId: 'conversion-a',
        outcome: 'unsupported',
        readiness: 'nonActionable',
        requestedAmount: 10_000,
        executedAmount: 0,
        unexecutedAmount: 10_000,
        destinationCreditAmount: 0,
        taxableConvertedAmount: 0,
        nontaxableConvertedAmount: 0,
        taxFunding: { status: 'unsupported', evidenceId: null },
      }],
    })
    expect(result.evidence[0]?.reasons.map((reason) => reason.code)).toEqual(
      expect.arrayContaining([
        'conversion-basis-evidence-missing',
        'conversion-rmd-reserve-unavailable',
        'conversion-tax-funding-evidence-unsupported',
      ]),
    )
    expect(Object.isFrozen(result)).toBe(true)
    expect(Object.isFrozen(result.evidence[0])).toBe(true)
    const publication = publishAnnualRetirementActions({
      taxYear: year,
      requests: result.requests,
      sources: [rothConversionPublicationSource(result)],
    })
    expect(publication).toMatchObject({
      taxYear: year,
      executorSources: ['rothConversionExecutor'],
      records: [{
        actionId: 'conversion-a',
        executorSource: 'rothConversionExecutor',
        executedAmount: 0,
      }],
    })
  })

  it('is stable under request, account, and allocation permutations', () => {
    const first = request('conversion-a', 1)
    const second = request('conversion-b', 2, [{
      allocationId: 'allocation-c',
      sourceAccountId: 'traditional-a',
      requestedAmount: 1_000,
    }])
    const baseline = input([first, second])
    const permuted = structuredClone(baseline)
    permuted.openingBalances = [...permuted.openingBalances].reverse()
    permuted.requests = [...permuted.requests].reverse().map((value) => ({
      ...value,
      allocations: [...value.allocations].reverse(),
    }))
    permuted.runtimeEvidence = {
      personAliveEvidence: [
        ...(permuted.runtimeEvidence?.personAliveEvidence ?? []),
      ].reverse(),
    }

    expect(executeRothConversions(permuted)).toEqual(executeRothConversions(baseline))
  })

  it('keeps every peer in an owner-year group non-actionable and unchanged', () => {
    const result = executeRothConversions(input([
      request('conversion-a', 1),
      request('conversion-b', 2, [{
        allocationId: 'allocation-c',
        sourceAccountId: 'traditional-a',
        requestedAmount: 1_000,
      }]),
    ]))

    expect(result.evidence).toHaveLength(2)
    expect(result.evidence.every(
      (entry) => entry.readiness === 'nonActionable' && entry.executedAmount === 0,
    )).toBe(true)
    expect(result.balances.every(
      (balance) => balance.openingBalance === balance.closingBalance,
    )).toBe(true)
  })

  it('preserves potentially convertible employer-plan support evidence', () => {
    const value = input()
    const valuePlan = value.plan as Plan
    valuePlan.accounts.find((account) => account.id === 'roth-a')!.ownerPersonId = 'p2'
    const source = valuePlan.accounts.find((account) => account.id === 'traditional-a')
    if (source?.type !== 'traditional') throw new Error('fixture drift')
    source.kind = 'employer'
    const result = executeRothConversions(value)

    expect(result.evidence[0]).toMatchObject({
      outcome: 'unsupported',
      readiness: 'nonActionable',
      executedAmount: 0,
    })
    expect(result.evidence[0]?.reasons.map((reason) => reason.code)).toEqual(
      expect.arrayContaining([
        'conversion-destination-owner-mismatch',
        'conversion-plan-availability-unknown',
      ]),
    )
    const reasonCodes = result.evidence[0]?.reasons.map((reason) => reason.code)
    expect(reasonCodes).not.toContain('conversion-destination-incompatible')
    expect(reasonCodes).not.toContain('conversion-source-not-convertible')
  })

  it('preserves potentially compatible employer Roth destination evidence', () => {
    const value = input()
    const destination = (value.plan as Plan).accounts.find(
      (account) => account.id === 'roth-a',
    )
    if (destination?.type !== 'roth') throw new Error('fixture drift')
    destination.kind = 'employer'

    const evidence = executeRothConversions(value).evidence[0]!
    const reasonCodes = evidence.reasons.map((reason) => reason.code)

    expect(reasonCodes).toContain('conversion-employer-destination-unsupported')
    expect(reasonCodes).not.toContain('conversion-destination-incompatible')
  })

  it('publishes only the canonical inherited-source classification', () => {
    const value = input()
    const source = (value.plan as Plan).accounts.find((account) =>
      account.id === 'traditional-a')
    if (source?.type !== 'traditional') throw new Error('fixture drift')
    source.inherited = {
      ownerDeathYear: 2025,
      decedentHadStartedRmds: true,
    }

    const result = executeRothConversions(value)
    const reasonCodes = result.evidence[0]!.reasons.map((reason) => reason.code)

    expect(reasonCodes).toContain('conversion-inherited-source')
    expect(reasonCodes).not.toContain('conversion-source-not-convertible')
    expect(() => publishAnnualRetirementActions({
      taxYear: year,
      requests: result.requests,
      sources: [rothConversionPublicationSource(result)],
    })).not.toThrow()
  })

  it('rejects duplicate schedule identities before publishing evidence', () => {
    const first = request('conversion-a', 1)
    const duplicatePosition = request('conversion-b', 1)
    const forward = executeRothConversions(input([first, duplicatePosition]))
    const reverse = executeRothConversions(input([duplicatePosition, first]))

    expect(reverse).toEqual(forward)
    expect(forward).toMatchObject({
      committed: false,
      evidence: [],
      scheduleIssues: [{
        kind: 'executionSequenceConflict',
        collidingActionIds: ['conversion-a', 'conversion-b'],
      }],
    })
    const publicationSource = rothConversionPublicationSource(forward)
    expect(publicationSource).toMatchObject({
      executorSource: 'rothConversionExecutor',
      records: [
        { actionId: 'conversion-a', executedAmount: 0 },
        { actionId: 'conversion-b', executedAmount: 0 },
      ],
      scheduleDiagnostics: [
        { actionId: 'conversion-a' },
        { actionId: 'conversion-b' },
      ],
    })
  })

  it('publishes a noncolliding conversion sibling as batch-aborted', () => {
    const first = request('conversion-a', 1)
    const second = request('conversion-b', 1)
    const sibling = request('conversion-c', 2, [{
      allocationId: 'allocation-c',
      sourceAccountId: 'traditional-a',
      requestedAmount: 1_000,
    }])
    const result = executeRothConversions(input([first, second, sibling]))
    const publication = publishAnnualRetirementActions({
      taxYear: year,
      requests: result.requests,
      sources: [rothConversionPublicationSource(result)],
    })

    expect(publication?.records.find((entry) =>
      entry.actionId === sibling.actionId)).toMatchObject({
      readiness: 'nonActionable',
      outcome: 'refused',
      executedAmount: 0,
      reasons: [{ code: 'action-batch-schedule-conflict' }],
    })
    expect(publication?.scheduleDiagnostics).toHaveLength(2)
  })

  it('publishes each missing-date request instead of colliding null schedule slots', () => {
    const undated = (actionId: string) => rothConversionRequestSchema.parse({
      ...request(actionId, 1),
      executionDate: undefined,
    })

    const result = executeRothConversions(input([
      undated('conversion-a'),
      undated('conversion-b'),
    ]))

    expect(result.scheduleIssues).toEqual([])
    expect(result.evidence.map((entry) => entry.actionId)).toEqual([
      'conversion-a',
      'conversion-b',
    ])
    expect(result.evidence.every((entry) =>
      entry.reasons.some((reason) => reason.code === 'conversion-date-missing') &&
      entry.executedAmount === 0,
    )).toBe(true)
  })

  it('rejects a request from a different execution year before publishing evidence', () => {
    const result = executeRothConversions({
      ...input(),
      year: year + 1,
    })

    expect(result).toMatchObject({
      committed: false,
      evidence: [],
      scheduleIssues: [{
        kind: 'actionYearMismatch',
        actionId: 'conversion-a',
        expectedYear: year + 1,
        actualYear: year,
      }],
    })
  })

  it('distinguishes missing balance evidence from missing source or destination accounts', () => {
    const value = input()
    value.openingBalances = value.openingBalances.filter(
      (snapshot) =>
        snapshot.accountId !== 'traditional-a' && snapshot.accountId !== 'roth-a',
    )

    const evidence = executeRothConversions(value).evidence[0]!
    const sourceReasons = evidence.reasons.filter(
      (reason) => reason.accountId === 'traditional-a',
    )

    expect(sourceReasons.map((reason) => reason.code)).toContain('required-facts-missing')
    expect(sourceReasons.map((reason) => reason.code)).not.toContain('source-account-not-found')
    expect(evidence.allocations.find(
      (allocation) => allocation.sourceAccountId === 'traditional-a',
    )?.resolution).toBe('resolved')
    const destinationReasons = evidence.reasons.filter(
      (reason) => reason.accountId === 'roth-a',
    )
    expect(destinationReasons.map((reason) => reason.code)).toContain('required-facts-missing')
    expect(destinationReasons.map((reason) => reason.code)).not.toContain(
      'conversion-destination-not-found',
    )
    expect(() => publishAnnualRetirementActions({
      taxYear: year,
      requests: [evidence.request],
      sources: [rothConversionPublicationSource(executeRothConversions(value))],
    })).not.toThrow()
  })

  it('retains known balance diagnostics beside an independently unresolved source', () => {
    const value = input()
    const valuePlan = value.plan as Plan
    valuePlan.accounts = valuePlan.accounts.filter((account) =>
      account.id !== 'traditional-b')
    value.openingBalances = value.openingBalances
      .filter((snapshot) => snapshot.accountId !== 'traditional-b')
      .map((snapshot) => snapshot.accountId === 'traditional-a'
        ? { ...snapshot, openingBalance: asUsdCents(5_000) }
        : snapshot)

    const result = executeRothConversions(value)
    const reasons = result.evidence[0]!.reasons

    expect(reasons).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: 'source-account-not-found',
        allocationId: 'allocation-b',
      }),
      expect.objectContaining({
        code: 'conversion-balance-trimmed',
        allocationId: 'allocation-a',
      }),
    ]))
    expect(reasons.map((reason) => reason.code)).not.toContain(
      'conversion-balance-unavailable',
    )
    expect(() => publishAnnualRetirementActions({
      taxYear: year,
      requests: result.requests,
      sources: [rothConversionPublicationSource(result)],
    })).not.toThrow()
  })

  it.each([
    [['committed'], true],
    [['balances', 0, 'closingBalance'], 1_001],
    [['evidence', 0, 'destinationCreditAmount'], 1],
    [['evidence', 0, 'executedAmount'], 1],
    [['evidence', 0, 'taxableConvertedAmount'], 1],
    [['evidence', 0, 'nontaxableConvertedAmount'], 1],
    [['evidence', 0, 'allocations', 0, 'taxableConvertedAmount'], 1],
    [['evidence', 0, 'allocations', 0, 'nontaxableConvertedAmount'], 1],
    [['evidence', 0, 'allocations', 0, 'basisEvidenceId'], 'forged-basis'],
    [['evidence', 0, 'allocations', 0, 'rmdReserveEvidenceId'], 'forged-rmd'],
    [['evidence', 0, 'taxFunding', 'status'], 'funded'],
    [['evidence', 0, 'taxFunding', 'requiredFundingAmount'], 1],
    [['evidence', 0, 'taxFunding', 'fundedAmount'], 1],
    [['evidence', 0, 'taxFunding', 'evidenceId'], 'forged-funding'],
  ] as const)(
    'rejects forged nonmoving staging evidence at %j',
    (path, replacement) => {
      const forged: unknown = structuredClone(executeRothConversions(input()))
      setAtPath(forged, path, replacement)

      expect(() => rothConversionPublicationSource(
        forged as ReturnType<typeof executeRothConversions>,
      )).toThrow(/conversion/i)
    },
  )

  it('rejects duplicated allocation evidence that omits a requested allocation', () => {
    const canonical = executeRothConversions(input())
    const duplicate = structuredClone(canonical.evidence[0]!.allocations[0]!)
    const forged: unknown = structuredClone(canonical)
    setAtPath(forged, ['evidence', 0, 'allocations'], [duplicate, duplicate])

    expect(() => rothConversionPublicationSource(
      forged as ReturnType<typeof executeRothConversions>,
    )).toThrow(/allocation evidence is incomplete/i)
  })

  it('publishes a trim reason when a positive source balance is below its allocation', () => {
    const value = input()
    value.openingBalances = value.openingBalances.map((snapshot) =>
      snapshot.accountId === 'traditional-a'
        ? { ...snapshot, openingBalance: asUsdCents(5_000) }
        : snapshot,
    )

    const result = executeRothConversions(value)
    const allocationReasons = result.evidence[0]!.reasons.filter(
      (reason) => reason.allocationId === 'allocation-a',
    )

    expect(allocationReasons.map((reason) => reason.code)).toContain(
      'conversion-balance-trimmed',
    )
    expect(allocationReasons.map((reason) => reason.code)).not.toContain(
      'conversion-balance-unavailable',
    )
    expect(result.evidence[0]).toMatchObject({
      executedAmount: 0,
      unexecutedAmount: 10_000,
    })
    expect(result.balances.find(
      (balance) => balance.accountId === 'traditional-a',
    )).toMatchObject({ openingBalance: 5_000, closingBalance: 5_000 })
    expect(publishAnnualRetirementActions({
      taxYear: year,
      requests: result.requests,
      sources: [rothConversionPublicationSource(result)],
    })?.records[0]?.reasons.map((reason) => reason.code)).toContain(
      'conversion-balance-trimmed',
    )
  })

  it.each([
    [
      'conversion-balance-trimmed',
      10_000,
      8_000,
      8_000,
    ],
    [
      'conversion-balance-unavailable',
      10_000,
      10_000,
      1_000,
    ],
  ] as const)(
    'tracks chronological source availability for %s diagnostics without moving money',
    (expectedReason, openingBalance, firstAmount, secondAmount) => {
      const first = request('conversion-first', 1, [{
        allocationId: 'allocation-first',
        sourceAccountId: 'traditional-a',
        requestedAmount: firstAmount,
      }])
      const second = request('conversion-second', 2, [{
        allocationId: 'allocation-second',
        sourceAccountId: 'traditional-a',
        requestedAmount: secondAmount,
      }])
      const value = input([second, first])
      value.openingBalances = value.openingBalances.map((snapshot) =>
        snapshot.accountId === 'traditional-a'
          ? { ...snapshot, openingBalance: asUsdCents(openingBalance) }
          : snapshot,
      )

      const result = executeRothConversions(value)
      const [firstEvidence, secondEvidence] = result.evidence
      const firstReasonCodes = firstEvidence?.reasons.map((reason) => reason.code)
      const secondReasonCodes = secondEvidence?.reasons.map((reason) => reason.code)
      const mutuallyExclusiveReason = expectedReason === 'conversion-balance-trimmed'
        ? 'conversion-balance-unavailable'
        : 'conversion-balance-trimmed'

      expect(firstEvidence?.actionId).toBe('conversion-first')
      expect(firstReasonCodes).not.toContain('conversion-balance-trimmed')
      expect(firstReasonCodes).not.toContain('conversion-balance-unavailable')
      expect(secondEvidence?.actionId).toBe('conversion-second')
      expect(secondReasonCodes).toContain(expectedReason)
      expect(secondReasonCodes).not.toContain(mutuallyExclusiveReason)
      expect(result.balances.find(
        (balance) => balance.accountId === 'traditional-a',
      )).toMatchObject({
        openingBalance,
        closingBalance: openingBalance,
      })
      expect(() => publishAnnualRetirementActions({
        taxYear: year,
        requests: result.requests,
        sources: [rothConversionPublicationSource(result)],
      })).not.toThrow()
    },
  )

  it('does not consume diagnostic capacity for an earlier unresolved-source action', () => {
    const unresolved = request('conversion-unresolved', 1, [
      {
        allocationId: 'allocation-known',
        sourceAccountId: 'traditional-a',
        requestedAmount: 8_000,
      },
      {
        allocationId: 'allocation-missing',
        sourceAccountId: 'missing-source',
        requestedAmount: 1_000,
      },
    ])
    const later = request('conversion-later', 2, [{
      allocationId: 'allocation-later',
      sourceAccountId: 'traditional-a',
      requestedAmount: 8_000,
    }])
    const value = input([later, unresolved])
    value.openingBalances = value.openingBalances.map((snapshot) =>
      snapshot.accountId === 'traditional-a'
        ? { ...snapshot, openingBalance: asUsdCents(10_000) }
        : snapshot,
    )

    const result = executeRothConversions(value)
    const [unresolvedEvidence, laterEvidence] = result.evidence

    expect(unresolvedEvidence?.reasons.map((reason) => reason.code)).toContain(
      'source-account-not-found',
    )
    expect(laterEvidence?.actionId).toBe('conversion-later')
    const laterReasonCodes = laterEvidence?.reasons.map((reason) => reason.code)
    expect(laterReasonCodes).not.toContain('conversion-balance-trimmed')
    expect(laterReasonCodes).not.toContain('conversion-balance-unavailable')
  })

  it.each([
    'person-not-alive',
    'conversion-destination-incompatible',
    'required-facts-missing',
  ] as const)(
    'does not consume diagnostic capacity after a nonaccepted %s preflight',
    (refusalReason) => {
      const firstBase = request('conversion-refused', 1, [{
        allocationId: 'allocation-refused',
        sourceAccountId: 'traditional-a',
        requestedAmount: 8_000,
      }])
      const first = refusalReason === 'conversion-destination-incompatible'
        ? rothConversionRequestSchema.parse({
            ...firstBase,
            destinationRothAccountId: 'traditional-b',
          })
        : firstBase
      const later = request('conversion-later', 2, [{
        allocationId: 'allocation-later',
        sourceAccountId: 'traditional-a',
        requestedAmount: 8_000,
      }])
      const value = input([later, first])
      value.openingBalances = value.openingBalances.map((snapshot) =>
        snapshot.accountId === 'traditional-a'
          ? { ...snapshot, openingBalance: asUsdCents(10_000) }
          : snapshot,
      )
      if (refusalReason === 'person-not-alive') {
        value.runtimeEvidence = {
          personAliveEvidence: value.runtimeEvidence?.personAliveEvidence?.map(
            (evidence) => evidence.actionId === first.actionId
              ? { ...evidence, alive: false }
              : evidence,
          ),
        }
      } else if (refusalReason === 'required-facts-missing') {
        value.runtimeEvidence = {
          personAliveEvidence: value.runtimeEvidence?.personAliveEvidence?.filter(
            (evidence) => evidence.actionId !== first.actionId,
          ),
        }
      }

      const result = executeRothConversions(value)
      const [refusedEvidence, laterEvidence] = result.evidence

      expect(refusedEvidence?.reasons.map((reason) => reason.code)).toContain(
        refusalReason,
      )
      expect(laterEvidence?.actionId).toBe('conversion-later')
      const laterReasonCodes = laterEvidence?.reasons.map((reason) => reason.code)
      expect(laterReasonCodes).not.toContain('conversion-balance-trimmed')
      expect(laterReasonCodes).not.toContain('conversion-balance-unavailable')
      expect(result.balances.find(
        (balance) => balance.accountId === 'traditional-a',
      )).toMatchObject({ openingBalance: 10_000, closingBalance: 10_000 })
    },
  )

  it('rejects duplicate account and balance identities with unchanged snapshots', () => {
    const duplicatePlan = input()
    ;(duplicatePlan.plan as Plan).accounts.push({ ...(duplicatePlan.plan as Plan).accounts[0]! })
    const planResult = executeRothConversions(duplicatePlan)
    expect(planResult).toMatchObject({ committed: false, evidence: [] })
    expect(planResult.balances.every(
      (balance) => balance.openingBalance === balance.closingBalance,
    )).toBe(true)

    const duplicateBalance = input()
    const conflictingSnapshot = {
      ...duplicateBalance.openingBalances[0]!,
      openingBalance: asUsdCents(9_000),
    }
    duplicateBalance.openingBalances = [
      ...duplicateBalance.openingBalances,
      conflictingSnapshot,
    ]
    const forward = executeRothConversions(duplicateBalance)
    const reversed = executeRothConversions({
      ...duplicateBalance,
      openingBalances: [...duplicateBalance.openingBalances].reverse(),
    })
    expect(reversed).toEqual(forward)
    expect(forward).toMatchObject({
      committed: false,
      evidence: [],
      scheduleIssues: [{ kind: 'invalidInput' }],
    })
  })

  it('deep-freezes schedule-aborted and invalid early-return results', () => {
    const collision = executeRothConversions(input([
      request('conversion-a', 1),
      request('conversion-b', 1),
    ]))
    const invalidYear = executeRothConversions({ ...input(), year: 0 })
    const duplicatePlanInput = input()
    ;(duplicatePlanInput.plan as Plan).accounts.push({
      ...(duplicatePlanInput.plan as Plan).accounts[0]!,
    })
    const duplicatePlan = executeRothConversions(duplicatePlanInput)

    for (const result of [collision, invalidYear, duplicatePlan]) {
      expect(Object.isFrozen(result)).toBe(true)
      expect(Object.isFrozen(result.requests)).toBe(true)
      expect(Object.isFrozen(result.scheduleIssues)).toBe(true)
      expect(Object.isFrozen(result.scheduleIssues[0])).toBe(true)
      expect(Object.isFrozen(result.balances)).toBe(true)
    }
    expect(Object.isFrozen(collision.requests[0])).toBe(true)
    expect(Object.isFrozen(collision.requests[0]!.allocations)).toBe(true)
    expect(Object.isFrozen(collision.balances[0])).toBe(true)
  })

  it('does not overflow or alter a maximum-safe destination snapshot', () => {
    const value = input()
    value.openingBalances = value.openingBalances.map((balance) =>
      balance.accountId === 'roth-a'
        ? { ...balance, openingBalance: asUsdCents(Number.MAX_SAFE_INTEGER) }
        : balance,
    )
    const result = executeRothConversions(value)

    expect(result.balances.find((balance) => balance.accountId === 'roth-a')).toEqual({
      accountId: 'roth-a',
      openingBalance: Number.MAX_SAFE_INTEGER,
      closingBalance: Number.MAX_SAFE_INTEGER,
    })
  })

  // Treas. Reg. 1.408A-4 A-6(b) bars a conversion "to the extent that the
  // required minimum distribution for the traditional IRA for the year has not
  // been distributed", and Treas. Reg. 1.408-8(e)(1)(i) makes the amount that
  // has to come out the SUM of the owner's separately calculated IRA amounts,
  // distributable "from any one or more of the IRAs". So the question the
  // executor must answer is owner-wide and aggregated, and the only thing that
  // may answer it is bound evidence of the outcome.
  describe('owner IRA-RMD-satisfaction evidence', () => {
    function satisfaction(
      requests: readonly RothConversionRequest[],
      requiredAmount: number,
      distributedAmount: number,
    ): NonpersistedOwnerIraRmdSatisfactionEvidence[] {
      return requests.map((value) => ({
        evidenceId: `rmd-satisfaction-${value.actionId}`,
        actionId: value.actionId,
        personId: value.personId,
        actionYear: value.year,
        actionDate: value.executionDate ?? null,
        requiredAmount: asUsdCents(requiredAmount),
        distributedAmount: asUsdCents(distributedAmount),
      }))
    }

    function withSatisfaction(
      requiredAmount: number,
      distributedAmount: number,
      mutate: (
        evidence: readonly NonpersistedOwnerIraRmdSatisfactionEvidence[],
      ) => readonly NonpersistedOwnerIraRmdSatisfactionEvidence[] = (value) => value,
    ): ExecuteRothConversionsInput {
      const value = input()
      return {
        ...value,
        runtimeEvidence: {
          ...value.runtimeEvidence,
          ownerIraRmdSatisfactionEvidence: mutate(
            satisfaction(value.requests, requiredAmount, distributedAmount),
          ),
        },
      }
    }

    function reasonCodes(value: ExecuteRothConversionsInput): string[] {
      return executeRothConversions(value).evidence[0]!.reasons.map(
        (reason) => reason.code,
      )
    }

    it('drops the reserve reason once the owner aggregated IRA RMD sum was distributed', () => {
      expect(reasonCodes(withSatisfaction(40_000, 40_000)))
        .not.toContain('conversion-rmd-reserve-unavailable')
    })

    it('drops the reserve reason when no aggregated IRA RMD was due', () => {
      // A sum of zero has already been distributed; there is nothing A-6(b)
      // withholds. The owner still cannot convert, but not for this reason.
      expect(reasonCodes(withSatisfaction(0, 0)))
        .not.toContain('conversion-rmd-reserve-unavailable')
    })

    it('keeps every other owner-wide conversion prerequisite while the reserve clears', () => {
      const codes = reasonCodes(withSatisfaction(40_000, 40_000))

      expect(codes).toEqual(expect.arrayContaining([
        'conversion-basis-evidence-missing',
        'conversion-tax-funding-evidence-unsupported',
      ]))
      expect(executeRothConversions(withSatisfaction(40_000, 40_000)))
        .toMatchObject({
          committed: false,
          evidence: [{
            outcome: 'unsupported',
            readiness: 'nonActionable',
            executedAmount: 0,
            unexecutedAmount: 10_000,
          }],
        })
    })

    it('keeps the reserve reason when part of the sum is still undistributed', () => {
      // The sweep across the owner's other aggregated IRAs could not close the
      // shortfall, which after Treas. Reg. 1.408-8(e)(1)(i) settlement means
      // every one of those IRAs is empty.
      expect(reasonCodes(withSatisfaction(40_000, 39_999)))
        .toContain('conversion-rmd-reserve-unavailable')
    })

    it('keeps the reserve reason when the channel carries no evidence at all', () => {
      // Absence of evidence is not evidence of satisfaction.
      expect(reasonCodes(input()))
        .toContain('conversion-rmd-reserve-unavailable')
      expect(reasonCodes(withSatisfaction(40_000, 40_000, () => [])))
        .toContain('conversion-rmd-reserve-unavailable')
    })

    it.each([
      ['a blank evidence id', (entry: NonpersistedOwnerIraRmdSatisfactionEvidence) =>
        [{ ...entry, evidenceId: '   ' }]],
      ['another owner', (entry: NonpersistedOwnerIraRmdSatisfactionEvidence) =>
        [{ ...entry, personId: asPersonId('p2') }]],
      ['another action year', (entry: NonpersistedOwnerIraRmdSatisfactionEvidence) =>
        [{ ...entry, actionYear: entry.actionYear + 1 }]],
      ['another execution date', (entry: NonpersistedOwnerIraRmdSatisfactionEvidence) =>
        [{ ...entry, actionDate: '2030-12-16' }]],
      ['a dropped execution date', (entry: NonpersistedOwnerIraRmdSatisfactionEvidence) =>
        [{ ...entry, actionDate: null }]],
      ['an unbound action', (entry: NonpersistedOwnerIraRmdSatisfactionEvidence) =>
        [{ ...entry, actionId: request('conversion-other').actionId }]],
      ['two entries for one action', (entry: NonpersistedOwnerIraRmdSatisfactionEvidence) =>
        [entry, { ...entry, evidenceId: `${entry.evidenceId}-duplicate` }]],
      ['a fractional required amount', (entry: NonpersistedOwnerIraRmdSatisfactionEvidence) =>
        [{ ...entry, requiredAmount: 40_000.5 as typeof entry.requiredAmount }]],
      ['a negative distributed amount', (entry: NonpersistedOwnerIraRmdSatisfactionEvidence) =>
        [{ ...entry, distributedAmount: -1 as typeof entry.distributedAmount }]],
    ] as const)('keeps the reserve reason under %s', (_label, mutate) => {
      expect(reasonCodes(withSatisfaction(40_000, 40_000, (evidence) =>
        mutate(evidence[0]!)))).toContain('conversion-rmd-reserve-unavailable')
    })

    it('binds satisfaction per action rather than per owner-year batch', () => {
      const first = request('conversion-a', 1)
      const second = request('conversion-b', 2, [{
        allocationId: 'allocation-c',
        sourceAccountId: 'traditional-a',
        requestedAmount: 1_000,
      }])
      const value = input([first, second])
      const result = executeRothConversions({
        ...value,
        runtimeEvidence: {
          ...value.runtimeEvidence,
          ownerIraRmdSatisfactionEvidence: satisfaction([first], 40_000, 40_000),
        },
      })
      const codesByAction = Object.fromEntries(result.evidence.map((entry) => [
        entry.actionId,
        entry.reasons.map((reason) => reason.code),
      ]))

      expect(codesByAction['conversion-a'])
        .not.toContain('conversion-rmd-reserve-unavailable')
      expect(codesByAction['conversion-b'])
        .toContain('conversion-rmd-reserve-unavailable')
    })

    // The publication contract required all three staging codes to recognise a
    // staged non-moving conversion. Dropping one must not silently reroute the
    // record: it still has to publish, both through the plain disposition
    // schema and through the bypass a physical trim reason still needs.
    it('publishes a staged conversion whose reserve reason has cleared', () => {
      const result = executeRothConversions(withSatisfaction(40_000, 40_000))
      const record = result.evidence[0]!

      expect(actionExecutionDispositionSchema.safeParse({
        outcome: record.outcome,
        readiness: record.readiness,
        requestedAmount: record.requestedAmount,
        executedAmount: record.executedAmount,
        unexecutedAmount: record.unexecutedAmount,
        reasons: record.reasons,
      }).success).toBe(true)
      expect(publishAnnualRetirementActions({
        taxYear: year,
        requests: result.requests,
        sources: [rothConversionPublicationSource(result)],
      })?.records[0]?.reasons.map((reason) => reason.code))
        .not.toContain('conversion-rmd-reserve-unavailable')
    })

    it('publishes a cleared-reserve conversion that also carries a physical trim', () => {
      const value = withSatisfaction(40_000, 40_000)
      value.openingBalances = value.openingBalances.map((snapshot) =>
        snapshot.accountId === 'traditional-a'
          ? { ...snapshot, openingBalance: asUsdCents(5_000) }
          : snapshot,
      )
      const result = executeRothConversions(value)
      const codes = result.evidence[0]!.reasons.map((reason) => reason.code)

      expect(codes).toContain('conversion-balance-trimmed')
      expect(codes).not.toContain('conversion-rmd-reserve-unavailable')
      // A partial-outcome reason inside an unsupported disposition is exactly
      // what the staged-conversion bypass exists for, so this record proves the
      // bypass still recognises the record after the reserve reason cleared.
      expect(actionExecutionDispositionSchema.safeParse({
        outcome: result.evidence[0]!.outcome,
        readiness: result.evidence[0]!.readiness,
        requestedAmount: result.evidence[0]!.requestedAmount,
        executedAmount: result.evidence[0]!.executedAmount,
        unexecutedAmount: result.evidence[0]!.unexecutedAmount,
        reasons: result.evidence[0]!.reasons,
      }).success).toBe(false)
      expect(() => publishAnnualRetirementActions({
        taxYear: year,
        requests: result.requests,
        sources: [rothConversionPublicationSource(result)],
      })).not.toThrow()
    })

    it('still moves no money and commits nothing once the reserve clears', () => {
      const result = executeRothConversions(withSatisfaction(40_000, 40_000))

      expect(result.committed).toBe(false)
      expect(result.balances.every(
        (balance) => balance.openingBalance === balance.closingBalance,
      )).toBe(true)
      expect(result.evidence.every((entry) =>
        entry.executedAmount === 0 &&
        entry.destinationCreditAmount === 0 &&
        entry.readiness === 'nonActionable' &&
        entry.allocations.every((allocation) =>
          allocation.executedAmount === 0 &&
          allocation.rmdReserveEvidenceId === null),
      )).toBe(true)
    })
  })

  it('fails closed when hostile getters throw during input inspection', () => {
    const value = input()
    Object.defineProperty(value, 'year', {
      enumerable: true,
      get: () => { throw new Error('hostile getter') },
    })

    expect(executeRothConversions(value)).toMatchObject({
      committed: false,
      balances: [],
      evidence: [],
      scheduleIssues: [{ kind: 'invalidInput' }],
    })
  })
})
