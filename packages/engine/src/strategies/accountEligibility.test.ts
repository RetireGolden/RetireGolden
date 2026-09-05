import { describe, expect, it } from 'vitest'

import {
  allocateRetirementActionCandidateIdentity,
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
  type QcdCandidateIdentityIntent,
  type QualifiedCharitableDistributionRequest,
  type RetirementActionRequest,
  type RothConversionRequest,
} from '../actions/index.js'
import { createEmptyPlan, type Account, type Person, type Plan } from '../model/plan.js'
import { packForYear } from '../params/index.js'
import { describeRefusal } from '../rules/describeRefusal.js'
import { describeRule } from '../rules/describeRule.js'
import {
  addCalendarMonths,
  acceptsContributions,
  buildRetirementActionEligibilityContextFromPlan,
  evaluateRetirementActionEligibility,
  evaluateRetirementActionEligibilityFromPlan,
  followsOwnerRmds,
  hsaNonQualifiedPenaltyRate,
  isAggregatedIra,
  isConvertibleToRoth,
  employerPlanIsDistributableForRothIraRollover,
  isEquityCompVested,
  isSpendableInYear,
  isTreatAsOwnEffective,
  parseCivilIsoDate,
  reconcileRequestedAllocations,
  traditionalWithdrawalPenaltyRate,
  type EquityCompAccount,
  type NonpersistedRetirementActionEligibilityContext,
  type RetirementActionEligibilityRuntimeEvidence,
  type TraditionalAccount,
} from './accountEligibility.js'
import { inheritedForcedAmount, inheritedTenYearDeadline } from './inheritedIra.js'

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

const workingUnder59 = { ownerAgeAttained: 46, ownerRetirementAge: 65 }
const inServiceAt59Half = { ownerAgeAttained: 60, ownerRetirementAge: 65 }
const separatedBefore59Half = { ownerAgeAttained: 50, ownerRetirementAge: 50 }

