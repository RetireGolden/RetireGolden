import { describe, expect, it } from 'vitest'

import { asAccountId, asPersonId } from '../actions/identity.js'
import { asPositiveUsdCents, asUsdCents } from '../actions/money.js'
import type { QcdCandidateIdentityIntent } from '../actions/retirementActionCandidateIdentityAllocator.js'
import { qcdEfficiency } from '../insights/detectors/qcdEfficiency.js'
import type { DetectorContext } from '../insights/types.js'
import type { Plan } from '../model/plan.js'
import { singlePersonPlan, traditionalAccount } from '../testing/planFixtures.js'
import { candidateFromInsight } from './insightsAdapter.js'
import {
  adaptQcdEfficiencyDetectorCandidate,
  type QcdEfficiencyCandidateAlternative,
} from './qcdCandidateAdapter.js'

const charity = {
  designationId: 'charity-public-a',
  name: 'Public charity',
  designationKind: 'eligiblePublicCharity' as const,
  directFromCustodianAttested: true,
  eligibleOrganizationAttested: true,
  notDonorAdvisedFundOrSupportingOrganizationAttested: true,
  notSplitInterestEntityAttested: true,
  entireDistributionOtherwiseDeductibleAttested: true,
}

function eligiblePlan(): Plan {
  const plan = singlePersonPlan({ dob: '1955-01-31', planningAge: 90 })
  plan.accounts = [
    traditionalAccount('ira-b', 100_000),
    traditionalAccount('ira-a', 100_000),
  ]
  plan.strategies.itemizedDeductions = {
    stateAndLocalTaxes: 1_000,
    mortgageInterest: 2_000,
    charitable: 250,
  }
  plan.retirementActionEligibilityFacts = {
    iraClassifications: [
      {
        sourceAccountId: 'ira-b',
        subtype: 'traditional',
        evidenceId: 'ira-b-classification',
        provenance: { source: 'manual' },
      },
      {
        sourceAccountId: 'ira-a',
        subtype: 'traditional',
        evidenceId: 'ira-a-classification',
        provenance: { source: 'manual' },
      },
    ],
    sepSimpleActivities: [],
    deductibleIraContributions: [
      {
        donorPersonId: 'p1',
        taxYear: 2025,
        amountCents: asUsdCents(0),
        evidenceId: 'p1-contribution-2025',
        provenance: { source: 'manual' },
      },
      {
        donorPersonId: 'p1',
        taxYear: 2026,
        amountCents: asUsdCents(0),
        evidenceId: 'p1-contribution-2026',
        provenance: { source: 'manual' },
      },
      {
        donorPersonId: 'p1',
        taxYear: 2027,
        amountCents: asUsdCents(0),
        evidenceId: 'p1-contribution-2027',
        provenance: { source: 'manual' },
      },
    ],
  }
  return plan
}

function exploratoryCandidate(plan: Plan, years: readonly number[] = [2026]) {
  const card = qcdEfficiency.screen({
    plan,
    projection: {
      result: {
        years: years.map((year) => ({ year, people: [], balances: {} })),
      },
    },
  } as unknown as DetectorContext)
  if (card === null) throw new Error('fixture must emit QCD insight')
  const candidate = candidateFromInsight(card, card.action)
  if (candidate === null) throw new Error('fixture must emit modelable candidate')
  return candidate
}

function alternative(
  alternativeId: string,
  sourceAccountId: string,
  overrides: Partial<QcdCandidateIdentityIntent> = {},
): QcdEfficiencyCandidateAlternative {
  return {
    alternativeId,
    intent: {
      kind: 'qcd',
      year: 2026,
      executionDate: '2026-08-01',
      executionSequence: 1,
      requestedAmount: asPositiveUsdCents(25_000),
      donorPersonId: asPersonId('p1'),
      provenance: { source: 'generator', sourceId: 'qcd-efficiency' },
      sourceAllocation: {
        sourceAccountId: asAccountId(sourceAccountId),
        requestedAmount: asPositiveUsdCents(25_000),
      },
      charity: { ...charity },
      ...overrides,
    },
    runtimeFacts: {
      personAliveEvidenceId: `alive-${alternativeId}`,
      donorAlive: true,
      priorQcdOffsetEvidenceId: `offset-${alternativeId}`,
      priorQcdOffsetApplied: asUsdCents(0),
    },
  }
}

