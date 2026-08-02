import { describe, expect, it } from 'vitest'

import type { Plan } from '../model/plan.js'
import { singlePersonPlan, traditionalAccount } from '../testing/planFixtures.js'
import type {
  RetirementActionEligibilityRuntimeEvidence,
} from '../strategies/accountEligibility.js'
import type { QualifiedCharitableDistributionRequest } from './contract.js'
import {
  asAccountId,
  asActionId,
  asAllocationId,
  asPersonId,
} from './identity.js'
import { asPositiveUsdCents, asUsdCents } from './money.js'
import {
  evaluateAnnualQcdExecutionPrerequisites,
} from './annualQcdExecutionPrerequisite.js'
import { publishAnnualRetirementActions } from './annualRetirementActionPublication.js'

const charity = {
  designationId: 'charity-a',
  name: 'Public charity',
  designationKind: 'eligiblePublicCharity' as const,
  directFromCustodianAttested: true,
  eligibleOrganizationAttested: true,
  notDonorAdvisedFundOrSupportingOrganizationAttested: true,
  notSplitInterestEntityAttested: true,
  entireDistributionOtherwiseDeductibleAttested: true,
}

function planFixture(): Plan {
  const plan = singlePersonPlan({ dob: '1955-01-31', planningAge: 90 })
  plan.accounts = [traditionalAccount('ira-a', 100_000)]
  plan.retirementActionEligibilityFacts = {
    iraClassifications: [{
      sourceAccountId: 'ira-a',
      subtype: 'traditional',
      evidenceId: 'ira-a-classification',
      provenance: { source: 'manual' },
    }],
    sepSimpleActivities: [],
    deductibleIraContributions: [
      {
        donorPersonId: 'p1',
        taxYear: 2025,
        amountCents: asUsdCents(0),
        evidenceId: 'p1-contribution-2025',
        provenance: { source: 'manual', sourceId: 'ledger-2025' },
      },
      {
        donorPersonId: 'p1',
        taxYear: 2026,
        amountCents: asUsdCents(0),
        evidenceId: 'p1-contribution-2026',
        provenance: { source: 'import', sourceId: 'custodian-2026' },
      },
    ],
  }
  return plan
}

function request(
  actionId = 'qcd-a',
  overrides: Partial<QualifiedCharitableDistributionRequest> = {},
): QualifiedCharitableDistributionRequest {
  const amount = asPositiveUsdCents(25_000)
  return {
    actionId: asActionId(actionId),
    kind: 'qcd',
    year: 2026,
    executionDate: '2026-08-01',
    executionSequence: 1,
    requestedAmount: amount,
    provenance: { source: 'manual' },
    donorPersonId: asPersonId('p1'),
    allocation: {
      allocationId: asAllocationId(`allocation-${actionId}`),
      sourceAccountId: asAccountId('ira-a'),
      requestedAmount: amount,
    },
    charity: { ...charity },
    ...overrides,
  }
}

function runtimeEvidence(
  requests: readonly QualifiedCharitableDistributionRequest[],
): RetirementActionEligibilityRuntimeEvidence {
  return {
    personAliveEvidence: requests.map((entry) => ({
      evidenceId: `alive-${entry.actionId}`,
      actionId: entry.actionId,
      personId: entry.donorPersonId,
      actionYear: entry.year,
      actionDate: entry.executionDate ?? null,
      alive: true,
    })),
    priorQcdOffsetEvidence: requests.map((entry) => ({
      evidenceId: `offset-${entry.actionId}`,
      actionId: entry.actionId,
      donorPersonId: entry.donorPersonId,
      actionYear: entry.year,
      actionDate: entry.executionDate ?? null,
      priorOffsetApplied: asUsdCents(0),
    })),
  }
}