describe('contributions / convertibility / RMD eligibility', () => {
  it('inherited traditional accounts cannot contribute, convert, or follow owner RMDs', () => {
    const inherited = inheritedIra()
    expect(acceptsContributions(inherited)).toBe(false)
    expect(isConvertibleToRoth(inherited, inServiceAt59Half)).toBe(false)
    expect(followsOwnerRmds(inherited)).toBe(false)
    expect(isAggregatedIra(inherited)).toBe(false)
  })

  it('owned traditional IRAs contribute, convert, follow RMDs, and aggregate for 8606', () => {
    const owned = ownedIra()
    expect(acceptsContributions(owned)).toBe(true)
    expect(isConvertibleToRoth(owned, workingUnder59)).toBe(true)
    expect(followsOwnerRmds(owned)).toBe(true)
    expect(isAggregatedIra(owned)).toBe(true)
  })

  it('employer traditional plans convert only on a provable 401(k)(2)(B)(i) event and never aggregate for 8606', () => {
    const employer = ownedIra({ kind: 'employer' })
    expect(isConvertibleToRoth(employer, workingUnder59)).toBe(false)
    expect(isConvertibleToRoth(employer, inServiceAt59Half)).toBe(true)
    expect(isConvertibleToRoth(employer, separatedBefore59Half)).toBe(true)
    expect(employerPlanIsDistributableForRothIraRollover(workingUnder59)).toBe(false)
    expect(employerPlanIsDistributableForRothIraRollover(inServiceAt59Half)).toBe(true)
    expect(employerPlanIsDistributableForRothIraRollover(separatedBefore59Half)).toBe(true)
    expect(isAggregatedIra(employer)).toBe(false)
  })

  it('preserves the public one-argument call: IRAs convert, employer accounts fail closed', () => {
    // Existing consumers call isConvertibleToRoth(account). Absent year-level
    // context the employer gate cannot prove a 401(k)(2)(B)(i) event, so that
    // arm fails closed rather than throwing. An owned IRA does not need the
    // event and stays convertible.
    expect(isConvertibleToRoth(ownedIra())).toBe(true)
    expect(isConvertibleToRoth(ownedIra({ kind: 'employer' }))).toBe(false)
    expect(isConvertibleToRoth(inheritedIra())).toBe(false)
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
    expect(isConvertibleToRoth(roth, inServiceAt59Half)).toBe(false)
    expect(followsOwnerRmds(roth)).toBe(false)
    expect(acceptsContributions(roth)).toBe(true)
  })

  it('blocks contributions to any inherited account, including Roth', () => {
    const inheritedRoth: Account = {
      type: 'roth',
      id: 'ir',
      name: 'Inherited Roth',
      ownerPersonId: 'p1',
      annualReturnPct: null,
      kind: 'ira',
      balance: 50_000,
      annualContribution: 7_000,
      inherited: { ownerDeathYear: 2024, decedentHadStartedRmds: false },
    }
    expect(acceptsContributions(inheritedRoth)).toBe(false)
  })

  it('isTreatAsOwnEffective requires the classifier S2 structural preconditions', () => {
    // Election alone is not enough — missing sole/unlimited/edb never flips.
    expect(isTreatAsOwnEffective({
      inherited: {
        beneficiary: {
          election: 'treat-as-own',
          treatAsOwnElectionYear: 2026,
        },
      },
    }, 2026)).toBe(false)
    expect(isTreatAsOwnEffective({
      kind: 'ira',
      inherited: {
        ownerDeathYear: 2024,
        beneficiary: {
          election: 'treat-as-own',
          treatAsOwnElectionYear: 2026,
          edbCategory: 'surviving-spouse',
          soleBeneficiary: true,
          spouseUnlimitedWithdrawalRight: true,
        },
      },
    }, 2026)).toBe(true)
    expect(isTreatAsOwnEffective({
      kind: 'ira',
      inherited: {
        ownerDeathYear: 2024,
        beneficiary: {
          election: 'treat-as-own',
          treatAsOwnElectionYear: 2026,
          edbCategory: 'surviving-spouse',
          soleBeneficiary: true,
          spouseUnlimitedWithdrawalRight: true,
        },
      },
    }, 2025)).toBe(false)
    // Inherited employer accounts never flip — matrix scope is IRAs only.
    expect(isTreatAsOwnEffective({
      kind: '401k',
      inherited: {
        beneficiary: {
          election: 'treat-as-own',
          treatAsOwnElectionYear: 2026,
          edbCategory: 'surviving-spouse',
          soleBeneficiary: true,
          spouseUnlimitedWithdrawalRight: true,
        },
      },
    }, 2026)).toBe(false)
    // Pre-SECURE death: classifier never reaches S2 (X1 legacy first).
    expect(isTreatAsOwnEffective({
      kind: 'ira',
      inherited: {
        ownerDeathYear: 2019,
        beneficiary: {
          election: 'treat-as-own',
          treatAsOwnElectionYear: 2026,
          edbCategory: 'surviving-spouse',
          soleBeneficiary: true,
          spouseUnlimitedWithdrawalRight: true,
        },
      },
    }, 2026)).toBe(false)
  })

  it('isTreatAsOwnEffective returns false when RBD derivation needs review', () => {
    // Born-1960 owner died 2025 with decedentHadStartedRmds true contradicts
    // derivation (RBD 2036) — classifier refuses; flip never takes effect.
    expect(isTreatAsOwnEffective({
      kind: 'ira',
      inherited: {
        ownerDeathYear: 2025,
        decedentHadStartedRmds: true,
        beneficiary: {
          election: 'treat-as-own',
          treatAsOwnElectionYear: 2026,
          edbCategory: 'surviving-spouse',
          soleBeneficiary: true,
          spouseUnlimitedWithdrawalRight: true,
          ownerBirthYear: 1960,
        },
      },
    }, 2026)).toBe(false)
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

describe('Plan v3 retirement-action eligibility adapter', () => {
  function planWithEligibilityFacts(subtype: 'traditional' | 'sep' | 'simple'): Plan {
    const plan = createEmptyPlan({
      newId: () => 'generated',
      now: () => new Date('2026-01-01T00:00:00.000Z'),
    })
    plan.household.people[0] = person('p1', '1954-08-31')
    plan.accounts = [ownedIra(), rothIra()]
    plan.retirementActionEligibilityFacts = {
      iraClassifications: [
        subtype === 'simple'
          ? {
              evidenceId: 'classification-1',
              provenance: { source: 'manual' },
              sourceAccountId: 'ira',
              subtype,
              simpleParticipationStartDate: '2020-01-01',
            }
          : {
              evidenceId: 'classification-1',
              provenance: { source: 'manual' },
              sourceAccountId: 'ira',
              subtype,
            },
      ],
      sepSimpleActivities:
        subtype === 'traditional'
          ? []
          : [
              {
                evidenceId: 'activity-2025',
                provenance: { source: 'manual' },
                sourceAccountId: 'ira',
                actionTaxYear: 2025,
                planYearEndDate: '2025-12-31',
                employerContributionMadeForPlanYear: true,
              },
              {
                evidenceId: 'activity-2026',
                provenance: { source: 'manual' },
                sourceAccountId: 'ira',
                actionTaxYear: 2026,
                planYearEndDate: '2026-12-31',
                employerContributionMadeForPlanYear: false,
              },
            ],
      deductibleIraContributions: [
        {
          evidenceId: 'contribution-2025',
          provenance: { source: 'manual' },
          donorPersonId: 'p1',
          taxYear: 2025,
          amountCents: asUsdCents(500),
        },
        {
          evidenceId: 'contribution-2026',
          provenance: { source: 'manual' },
          donorPersonId: 'p1',
          taxYear: 2026,
          amountCents: asUsdCents(250),
        },
      ],
    }
    return plan
  }

  function runtimeFor(
    request: QualifiedCharitableDistributionRequest | RothConversionRequest,
    priorOffsetApplied = 0,
  ): RetirementActionEligibilityRuntimeEvidence {
    const personId = request.kind === 'qcd' ? request.donorPersonId : request.personId
    return {
      personAliveEvidence: [
        {
          evidenceId: 'alive-1',
          actionId: request.actionId,
          personId,
          actionYear: request.year,
          actionDate: request.executionDate ?? null,
          alive: true,
        },
      ],
      priorQcdOffsetEvidence:
        request.kind === 'qcd'
          ? [
              {
                evidenceId: 'offset-1',
                actionId: request.actionId,
                donorPersonId: request.donorPersonId,
                actionYear: request.year,
                actionDate: request.executionDate ?? null,
                priorOffsetApplied: asUsdCents(priorOffsetApplied),
              },
            ]
          : [],
    }
  }

  it('uses only matching-year SEP/SIMPLE activity and the exact threshold-through-action contribution prefix', () => {
    const request = qcdRequest({ executionDate: '2026-03-01' })
    const plan = planWithEligibilityFacts('sep')
    const context = buildRetirementActionEligibilityContextFromPlan(
      plan,
      request,
      runtimeFor(request, 100),
    )
    expect(context.iraFacts).toEqual([
      {
        sourceAccountId: asAccountId('ira'),
        subtype: 'sep',
        qcdActivity: {
          kind: 'employerContribution',
          actionTaxYear: 2026,
          planYearEndDate: '2026-12-31',
          employerContributionMadeForPlanYear: false,
          evidenceId: 'activity-2026',
        },
      },
    ])
    expect(context.qcdContributionHistories?.[0]?.taxYears).toEqual([
      { taxYear: 2025, deductibleContributionAmount: asUsdCents(500) },
      { taxYear: 2026, deductibleContributionAmount: asUsdCents(250) },
    ])
    expect(
      evaluateRetirementActionEligibilityFromPlan(
        request,
        plan,
        runtimeFor(request, 100),
      ),
    ).toEqual({ status: 'accepted', reasons: [] })
  })

  it('classifies a conversion without requiring unrelated QCD activity', () => {
    const request = conversionRequest()
    const plan = planWithEligibilityFacts('simple')
    plan.retirementActionEligibilityFacts!.sepSimpleActivities = []
    expect(
      evaluateRetirementActionEligibilityFromPlan(
        request,
        plan,
        runtimeFor(request),
      ),
    ).toEqual({ status: 'accepted', reasons: [] })
  })

  it('omits incomplete or unbound runtime facts so missing alive/offset evidence stays nonactionable', () => {
    const request = qcdRequest({ executionDate: '2026-03-01' })
    const plan = planWithEligibilityFacts('traditional')
    expect(
      evaluateRetirementActionEligibilityFromPlan(request, plan).reasons.map(
        (reason) => reason.code,
      ),
    ).toEqual(['required-facts-missing', 'qcd-contribution-history-unknown'])

    const aliveOnly = runtimeFor(request)
    delete aliveOnly.priorQcdOffsetEvidence
    expect(
      evaluateRetirementActionEligibilityFromPlan(
        request,
        plan,
        aliveOnly,
      ).reasons.map((reason) => reason.code),
    ).toEqual(['qcd-contribution-history-unknown'])

    plan.retirementActionEligibilityFacts!.deductibleIraContributions =
      plan.retirementActionEligibilityFacts!.deductibleIraContributions.filter(
        (contribution) => contribution.taxYear !== 2025,
      )
    expect(
      buildRetirementActionEligibilityContextFromPlan(
        plan,
        request,
        runtimeFor(request),
      ),
    ).not.toHaveProperty('qcdContributionHistories')

    const ambiguous = runtimeFor(request)
    ambiguous.personAliveEvidence = [
      ...ambiguous.personAliveEvidence!,
      {
        ...ambiguous.personAliveEvidence![0]!,
        evidenceId: 'alive-duplicate',
      },
    ]
    ambiguous.priorQcdOffsetEvidence = [
      ...ambiguous.priorQcdOffsetEvidence!,
      {
        ...ambiguous.priorQcdOffsetEvidence![0]!,
        evidenceId: 'offset-duplicate',
      },
    ]
    const ambiguousContext = buildRetirementActionEligibilityContextFromPlan(
      planWithEligibilityFacts('traditional'),
      request,
      ambiguous,
    )
    expect(ambiguousContext).not.toHaveProperty('personAliveEvidence')
    expect(ambiguousContext).not.toHaveProperty('qcdContributionHistories')
  })

  it('binds a prior-QCD offset to the exact action/donor/year/date and is account-order invariant', () => {
    const request = qcdRequest({
      actionId: asActionId('qcd-2'),
      executionDate: '2026-03-01',
    })
    const plan = planWithEligibilityFacts('traditional')
    const runtime = runtimeFor(request, 100)
    runtime.priorQcdOffsetEvidence = [
      {
        evidenceId: 'other-action',
        actionId: asActionId('qcd-1'),
        donorPersonId: request.donorPersonId,
        actionYear: request.year,
        actionDate: request.executionDate ?? null,
        priorOffsetApplied: asUsdCents(50),
      },
      ...runtime.priorQcdOffsetEvidence!,
    ]
    const forward = evaluateRetirementActionEligibilityFromPlan(
      request,
      plan,
      runtime,
    )
    const reversed = {
      ...plan,
      accounts: [...plan.accounts].reverse(),
    }
    expect(
      evaluateRetirementActionEligibilityFromPlan(request, reversed, runtime),
    ).toEqual(forward)
    expect(forward).toEqual({ status: 'accepted', reasons: [] })

    runtime.priorQcdOffsetEvidence = runtime.priorQcdOffsetEvidence!.map(
      (evidence) =>
        evidence.actionId === request.actionId
          ? { ...evidence, actionDate: '2026-03-02' }
          : evidence,
    )
    expect(
      evaluateRetirementActionEligibilityFromPlan(
        request,
        plan,
        runtime,
      ).reasons.map((reason) => reason.code),
    ).toContain('qcd-contribution-history-unknown')
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

  it('retains distinct diagnostics when identifier tuples contain delimiters', () => {
    const base = ordinaryRequest()
    const request = {
      ...base,
      requestedAmount: ordinaryWithdrawalRequestSchema.shape.requestedAmount.parse(2),
      allocations: [
        {
          allocationId: asAllocationId('c'),
          sourceAccountId: asAccountId('a|b'),
          requestedAmount: ordinaryWithdrawalRequestSchema.shape.requestedAmount.parse(1),
        },
        {
          allocationId: asAllocationId('b|c'),
          sourceAccountId: asAccountId('a'),
          requestedAmount: ordinaryWithdrawalRequestSchema.shape.requestedAmount.parse(1),
        },
      ],
    } as OrdinaryWithdrawalRequest
    const decision = evaluateRetirementActionEligibility(
      request,
      { people: [person('p1')], accounts: [] },
      withAlive(request),
    )
    expect(decision.reasons.map((reason) => [
      reason.accountId,
      reason.allocationId,
    ])).toEqual([
      ['a', 'b|c'],
      ['a|b', 'c'],
    ])
  })

  it('validates supplied ordinary execution dates while allowing omission when unnecessary', () => {
    const base = ordinaryRequest()
    const plan = { people: [person('p1')], accounts: [ira, cash] }
    for (const executionDate of ['2026-02-30', '2026-2-01', '2027-01-01']) {
      const request = { ...base, executionDate } as OrdinaryWithdrawalRequest
      expect(
        evaluateRetirementActionEligibility(request, plan, withAlive(request)),
      ).toMatchObject({
        status: 'unsupported',
        reasons: [{ code: 'required-facts-missing' }],
      })
    }
    const withoutDate = { ...base, executionDate: undefined } as OrdinaryWithdrawalRequest
    expect(
      evaluateRetirementActionEligibility(withoutDate, plan, withAlive(withoutDate)),
    ).toEqual({ status: 'accepted', reasons: [] })
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
    const invalidBeforeThresholdYear = qcdRequest({ executionDate: '2026-02-30' })
    expect(
      evaluateRetirementActionEligibility(
        invalidBeforeThresholdYear,
        { people: [person('p1', '1956-08-31')], accounts: [ira] },
        withAlive(invalidBeforeThresholdYear, {
          iraFacts: traditionalContext().iraFacts,
        }),
      ).reasons.map((reason) => reason.code),
    ).toEqual(['qcd-date-invalid'])
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

  it.each([
    [
      'traditional with missing activity',
      {
        sourceAccountId: asAccountId('ira'),
        subtype: 'traditional',
      },
    ],
    [
      'traditional with null activity',
      {
        sourceAccountId: asAccountId('ira'),
        subtype: 'traditional',
        qcdActivity: null,
      },
    ],
    [
      'SEP with null activity',
      {
        sourceAccountId: asAccountId('ira'),
        subtype: 'sep',
        qcdActivity: null,
      },
    ],
    [
      'SIMPLE with null activity',
      {
        sourceAccountId: asAccountId('ira'),
        subtype: 'simple',
        qcdActivity: null,
      },
    ],
  ])('fails closed without throwing for malformed external %s', (_label, fact) => {
    const request = qcdRequest()
    const plan = { people: [person('p1')], accounts: [ira] }
    const context = withAlive(request, {
      ...traditionalContext(),
      iraFacts: [fact] as NonpersistedRetirementActionEligibilityContext['iraFacts'],
    })
    const evaluate = () =>
      evaluateRetirementActionEligibility(request, plan, context)

    expect(evaluate).not.toThrow()
    expect(evaluate().reasons[0]?.code).toBe('qcd-sep-simple-activity-unknown')
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

describeRule('irc-408-d-3-G-simple-two-year-rollover-bar', {
  // A Roth conversion out of a SIMPLE IRA one day short of the two-year period.
  // 408(d)(3)(G) denies rollover treatment, and 408A(e)(1)(B)(i) makes rollover
  // treatment a condition of a qualified rollover contribution, so the movement
  // is unavailable and the engine must refuse it. Mistaking this rule for the
  // 25 percent rate substitution in 72(t)(6)(A) predicts the opposite outcome:
  // an accepted conversion that is merely repriced.
  readings: { statuteRolloverBarred: 'refused', rejectedRateSubstitutionOnly: 'accepted' },
  accepted: 'statuteRolloverBarred',
}, ({ accepted, readings }) => {
  // Participation opened 2024-06-15, so the two-year period runs through
  // 2026-06-14 and the bar lifts on 2026-06-15.
  const evaluateOn = (executionDate: string) => {
    const request = { ...conversionRequest(), executionDate } as RothConversionRequest
    return evaluateRetirementActionEligibility(
      request,
      { people: [person('p1')], accounts: [ownedIra(), rothIra()] },
      {
        ...withAlive(request),
        iraFacts: [{
          sourceAccountId: asAccountId('ira'),
          subtype: 'simple',
          simpleParticipationStartDate: '2024-06-15',
        }],
      },
    )
  }

  it('refuses the conversion outright inside the two-year period', () => {
    const decision = evaluateOn('2026-06-14')
    expect(decision.status).toBe(accepted)
    expect(decision.status).not.toBe(readings.rejectedRateSubstitutionOnly)
    expect(decision.reasons[0]?.code).toBe('conversion-simple-two-year-period-open')
  })

  it('lifts the bar on the 24-month anniversary itself', () => {
    // A 2-year period beginning on the participation date runs through the day
    // before the anniversary, so the anniversary is outside it.
    expect(evaluateOn('2026-06-15').status).toBe(readings.rejectedRateSubstitutionOnly)
  })

  it('does not reach an ordinary traditional IRA of the same owner', () => {
    const request = conversionRequest()
    expect(
      evaluateRetirementActionEligibility(
        request,
        { people: [person('p1')], accounts: [ownedIra(), rothIra()] },
        withAlive(request, traditionalContext()),
      ).status,
    ).toBe(readings.rejectedRateSubstitutionOnly)
  })
})

describeRule('irc-401-a-9-H-designated-beneficiary-ten-year-rule', {
  // Calendar year by which an account inherited from a 2024 death must be empty.
  // 401(a)(9)(H)(i)(I) applies (B)(ii) by substituting 10 years for 5, so the
  // pre-SECURE reading of the same subparagraph predicts 2029.
  readings: { secureTenYearRule: 2034, rejectedPreSecureFiveYearRule: 2029 },
  accepted: 'secureTenYearRule',
}, ({ accepted, readings }) => {
  const forcedIn = (year: number): number =>
    inheritedForcedAmount({
      pack: packForYear(2026).pack,
      year,
      ownerDeathYear: 2024,
      decedentHadStartedRmds: false,
      balance: 100_000,
      startBalance: 100_000,
      beneficiaryAge: 45,
    })

  it('keeps an inherited account off the owner RMD schedule entirely', () => {
    expect(followsOwnerRmds(inheritedIra())).toBe(false)
    expect(followsOwnerRmds(ownedIra())).toBe(true)
  })

  it('sweeps the balance in the tenth year after the death and not the fifth', () => {
    expect(inheritedTenYearDeadline(2024)).toBe(accepted)
    expect(forcedIn(readings.rejectedPreSecureFiveYearRule)).toBe(0)
    expect(forcedIn(accepted)).toBe(100_000)
  })

  it('forces nothing in the interim years when the decedent had not begun distributions', () => {
    // (H)(i)(II) makes the deadline apply whether or not distributions had
    // begun; it does not itself impose an annual amount before the deadline.
    expect(forcedIn(2030)).toBe(0)
  })
})

describeRule('irc-72-t-2-A-ii-death-beneficiary-exception', {
  // Penalty rate on a need-based withdrawal from an inherited account. The
  // exception turns on the death, so it holds at ages the age-based reading
  // would penalize in full.
  readings: { statuteDeathException: 0, rejectedAgeTestOnly: 0.1 },
  accepted: 'statuteDeathException',
}, ({ accepted, readings }) => {
  it('exempts an inherited account at every age the age test would penalize', () => {
    for (const ownerAgeAttained of [25, 40, 59]) {
      expect(
        traditionalWithdrawalPenaltyRate(inheritedIra(), { ownerAgeAttained, ownerRetirementAge: null }),
      ).toBe(accepted)
      // Same owner, same age, an account that was not inherited: the death is
      // the only fact that moves the rate.
      expect(
        traditionalWithdrawalPenaltyRate(ownedIra(), { ownerAgeAttained, ownerRetirementAge: null }),
      ).toBe(readings.rejectedAgeTestOnly)
    }
  })

  it('does not borrow the Rule of 55, which an inherited employer account would fail', () => {
    const inheritedEmployerPlan = ownedIra({
      kind: 'employer',
      inherited: { ownerDeathYear: 2020, decedentHadStartedRmds: true },
    })
    expect(
      traditionalWithdrawalPenaltyRate(inheritedEmployerPlan, {
        ownerAgeAttained: 30,
        ownerRetirementAge: 40,
      }),
    ).toBe(accepted)
  })
})

/**
 * Refusal fixtures for the `outOfScope` records this module implements.
 *
 * `describeRule` refuses an `outOfScope` id, because there is no computed value
 * to discriminate readings of; `describeRefusal` is its sibling for the half of
 * the registry that says "we will not answer this". Each fixture names the
 * refusal site the record itself publishes, the input that is out of scope, and
 * the reason code that comes back, then drives the real exported entry point so
 * the day a refusal quietly turns into an answer the fixture fails and names the
 * record that has to be reclassified.
 */
describe('outOfScope refusals reached through evaluateRetirementActionEligibilityFromPlan', () => {
  // The default donor turned 70½ on 2025-02-28, so every fixture below is
  // age-eligible for a QCD unless it deliberately says otherwise; the age-70½
  // fixture passes a later birth date rather than reaching past this helper.
  const AGE_ELIGIBLE_DONOR_BIRTH_DATE = '1954-08-31'

  function refusalPlan(
    accounts: Account[],
    donorBirthDate = AGE_ELIGIBLE_DONOR_BIRTH_DATE,
  ): Plan {
    const plan = createEmptyPlan({
      newId: () => 'generated',
      now: () => new Date('2026-01-01T00:00:00.000Z'),
    })
    plan.household.people[0] = person('p1', donorBirthDate)
    plan.accounts = accounts
    // Classify id 'ira' as a traditional IRA only when the fixture actually put
    // a traditional account there. The Roth-source fixture below reuses this id
    // for a Roth IRA (the QCD source account id the request expects), and a
    // classification fact contradicting the account's own type would make the
    // plan describe two incompatible things about the same account.
    const traditionalIra = accounts.find(
      (account): account is TraditionalAccount => account.id === 'ira' && account.type === 'traditional',
    )
    plan.retirementActionEligibilityFacts = {
      iraClassifications:
        traditionalIra === undefined
          ? []
          : [
              {
                evidenceId: 'classification-1',
                provenance: { source: 'manual' },
                sourceAccountId: 'ira',
                subtype: 'traditional',
              },
            ],
      sepSimpleActivities: [],
      // Post-70½ deductible-contribution history has to be complete from the
      // donor's threshold year through the action year, or every QCD comes
      // back qcd-contribution-history-unknown and the fixtures below would be
      // pinning that code instead of the refusal they name.
      deductibleIraContributions: [2025, 2026].map((taxYear) => ({
        evidenceId: `contribution-${taxYear}`,
        provenance: { source: 'manual' as const },
        donorPersonId: 'p1',
        taxYear,
        amountCents: asUsdCents(0),
      })),
    }
    return plan
  }

  function aliveRuntime(
    request: QualifiedCharitableDistributionRequest | RothConversionRequest,
  ): RetirementActionEligibilityRuntimeEvidence {
    const personId = request.kind === 'qcd' ? request.donorPersonId : request.personId
    return {
      personAliveEvidence: [
        {
          evidenceId: 'alive-1',
          actionId: request.actionId,
          personId,
          actionYear: request.year,
          actionDate: request.executionDate ?? null,
          alive: true,
        },
      ],
      priorQcdOffsetEvidence:
        request.kind === 'qcd'
          ? [
              {
                evidenceId: 'offset-1',
                actionId: request.actionId,
                donorPersonId: request.donorPersonId,
                actionYear: request.year,
                actionDate: request.executionDate ?? null,
                priorOffsetApplied: asUsdCents(0),
              },
            ]
          : [],
    }
  }

  function refuse(
    request: QualifiedCharitableDistributionRequest | RothConversionRequest,
    accounts: Account[],
    donorBirthDate = AGE_ELIGIBLE_DONOR_BIRTH_DATE,
  ): { status: string; codes: string[] } {
    const outcome = evaluateRetirementActionEligibilityFromPlan(
      request,
      refusalPlan(accounts, donorBirthDate),
      aliveRuntime(request),
    )
    return { status: outcome.status, codes: outcome.reasons.map((reason) => reason.code) }
  }

  function qcdIntentFromRequest(
    request: QualifiedCharitableDistributionRequest,
  ): QcdCandidateIdentityIntent {
    return {
      kind: request.kind,
      year: request.year,
      executionDate: request.executionDate,
      executionSequence: request.executionSequence,
      requestedAmount: request.requestedAmount,
      donorPersonId: request.donorPersonId,
      provenance: request.provenance,
      charity: request.charity,
      sourceAllocation: {
        sourceAccountId: request.allocation.sourceAccountId,
        requestedAmount: request.allocation.requestedAmount,
      },
    }
  }

  function allocateQcdIdentity(accounts: Account[]) {
    return allocateRetirementActionCandidateIdentity(
      refusalPlan(accounts),
      qcdIntentFromRequest(qcdRequest()),
    )
  }

  describeRefusal('irc-408-d-3-C-i-inherited-ira-rollover-bar', {
    entryPoint: 'packages/engine/src/strategies/accountEligibility.ts#evaluateConversion',
    outOfScopeInput: 'a Roth conversion whose only source allocation is a nonspouse inherited IRA',
    refusal: "reason code 'conversion-inherited-source', so nothing is accepted and no dollars move",
  }, () => {
    it('refuses an inherited source instead of computing a conversion', () => {
      const outcome = refuse(conversionRequest(), [inheritedIra(), rothIra()])
      expect(outcome.codes).toContain('conversion-inherited-source')
      expect(outcome.status).not.toBe('accepted')
    })

    it('accepts the same request from an owned IRA, so the refusal is the inherited fact and not the shape of the fixture', () => {
      expect(refuse(conversionRequest(), [ownedIra(), rothIra()])).toEqual({
        status: 'accepted',
        codes: [],
      })
    })
  })

  describeRefusal('irc-408-d-8-roth-ira-source', {
    entryPoint: 'packages/engine/src/strategies/accountEligibility.ts#evaluateQcd',
    outOfScopeInput: 'a QCD whose source account is a Roth IRA',
    refusal: "reason code 'qcd-roth-source-unsupported' rather than a partly excludable distribution",
  }, () => {
    it('refuses a Roth source instead of proving how much would otherwise be includible', () => {
      const outcome = refuse(qcdRequest(), [rothIra('ira')])
      expect(outcome.codes).toContain('qcd-roth-source-unsupported')
      expect(outcome.status).not.toBe('accepted')
    })

    it('does not confuse the Roth source with the generic not-an-IRA refusal', () => {
      // evaluateQcd: a Roth IRA source gets qcd-roth-source-unsupported —
      // distinct from qcd-source-not-ira. The allocator test below exercises
      // the intentionally coarser qcd-source-not-ira guard (Roth is not a
      // traditional IRA); losing the evaluateQcd distinction would hide which
      // statute is unimplemented.
      const outcome = refuse(qcdRequest(), [rothIra('ira')])
      expect(outcome.codes).not.toContain('qcd-source-not-ira')
    })

    it('allocates an owned traditional IRA and blocks a Roth source as qcd-source-not-ira', () => {
      const ordinary = allocateQcdIdentity([ownedIra()])
      expect(ordinary.status).toBe('allocated')
      expect(ordinary.request).not.toBeNull()

      const roth = allocateQcdIdentity([rothIra('ira')])
      expect(roth.status).toBe('blocked')
      expect(roth.request).toBeNull()
      if (roth.status !== 'blocked') return
      const codes = roth.issues.flatMap((issue) => issue.reason?.code ?? [])
      expect(codes).toContain('qcd-source-not-ira')
      expect(codes).not.toContain('person-not-found')
      expect(codes).not.toContain('source-account-not-found')
      expect(codes).not.toContain('required-facts-missing')
    })
  })

  describeRefusal('irc-408-d-8-F-split-interest-sublimit', {
    entryPoint: 'packages/engine/src/strategies/accountEligibility.ts#evaluateQcd',
    outOfScopeInput:
      'a QCD to a destination the donor will not attest is outside the split-interest entity class',
    refusal: "reason code 'qcd-split-interest-unsupported', with no one-time sublimit computed",
  }, () => {
    it('requires the affirmative not-a-split-interest attestation the record describes', () => {
      const request = qcdRequest({
        charity: {
          designationId: 'charity-1',
          name: 'Public charity',
          designationKind: 'eligiblePublicCharity',
          directFromCustodianAttested: true,
          eligibleOrganizationAttested: true,
          notDonorAdvisedFundOrSupportingOrganizationAttested: true,
          notSplitInterestEntityAttested: false,
          entireDistributionOtherwiseDeductibleAttested: true,
        },
      })
      const outcome = refuse(request, [ownedIra()])
      expect(outcome.codes).toContain('qcd-split-interest-unsupported')
      expect(outcome.status).not.toBe('accepted')
    })

    it('refuses a destination the request itself names as a split-interest entity', () => {
      const request = qcdRequest({
        charity: {
          designationId: 'charity-1',
          name: 'Charitable remainder unitrust',
          designationKind: 'splitInterestEntity',
          directFromCustodianAttested: true,
          eligibleOrganizationAttested: true,
          notDonorAdvisedFundOrSupportingOrganizationAttested: true,
          notSplitInterestEntityAttested: false,
          entireDistributionOtherwiseDeductibleAttested: true,
        },
      })
      expect(refuse(request, [ownedIra()]).codes).toContain('qcd-split-interest-unsupported')
    })

    it('stays quiet on an ordinary public charity with the attestation given', () => {
      expect(refuse(qcdRequest(), [ownedIra()]).codes).not.toContain('qcd-split-interest-unsupported')
    })
  })

  describeRefusal('irc-408-d-8-F-i-split-interest-direct-payment', {
    entryPoint: 'packages/engine/src/strategies/accountEligibility.ts#evaluateQcd',
    outOfScopeInput:
      'a QCD the request routes to a charitable remainder trust or gift annuity even when the donor attests the transfer is direct from the custodian',
    refusal: "reason code 'qcd-split-interest-unsupported', so no QCD executes and no tax result is produced",
    note: 'the direct-payment limb, not the missing attestation',
  }, () => {
    function splitInterestRequest(): QualifiedCharitableDistributionRequest {
      return qcdRequest({
        charity: {
          designationId: 'charity-1',
          name: 'Charitable remainder unitrust',
          designationKind: 'splitInterestEntity',
          // Every condition 408(d)(8)(F)(i) attaches to the transfer itself is
          // asserted here, including the not-a-split-interest attestation the
          // sibling sublimit fixture withholds. The refusal must therefore be
          // the entity class, not a missing attestation.
          directFromCustodianAttested: true,
          eligibleOrganizationAttested: true,
          notDonorAdvisedFundOrSupportingOrganizationAttested: true,
          notSplitInterestEntityAttested: true,
          entireDistributionOtherwiseDeductibleAttested: true,
        },
      })
    }

    it('refuses a direct trustee payment to a split-interest entity', () => {
      const outcome = refuse(splitInterestRequest(), [ownedIra()])
      expect(outcome.codes).toContain('qcd-split-interest-unsupported')
      expect(outcome.status).not.toBe('accepted')
    })

    it('does not let the direct-payment attestation buy the entity class back', () => {
      // The attested direct transfer is exactly the fact 408(d)(8)(F)(i)
      // requires; the engine still refuses, which is what "not modelled" means
      // here and what would break if a split-interest QCD were ever priced.
      expect(refuse(splitInterestRequest(), [ownedIra()]).codes)
        .toContain('qcd-split-interest-unsupported')
    })

    it('accepts the same transfer to an ordinary public charity, so the refusal is the entity class', () => {
      expect(refuse(qcdRequest(), [ownedIra()])).toEqual({ status: 'accepted', codes: [] })
    })
  })

  describeRefusal('irc-408-d-8-beneficiary-ira-source', {
    entryPoint: 'packages/engine/src/strategies/accountEligibility.ts#evaluateQcd',
    outOfScopeInput: 'a QCD whose source IRA is an inherited (beneficiary) IRA',
    refusal:
      "reason code 'qcd-inherited-basis-unsupported', so the inherited source stays classification-only and non-actionable",
  }, () => {
    it('refuses an inherited source rather than borrowing the donor own-IRA basis pool', () => {
      const outcome = refuse(qcdRequest(), [inheritedIra()])
      expect(outcome.codes).toContain('qcd-inherited-basis-unsupported')
      expect(outcome.status).not.toBe('accepted')
    })

    it('does not mistake the inherited IRA for a non-IRA source', () => {
      // An inherited IRA is still an IRA; the missing thing is separate
      // beneficiary basis history. Collapsing this into qcd-source-not-ira
      // would hide which statute is unimplemented.
      expect(refuse(qcdRequest(), [inheritedIra()]).codes).not.toContain('qcd-source-not-ira')
    })

    it('accepts the same request from the donor own IRA, so the refusal is the inherited fact', () => {
      expect(refuse(qcdRequest(), [ownedIra()])).toEqual({ status: 'accepted', codes: [] })
    })

    it('allocates an owned traditional IRA and blocks an inherited source as qcd-inherited-basis-unsupported', () => {
      const ordinary = allocateQcdIdentity([ownedIra()])
      expect(ordinary.status).toBe('allocated')
      expect(ordinary.request).not.toBeNull()

      const inherited = allocateQcdIdentity([inheritedIra()])
      expect(inherited.status).toBe('blocked')
      expect(inherited.request).toBeNull()
      if (inherited.status !== 'blocked') return
      const codes = inherited.issues.flatMap((issue) => issue.reason?.code ?? [])
      expect(codes).toContain('qcd-inherited-basis-unsupported')
      expect(codes).not.toContain('qcd-source-not-ira')
      expect(codes).not.toContain('person-not-found')
      expect(codes).not.toContain('source-account-not-found')
      expect(codes).not.toContain('required-facts-missing')
    })
  })

  describeRefusal('irc-72-t-1-qcd-not-early-distribution-exception', {
    entryPoint: 'packages/engine/src/strategies/accountEligibility.ts#evaluateQcd',
    outOfScopeInput:
      'a QCD by a donor who has not attained age 70½ — the only shape in which a QCD could ever need a §72(t) exception',
    refusal: "reason code 'qcd-before-age-70-half', so no QCD is ever accepted below the age-59½ threshold",
  }, () => {
    // Born 1975: age 51 in the 2026 action year, so under 59½ as well as under
    // 70½. If this request were ever accepted, the engine would be holding an
    // early distribution that no 72(t)(2)(A)(i) exception covers.
    const UNDER_59_HALF_DONOR_BIRTH_DATE = '1975-01-01'

    it('refuses a QCD below age 70½ instead of pricing an early distribution', () => {
      const outcome = refuse(qcdRequest(), [ownedIra()], UNDER_59_HALF_DONOR_BIRTH_DATE)
      expect(outcome.codes).toContain('qcd-before-age-70-half')
      expect(outcome.status).not.toBe('accepted')
    })

    it('accepts the same request once the donor is past 70½, which is also past 59½', () => {
      expect(refuse(qcdRequest(), [ownedIra()])).toEqual({ status: 'accepted', codes: [] })
    })
  })
})