describe('QCD efficiency candidate adapter', () => {
  it('selects an eligible alternative by stable identities and retains every alternative', () => {
    const plan = eligiblePlan()
    const candidate = exploratoryCandidate(plan)
    const first = adaptQcdEfficiencyDetectorCandidate(plan, candidate, [
      alternative('option-b', 'ira-b'),
      alternative('option-a', 'ira-a'),
    ])
    const permutedPlan: Plan = {
      ...plan,
      accounts: [...plan.accounts].reverse(),
      retirementActionEligibilityFacts: {
        ...plan.retirementActionEligibilityFacts!,
        iraClassifications: [
          ...plan.retirementActionEligibilityFacts!.iraClassifications,
        ].reverse(),
        deductibleIraContributions: [
          ...plan.retirementActionEligibilityFacts!.deductibleIraContributions,
        ].reverse(),
      },
    }
    const second = adaptQcdEfficiencyDetectorCandidate(
      permutedPlan,
      exploratoryCandidate(permutedPlan),
      [alternative('option-a', 'ira-a'), alternative('option-b', 'ira-b')],
    )

    expect(first.status).toBe('adapted')
    expect(second.status).toBe('adapted')
    if (first.status !== 'adapted' || second.status !== 'adapted') return
    expect(first.selectedAlternativeIds).toEqual(['option-a'])
    expect(second.selectedAlternativeIds).toEqual(['option-a'])
    expect(second.requests).toEqual(first.requests)
    expect(first.requests[0]).toMatchObject({
      kind: 'qcd',
      donorPersonId: 'p1',
      executionDate: '2026-08-01',
      allocation: { sourceAccountId: 'ira-a', requestedAmount: 25_000 },
      charity: { designationId: 'charity-public-a' },
    })
    expect(first.candidate.planPatch).toMatchObject({
      strategies: {
        qcdAnnual: 0,
        itemizedDeductions: { charitable: 0 },
        retirementActions: [first.requests[0]],
      },
    })
    expect(first.candidate.retirementActionReadiness).toEqual({
      state: 'identityComplete',
      actionRequestIds: [first.requests[0]!.actionId],
    })
    expect(first.allocationEvidence.alternatives).toHaveLength(2)
    expect(first.allocationEvidence.alternatives.every((entry) => entry.disposition === 'eligible'))
      .toBe(true)
    expect(first.allocationEvidence.alternatives).toEqual(expect.arrayContaining([
      expect.objectContaining({
        alternativeId: 'option-a',
        personAliveEvidenceId: 'alive-option-a',
        priorQcdOffsetEvidenceId: 'offset-option-a',
        priorQcdOffsetApplied: 0,
      }),
    ]))
  })

  it('retains rejected alternatives while selecting an accepted source', () => {
    const plan = eligiblePlan()
    const candidate = exploratoryCandidate(plan)
    const unconfirmed = alternative('unconfirmed', 'ira-a')
    unconfirmed.intent.charity.directFromCustodianAttested = false

    const result = adaptQcdEfficiencyDetectorCandidate(plan, candidate, [
      unconfirmed,
      alternative('accepted', 'ira-b'),
    ])

    expect(result.status).toBe('adapted')
    if (result.status !== 'adapted') return
    expect(result.selectedAlternativeIds).toEqual(['accepted'])
    expect(result.allocationEvidence.alternatives).toEqual(expect.arrayContaining([
      expect.objectContaining({
        alternativeId: 'unconfirmed',
        disposition: 'blocked',
        reasonCodes: expect.arrayContaining(['qcd-direct-charity-unconfirmed']),
      }),
    ]))
    expect(result.candidate.metadata?.qcdAlternatives).toEqual(
      result.allocationEvidence.alternatives,
    )
  })

  it('requires and materializes one eligible QCD for every detector projection year', () => {
    const plan = eligiblePlan()
    const candidate = exploratoryCandidate(plan, [2026, 2027])
    const result = adaptQcdEfficiencyDetectorCandidate(plan, candidate, [
      alternative('2027-option', 'ira-b', {
        year: 2027,
        executionDate: '2027-08-01',
      }),
      alternative('2026-option', 'ira-a'),
    ])

    expect(result.status).toBe('adapted')
    if (result.status !== 'adapted') return
    expect(result.selectedAlternativeIds).toEqual(['2026-option', '2027-option'])
    expect(result.requests.map((request) => request.year)).toEqual([2026, 2027])
    expect(result.candidate.planPatch).toMatchObject({
      strategies: {
        qcdAnnual: 0,
        itemizedDeductions: { charitable: 0 },
        retirementActions: result.requests,
      },
    })
    expect(result.candidate.metadata).toMatchObject({
      qcdTargetYears: [2026, 2027],
      qcdSelectedAlternativeIds: ['2026-option', '2027-option'],
    })
  })

  it('blocks incomplete schedules and alternatives outside detector projection years', () => {
    const plan = eligiblePlan()
    const candidate = exploratoryCandidate(plan, [2026, 2027])
    const incomplete = adaptQcdEfficiencyDetectorCandidate(plan, candidate, [
      alternative('2026-only', 'ira-a'),
    ])
    expect(incomplete.status).toBe('blocked')
    if (incomplete.status === 'blocked') {
      expect(incomplete.issues.some((entry) => entry.detail.includes('target year 2027')))
        .toBe(true)
    }

    const outOfHorizon = adaptQcdEfficiencyDetectorCandidate(plan, candidate, [
      alternative('2026-option', 'ira-a'),
      alternative('2027-option', 'ira-b', {
        year: 2027,
        executionDate: '2027-08-01',
      }),
      alternative('2099-option', 'ira-a', {
        year: 2099,
        executionDate: '2099-08-01',
      }),
    ])
    expect(outOfHorizon.status).toBe('blocked')
    if (outOfHorizon.status === 'blocked') {
      expect(outOfHorizon.issues.map((entry) => entry.kind)).toContain('invalidAlternative')
    }
  })

  it.each([
    ['missing contribution history', (plan: Plan) => {
      plan.retirementActionEligibilityFacts!.deductibleIraContributions = []
    }, 'qcd-contribution-history-unknown'],
    ['missing source classification', (plan: Plan) => {
      plan.retirementActionEligibilityFacts!.iraClassifications = []
    }, 'qcd-sep-simple-activity-unknown'],
    ['unconfirmed charity', (_plan: Plan, option: QcdEfficiencyCandidateAlternative) => {
      option.intent.charity.directFromCustodianAttested = false
    }, 'qcd-direct-charity-unconfirmed'],
    ['invalid date', (_plan: Plan, option: QcdEfficiencyCandidateAlternative) => {
      option.intent.executionDate = '2026-02-30'
    }, 'qcd-date-invalid'],
  ])('fails closed for %s', (_label, mutate, code) => {
    const plan = eligiblePlan()
    const option = alternative('only', 'ira-a')
    mutate(plan, option)

    const result = adaptQcdEfficiencyDetectorCandidate(
      plan,
      exploratoryCandidate(plan),
      [option],
    )

    expect(result.status).toBe('blocked')
    expect(result.allocationEvidence.alternatives[0]?.reasonCodes).toContain(code)
  })

  it('uses Plan-bound SEP activity evidence and blocks an ongoing SEP without fallback', () => {
    const inactive = eligiblePlan()
    inactive.retirementActionEligibilityFacts!.iraClassifications[0] = {
      sourceAccountId: 'ira-b',
      subtype: 'sep',
      evidenceId: 'ira-b-sep-classification',
      provenance: { source: 'manual' },
    }
    inactive.retirementActionEligibilityFacts!.sepSimpleActivities = [{
      sourceAccountId: 'ira-b',
      actionTaxYear: 2026,
      planYearEndDate: '2026-12-31',
      employerContributionMadeForPlanYear: false,
      evidenceId: 'ira-b-sep-activity',
      provenance: { source: 'manual' },
    }]
    const accepted = adaptQcdEfficiencyDetectorCandidate(
      inactive,
      exploratoryCandidate(inactive),
      [alternative('inactive-sep', 'ira-b')],
    )
    expect(accepted.status).toBe('adapted')

    const ongoing = structuredClone(inactive)
    ongoing.retirementActionEligibilityFacts!.sepSimpleActivities[0]!
      .employerContributionMadeForPlanYear = true
    const blocked = adaptQcdEfficiencyDetectorCandidate(
      ongoing,
      exploratoryCandidate(ongoing),
      [alternative('ongoing-sep', 'ira-b')],
    )
    expect(blocked.status).toBe('blocked')
    expect(blocked.allocationEvidence.alternatives[0]?.reasonCodes)
      .toContain('qcd-ongoing-sep-simple')
  })

  it('rejects mixed aggregate QCDs, malformed alternatives, and occupied execution slots', () => {
    const aggregatePlan = eligiblePlan()
    aggregatePlan.strategies.qcdAnnual = 10
    const aggregate = adaptQcdEfficiencyDetectorCandidate(
      aggregatePlan,
      exploratoryCandidate(aggregatePlan),
      [alternative('only', 'ira-a')],
    )
    expect(aggregate.status).toBe('blocked')

    const plan = eligiblePlan()
    const candidate = exploratoryCandidate(plan)
    const forgedDisplay = adaptQcdEfficiencyDetectorCandidate(
      plan,
      { ...candidate, explanation: 'Trust me: this is a sourced QCD.' },
      [alternative('forged-display', 'ira-a')],
    )
    expect(forgedDisplay.status).toBe('blocked')

    const malformed = alternative('only', 'ira-a') as QcdEfficiencyCandidateAlternative & {
      unexpected?: boolean
    }
    malformed.unexpected = true
    const malformedResult = adaptQcdEfficiencyDetectorCandidate(plan, candidate, [malformed])
    expect(malformedResult.status).toBe('blocked')
    if (malformedResult.status === 'blocked') {
      expect(malformedResult.issues.map((entry) => entry.kind)).toContain('invalidAlternative')
    }

    const missingIntent = {
      alternativeId: 'missing-intent',
      runtimeFacts: {
        personAliveEvidenceId: 'alive-missing-intent',
        donorAlive: true,
        priorQcdOffsetEvidenceId: 'offset-missing-intent',
        priorQcdOffsetApplied: 0,
      },
    }
    expect(() => adaptQcdEfficiencyDetectorCandidate(
      plan,
      candidate,
      [missingIntent] as never,
    )).not.toThrow()
    expect(adaptQcdEfficiencyDetectorCandidate(
      plan,
      candidate,
      [missingIntent] as never,
    ).status).toBe('blocked')

    const hostileAlternative = new Proxy({}, {
      ownKeys: () => { throw new Error('hostile alternative') },
    })
    expect(adaptQcdEfficiencyDetectorCandidate(
      plan,
      candidate,
      [hostileAlternative] as never,
    ).status).toBe('blocked')
    expect(() => adaptQcdEfficiencyDetectorCandidate(
      plan,
      candidate,
      null as never,
    )).not.toThrow()
    expect(adaptQcdEfficiencyDetectorCandidate(
      plan,
      candidate,
      null as never,
    ).status).toBe('blocked')

    const duplicatedIdentity = adaptQcdEfficiencyDetectorCandidate(plan, candidate, [
      alternative('duplicate-a', 'ira-a'),
      alternative('duplicate-b', 'ira-a'),
    ])
    expect(duplicatedIdentity.status).toBe('blocked')
    if (duplicatedIdentity.status === 'blocked') {
      expect(duplicatedIdentity.issues.map((entry) => entry.kind)).toContain('ambiguousAlternative')
    }

    const repeatedEvidence = alternative('evidence-a', 'ira-a')
    const repeatedEvidenceSibling = alternative('evidence-b', 'ira-b')
    repeatedEvidenceSibling.runtimeFacts.personAliveEvidenceId =
      repeatedEvidence.runtimeFacts.personAliveEvidenceId
    const repeatedEvidenceResult = adaptQcdEfficiencyDetectorCandidate(plan, candidate, [
      repeatedEvidence,
      repeatedEvidenceSibling,
    ])
    expect(repeatedEvidenceResult.status).toBe('blocked')

    const first = adaptQcdEfficiencyDetectorCandidate(
      plan,
      candidate,
      [alternative('first', 'ira-a')],
    )
    expect(first.status).toBe('adapted')
    if (first.status !== 'adapted') return
    plan.strategies.retirementActions = [{
      ...first.requests[0]!,
      actionId: 'existing-action' as never,
      allocation: {
        ...first.requests[0]!.allocation,
        allocationId: 'existing-allocation' as never,
      },
    }]
    const conflict = adaptQcdEfficiencyDetectorCandidate(
      plan,
      exploratoryCandidate(plan),
      [alternative('conflict', 'ira-b')],
    )
    expect(conflict.status).toBe('blocked')
    if (conflict.status === 'blocked') {
      expect(conflict.issues.some((entry) => entry.detail.includes('already used'))).toBe(true)
    }
  })
})
