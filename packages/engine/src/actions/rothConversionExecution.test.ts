import { describe, expect, it } from 'vitest'

import type { Plan } from '../model/plan.js'
import { singlePersonPlan, traditionalAccount } from '../testing/planFixtures.js'
import { rothConversionRequestSchema, type RothConversionRequest } from './contract.js'
import { asUsdCents } from './money.js'
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

  it('does not mix unresolved sources with resolved physical-balance evidence', () => {
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
    const reasonCodes = result.evidence[0]!.reasons.map((reason) => reason.code)

    expect(reasonCodes).toContain('source-account-not-found')
    expect(reasonCodes).not.toContain('conversion-balance-trimmed')
    expect(reasonCodes).not.toContain('conversion-balance-unavailable')
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

  it('fails closed without invoking hostile getters', () => {
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
