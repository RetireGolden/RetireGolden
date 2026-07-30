import { describe, expect, it } from 'vitest'

import {
  asAccountId,
  asActionId,
  asAllocationId,
  asPersonId,
  asUsdCents,
  ordinaryWithdrawalRequestSchema,
  qualifiedCharitableDistributionRequestSchema,
  retirementActionRequestSchema,
  rothConversionRequestSchema,
  type OrdinaryWithdrawalRequest,
  type QualifiedCharitableDistributionRequest,
  type RetirementActionRequest,
  type RothConversionRequest,
} from '../actions/index.js'
import type { Account, Person } from '../model/plan.js'
import {
  addCalendarMonths,
  acceptsContributions,
  evaluateRetirementActionEligibility,
  followsOwnerRmds,
  hsaNonQualifiedPenaltyRate,
  isAggregatedIra,
  isConvertibleToRoth,
  isEquityCompVested,
  isSpendableInYear,
  parseCivilIsoDate,
  reconcileRequestedAllocations,
  traditionalWithdrawalPenaltyRate,
  type EquityCompAccount,
  type NonpersistedRetirementActionEligibilityContext,
  type TraditionalAccount,
} from './accountEligibility.js'

function ownedIra(over: Partial<TraditionalAccount> = {}): TraditionalAccount {
  return {
    type: 'traditional',
    id: 'ira',
    name: 'IRA',
    ownerPersonId: 'p1',
    annualReturnPct: null,
    kind: 'ira',
    balance: 100_000,
    annualContribution: 0,
    ...over,
  }
}

function inheritedIra(): TraditionalAccount {
  return ownedIra({ inherited: { ownerDeathYear: 2024, decedentHadStartedRmds: false } })
}

function equityComp(over: Partial<EquityCompAccount> = {}): EquityCompAccount {
  return {
    type: 'equityComp',
    id: 'eq',
    name: 'RSU',
    ownerPersonId: 'p1',
    annualReturnPct: null,
    balance: 50_000,
    costBasis: 10_000,
    annualContribution: 0,
    vestingMode: 'cliff',
    vestDate: '2030-01-01',
    ...over,
  }
}

describe('contributions / convertibility / RMD eligibility', () => {
  it('inherited traditional accounts cannot contribute, convert, or follow owner RMDs', () => {
    const inherited = inheritedIra()
    expect(acceptsContributions(inherited)).toBe(false)
    expect(isConvertibleToRoth(inherited)).toBe(false)
    expect(followsOwnerRmds(inherited)).toBe(false)
    expect(isAggregatedIra(inherited)).toBe(false)
  })

  it('owned traditional IRAs contribute, convert, follow RMDs, and aggregate for 8606', () => {
    const owned = ownedIra()
    expect(acceptsContributions(owned)).toBe(true)
    expect(isConvertibleToRoth(owned)).toBe(true)
    expect(followsOwnerRmds(owned)).toBe(true)
    expect(isAggregatedIra(owned)).toBe(true)
  })

  it('employer traditional plans convert but do not aggregate for the IRA 8606 rule', () => {
    const employer = ownedIra({ kind: 'employer' })
    expect(isConvertibleToRoth(employer)).toBe(true)
    expect(isAggregatedIra(employer)).toBe(false)
  })

  it('a Roth account is neither convertible nor RMD-bearing', () => {
    const roth: Account = {
      type: 'roth',
      id: 'r',
      name: 'Roth',
      ownerPersonId: 'p1',
      annualReturnPct: null,
      kind: 'ira',
      balance: 1,
      annualContribution: 0,
    }
    expect(isConvertibleToRoth(roth)).toBe(false)
    expect(followsOwnerRmds(roth)).toBe(false)
    expect(acceptsContributions(roth)).toBe(true)
  })
})

describe('equity-comp vesting / spendability', () => {
  it('final-vesting equity comp is always spendable', () => {
    expect(isEquityCompVested(equityComp({ vestingMode: 'final' }), 2026)).toBe(true)
    expect(isSpendableInYear(equityComp({ vestingMode: 'final' }), 2026)).toBe(true)
  })

  it('cliff-vesting equity comp is unavailable before its vest year', () => {
    const rsu = equityComp({ vestDate: '2030-01-01' })
    expect(isEquityCompVested(rsu, 2029)).toBe(false)
    expect(isEquityCompVested(rsu, 2030)).toBe(true)
    expect(isSpendableInYear(rsu, 2029)).toBe(false)
  })

  it('non-equity accounts are always spendable', () => {
    expect(isSpendableInYear(ownedIra(), 2026)).toBe(true)
  })
})

