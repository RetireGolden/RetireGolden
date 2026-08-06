import { describe, expect, it } from 'vitest'

import {
  asAccountId,
  asPersonId,
} from './identity.js'
import { asPositiveUsdCents } from './money.js'
import {
  allocateRetirementActionCandidateIdentity,
  type OrdinaryWithdrawalCandidateIdentityIntent,
  type RetirementActionCandidateIdentityIntent,
  type RothConversionCandidateIdentityIntent,
} from './retirementActionCandidateIdentityAllocator.js'
import { parsePlan, type Account, type Plan } from '../model/plan.js'
import {
  cashAccount,
  couplePlan,
  ownedNonRothIraAnnualFilingSourceRecord,
  singlePersonPlan,
  traditionalAccount,
} from '../testing/planFixtures.js'

function ownedCash(id: string, ownerPersonId = 'p1'): Account {
  return { ...cashAccount(id, 100_000), ownerPersonId }
}

function ownedRoth(id: string, ownerPersonId = 'p1', kind: 'ira' | 'employer' = 'ira'): Account {
  return {
    type: 'roth',
    id,
    name: id,
    ownerPersonId,
    annualReturnPct: 0,
    kind,
    balance: 100_000,
    annualContribution: 0,
  }
}

function ordinaryIntent(
  overrides: Partial<OrdinaryWithdrawalCandidateIdentityIntent> = {},
): OrdinaryWithdrawalCandidateIdentityIntent {
  return {
    kind: 'ordinaryWithdrawal',
    year: 2030,
    executionDate: '2030-06-15',
    executionSequence: 1,
    requestedAmount: asPositiveUsdCents(12_345),
    personId: asPersonId('p1'),
    provenance: { source: 'generator', sourceId: 'candidate-one' },
    sourceAllocations: [{
      sourceAccountId: asAccountId('cash-a'),
      requestedAmount: asPositiveUsdCents(12_345),
    }],
    purpose: { kind: 'spending' },
    ...overrides,
  }
}

function conversionIntent(
  overrides: Partial<RothConversionCandidateIdentityIntent> = {},
): RothConversionCandidateIdentityIntent {
  return {
    kind: 'rothConversion',
    year: 2030,
    executionDate: '2030-09-01',
    executionSequence: 2,
    requestedAmount: asPositiveUsdCents(50_000),
    personId: asPersonId('p1'),
    provenance: { source: 'optimizer', sourceId: 'conversion-one' },
    sourceAllocations: [{
      sourceAccountId: asAccountId('trad-a'),
      requestedAmount: asPositiveUsdCents(50_000),
    }],
    destinationRothAccountId: asAccountId('roth-a'),
    taxFunding: { kind: 'noneExpected' },
    ...overrides,
  }
}

function issueKinds(result: ReturnType<typeof allocateRetirementActionCandidateIdentity>): string[] {
  return result.status === 'blocked' ? result.issues.map((entry) => entry.kind) : []
}

function reasonCodes(result: ReturnType<typeof allocateRetirementActionCandidateIdentity>): string[] {
  return result.status === 'blocked'
    ? result.issues.flatMap((entry) => entry.reason === null ? [] : [entry.reason.code])
    : []
}

function allocateUnknown(plan: Readonly<Plan>, value: unknown) {
  return allocateRetirementActionCandidateIdentity(
    plan,
    value as RetirementActionCandidateIdentityIntent,
  )
}

