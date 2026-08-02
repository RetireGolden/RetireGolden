import { describe, expect, it } from 'vitest'

import { parsePlan, type Plan } from '../model/plan.js'
import { couplePlan, singlePersonPlan, traditionalAccount } from '../testing/planFixtures.js'
import type { RetirementActionEligibilityRuntimeEvidence } from '../strategies/accountEligibility.js'
import type { QualifiedCharitableDistributionRequest } from './contract.js'
import type { AccountOpeningBalanceSnapshot } from './execution.js'
import { asAccountId, asActionId, asAllocationId, asPersonId } from './identity.js'
import { asPositiveUsdCents, asUsdCents } from './money.js'
import { deriveActionStructuralId } from './structuralId.js'
import {
  evaluateAnnualQcdExecutionPrerequisites,
  type AnnualQcdExecutionPrerequisitesEvaluated,
} from './annualQcdExecutionPrerequisite.js'
import {
  stageAnnualQcdPhysicalExecution,
  type AnnualQcdPhysicalExecutionIssue,
  type AnnualQcdRmdPoolOpeningSnapshot,
  type StageAnnualQcdPhysicalExecutionInput,
} from './annualQcdPhysicalExecution.js'

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
    deductibleIraContributions: [2025, 2026].map((taxYear) => ({
      donorPersonId: 'p1',
      taxYear,
      amountCents: asUsdCents(0),
      evidenceId: `p1-contribution-${taxYear}`,
      provenance: { source: 'manual' as const, sourceId: `ledger-${taxYear}` },
    })),
  }
  return plan
}

function request(
  actionId = 'qcd-a',
  amount = 25_000,
  overrides: Partial<QualifiedCharitableDistributionRequest> = {},
): QualifiedCharitableDistributionRequest {
  const requestedAmount = asPositiveUsdCents(amount)
  return {
    actionId: asActionId(actionId),
    kind: 'qcd',
    year: 2026,
    executionDate: '2026-08-01',
    executionSequence: 1,
    requestedAmount,
    provenance: { source: 'manual' },
    donorPersonId: asPersonId('p1'),
    allocation: {
      allocationId: asAllocationId(`allocation-${actionId}`),
      sourceAccountId: asAccountId('ira-a'),
      requestedAmount,
    },
    charity: { ...charity },
    ...overrides,
  }
}