describe('early-withdrawal penalties', () => {
  it('charges 10% on a traditional IRA before 60', () => {
    expect(traditionalWithdrawalPenaltyRate(ownedIra(), { ownerAgeAttained: 55, ownerRetirementAge: 55 })).toBe(0.1)
  })

  it('waives the penalty from age 60 on', () => {
    expect(traditionalWithdrawalPenaltyRate(ownedIra(), { ownerAgeAttained: 60, ownerRetirementAge: 50 })).toBe(0)
  })

  it('applies the Rule of 55 to an employer plan separated from at 55+', () => {
    const employer = ownedIra({ kind: 'employer' })
    expect(traditionalWithdrawalPenaltyRate(employer, { ownerAgeAttained: 57, ownerRetirementAge: 55 })).toBe(0)
    // But not before the separation (retirement) age.
    expect(traditionalWithdrawalPenaltyRate(employer, { ownerAgeAttained: 54, ownerRetirementAge: 55 })).toBe(0.1)
  })

  it('never penalizes an inherited account regardless of age', () => {
    expect(traditionalWithdrawalPenaltyRate(inheritedIra(), { ownerAgeAttained: 40, ownerRetirementAge: null })).toBe(0)
  })

  it('penalizes non-qualified HSA withdrawals 20% before 65 only', () => {
    expect(hsaNonQualifiedPenaltyRate(64)).toBe(0.2)
    expect(hsaNonQualifiedPenaltyRate(65)).toBe(0)
  })
})

function person(id: string, dob = '1955-08-31'): Person {
  return {
    id,
    name: id,
    dob,
    sex: 'average',
    retirementAge: 65,
    longevity: { planningAge: 95, source: 'manual' },
  }
}

function rothIra(id = 'roth', ownerPersonId = 'p1'): Account {
  return {
    type: 'roth',
    id,
    name: id,
    ownerPersonId,
    annualReturnPct: null,
    kind: 'ira',
    balance: 50_000,
    annualContribution: 0,
  }
}

function ordinaryRequest(): OrdinaryWithdrawalRequest {
  return ordinaryWithdrawalRequestSchema.parse({
    actionId: 'withdraw-1',
    kind: 'ordinaryWithdrawal',
    personId: 'p1',
    year: 2026,
    executionDate: '2026-03-01',
    executionSequence: 1,
    requestedAmount: 10_001,
    allocations: [
      { allocationId: 'a-1', sourceAccountId: 'ira', requestedAmount: 6_000 },
      { allocationId: 'a-2', sourceAccountId: 'cash', requestedAmount: 4_001 },
    ],
    purpose: { kind: 'spending' },
    provenance: { source: 'manual' },
  })
}

function conversionRequest(): RothConversionRequest {
  return rothConversionRequestSchema.parse({
    actionId: 'convert-1',
    kind: 'rothConversion',
    personId: 'p1',
    year: 2026,
    executionDate: '2026-03-01',
    executionSequence: 1,
    requestedAmount: 10_001,
    allocations: [
      { allocationId: 'a-1', sourceAccountId: 'ira', requestedAmount: 10_001 },
    ],
    destinationRothAccountId: 'roth',
    taxFunding: { kind: 'noneExpected' },
    provenance: { source: 'manual' },
  })
}

function qcdRequest(over: Partial<QualifiedCharitableDistributionRequest> = {}): QualifiedCharitableDistributionRequest {
  return qualifiedCharitableDistributionRequestSchema.parse({
    actionId: 'qcd-1',
    kind: 'qcd',
    donorPersonId: 'p1',
    year: 2026,
    executionDate: '2026-02-28',
    executionSequence: 1,
    requestedAmount: 10_001,
    allocation: {
      allocationId: 'a-1',
      sourceAccountId: 'ira',
      requestedAmount: 10_001,
    },
    charity: {
      designationId: 'charity-1',
      name: 'Public charity',
      designationKind: 'eligiblePublicCharity',
      directFromCustodianAttested: true,
      eligibleOrganizationAttested: true,
      notDonorAdvisedFundOrSupportingOrganizationAttested: true,
      notSplitInterestEntityAttested: true,
      entireDistributionOtherwiseDeductibleAttested: true,
    },
    provenance: { source: 'manual' },
    ...over,
  })
}