describe('retirement-action candidate identity allocator', () => {
  it('materializes exact-cent ordinary identities independently of Plan and source order', () => {
    const original = couplePlan()
    original.accounts = [
      ownedCash('cash-b'),
      ownedCash('cash-a'),
      ownedCash('cash-p2', 'p2'),
    ]
    const intent = ordinaryIntent({
      requestedAmount: asPositiveUsdCents(12_345),
      sourceAllocations: [
        { sourceAccountId: asAccountId('cash-b'), requestedAmount: asPositiveUsdCents(2_345) },
        { sourceAccountId: asAccountId('cash-a'), requestedAmount: asPositiveUsdCents(10_000) },
      ],
    })
    const permuted: Plan = {
      ...original,
      household: {
        ...original.household,
        people: [...original.household.people].reverse(),
      },
      accounts: [...original.accounts].reverse(),
    }
    const reversedIntent = {
      ...intent,
      sourceAllocations: [...intent.sourceAllocations].reverse(),
    }

    const first = allocateRetirementActionCandidateIdentity(original, intent)
    const second = allocateRetirementActionCandidateIdentity(permuted, reversedIntent)

    expect(first).toEqual(second)
    expect(first.status).toBe('allocated')
    if (first.status !== 'allocated') return
    expect(first.request.kind).toBe('ordinaryWithdrawal')
    if (first.request.kind !== 'ordinaryWithdrawal') return
    expect(first.request.requestedAmount).toBe(12_345)
    expect(first.request.allocations.reduce(
      (sum, allocation) => sum + allocation.requestedAmount,
      0,
    )).toBe(12_345)
    expect(first.evidence).toMatchObject({
      policy: 'explicitStablePlanIdsOnly',
      personId: 'p1',
      sourceAccountIds: ['cash-a', 'cash-b'],
      destinationRothAccountId: null,
      sourceCanonicalOrder: 'utf16AccountId',
      generatedAllocationOrder: 'utf16AllocationId',
    })
    expect(new Set(first.request.allocations.map((allocation) => allocation.allocationId)).size)
      .toBe(2)
  })

  it('materializes same-owner owned-IRA conversion identities without claiming actionability', () => {
    const plan = singlePersonPlan()
    plan.accounts = [traditionalAccount('trad-a', 100_000), ownedRoth('roth-a')]

    const result = allocateRetirementActionCandidateIdentity(plan, conversionIntent())
    const permuted = allocateRetirementActionCandidateIdentity(
      { ...plan, accounts: [...plan.accounts].reverse() },
      conversionIntent(),
    )

    expect(permuted).toEqual(result)
    expect(result.status).toBe('allocated')
    if (result.status !== 'allocated') return
    expect(result.request).toMatchObject({
      kind: 'rothConversion',
      personId: 'p1',
      destinationRothAccountId: 'roth-a',
      requestedAmount: 50_000,
    })
    expect(result.evidence.destinationRothAccountId).toBe('roth-a')
    expect('readiness' in result).toBe(false)
  })

  it.each([
    ['zero request', { requestedAmount: 0 }],
    ['sub-cent request', { requestedAmount: 1.5 }],
    ['unsafe request', { requestedAmount: Number.MAX_SAFE_INTEGER + 1 }],
    ['zero source', { sourceAllocations: [{ sourceAccountId: 'cash-a', requestedAmount: 0 }] }],
    ['one-cent mismatch', { requestedAmount: 12_346 }],
  ])('blocks %s amounts with exact allocation-total semantics', (_label, override) => {
    const plan = singlePersonPlan()
    plan.accounts = [ownedCash('cash-a')]
    const malformed = { ...ordinaryIntent(), ...override }

    const result = allocateUnknown(plan, malformed)

    expect(result.status).toBe('blocked')
    expect(issueKinds(result)).toContain('amountMismatch')
    expect(reasonCodes(result)).toContain('allocation-total-mismatch')
    if (result.status === 'blocked') expect(result.request).toBeNull()
  })

  it('distinguishes missing, ambiguous, and duplicate Plan identity without selecting by array order', () => {
    const plan = couplePlan()
    plan.accounts = [ownedCash('cash-a'), ownedRoth('roth-a')]
    const duplicatedPeople = {
      ...plan,
      household: {
        ...plan.household,
        people: [plan.household.people[0]!, { ...plan.household.people[0]!, name: 'Duplicate' }],
      },
    } as Plan
    const duplicatedAccounts = {
      ...plan,
      accounts: [ownedCash('cash-a'), ownedCash('cash-a')],
    } as Plan

    const missingPerson = allocateUnknown(plan, {
      ...ordinaryIntent(),
      personId: 'missing-person',
    })
    const ambiguousPerson = allocateRetirementActionCandidateIdentity(
      duplicatedPeople,
      ordinaryIntent(),
    )
    const missingSource = allocateUnknown(plan, {
      ...ordinaryIntent(),
      sourceAllocations: [{ sourceAccountId: 'missing-source', requestedAmount: 12_345 }],
    })
    const ambiguousSource = allocateRetirementActionCandidateIdentity(
      duplicatedAccounts,
      ordinaryIntent(),
    )
    const duplicateSource = allocateUnknown(plan, {
      ...ordinaryIntent(),
      requestedAmount: 24_690,
      sourceAllocations: [
        { sourceAccountId: 'cash-a', requestedAmount: 12_345 },
        { sourceAccountId: 'cash-a', requestedAmount: 12_345 },
      ],
    })

    expect(issueKinds(missingPerson)).toContain('missingIdentity')
    expect(issueKinds(ambiguousPerson)).toContain('ambiguousIdentity')
    expect(issueKinds(missingSource)).toContain('missingIdentity')
    expect(issueKinds(ambiguousSource)).toContain('ambiguousIdentity')
    expect(issueKinds(duplicateSource)).toContain('duplicateIdentity')
    expect(reasonCodes(duplicateSource)).toContain('duplicate-source-account')
  })

  it('blocks joint, cross-owner, and unsupported ordinary sources', () => {
    const plan = couplePlan()
    const joint = ownedCash('joint')
    joint.ownerPersonId = null
    plan.accounts = [
      joint,
      ownedCash('p2-cash', 'p2'),
      {
        type: 'property',
        id: 'home',
        name: 'home',
        ownerPersonId: 'p1',
        annualReturnPct: 0,
        value: 100_000,
        plannedSaleYear: null,
        expectedNetProceeds: null,
      },
    ]

    const jointResult = allocateRetirementActionCandidateIdentity(plan, ordinaryIntent({
      sourceAllocations: [{ sourceAccountId: asAccountId('joint'), requestedAmount: asPositiveUsdCents(12_345) }],
    }))
    const crossOwner = allocateRetirementActionCandidateIdentity(plan, ordinaryIntent({
      sourceAllocations: [{ sourceAccountId: asAccountId('p2-cash'), requestedAmount: asPositiveUsdCents(12_345) }],
    }))
    const unsupported = allocateRetirementActionCandidateIdentity(plan, ordinaryIntent({
      sourceAllocations: [{ sourceAccountId: asAccountId('home'), requestedAmount: asPositiveUsdCents(12_345) }],
    }))

    expect(issueKinds(jointResult)).toContain('ambiguousIdentity')
    expect(reasonCodes(jointResult)).toContain('joint-source-acting-person-mismatch')
    expect(reasonCodes(crossOwner)).toContain('source-owner-mismatch')
    expect(reasonCodes(unsupported)).toContain('withdrawal-source-type-unsupported')
  })

  it('blocks ineligible conversion sources and destinations without fallback', () => {
    const plan = couplePlan()
    const inherited = traditionalAccount('inherited', 100_000)
    if (inherited.type !== 'traditional') throw new Error('fixture must be traditional')
    inherited.inherited = { ownerDeathYear: 2025, decedentHadStartedRmds: true }
    plan.accounts = [
      inherited,
      ownedCash('cash-a'),
      traditionalAccount('trad-p2', 100_000, 'p2'),
      ownedRoth('roth-p2', 'p2'),
      ownedRoth('roth-employer', 'p1', 'employer'),
    ]

    const inheritedResult = allocateRetirementActionCandidateIdentity(plan, conversionIntent({
      sourceAllocations: [{ sourceAccountId: asAccountId('inherited'), requestedAmount: asPositiveUsdCents(50_000) }],
      destinationRothAccountId: asAccountId('roth-employer'),
    }))
    const nonconvertible = allocateRetirementActionCandidateIdentity(plan, conversionIntent({
      sourceAllocations: [{ sourceAccountId: asAccountId('cash-a'), requestedAmount: asPositiveUsdCents(50_000) }],
      destinationRothAccountId: asAccountId('roth-employer'),
    }))
    const crossOwnerSource = allocateRetirementActionCandidateIdentity(plan, conversionIntent({
      sourceAllocations: [{ sourceAccountId: asAccountId('trad-p2'), requestedAmount: asPositiveUsdCents(50_000) }],
      destinationRothAccountId: asAccountId('roth-employer'),
    }))
    const crossOwnerDestination = allocateRetirementActionCandidateIdentity(plan, conversionIntent({
      sourceAllocations: [{ sourceAccountId: asAccountId('inherited'), requestedAmount: asPositiveUsdCents(50_000) }],
      destinationRothAccountId: asAccountId('roth-p2'),
    }))

    expect(reasonCodes(inheritedResult)).toContain('conversion-inherited-source')
    expect(reasonCodes(nonconvertible)).toContain('conversion-source-not-convertible')
    expect(reasonCodes(crossOwnerSource)).toContain('conversion-source-owner-mismatch')
    expect(reasonCodes(crossOwnerDestination)).toContain('conversion-destination-owner-mismatch')
    expect(reasonCodes(inheritedResult)).toContain('conversion-employer-destination-unsupported')
  })

  it('rejects missing or ambiguous conversion destinations', () => {
    const plan = singlePersonPlan()
    plan.accounts = [traditionalAccount('trad-a', 100_000), ownedRoth('roth-a')]
    const duplicated = {
      ...plan,
      accounts: [...plan.accounts, ownedRoth('roth-a')],
    } as Plan

    const missing = allocateUnknown(plan, {
      ...conversionIntent(),
      destinationRothAccountId: 'missing-roth',
    })
    const ambiguous = allocateRetirementActionCandidateIdentity(duplicated, conversionIntent())

    expect(issueKinds(missing)).toContain('missingIdentity')
    expect(issueKinds(ambiguous)).toContain('ambiguousIdentity')
    expect(reasonCodes(missing)).toContain('conversion-destination-not-found')
  })

  it('rejects linked conversion funding until identities can be allocated as one pair', () => {
    const plan = singlePersonPlan()
    plan.accounts = [traditionalAccount('trad-a', 100_000), ownedRoth('roth-a')]

    const result = allocateRetirementActionCandidateIdentity(plan, conversionIntent({
      taxFunding: {
        kind: 'linkedWithdrawal',
        withdrawalActionId: 'future-withdrawal' as never,
      },
    }))

    expect(result.status).toBe('blocked')
    expect(issueKinds(result)).toContain('invalidIntent')
    expect(reasonCodes(result)).toContain('required-facts-missing')
    if (result.status === 'blocked') {
      expect(result.issues.some((entry) => entry.field === 'taxFunding')).toBe(true)
    }
  })

  it('rejects aggregate and category-shaped inputs without fabricating identity', () => {
    const plan = singlePersonPlan()
    plan.accounts = [ownedCash('cash-a')]
    const aggregate = allocateUnknown(plan, {
      kind: 'legacyAggregateWithdrawal',
      year: 2030,
      requestedAmount: 12_345,
      legacyCategory: 'taxable',
    })
    const categoryOnly = allocateUnknown(plan, {
      kind: 'ordinaryWithdrawal',
      year: 2030,
      executionSequence: 1,
      requestedAmount: 12_345,
      personId: 'p1',
      sourceCategory: 'cash',
      purpose: { kind: 'spending' },
      provenance: { source: 'generator' },
    })

    expect(aggregate.status).toBe('blocked')
    expect(reasonCodes(aggregate)).toContain('required-facts-missing')
    expect(categoryOnly.status).toBe('blocked')
    expect(reasonCodes(categoryOnly)).toContain('source-account-not-found')
  })

  it('fails closed instead of throwing on hostile candidate inspection', () => {
    const plan = singlePersonPlan()
    plan.accounts = [ownedCash('cash-a')]
    const hostile = new Proxy({}, {
      get: () => { throw new Error('hostile getter') },
      ownKeys: () => { throw new Error('hostile keys') },
    })

    expect(() => allocateUnknown(plan, hostile)).not.toThrow()
    const result = allocateUnknown(plan, hostile)

    expect(result.status).toBe('blocked')
    expect(issueKinds(result)).toEqual(['invalidIntent'])
    expect(reasonCodes(result)).toEqual(['required-facts-missing'])
  })

  it('snapshots accessor-backed intent facts once before deriving identity', () => {
    const plan = singlePersonPlan()
    plan.accounts = [ownedCash('cash-a')]
    let yearReads = 0
    const accessorIntent = ordinaryIntent() as OrdinaryWithdrawalCandidateIdentityIntent
    Object.defineProperty(accessorIntent, 'year', {
      enumerable: true,
      configurable: true,
      get: () => {
        yearReads += 1
        return yearReads === 1 ? 2030 : 2031
      },
    })

    const result = allocateRetirementActionCandidateIdentity(plan, accessorIntent)
    const stable = allocateRetirementActionCandidateIdentity(plan, ordinaryIntent({ year: 2030 }))

    expect(yearReads).toBe(1)
    expect(result).toEqual(stable)
  })

  it('keeps caller indexes in diagnostics while canonicalizing valid source output', () => {
    const plan = singlePersonPlan()
    plan.accounts = [ownedCash('cash-a'), ownedCash('cash-b')]
    const result = allocateUnknown(plan, {
      ...ordinaryIntent(),
      requestedAmount: 20_000,
      sourceAllocations: [
        { sourceAccountId: 'cash-b', requestedAmount: 10_000, unexpected: true },
        { sourceAccountId: 'cash-a', requestedAmount: 10_000 },
      ],
    })

    expect(result.status).toBe('blocked')
    if (result.status === 'blocked') {
      expect(result.issues.some((entry) =>
        entry.field === 'sourceAllocations.0.unexpected'
      )).toBe(true)
      expect(result.issues.some((entry) =>
        entry.field === 'sourceAllocations.1.unexpected'
      )).toBe(false)
    }
  })

  it('does not silently overwrite caller-supplied action or allocation identities', () => {
    const plan = singlePersonPlan()
    plan.accounts = [ownedCash('cash-a')]
    const result = allocateUnknown(plan, {
      ...ordinaryIntent(),
      actionId: 'caller-action-id',
      sourceAllocations: [{
        allocationId: 'caller-allocation-id',
        sourceAccountId: 'cash-a',
        requestedAmount: 12_345,
      }],
    })

    expect(result.status).toBe('blocked')
    expect(issueKinds(result)).toContain('invalidIntent')
    if (result.status === 'blocked') {
      expect(result.issues.map((entry) => entry.field)).toEqual(expect.arrayContaining([
        'actionId',
        'sourceAllocations.0.allocationId',
      ]))
      expect(result.request).toBeNull()
    }
  })

  it('blocks deterministic ID reuse instead of suffixing or overwriting', () => {
    const plan = singlePersonPlan()
    plan.accounts = [ownedCash('cash-a')]
    const first = allocateRetirementActionCandidateIdentity(plan, ordinaryIntent())
    expect(first.status).toBe('allocated')
    if (first.status !== 'allocated') return
    plan.strategies.retirementActions = [first.request]

    const collision = allocateRetirementActionCandidateIdentity(plan, ordinaryIntent())

    expect(collision.status).toBe('blocked')
    expect(issueKinds(collision)).toContain('generatedIdentityCollision')
    if (collision.status === 'blocked') {
      expect(collision.issues.some((entry) => entry.field === 'actionId')).toBe(true)
      expect(collision.issues.every((entry) => entry.reason === null)).toBe(true)
      expect(collision.request).toBeNull()
    }
  })

  it('checks generated IDs against the complete Plan identity namespace', () => {
    const plan = singlePersonPlan()
    plan.accounts = [ownedCash('cash-a')]
    const first = allocateRetirementActionCandidateIdentity(plan, ordinaryIntent())
    expect(first.status).toBe('allocated')
    if (first.status !== 'allocated') return
    plan.accounts.push(ownedCash(first.request.actionId))

    const collision = allocateRetirementActionCandidateIdentity(plan, ordinaryIntent())

    expect(collision.status).toBe('blocked')
    expect(issueKinds(collision)).toContain('generatedIdentityCollision')
  })

  it('includes authoritative annual tax-source identifiers in collision checks', () => {
    const plan = singlePersonPlan()
    plan.accounts = [ownedCash('cash-a'), traditionalAccount('trad-a', 100_000)]
    const first = allocateRetirementActionCandidateIdentity(plan, ordinaryIntent())
    expect(first.status).toBe('allocated')
    if (first.status !== 'allocated') return
    plan.retirementActionAnnualTaxFacts = {
      ownedNonRothIraAnnualFilingSourceRecords: [{
        ...ownedNonRothIraAnnualFilingSourceRecord(plan, 'p1', ['trad-a']),
        sourceRecordId: first.request.actionId,
      }],
    }
    expect(parsePlan(plan).ok).toBe(true)

    const collision = allocateRetirementActionCandidateIdentity(plan, ordinaryIntent())

    expect(collision.status).toBe('blocked')
    expect(issueKinds(collision)).toContain('generatedIdentityCollision')
  })

  it('refuses to allocate against an annual filing-source root the arbiter rejects', () => {
    const plan = singlePersonPlan()
    plan.accounts = [ownedCash('cash-a'), traditionalAccount('trad-a', 100_000)]
    const first = ownedNonRothIraAnnualFilingSourceRecord(plan, 'p1', ['trad-a'], 2030, 'first')
    const second = ownedNonRothIraAnnualFilingSourceRecord(plan, 'p1', ['trad-a'], 2030, 'second')
    plan.retirementActionAnnualTaxFacts = {
      ownedNonRothIraAnnualFilingSourceRecords: [first, second],
    }
    // The duplicated owner/year key is exactly what the persisted Plan refuses,
    // so the allocator must not reach a different verdict from the same root.
    expect(parsePlan(plan).ok).toBe(false)

    const result = allocateRetirementActionCandidateIdentity(plan, ordinaryIntent())

    expect(result.status).toBe('blocked')
    expect(issueKinds(result)).toEqual(['ambiguousIdentity'])
    expect(reasonCodes(result)).toEqual([])
    if (result.status !== 'blocked') return
    expect(result.issues[0].field).toBe(
      'plan.retirementActionAnnualTaxFacts.ownedNonRothIraAnnualFilingSourceRecords',
    )
    expect(result.issues[0].detail).toContain('duplicateOwnerYearSource')
    expect(result.request).toBeNull()
  })

  it('refuses an annual filing-source root whose records share one stable identifier', () => {
    const plan = singlePersonPlan()
    plan.accounts = [ownedCash('cash-a'), traditionalAccount('trad-a', 100_000)]
    const first = ownedNonRothIraAnnualFilingSourceRecord(plan, 'p1', ['trad-a'], 2030, 'first')
    const second = ownedNonRothIraAnnualFilingSourceRecord(plan, 'p1', ['trad-a'], 2031, 'second')
    second.sourceEvidenceId = first.sourceEvidenceId
    plan.retirementActionAnnualTaxFacts = {
      ownedNonRothIraAnnualFilingSourceRecords: [first, second],
    }

    const result = allocateRetirementActionCandidateIdentity(plan, ordinaryIntent())

    expect(result.status).toBe('blocked')
    expect(issueKinds(result)).toEqual(['ambiguousIdentity'])
    if (result.status !== 'blocked') return
    expect(result.issues[0].detail).toContain('duplicateSourceIdentifier')
  })

  it('allocates unchanged against a clean annual filing-source root', () => {
    const plan = singlePersonPlan()
    plan.accounts = [ownedCash('cash-a'), traditionalAccount('trad-a', 100_000)]
    const clean = structuredClone(plan)
    plan.retirementActionAnnualTaxFacts = {
      ownedNonRothIraAnnualFilingSourceRecords: [
        ownedNonRothIraAnnualFilingSourceRecord(plan, 'p1', ['trad-a'], 2030, 'first'),
        ownedNonRothIraAnnualFilingSourceRecord(plan, 'p1', ['trad-a'], 2031, 'second'),
      ],
    }
    expect(parsePlan(plan).ok).toBe(true)

    const withSources = allocateRetirementActionCandidateIdentity(plan, ordinaryIntent())
    const withoutSources = allocateRetirementActionCandidateIdentity(clean, ordinaryIntent())

    expect(withSources.status).toBe('allocated')
    expect(withSources).toEqual(withoutSources)
  })

  it('canonicalizes nested purpose facts rather than depending on object property insertion order', () => {
    const plan = singlePersonPlan()
    plan.accounts = [ownedCash('cash-a')]
    const canonical = ordinaryIntent({
      purpose: { kind: 'goal', referenceId: 'goal-a' },
    })
    const reorderedPurpose = Object.fromEntries([
      ['referenceId', 'goal-a'],
      ['kind', 'goal'],
    ]) as OrdinaryWithdrawalCandidateIdentityIntent['purpose']

    const first = allocateRetirementActionCandidateIdentity(plan, canonical)
    const second = allocateRetirementActionCandidateIdentity(plan, {
      ...canonical,
      purpose: reorderedPurpose,
    })

    expect(second).toEqual(first)
  })

  it('does not mutate the Plan or candidate intent', () => {
    const plan = singlePersonPlan()
    plan.accounts = [ownedCash('cash-a')]
    const intent = ordinaryIntent()
    const planBefore = structuredClone(plan)
    const intentBefore = structuredClone(intent)

    expect(allocateRetirementActionCandidateIdentity(plan, intent).status).toBe('allocated')
    expect(plan).toEqual(planBefore)
    expect(intent).toEqual(intentBefore)
  })
})