describe('evaluateAnnualQcdExecutionPrerequisites', () => {
  it('publishes accepted identity/legal snapshots only as zero-movement qcdExecutor records', () => {
    const plan = planFixture()
    const action = request()
    const input = {
      taxYear: 2026,
      plan,
      requests: [action],
      runtimeEvidence: runtimeEvidence([action]),
    }
    const snapshot = structuredClone(input)

    const result = evaluateAnnualQcdExecutionPrerequisites(input)

    expect(result.status).toBe('evaluated')
    if (result.status !== 'evaluated') return
    expect(result).toEqual(evaluateAnnualQcdExecutionPrerequisites(input))
    expect(input).toEqual(snapshot)
    expect(result.committed).toBe(false)
    expect(result.publicationSource).toMatchObject({
      executorSource: 'qcdExecutor',
      scheduleDiagnostics: [],
      records: [{
        actionId: 'qcd-a',
        kind: 'qcd',
        personId: 'p1',
        requestedAmount: 25_000,
        executedAmount: 0,
        unexecutedAmount: 25_000,
        readiness: 'nonActionable',
        outcome: 'unsupported',
        executedDate: null,
        executedSequence: null,
        allocations: [{
          allocationId: 'allocation-qcd-a',
          sourceAccountId: 'ira-a',
          resolution: 'resolved',
          requestedAmount: 25_000,
          executedAmount: 0,
          unexecutedAmount: 25_000,
        }],
      }],
    })
    expect(result.publicationSource.records[0]?.reasons.map((entry) => entry.code))
      .toEqual([
        'qcd-nonqcd-deduction-unsupported',
        'qcd-rmd-evidence-missing',
        'qcd-tax-year-limit-unsupported',
      ])
    expect(result.evidence[0]?.eligibility).toMatchObject({
      decision: { status: 'accepted', reasons: [] },
      donor: {
        donorPersonId: 'p1',
        resolution: 'resolved',
        birthDate: '1955-01-31',
        age70HalfThresholdDate: '2025-07-31',
        aliveEvidence: { evidenceId: 'alive-qcd-a', alive: true },
      },
      schedule: {
        taxYear: 2026,
        scheduledDate: '2026-08-01',
        parsedScheduledDate: '2026-08-01',
        dateInActionYear: true,
        age70HalfThresholdDate: '2025-07-31',
        reachedAge70HalfOnScheduledDate: true,
      },
      source: {
        allocationId: 'allocation-qcd-a',
        sourceAccountId: 'ira-a',
        resolution: 'resolved',
        ownerPersonId: 'p1',
        accountType: 'traditional',
        retirementAccountKind: 'ira',
        inheritance: 'owned',
        iraEligibilityFact: {
          sourceAccountId: 'ira-a',
          subtype: 'traditional',
          qcdActivity: { kind: 'notApplicable' },
        },
      },
      charity,
      contributionHistory: {
        donorPersonId: 'p1',
        taxYears: [
          { taxYear: 2025, deductibleContributionAmount: 0 },
          { taxYear: 2026, deductibleContributionAmount: 0 },
        ],
        priorOffsetApplied: 0,
      },
      priorQcdOffsetEvidence: {
        evidenceId: 'offset-qcd-a',
        actionId: 'qcd-a',
        donorPersonId: 'p1',
        actionYear: 2026,
        actionDate: '2026-08-01',
        priorOffsetApplied: 0,
      },
      deductibleContributionEvidence: [
        {
          donorPersonId: 'p1',
          taxYear: 2025,
          amountCents: 0,
          evidenceId: 'p1-contribution-2025',
          provenance: { source: 'manual', sourceId: 'ledger-2025' },
        },
        {
          donorPersonId: 'p1',
          taxYear: 2026,
          amountCents: 0,
          evidenceId: 'p1-contribution-2026',
          provenance: { source: 'import', sourceId: 'custodian-2026' },
        },
      ],
    })
    expect(result.evidence[0]?.missingAnnualStages).toEqual({
      physicalSettlement: 'notEstablished',
      personalIndexedLimit: 'notEstablished',
      deductibleContributionOffset: 'notEstablished',
      otherwiseTaxablePoolAndBasis: 'notEstablished',
      rmdCoordination: 'notEstablished',
      charitableDeductionTreatment: 'notEstablished',
      exclusionAndTaxCharacter: 'notEstablished',
    })
    expect(result).not.toHaveProperty('balances')
    expect(result.evidence[0]).not.toHaveProperty('rmdSatisfiedAmount')
    expect(result.evidence[0]).not.toHaveProperty('excludableQcdAmount')
    expect(Object.isFrozen(result)).toBe(true)
    expect(Object.isFrozen(result.evidence[0]?.eligibility.charity)).toBe(true)
    const publication = publishAnnualRetirementActions({
      taxYear: 2026,
      requests: result.requests,
      sources: [result.publicationSource],
    })
    expect(publication).toMatchObject({
      taxYear: 2026,
      executorSources: ['qcdExecutor'],
      records: [{
        actionId: 'qcd-a',
        executorSource: 'qcdExecutor',
        outcome: 'unsupported',
        readiness: 'nonActionable',
        executedAmount: 0,
      }],
    })
  })

  it('retains refused and unsupported eligibility facts without inventing movement or derived treatment', () => {
    const plan = planFixture()
    plan.accounts = [traditionalAccount('ira-a', 100_000, 'other-person')]
    const action = request('qcd-refused', {
      executionDate: '2024-02-30',
      charity: {
        ...charity,
        designationKind: 'unknown',
        directFromCustodianAttested: false,
      },
    })

    const result = evaluateAnnualQcdExecutionPrerequisites({
      taxYear: 2026,
      plan,
      requests: [action],
      runtimeEvidence: runtimeEvidence([action]),
    })

    expect(result.status).toBe('evaluated')
    if (result.status !== 'evaluated') return
    expect(result.evidence[0]?.eligibility.decision.status).toBe('unsupported')
    expect(result.evidence[0]?.eligibility.schedule).toMatchObject({
      scheduledDate: '2024-02-30',
      parsedScheduledDate: null,
      dateInActionYear: null,
      reachedAge70HalfOnScheduledDate: null,
    })
    expect(result.evidence[0]?.eligibility.charity).toMatchObject({
      designationKind: 'unknown',
      directFromCustodianAttested: false,
    })
    const reasonCodes = result.publicationSource.records[0]?.reasons.map(
      (entry) => entry.code,
    )
    expect(reasonCodes).toEqual(expect.arrayContaining([
      'qcd-date-invalid',
      'qcd-source-owner-mismatch',
      'qcd-direct-charity-unconfirmed',
      'qcd-tax-year-limit-unsupported',
      'qcd-rmd-evidence-missing',
      'qcd-nonqcd-deduction-unsupported',
    ]))
    expect(result.publicationSource.records[0]).toMatchObject({
      outcome: 'unsupported',
      readiness: 'nonActionable',
      executedAmount: 0,
      unexecutedAmount: 25_000,
      executedDate: null,
    })
  })

  it('is invariant to Plan, request, and runtime-evidence array order', () => {
    const first = request('qcd-a', { executionSequence: 2 })
    const second = request('qcd-b', {
      executionDate: '2026-09-01',
      executionSequence: 1,
    })
    const plan = planFixture()
    plan.accounts.push(traditionalAccount('other-ira', 50_000))
    const runtime = runtimeEvidence([first, second])
    const permutedPlan: Plan = {
      ...plan,
      household: {
        ...plan.household,
        people: [...plan.household.people].reverse(),
      },
      accounts: [...plan.accounts].reverse(),
    }

    const forward = evaluateAnnualQcdExecutionPrerequisites({
      taxYear: 2026,
      plan,
      requests: [first, second],
      runtimeEvidence: runtime,
    })
    const reversed = evaluateAnnualQcdExecutionPrerequisites({
      taxYear: 2026,
      plan: permutedPlan,
      requests: [second, first],
      runtimeEvidence: {
        personAliveEvidence: [...(runtime.personAliveEvidence ?? [])].reverse(),
        priorQcdOffsetEvidence: [...(runtime.priorQcdOffsetEvidence ?? [])].reverse(),
      },
    })

    expect(reversed).toEqual(forward)
    expect(forward.status).toBe('evaluated')
    if (forward.status === 'evaluated') {
      expect(forward.requests.map((entry) => entry.actionId)).toEqual(['qcd-a', 'qcd-b'])
    }
  })

  it('preserves distinct durable contribution evidence identity and provenance', () => {
    const plan = planFixture()
    for (const contribution of
      plan.retirementActionEligibilityFacts!.deductibleIraContributions) {
      contribution.amountCents = asUsdCents(100)
    }
    const action = request()

    const result = evaluateAnnualQcdExecutionPrerequisites({
      taxYear: 2026,
      plan,
      requests: [action],
      runtimeEvidence: runtimeEvidence([action]),
    })

    expect(result.status).toBe('evaluated')
    if (result.status !== 'evaluated') return
    expect(result.evidence[0]?.eligibility.deductibleContributionEvidence)
      .toEqual([
        expect.objectContaining({
          evidenceId: 'p1-contribution-2025',
          amountCents: 100,
          provenance: { source: 'manual', sourceId: 'ledger-2025' },
        }),
        expect.objectContaining({
          evidenceId: 'p1-contribution-2026',
          amountCents: 100,
          provenance: { source: 'import', sourceId: 'custodian-2026' },
        }),
      ])
    expect(result.evidence[0]?.eligibility.priorQcdOffsetEvidence?.evidenceId)
      .toBe('offset-qcd-a')
  })

  it.each([
    'same-action cross-role',
    'cross-action same-role',
    'sibling cross-role',
    'runtime-to-durable',
  ] as const)('blocks %s evidence-ID reuse batch-wide', (scenario) => {
    const first = request('qcd-a')
    const second = request('qcd-b', {
      executionDate: '2026-09-01',
    })
    const base = runtimeEvidence([first, second])
    const alive = [...(base.personAliveEvidence ?? [])].map((entry) => ({
      ...entry,
    }))
    const offsets = [...(base.priorQcdOffsetEvidence ?? [])].map((entry) => ({
      ...entry,
    }))
    if (scenario === 'same-action cross-role') {
      alive[0]!.evidenceId = 'reused-evidence'
      offsets[0]!.evidenceId = 'reused-evidence'
    } else if (scenario === 'cross-action same-role') {
      alive[0]!.evidenceId = 'reused-evidence'
      alive[1]!.evidenceId = 'reused-evidence'
    } else if (scenario === 'sibling cross-role') {
      alive[0]!.evidenceId = 'reused-evidence'
      offsets[1]!.evidenceId = 'reused-evidence'
    } else {
      alive[0]!.evidenceId = 'p1-contribution-2025'
    }

    const result = evaluateAnnualQcdExecutionPrerequisites({
      taxYear: 2026,
      plan: planFixture(),
      requests: [first, second],
      runtimeEvidence: {
        personAliveEvidence: alive,
        priorQcdOffsetEvidence: offsets,
      },
    })

    expect(result).toMatchObject({
      status: 'blocked',
      committed: false,
      requests: [],
      evidence: [],
      publicationSource: null,
      issues: [{ kind: 'evidenceIdReused' }],
    })
  })

  it.each(['IRA classification', 'SEP activity'] as const)(
    'blocks runtime evidence IDs reused by relevant %s evidence',
    (durableRole) => {
      const action = request()
      const plan = planFixture()
      let durableEvidenceId = 'ira-a-classification'
      const secretSourceId = `private-${durableRole}`
      if (durableRole === 'SEP activity') {
        durableEvidenceId = 'ira-a-sep-activity'
        plan.retirementActionEligibilityFacts!.iraClassifications = [{
          sourceAccountId: 'ira-a', subtype: 'sep',
          evidenceId: 'ira-a-sep-classification',
          provenance: { source: 'manual' },
        }]
        plan.retirementActionEligibilityFacts!.sepSimpleActivities = [{
          sourceAccountId: 'ira-a', actionTaxYear: 2026,
          planYearEndDate: '2026-12-31',
          employerContributionMadeForPlanYear: false,
          evidenceId: durableEvidenceId,
          provenance: { source: 'import', sourceId: secretSourceId },
        }]
      } else {
        plan.retirementActionEligibilityFacts!.iraClassifications[0]!.provenance = {
          source: 'import', sourceId: secretSourceId,
        }
      }
      const runtime = runtimeEvidence([action])
      runtime.personAliveEvidence![0]!.evidenceId = durableEvidenceId

      const result = evaluateAnnualQcdExecutionPrerequisites({
        taxYear: 2026, plan, requests: [action], runtimeEvidence: runtime,
      })
      expect(result).toMatchObject({
        status: 'blocked',
        issues: [{ kind: 'evidenceIdReused' }],
      })
      expect(JSON.stringify(result)).not.toContain(secretSourceId)
    },
  )

  it.each(['unrequested source', 'different activity year'] as const)(
    'does not claim evidence from an %s',
    (irrelevantBinding) => {
      const action = request()
      const plan = planFixture()
      const runtime = runtimeEvidence([action])
      const reusedId = runtime.personAliveEvidence![0]!.evidenceId
      if (irrelevantBinding === 'unrequested source') {
        plan.retirementActionEligibilityFacts!.iraClassifications.push({
          sourceAccountId: 'ira-unused', subtype: 'traditional',
          evidenceId: reusedId, provenance: { source: 'manual' },
        })
      } else {
        plan.retirementActionEligibilityFacts!.sepSimpleActivities.push({
          sourceAccountId: 'ira-a', actionTaxYear: 2025,
          planYearEndDate: '2025-12-31',
          employerContributionMadeForPlanYear: false,
          evidenceId: reusedId, provenance: { source: 'manual' },
        })
      }

      expect(evaluateAnnualQcdExecutionPrerequisites({
        taxYear: 2026, plan, requests: [action], runtimeEvidence: runtime,
      }).status).toBe('evaluated')
    },
  )

  it('adds deterministic schedule diagnostics without replacing unsupported prerequisites', () => {
    const first = request('qcd-a')
    const second = request('qcd-b')
    const plan = planFixture()

    const result = evaluateAnnualQcdExecutionPrerequisites({
      taxYear: 2026,
      plan,
      requests: [second, first],
      runtimeEvidence: runtimeEvidence([first, second]),
    })

    expect(result.status).toBe('evaluated')
    if (result.status !== 'evaluated') return
    expect(result.publicationSource.scheduleDiagnostics).toEqual([
      {
        kind: 'executionSequenceConflict',
        actionId: 'qcd-a',
        year: 2026,
        scheduledDate: '2026-08-01',
        executionSequence: 1,
        collidingActionIds: ['qcd-a', 'qcd-b'],
        reason: expect.objectContaining({ code: 'action-sequence-conflict' }),
      },
      {
        kind: 'executionSequenceConflict',
        actionId: 'qcd-b',
        year: 2026,
        scheduledDate: '2026-08-01',
        executionSequence: 1,
        collidingActionIds: ['qcd-a', 'qcd-b'],
        reason: expect.objectContaining({ code: 'action-sequence-conflict' }),
      },
    ])
    for (const record of result.publicationSource.records) {
      expect(record).toMatchObject({
        outcome: 'unsupported',
        readiness: 'nonActionable',
        executedAmount: 0,
        unexecutedAmount: 25_000,
        allocations: [{
          resolution: 'resolved',
          executedAmount: 0,
          unexecutedAmount: 25_000,
        }],
      })
      expect(record.reasons.map((entry) => entry.code)).toEqual([
        'qcd-nonqcd-deduction-unsupported',
        'qcd-rmd-evidence-missing',
        'qcd-tax-year-limit-unsupported',
        'action-sequence-conflict',
      ])
    }
    expect(result.evidence[0]?.eligibility.decision.status).toBe('accepted')
    expect(result.evidence[0]?.missingAnnualStages.physicalSettlement)
      .toBe('notEstablished')
    const publication = publishAnnualRetirementActions({
      taxYear: 2026,
      requests: result.requests,
      sources: [result.publicationSource],
    })
    expect(publication?.scheduleDiagnostics).toHaveLength(2)
    expect(publication?.records).toEqual(expect.arrayContaining([
      expect.objectContaining({
        executorSource: 'qcdExecutor',
        outcome: 'unsupported',
        allocations: [expect.objectContaining({ resolution: 'resolved' })],
        reasons: expect.arrayContaining([
          expect.objectContaining({ code: 'qcd-rmd-evidence-missing' }),
          expect.objectContaining({ code: 'action-sequence-conflict' }),
        ]),
      }),
    ]))
  })

  it('publishes canonical batch fallbacks for records outside a colliding slot', () => {
    const first = request('qcd-a')
    const second = request('qcd-b')
    const unaffected = request('qcd-c', { executionDate: '2026-09-01' })
    const result = evaluateAnnualQcdExecutionPrerequisites({
      taxYear: 2026,
      plan: planFixture(),
      requests: [unaffected, second, first],
      runtimeEvidence: runtimeEvidence([first, second, unaffected]),
    })

    expect(result.status).toBe('evaluated')
    if (result.status !== 'evaluated') return
    expect(result.publicationSource.records.find((record) =>
      record.actionId === 'qcd-c')).toMatchObject({
      outcome: 'refused',
      allocations: [{ resolution: 'unresolved' }],
      reasons: [{ code: 'action-batch-schedule-conflict' }],
    })
    expect(() => publishAnnualRetirementActions({
      taxYear: 2026,
      requests: result.requests,
      sources: [result.publicationSource],
    })).not.toThrow()
  })

  it.each(['missing', 'ambiguous'] as const)(
    'omits resolved-source annual reasons when the QCD source is %s',
    (sourceState) => {
      const action = request()
      const plan = planFixture()
      plan.accounts = sourceState === 'missing'
        ? []
        : [plan.accounts[0]!, structuredClone(plan.accounts[0]!)]
      const result = evaluateAnnualQcdExecutionPrerequisites({
        taxYear: 2026,
        plan,
        requests: [action],
        runtimeEvidence: runtimeEvidence([action]),
      })

      expect(result.status).toBe('evaluated')
      if (result.status !== 'evaluated') return
      expect(result.publicationSource.records[0]).toMatchObject({
        allocations: [{ resolution: 'unresolved' }],
      })
      expect(result.publicationSource.records[0]?.reasons.map((reason) => reason.code))
        .not.toContain('qcd-rmd-evidence-missing')
      expect(() => publishAnnualRetirementActions({
        taxYear: 2026,
        requests: result.requests,
        sources: [result.publicationSource],
      })).not.toThrow()
    },
  )

  it.each([
    'inherited source',
    'active SEP',
    'invalid charity',
  ] as const)(
    'preserves %s eligibility reasons and resolved source truth during a collision',
    (scenario) => {
      const first = request('qcd-a')
      const second = request('qcd-b')
      const plan = planFixture()
      let expectedReason = 'qcd-inherited-basis-unsupported'
      if (scenario === 'inherited source') {
        const inherited = traditionalAccount('ira-a', 100_000)
        if (inherited.type !== 'traditional') throw new Error('fixture mismatch')
        inherited.inherited = {
          ownerDeathYear: 2020,
          decedentHadStartedRmds: false,
        }
        plan.accounts = [inherited]
      } else if (scenario === 'active SEP') {
        expectedReason = 'qcd-ongoing-sep-simple'
        plan.retirementActionEligibilityFacts!.iraClassifications = [{
          sourceAccountId: 'ira-a',
          subtype: 'sep',
          evidenceId: 'ira-a-sep-classification',
          provenance: { source: 'manual' },
        }]
        plan.retirementActionEligibilityFacts!.sepSimpleActivities = [{
          sourceAccountId: 'ira-a',
          actionTaxYear: 2026,
          planYearEndDate: '2026-12-31',
          employerContributionMadeForPlanYear: true,
          evidenceId: 'ira-a-sep-activity',
          provenance: { source: 'import', sourceId: 'sep-return-2026' },
        }]
      } else {
        expectedReason = 'qcd-direct-charity-unconfirmed'
        const invalidCharity = {
          ...charity,
          designationKind: 'unknown' as const,
          directFromCustodianAttested: false,
        }
        Object.assign(first, { charity: invalidCharity })
        Object.assign(second, { charity: { ...invalidCharity } })
      }

      const result = evaluateAnnualQcdExecutionPrerequisites({
        taxYear: 2026,
        plan,
        requests: [second, first],
        runtimeEvidence: runtimeEvidence([first, second]),
      })

      expect(result.status).toBe('evaluated')
      if (result.status !== 'evaluated') return
      for (const record of result.publicationSource.records) {
        expect(record).toMatchObject({
          outcome: 'unsupported',
          readiness: 'nonActionable',
          executedAmount: 0,
          allocations: [{ resolution: 'resolved', executedAmount: 0 }],
        })
        expect(record.reasons.map((reason) => reason.code)).toEqual(
          expect.arrayContaining([
            expectedReason,
            'qcd-tax-year-limit-unsupported',
            'action-sequence-conflict',
          ]),
        )
      }
    },
  )

  it('blocks malformed annual batches without publishing partial evidence', () => {
    const action = request()
    const plan = planFixture()
    const invalidYear = evaluateAnnualQcdExecutionPrerequisites({
      taxYear: 0,
      plan,
      requests: [action],
    })
    const duplicate = evaluateAnnualQcdExecutionPrerequisites({
      taxYear: 2026,
      plan,
      requests: [action, structuredClone(action)],
    })
    const wrongYear = evaluateAnnualQcdExecutionPrerequisites({
      taxYear: 2025,
      plan,
      requests: [action],
    })
    const malformed = evaluateAnnualQcdExecutionPrerequisites({
      taxYear: 2026,
      plan,
      requests: [{ ...action, requestedAmount: 1.5 } as never],
    })

    expect(invalidYear).toMatchObject({
      status: 'blocked',
      publicationSource: null,
      evidence: [],
      issues: [{ kind: 'invalidInput' }],
    })
    expect(duplicate).toMatchObject({
      status: 'blocked',
      publicationSource: null,
      evidence: [],
      issues: [{ kind: 'duplicateActionId', actionId: 'qcd-a' }],
    })
    expect(wrongYear).toMatchObject({
      status: 'blocked',
      publicationSource: null,
      evidence: [],
      issues: [{ kind: 'actionYearMismatch', actionId: 'qcd-a' }],
    })
    expect(malformed).toMatchObject({
      status: 'blocked',
      publicationSource: null,
      evidence: [],
      issues: [{ kind: 'invalidInput' }],
    })
  })

  it('fails closed when inputs cannot be losslessly snapshotted', () => {
    const plan = planFixture()
    Object.defineProperty(plan, 'accounts', {
      enumerable: true,
      get: () => {
        throw new Error('must not execute')
      },
    })

    const result = evaluateAnnualQcdExecutionPrerequisites({
      taxYear: 2026,
      plan,
      requests: [request()],
    })

    expect(result).toMatchObject({
      status: 'blocked',
      committed: false,
      publicationSource: null,
      evidence: [],
      issues: [{ kind: 'invalidInput' }],
    })
  })
})