function traditionalContext(
  deductibleContributionAmount = 0,
  priorOffsetApplied = 0,
): NonpersistedRetirementActionEligibilityContext {
  return {
    iraFacts: [
      {
        sourceAccountId: asAccountId('ira'),
        subtype: 'traditional',
        qcdActivity: { kind: 'notApplicable' },
      },
    ],
    qcdContributionHistories: [
      {
        donorPersonId: asPersonId('p1'),
        taxYears: [
          {
            taxYear: 2026,
            deductibleContributionAmount: asUsdCents(deductibleContributionAmount),
          },
        ],
        priorOffsetApplied: asUsdCents(priorOffsetApplied),
      },
    ],
  }
}

function withAlive(
  request: OrdinaryWithdrawalRequest | RothConversionRequest | QualifiedCharitableDistributionRequest,
  context: NonpersistedRetirementActionEligibilityContext = {},
  alive = true,
  overrides: Partial<
    NonNullable<NonpersistedRetirementActionEligibilityContext['personAliveEvidence']>[number]
  > = {},
): NonpersistedRetirementActionEligibilityContext {
  const personId = request.kind === 'qcd' ? request.donorPersonId : request.personId
  return {
    ...context,
    personAliveEvidence: [{
      evidenceId: 'alive-evidence-1',
      actionId: request.actionId,
      personId,
      actionYear: request.year,
      actionDate: request.executionDate ?? null,
      alive,
      ...overrides,
    }],
  }
}

describe('civil-date action eligibility helpers', () => {
  it('rejects impossible dates and applies the proleptic-Gregorian month-end clamp', () => {
    expect(parseCivilIsoDate('2024-02-29')).toEqual({ year: 2024, month: 2, day: 29 })
    expect(parseCivilIsoDate('2023-02-29')).toBeNull()
    expect(parseCivilIsoDate('2026-04-31')).toBeNull()
    expect(parseCivilIsoDate('2026-13-01')).toBeNull()
    expect(addCalendarMonths('1955-08-31', 846)).toBe('2026-02-28')
    expect(addCalendarMonths('2024-08-31', 6)).toBe('2025-02-28')
    expect(addCalendarMonths('2024-02-29', 12)).toBe('2025-02-28')
  })

  it('reconciles duplicate identities and exact integer cents without floating arithmetic', () => {
    const accepted = reconcileRequestedAllocations(asUsdCents(9_007_199_254_740_990), [
      {
        allocationId: asAllocationId('a'),
        sourceAccountId: asAccountId('ira'),
        requestedAmount: ordinaryWithdrawalRequestSchema.shape.requestedAmount.parse(
          9_007_199_254_740_990,
        ),
      },
    ])
    expect(accepted.status).toBe('accepted')

    const refused = reconcileRequestedAllocations(10_001, [
      {
        allocationId: asAllocationId('same'),
        sourceAccountId: asAccountId('ira'),
        requestedAmount: ordinaryWithdrawalRequestSchema.shape.requestedAmount.parse(5_000),
      },
      {
        allocationId: asAllocationId('same'),
        sourceAccountId: asAccountId('ira'),
        requestedAmount: ordinaryWithdrawalRequestSchema.shape.requestedAmount.parse(5_000),
      },
    ])
    expect(refused.status).toBe('refused')
    expect(refused.reasons.map((reason) => reason.code)).toEqual([
      'duplicate-allocation-id',
      'duplicate-source-account',
      'allocation-total-mismatch',
    ])
  })

  it('orders canonical allocation reasons by locale-independent UTF-16 code units', () => {
    const amount = ordinaryWithdrawalRequestSchema.shape.requestedAmount.parse(1)
    const allocations = [
      { allocationId: asAllocationId('Ä'), sourceAccountId: asAccountId('a'), requestedAmount: amount },
      { allocationId: asAllocationId('A'), sourceAccountId: asAccountId('ä'), requestedAmount: amount },
      { allocationId: asAllocationId('A'), sourceAccountId: asAccountId('!'), requestedAmount: amount },
      { allocationId: asAllocationId('Ä'), sourceAccountId: asAccountId('A'), requestedAmount: amount },
      { allocationId: asAllocationId('A'), sourceAccountId: asAccountId('Z'), requestedAmount: amount },
    ]
    const expected = [
      ['A', 'Z'],
      ['A', 'ä'],
      ['Ä', 'a'],
    ]
    const canonicalPairs = (input: typeof allocations): string[][] => {
      const decision = reconcileRequestedAllocations(5, input)
      expect(decision.status).toBe('refused')
      return decision.reasons.map((reason) => [
        reason.allocationId ?? '',
        reason.accountId ?? '',
      ])
    }
    expect(canonicalPairs(allocations)).toEqual(expected)
    expect(canonicalPairs([...allocations].reverse())).toEqual(expected)
  })
})