function runtimeEvidence(
  requests: readonly QualifiedCharitableDistributionRequest[],
  suffix = '',
): RetirementActionEligibilityRuntimeEvidence {
  return {
    personAliveEvidence: requests.map((entry) => ({
      evidenceId: `alive-${entry.actionId}${suffix}`,
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

function prerequisite(
  requests: readonly QualifiedCharitableDistributionRequest[],
  plan: Plan,
  runtime: RetirementActionEligibilityRuntimeEvidence,
): AnnualQcdExecutionPrerequisitesEvaluated {
  const result = evaluateAnnualQcdExecutionPrerequisites({
    taxYear: 2026,
    plan, requests, runtimeEvidence: runtime,
  })
  if (result.status !== 'evaluated') throw new Error('Fixture prerequisite was blocked')
  return result
}

function balance(amount = 50_000): AccountOpeningBalanceSnapshot {
  return { accountId: asAccountId('ira-a'), openingBalance: asUsdCents(amount) }
}

function pool(
  overrides: Partial<AnnualQcdRmdPoolOpeningSnapshot> = {},
): AnnualQcdRmdPoolOpeningSnapshot {
  return {
    predicate: 'annualQcdOwnedIraRmdPoolOpeningSnapshot',
    poolId: 'p1-owned-ira-2026',
    taxYear: 2026,
    donorPersonId: asPersonId('p1'),
    scope: 'ownedIra',
    sourceAccountIds: [asAccountId('ira-a')],
    rmdRequiredAmount: asUsdCents(10_000),
    rmdSatisfiedBefore: asUsdCents(2_000),
    rmdRemainingBefore: asUsdCents(8_000),
    upstreamEvidenceId: 'rmd-upstream-evidence',
    ...overrides,
  }
}

function input(
  requests: readonly QualifiedCharitableDistributionRequest[] = [request()],
  openingBalances: readonly AccountOpeningBalanceSnapshot[] = [balance()],
  rmdPools: readonly AnnualQcdRmdPoolOpeningSnapshot[] = [pool()],
  runtimeOverride?: RetirementActionEligibilityRuntimeEvidence,
  planOverride: Plan = planFixture(),
): StageAnnualQcdPhysicalExecutionInput {
  const parsedPlan = parsePlan(planOverride)
  if (!parsedPlan.ok) throw new Error('Fixture Plan was invalid')
  const plan = parsedPlan.plan
  const runtime = runtimeOverride ?? runtimeEvidence(requests)
  return {
    prerequisite: prerequisite(requests, plan, runtime),
    plan, runtimeEvidence: runtime, openingBalances, rmdPools,
  }
}

function expectBlocked(
  result: ReturnType<typeof stageAnnualQcdPhysicalExecution>,
  kind: AnnualQcdPhysicalExecutionIssue['kind'],
): void {
  expect(result).toMatchObject({
    status: 'annualQcdPhysicalExecutionBlocked',
    applications: [], detachedBalances: [], rmdPools: [], issues: [{ kind }],
  })
}

function reverseObjectKeyOrder(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(reverseObjectKeyOrder)
  if (value === null || typeof value !== 'object') return value
  return Object.fromEntries(
    Object.entries(value).reverse().map(([key, entry]) => [
      key,
      reverseObjectKeyOrder(entry),
    ]),
  )
}

describe('stageAnnualQcdPhysicalExecution', () => {
  it('stages a full detached source debit and copied charity without committing', () => {
    const value = input()
    const snapshot = structuredClone(value)

    const result = stageAnnualQcdPhysicalExecution(value)

    expect(result).toEqual(stageAnnualQcdPhysicalExecution(value))
    expect(value).toEqual(snapshot)
    expect(result).toMatchObject({
      status: 'annualQcdPhysicalExecutionStaged',
      committed: false,
      movement: 'notCommitted',
      taxCharacterStatus: 'awaitingAnnualQcdPostPass',
      taxYear: 2026,
      issues: [],
      detachedBalances: [{ accountId: 'ira-a', openingBalance: 50_000, detachedClosingBalance: 25_000 }],
      applications: [{
        request: { actionId: 'qcd-a', charity },
        executedAmount: 25_000,
        unexecutedAmount: 0,
        charitableDistributionAmount: 25_000,
        stagingDisposition: 'full',
        physicalReason: null,
      }],
    })
    expect(Object.isFrozen(result)).toBe(true)
    expect(Object.isFrozen(result.applications[0]?.request.charity)).toBe(true)
    const rebound = stageAnnualQcdPhysicalExecution(input(
      [request()],
      [balance()],
      [pool({ upstreamEvidenceId: 'different-upstream-evidence' })],
    ))
    expect(rebound.applications[0]?.stagingEvidenceId)
      .not.toBe(result.applications[0]?.stagingEvidenceId)
    const proofRebound = stageAnnualQcdPhysicalExecution(input(
      [request()], [balance()], [pool()], runtimeEvidence([request()], '-rebound'),
    ))
    expect(proofRebound.applications[0]?.prerequisiteEvidenceId)
      .not.toBe(result.applications[0]?.prerequisiteEvidenceId)
    expect(proofRebound.applications[0]?.stagingEvidenceId)
      .not.toBe(result.applications[0]?.stagingEvidenceId)
  })

  it('refuses to stage an evaluated action whose physical or legal eligibility was not accepted', () => {
    const ineligible = request('qcd-ineligible', 25_000, {
      charity: {
        ...charity,
        eligibleOrganizationAttested: false,
      },
    })

    const result = stageAnnualQcdPhysicalExecution(input([ineligible]))

    expectBlocked(result, 'prerequisiteInvalid')
    expect(result.taxYear).toBe(2026)
  })

  it('accepts an exact prerequisite independently of serialized object-key order', () => {
    const value = input()
    const reordered = {
      ...value,
      prerequisite: reverseObjectKeyOrder(value.prerequisite) as
        AnnualQcdExecutionPrerequisitesEvaluated,
    }

    expect(stageAnnualQcdPhysicalExecution(reordered).status)
      .toBe('annualQcdPhysicalExecutionStaged')
  })

  it('trims physical movement to the exact available source balance', () => {
    const result = stageAnnualQcdPhysicalExecution(input([request()], [balance(9_000)]))

    expect(result).toMatchObject({
      status: 'annualQcdPhysicalExecutionStaged',
      detachedBalances: [{ detachedClosingBalance: 0 }],
      applications: [{
        sourceBalanceBefore: 9_000,
        executedAmount: 9_000,
        unexecutedAmount: 16_000,
        sourceBalanceAfter: 0,
        stagingDisposition: 'partial',
        physicalReason: { code: 'qcd-balance-trimmed', outcome: 'partial' },
      }],
    })
  })

  it('stages zero movement and preserves RMD remaining when the source is empty', () => {
    const result = stageAnnualQcdPhysicalExecution(input([request()], [balance(0)]))

    expect(result).toMatchObject({
      status: 'annualQcdPhysicalExecutionStaged',
      rmdPools: [{ rmdSatisfiedAfter: 2_000, rmdRemainingAfter: 8_000 }],
      applications: [{
        executedAmount: 0,
        unexecutedAmount: 25_000,
        stagingDisposition: 'zero',
        physicalReason: { code: 'qcd-balance-unavailable', outcome: 'refused' },
        rmdSatisfiedByAction: 0,
      }],
    })
    expect(result.applications[0]).not.toHaveProperty('executionDate')
    expect(result.applications[0]).not.toHaveProperty('executionSequence')
  })

  it('caps RMD satisfaction at the exact opening RMD remaining', () => {
    const result = stageAnnualQcdPhysicalExecution(input())
    const smallerExecution = stageAnnualQcdPhysicalExecution(input(
      [request()],
      [balance(5_000)],
    ))

    expect(result).toMatchObject({
      status: 'annualQcdPhysicalExecutionStaged',
      rmdPools: [{
        predicate: 'annualQcdOwnedIraRmdPoolStagedTransition',
        rmdSatisfiedAfter: 10_000,
        rmdRemainingAfter: 0,
      }],
      applications: [{
        rmdRemainingBefore: 8_000,
        rmdSatisfiedByAction: 8_000,
        rmdRemainingAfter: 0,
      }],
    })
    expect(smallerExecution.rmdPools[0]?.openingEvidenceId)
      .toBe(result.rmdPools[0]?.openingEvidenceId)
    expect(smallerExecution.rmdPools[0]?.evidenceId)
      .not.toBe(result.rmdPools[0]?.evidenceId)
  })

  it('still stages the distribution when no RMD remains', () => {
    const noRmd = pool({
      rmdRequiredAmount: asUsdCents(10_000),
      rmdSatisfiedBefore: asUsdCents(10_000),
      rmdRemainingBefore: asUsdCents(0),
    })
    const result = stageAnnualQcdPhysicalExecution(input([request()], [balance()], [noRmd]))

    expect(result).toMatchObject({
      status: 'annualQcdPhysicalExecutionStaged',
      detachedBalances: [{ detachedClosingBalance: 25_000 }],
      applications: [{ executedAmount: 25_000, rmdSatisfiedByAction: 0 }],
      rmdPools: [{ rmdSatisfiedAfter: 10_000, rmdRemainingAfter: 0 }],
    })
  })

  it('applies actions in canonical chronology against sequential balance and RMD state', () => {
    const later = request('qcd-later', 7_000, { executionDate: '2026-09-01' })
    const earlier = request('qcd-earlier', 6_000, { executionDate: '2026-07-01' })
    const result = stageAnnualQcdPhysicalExecution(input(
      [later, earlier],
      [balance(10_000)],
      [pool({ rmdRequiredAmount: asUsdCents(9_000), rmdSatisfiedBefore: asUsdCents(0), rmdRemainingBefore: asUsdCents(9_000) })],
    ))

    expect(result).toMatchObject({
      status: 'annualQcdPhysicalExecutionStaged',
      detachedBalances: [{ detachedClosingBalance: 0 }],
      applications: [
        { request: { actionId: 'qcd-earlier' }, sourceBalanceBefore: 10_000, executedAmount: 6_000, rmdRemainingAfter: 3_000 },
        { request: { actionId: 'qcd-later' }, sourceBalanceBefore: 4_000, executedAmount: 4_000, rmdSatisfiedByAction: 3_000, rmdRemainingAfter: 0 },
      ],
      rmdPools: [{ rmdSatisfiedAfter: 9_000, rmdRemainingAfter: 0 }],
    })
  })

  it('is invariant to detached snapshot ordering and preserves unrelated balances', () => {
    const extra = { accountId: asAccountId('cash-z'), openingBalance: asUsdCents(123) }
    const value = input([request()], [extra, balance()], [pool()])
    const reverse = { ...value, openingBalances: [...value.openingBalances].reverse() }

    const left = stageAnnualQcdPhysicalExecution(value)
    const right = stageAnnualQcdPhysicalExecution(reverse)

    expect(left).toEqual(right)
    expect(left).toMatchObject({
      status: 'annualQcdPhysicalExecutionStaged',
      detachedBalances: [
        { accountId: 'cash-z', openingBalance: 123, detachedClosingBalance: 123 },
        { accountId: 'ira-a', openingBalance: 50_000, detachedClosingBalance: 25_000 },
      ],
    })
  })

  it("does not accept a non-Plan account inside the donor's complete RMD pool", () => {
    const mixed = pool({
      sourceAccountIds: [asAccountId('ira-a'), asAccountId('ira-spouse')],
    })
    const result = stageAnnualQcdPhysicalExecution(input([request()], [balance()], [mixed]))
    expectBlocked(result, 'rmdEvidenceInvalid')
  })

  it('rejects a valid RMD pool that is unrelated to every request in the batch', () => {
    const plan = couplePlan({
      p1Dob: '1955-01-31',
      p2Dob: '1955-02-01',
      p1PlanningAge: 90,
      p2PlanningAge: 90,
    })
    plan.accounts = [
      traditionalAccount('ira-a', 100_000, 'p1'),
      traditionalAccount('ira-p2', 100_000, 'p2'),
    ]
    plan.retirementActionEligibilityFacts = {
      iraClassifications: [
        {
          sourceAccountId: 'ira-a',
          subtype: 'traditional',
          evidenceId: 'ira-a-classification',
          provenance: { source: 'manual' },
        },
        {
          sourceAccountId: 'ira-p2',
          subtype: 'traditional',
          evidenceId: 'ira-p2-classification',
          provenance: { source: 'manual' },
        },
      ],
      sepSimpleActivities: [],
      deductibleIraContributions: [2025, 2026].map((taxYear) => ({
        donorPersonId: 'p1',
        taxYear,
        amountCents: asUsdCents(0),
        evidenceId: `p1-contribution-${taxYear}`,
        provenance: { source: 'manual' as const, sourceId: `ledger-${taxYear}` },
      })),
    }
    const unrelated = pool({
      poolId: 'p2-owned-ira-2026',
      donorPersonId: asPersonId('p2'),
      sourceAccountIds: [asAccountId('ira-p2')],
      upstreamEvidenceId: 'p2-rmd-upstream',
    })

    const result = stageAnnualQcdPhysicalExecution(input(
      [request()],
      [balance()],
      [pool(), unrelated],
      undefined,
      plan,
    ))

    expectBlocked(result, 'rmdEvidenceInvalid')
  })

  it('reserves every RMD-pool source account against pool and evidence identities', () => {
    const plan = planFixture()
    plan.accounts.push(traditionalAccount('ira-sibling', 40_000))
    plan.retirementActionEligibilityFacts!.iraClassifications.push({
      sourceAccountId: 'ira-sibling',
      subtype: 'traditional',
      evidenceId: 'ira-sibling-classification',
      provenance: { source: 'manual' },
    })
    const collidingPool = pool({
      sourceAccountIds: [asAccountId('ira-a'), asAccountId('ira-sibling')],
      upstreamEvidenceId: 'ira-sibling',
    })

    const result = stageAnnualQcdPhysicalExecution(input(
      [request()],
      [balance()],
      [collidingPool],
      undefined,
      plan,
    ))

    expectBlocked(result, 'rmdEvidenceInvalid')
  })

  it('reserves unrelated authoritative Plan entity IDs against RMD evidence', () => {
    const plan = planFixture()
    const collidingPool = pool({ upstreamEvidenceId: plan.id })

    const result = stageAnnualQcdPhysicalExecution(input(
      [request()],
      [balance()],
      [collidingPool],
      undefined,
      plan,
    ))

    expectBlocked(result, 'rmdEvidenceInvalid')
  })

  it('rejects a Plan identity that collides with derived prerequisite evidence', () => {
    const baseline = input()
    const derivedPrerequisiteId = deriveActionStructuralId(
      'annual-qcd-execution-prerequisite',
      [baseline.prerequisite.evidence[0]!],
    )
    const plan = planFixture()
    plan.id = derivedPrerequisiteId as typeof plan.id

    const result = stageAnnualQcdPhysicalExecution(input(
      [request()],
      [balance()],
      [pool()],
      undefined,
      plan,
    ))

    expectBlocked(result, 'prerequisiteInvalid')
  })

  it('blocks malformed RMD arithmetic and missing upstream identity atomically', () => {
    const badEquation = pool({ rmdRemainingBefore: asUsdCents(7_999) })
    const missingUpstream = pool({ upstreamEvidenceId: ' ' })

    for (const invalidPool of [badEquation, missingUpstream]) {
      expectBlocked(
        stageAnnualQcdPhysicalExecution(input([request()], [balance()], [invalidPool])),
        'rmdEvidenceInvalid',
      )
      expect(stageAnnualQcdPhysicalExecution(input([request()], [balance()], [invalidPool])).taxYear)
        .toBe(2026)
    }
  })

  it('rejects an RMD identity collision with prerequisite evidence', () => {
    const result = stageAnnualQcdPhysicalExecution(input(
      [request()],
      [balance()],
      [pool({ upstreamEvidenceId: 'alive-qcd-a' })],
    ))

    expectBlocked(result, 'rmdEvidenceInvalid')
    expect(result.taxYear).toBe(2026)
  })

  it('does not republish unknown fields from an untrusted RMD snapshot', () => {
    const untrustedPool = {
      ...pool(),
      injected: { authority: 'attacker-controlled' },
    }
    const result = stageAnnualQcdPhysicalExecution(input(
      [request()],
      [balance()],
      [untrustedPool],
    ))

    expect(result.status).toBe('annualQcdPhysicalExecutionStaged')
    expect(result.rmdPools[0]).not.toHaveProperty('injected')
  })

  it('blocks missing or duplicate opening balances atomically', () => {
    const duplicate = [balance(), balance(40_000)]

    for (const openingBalances of [[], duplicate]) {
      expectBlocked(
        stageAnnualQcdPhysicalExecution(input([request()], openingBalances)),
        'openingBalanceInvalid',
      )
    }
  })

  it('blocks a same-slot annual schedule collision before any physical staging', () => {
    const first = request('qcd-first')
    const second = request('qcd-second')
    const result = stageAnnualQcdPhysicalExecution(input([first, second]))

    expectBlocked(result, 'scheduleBlocked')
    const empty = structuredClone(input()) as unknown as {
      prerequisite: { requests: unknown[]; evidence: unknown[]; publicationSource: { records: unknown[] } }
    }
    empty.prerequisite.requests = []
    empty.prerequisite.evidence = []
    empty.prerequisite.publicationSource.records = []
    expectBlocked(stageAnnualQcdPhysicalExecution(empty as never), 'prerequisiteInvalid')
  })

  it('rejects relabeled prerequisite facts and hostile non-cent snapshots', () => {
    const valid = input()
    const tampered = structuredClone(valid) as unknown as {
      prerequisite: { evidence: Array<{ eligibility: { source: { sourceAccountId: string } } }> }
    }
    tampered.prerequisite.evidence[0]!.eligibility.source.sourceAccountId = 'ira-spouse'
    const hostile = structuredClone(valid) as unknown as {
      openingBalances: Array<{ accountId: string; openingBalance: bigint }>
    }
    hostile.openingBalances[0]!.openingBalance = 1n

    expect(stageAnnualQcdPhysicalExecution(tampered as never))
      .toMatchObject({ status: 'annualQcdPhysicalExecutionBlocked', issues: [{ kind: 'prerequisiteInvalid' }] })
    expect(stageAnnualQcdPhysicalExecution(hostile as never))
      .toMatchObject({ status: 'annualQcdPhysicalExecutionBlocked', issues: [{ kind: 'hostileInput' }] })
  })
})