describe('retirement-action physical eligibility preflight', () => {
  const ira = ownedIra()
  const cash: Account = {
    type: 'cash',
    id: 'cash',
    name: 'Cash',
    ownerPersonId: 'p1',
    annualReturnPct: null,
    balance: 10_000,
    annualContribution: 0,
  }

  it('accepts explicit ordinary sources and is invariant to account/allocation order', () => {
    const request = ordinaryRequest()
    const plan = { people: [person('p1')], accounts: [ira, cash] }
    const reorderedRequest = {
      ...request,
      allocations: [...request.allocations].reverse(),
    } as OrdinaryWithdrawalRequest
    const context = withAlive(request)
    expect(evaluateRetirementActionEligibility(request, plan, context)).toEqual({
      status: 'accepted',
      reasons: [],
    })
    expect(
      evaluateRetirementActionEligibility(reorderedRequest, {
        people: [...plan.people].reverse(),
        accounts: [...plan.accounts].reverse(),
      }, context),
    ).toEqual(evaluateRetirementActionEligibility(request, plan, context))
  })

  it('refuses missing and cross-owner ordinary sources without array fallback', () => {
    const request = ordinaryRequest()
    const missing = {
      ...request,
      allocations: [
        {
          ...request.allocations[0],
          sourceAccountId: asAccountId('missing'),
          requestedAmount: request.requestedAmount,
        },
      ],
    } as OrdinaryWithdrawalRequest
    expect(
      evaluateRetirementActionEligibility(missing, {
        people: [person('p1'), person('p2')],
        accounts: [ownedIra({ ownerPersonId: 'p2' })],
      }, withAlive(missing)).reasons.map((reason) => reason.code),
    ).toEqual(['source-account-not-found'])

    const crossOwner = {
      ...request,
      requestedAmount: request.allocations[0].requestedAmount,
      allocations: [request.allocations[0]],
    } as OrdinaryWithdrawalRequest
    expect(
      evaluateRetirementActionEligibility(crossOwner, {
        people: [person('p1'), person('p2')],
        accounts: [ownedIra({ ownerPersonId: 'p2' })],
      }, withAlive(crossOwner)).reasons.map((reason) => reason.code),
    ).toEqual(['source-owner-mismatch'])
  })

  it('fails closed for joint sources until exact joint-owner evidence exists', () => {
    const base = ordinaryRequest()
    const request = {
      ...base,
      requestedAmount: base.allocations[1].requestedAmount,
      allocations: [base.allocations[1]],
    } as OrdinaryWithdrawalRequest
    expect(
      evaluateRetirementActionEligibility(
        request,
        {
          people: [person('p1')],
          accounts: [{ ...cash, ownerPersonId: null }],
        },
        withAlive(request),
      ),
    ).toMatchObject({
      status: 'refused',
      reasons: [{ code: 'joint-source-acting-person-mismatch' }],
    })
  })

  it('requires action-bound person-alive evidence without inferring death from planning age', () => {
    const request = ordinaryRequest()
    const plan = { people: [person('p1')], accounts: [ira, cash] }
    expect(evaluateRetirementActionEligibility(request, plan)).toMatchObject({
      status: 'unsupported',
      reasons: [{ code: 'required-facts-missing' }],
    })
    expect(
      evaluateRetirementActionEligibility(request, plan, withAlive(request, {}, false)),
    ).toMatchObject({
      status: 'refused',
      reasons: [{ code: 'person-not-alive' }],
    })
    for (const overrides of [
      { actionId: asActionId('other-action') },
      { personId: asPersonId('p2') },
      { actionYear: 2027 },
      { actionDate: '2026-03-02' },
      { evidenceId: '   ' },
    ]) {
      expect(
        evaluateRetirementActionEligibility(
          request,
          plan,
          withAlive(request, {}, true, overrides),
        ),
      ).toMatchObject({
        status: 'unsupported',
        reasons: [{ code: 'required-facts-missing' }],
      })
    }
    expect(
      evaluateRetirementActionEligibility(
        conversionRequest(),
        { people: [person('p1')], accounts: [ira, rothIra()] },
        traditionalContext(),
      ).reasons.map((reason) => reason.code),
    ).toContain('required-facts-missing')
    expect(
      evaluateRetirementActionEligibility(
        qcdRequest(),
        { people: [person('p1')], accounts: [ira] },
        traditionalContext(),
      ).reasons.map((reason) => reason.code),
    ).toContain('required-facts-missing')
    const conversion = conversionRequest()
    expect(
      evaluateRetirementActionEligibility(
        conversion,
        { people: [person('p1')], accounts: [ira, rothIra()] },
        withAlive(conversion, traditionalContext(), false),
      ),
    ).toMatchObject({
      status: 'refused',
      reasons: [{ code: 'person-not-alive' }],
    })
    const qcd = qcdRequest()
    expect(
      evaluateRetirementActionEligibility(
        qcd,
        { people: [person('p1')], accounts: [ira] },
        withAlive(qcd, traditionalContext(), false),
      ),
    ).toMatchObject({
      status: 'refused',
      reasons: [{ code: 'person-not-alive' }],
    })
  })

  it('uses the exact equity-comp execution and vest dates', () => {
    const base = ordinaryRequest()
    const account = equityComp({
      id: 'eq',
      ownerPersonId: 'p1',
      vestDate: '2026-06-15',
    })
    const makeRequest = (executionDate: string | undefined): OrdinaryWithdrawalRequest => ({
      ...base,
      executionDate,
      requestedAmount: base.allocations[0].requestedAmount,
      allocations: [{
        ...base.allocations[0],
        sourceAccountId: asAccountId('eq'),
      }],
    })
    const before = makeRequest('2026-06-14')
    expect(
      evaluateRetirementActionEligibility(
        before,
        { people: [person('p1')], accounts: [account] },
        withAlive(before),
      ).reasons[0]?.code,
    ).toBe('withdrawal-source-not-spendable')

    const exact = makeRequest('2026-06-15')
    expect(
      evaluateRetirementActionEligibility(
        exact,
        { people: [person('p1')], accounts: [account] },
        withAlive(exact),
      ),
    ).toEqual({ status: 'accepted', reasons: [] })

    for (const executionDate of [undefined, '2026-02-30', '2027-01-01']) {
      const request = makeRequest(executionDate)
      expect(
        evaluateRetirementActionEligibility(
          request,
          { people: [person('p1')], accounts: [account] },
          withAlive(request),
        ).reasons[0]?.code,
      ).toBe('required-facts-missing')
    }
    expect(
      evaluateRetirementActionEligibility(
        exact,
        {
          people: [person('p1')],
          accounts: [equityComp({
            id: 'eq',
            ownerPersonId: 'p1',
            vestDate: '2026-02-30',
          })],
        },
        withAlive(exact),
      ).reasons[0]?.code,
    ).toBe('required-facts-missing')
  })

  it('accepts only a same-owner ordinary Roth IRA conversion destination', () => {
    const request = conversionRequest()
    const plan = { people: [person('p1'), person('p2')], accounts: [ira, rothIra()] }
    const context = withAlive(request, traditionalContext())
    expect(evaluateRetirementActionEligibility(request, plan, context)).toEqual({
      status: 'accepted',
      reasons: [],
    })
    expect(
      evaluateRetirementActionEligibility(request, {
        people: [...plan.people].reverse(),
        accounts: [...plan.accounts].reverse(),
      }, context),
    ).toEqual(evaluateRetirementActionEligibility(request, plan, context))

    const missingDestination = {
      ...request,
      destinationRothAccountId: asAccountId('missing'),
    } as RothConversionRequest
    expect(
      evaluateRetirementActionEligibility(missingDestination, plan, context).reasons[0]?.code,
    ).toBe('conversion-destination-not-found')

    const otherOwnerPlan = {
      ...plan,
      accounts: [ira, rothIra('roth', 'p2')],
    }
    expect(
      evaluateRetirementActionEligibility(request, otherOwnerPlan, context).reasons[0]?.code,
    ).toBe('conversion-destination-owner-mismatch')

    expect(
      evaluateRetirementActionEligibility(request, {
        ...plan,
        accounts: [ira, ownedIra({ id: 'roth' })],
      }, context).reasons[0]?.code,
    ).toBe('conversion-destination-incompatible')
  })

  it('fails closed for inherited, unclassified, SIMPLE, and employer conversion sources', () => {
    const request = conversionRequest()
    const basePlan = { people: [person('p1')], accounts: [ira, rothIra()] }
    expect(
      evaluateRetirementActionEligibility(request, basePlan, withAlive(request)).reasons[0]?.code,
    ).toBe('conversion-ira-subtype-unknown')

    expect(
      evaluateRetirementActionEligibility(request, {
        ...basePlan,
        accounts: [
          ownedIra({
            inherited: { ownerDeathYear: 2020, decedentHadStartedRmds: false },
          }),
          rothIra(),
        ],
      }, withAlive(request)).reasons[0]?.code,
    ).toBe('conversion-inherited-source')

    const simpleContext: NonpersistedRetirementActionEligibilityContext = {
      ...withAlive(request),
      iraFacts: [{
        sourceAccountId: asAccountId('ira'),
        subtype: 'simple',
        simpleParticipationStartDate: '2025-08-31',
        qcdActivity: {
          kind: 'employerContribution',
          actionTaxYear: 2026,
          planYearEndDate: '2026-12-31',
          employerContributionMadeForPlanYear: false,
          evidenceId: 'activity-1',
        },
      }],
    }
    expect(
      evaluateRetirementActionEligibility(request, basePlan, simpleContext).reasons[0]?.code,
    ).toBe('conversion-simple-two-year-period-open')

    expect(
      evaluateRetirementActionEligibility(request, {
        ...basePlan,
        accounts: [ownedIra({ kind: 'employer' }), rothIra()],
      }, withAlive(request, traditionalContext())).status,
    ).toBe('unsupported')
  })

  it('uses exact conversion dates and gives unsupported failures precedence', () => {
    const request = conversionRequest()
    const plan = { people: [person('p1')], accounts: [ira, rothIra()] }
    const invalid = { ...request, executionDate: '2026-02-30' } as RothConversionRequest
    expect(
      evaluateRetirementActionEligibility(
        invalid,
        plan,
        withAlive(invalid),
      ),
    ).toMatchObject({
      status: 'unsupported',
      reasons: [
        { code: 'conversion-ira-subtype-unknown' },
        { code: 'conversion-date-invalid' },
      ],
    })
    const outside = { ...request, executionDate: '2027-01-01' } as RothConversionRequest
    expect(
      evaluateRetirementActionEligibility(
        outside,
        plan,
        withAlive(outside, traditionalContext()),
      ).reasons[0]?.code,
    ).toBe('conversion-date-outside-action-year')
  })

  it('does not compare malformed SIMPLE conversion dates to the two-year boundary', () => {
    const base = conversionRequest()
    const plan = { people: [person('p1')], accounts: [ira, rothIra()] }
    for (const executionDate of ['2026-02-30', '2026-2-01']) {
      const request = { ...base, executionDate } as RothConversionRequest
      const context: NonpersistedRetirementActionEligibilityContext = {
        ...withAlive(request),
        iraFacts: [{
          sourceAccountId: asAccountId('ira'),
          subtype: 'simple',
          simpleParticipationStartDate: '2025-08-31',
          qcdActivity: {
            kind: 'employerContribution',
            actionTaxYear: 2026,
            planYearEndDate: '2026-12-31',
            employerContributionMadeForPlanYear: false,
            evidenceId: 'activity-1',
          },
        }],
      }
      expect(
        evaluateRetirementActionEligibility(request, plan, context)
          .reasons.map((reason) => reason.code),
      ).toEqual(['conversion-date-invalid'])
    }
  })

  it('keeps principal withholding unsupported while other funding sufficiency stays deferred', () => {
    const base = conversionRequest()
    const request = {
      ...base,
      taxFunding: {
        kind: 'conversionPrincipalWithholding',
        amount: base.requestedAmount,
      },
    } as RothConversionRequest
    expect(
      evaluateRetirementActionEligibility(
        request,
        { people: [person('p1')], accounts: [ira, rothIra()] },
        withAlive(request, traditionalContext()),
      ),
    ).toMatchObject({
      status: 'unsupported',
      reasons: [{ code: 'conversion-principal-withholding-unsupported' }],
    })
  })

  it('enforces QCD date, donor, source, subtype/activity, and history facts', () => {
    const plan = { people: [person('p1')], accounts: [ira] }
    const request = qcdRequest()
    expect(evaluateRetirementActionEligibility(
      request,
      plan,
      withAlive(request, traditionalContext()),
    )).toEqual({
      status: 'accepted',
      reasons: [],
    })
    const beforeThreshold = qcdRequest({ executionDate: '2026-02-27' })
    expect(
      evaluateRetirementActionEligibility(
        beforeThreshold,
        plan,
        withAlive(beforeThreshold, traditionalContext()),
      ).reasons[0]?.code,
    ).toBe('qcd-before-age-70-half')
    const futureThreshold = qcdRequest({ executionDate: '2026-12-31' })
    expect(
      evaluateRetirementActionEligibility(
        futureThreshold,
        { people: [person('p1', '1956-08-31')], accounts: [ira] },
        withAlive(futureThreshold, { iraFacts: traditionalContext().iraFacts }),
      ),
    ).toMatchObject({
      status: 'refused',
      reasons: [{ code: 'qcd-before-age-70-half' }],
    })
    const invalid = qcdRequest({ executionDate: '2026-02-30' })
    expect(
      evaluateRetirementActionEligibility(
        invalid,
        plan,
        withAlive(invalid, traditionalContext()),
      ).reasons[0]?.code,
    ).toBe('qcd-date-invalid')
    const missingDate = qcdRequest({ executionDate: undefined })
    expect(
      evaluateRetirementActionEligibility(
        missingDate,
        plan,
        withAlive(missingDate, traditionalContext()),
      ).reasons[0]?.code,
    ).toBe('qcd-date-missing')
    const outsideYear = qcdRequest({ executionDate: '2027-02-28' })
    expect(
      evaluateRetirementActionEligibility(
        outsideYear,
        plan,
        withAlive(outsideYear, traditionalContext()),
      ).reasons[0]?.code,
    ).toBe('qcd-date-outside-action-year')
    expect(
      evaluateRetirementActionEligibility(request, plan, withAlive(request)).reasons.map(
        (reason) => reason.code,
      ),
    ).toEqual([
      'qcd-sep-simple-activity-unknown',
      'qcd-contribution-history-unknown',
    ])
  })

  it('is invariant to person/account order and refuses a cross-owner QCD source', () => {
    const request = qcdRequest()
    const context = withAlive(request, traditionalContext())
    const plan = {
      people: [person('p1'), person('p2')],
      accounts: [ira, rothIra('other-roth', 'p2')],
    }
    expect(
      evaluateRetirementActionEligibility(request, {
        people: [...plan.people].reverse(),
        accounts: [...plan.accounts].reverse(),
      }, context),
    ).toEqual(evaluateRetirementActionEligibility(request, plan, context))

    expect(
      evaluateRetirementActionEligibility(request, {
        people: plan.people,
        accounts: [ownedIra({ ownerPersonId: 'p2' })],
      }, context).reasons.map((reason) => reason.code),
    ).toContain('qcd-source-owner-mismatch')
  })

  it('requires stable action-year and plan-year-bound SEP/SIMPLE activity evidence', () => {
    const request = qcdRequest()
    const plan = { people: [person('p1')], accounts: [ira] }
    const activity = {
      kind: 'employerContribution' as const,
      actionTaxYear: 2026,
      planYearEndDate: '2026-12-31',
      employerContributionMadeForPlanYear: false,
      evidenceId: 'activity-1',
    }
    const contextFor = (
      qcdActivity: typeof activity,
    ): NonpersistedRetirementActionEligibilityContext => withAlive(request, {
      ...traditionalContext(),
      iraFacts: [{
        sourceAccountId: asAccountId('ira'),
        subtype: 'sep',
        qcdActivity,
      }],
    })
    expect(
      evaluateRetirementActionEligibility(request, plan, contextFor(activity)),
    ).toEqual({ status: 'accepted', reasons: [] })

    for (const qcdActivity of [
      { ...activity, actionTaxYear: 2027 },
      { ...activity, planYearEndDate: '2027-01-01' },
      { ...activity, planYearEndDate: '2026-02-30' },
      { ...activity, evidenceId: '  ' },
    ]) {
      expect(
        evaluateRetirementActionEligibility(request, plan, contextFor(qcdActivity))
          .reasons[0]?.code,
      ).toBe('qcd-sep-simple-activity-unknown')
    }
  })

  it('refuses ongoing SEP/SIMPLE, leaves inherited and Roth sources unsupported, and defers offset diagnostics', () => {
    const plan = { people: [person('p1')], accounts: [ira] }
    const request = qcdRequest()
    const sepContext: NonpersistedRetirementActionEligibilityContext = {
      ...withAlive(request, traditionalContext()),
      iraFacts: [{
        sourceAccountId: asAccountId('ira'),
        subtype: 'sep',
        qcdActivity: {
          kind: 'employerContribution',
          actionTaxYear: 2026,
          planYearEndDate: '2026-12-31',
          employerContributionMadeForPlanYear: true,
          evidenceId: 'activity-1',
        },
      }],
    }
    expect(
      evaluateRetirementActionEligibility(request, plan, sepContext).reasons[0]?.code,
    ).toBe('qcd-ongoing-sep-simple')

    const offset = evaluateRetirementActionEligibility(
      request,
      plan,
      withAlive(request, traditionalContext(500, 100)),
    )
    expect(offset).toEqual({
      status: 'accepted',
      reasons: [],
    })

    expect(
      evaluateRetirementActionEligibility(qcdRequest(), {
        ...plan,
        accounts: [rothIra('ira')],
      }, withAlive(request, traditionalContext())).reasons[0]?.code,
    ).toBe('qcd-roth-source-unsupported')
    expect(
      evaluateRetirementActionEligibility(qcdRequest(), {
        ...plan,
        accounts: [ownedIra({
          inherited: { ownerDeathYear: 2020, decedentHadStartedRmds: false },
        })],
      }, withAlive(request, traditionalContext())).reasons[0]?.code,
    ).toBe('qcd-inherited-basis-unsupported')
  })

  it('requires donor-specific complete history across every threshold/action year', () => {
    const plan = {
      people: [person('p1', '1954-08-31'), person('p2', '1954-08-31')],
      accounts: [ira],
    }
    const request = qcdRequest({ executionDate: '2026-03-01' })
    const incompleteFacts: NonpersistedRetirementActionEligibilityContext = {
      ...traditionalContext(),
      qcdContributionHistories: [{
        donorPersonId: asPersonId('p2'),
        taxYears: [{ taxYear: 2026, deductibleContributionAmount: asUsdCents(0) }],
        priorOffsetApplied: asUsdCents(0),
      }],
    }
    const incomplete = withAlive(request, incompleteFacts)
    expect(
      evaluateRetirementActionEligibility(
        request,
        plan,
        incomplete,
      ).reasons.map((reason) => reason.code),
    ).toContain('qcd-contribution-history-unknown')
  })

  it('keeps all three legacy aggregate arms unsupported and non-actionable', () => {
    const plan = { people: [person('p1')], accounts: [ira] }
    const fixtures = [
      {
        actionId: 'legacy-w',
        kind: 'legacyAggregateWithdrawal',
        legacyCategory: 'traditional',
        year: 2026,
        requestedAmount: 100,
        provenance: { source: 'migration' },
      },
      {
        actionId: 'legacy-c',
        kind: 'legacyAggregateRothConversion',
        year: 2026,
        requestedAmount: 100,
        provenance: { source: 'migration' },
      },
      {
        actionId: 'legacy-q',
        kind: 'legacyAggregateQcd',
        legacyField: 'qcdAnnual',
        year: 2026,
        requestedAmount: 100,
        provenance: { source: 'migration' },
      },
    ].map((fixture) => retirementActionRequestSchema.parse(fixture))
    expect(
      fixtures.map((fixture: RetirementActionRequest) =>
        evaluateRetirementActionEligibility(fixture, plan),
      ),
    ).toEqual([
      {
        status: 'unsupported',
        reasons: [expect.objectContaining({ code: 'withdrawal-aggregate-unallocated' })],
      },
      {
        status: 'unsupported',
        reasons: [expect.objectContaining({ code: 'conversion-aggregate-unallocated' })],
      },
      {
        status: 'unsupported',
        reasons: [expect.objectContaining({ code: 'qcd-aggregate-unallocated' })],
      },
    ])
  })
})
