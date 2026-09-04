import { describe, expect, it } from 'vitest'

import {
  asAccountId,
  asActionId,
  asAllocationId,
  asPersonId,
  asPositiveUsdCents,
  asUsdCents,
  type QualifiedCharitableDistributionRequest,
} from '../../actions/index.js'
import type { Account, Plan } from '../../model/plan.js'
import {
  cashAccount,
  singlePersonPlan,
  traditionalAccount,
  validatePlan,
} from '../../testing/planFixtures.js'
import {
  annualQcdExecutionInput,
  type AnnualQcdExecutionInput,
} from './annualQcdExecutionInput.js'

const YEAR = 2026
const PERSON_ID = asPersonId('p1')
const SOURCE_ID = asAccountId('ira-b')
const GIFT_CENTS = asPositiveUsdCents(2_000_000)

function qcd(): QualifiedCharitableDistributionRequest {
  return {
    actionId: asActionId('qcd-action'),
    kind: 'qcd',
    year: YEAR,
    executionDate: `${YEAR}-08-01`,
    executionSequence: 1,
    requestedAmount: GIFT_CENTS,
    provenance: { source: 'manual' },
    donorPersonId: PERSON_ID,
    allocation: {
      allocationId: asAllocationId('qcd-allocation'),
      sourceAccountId: SOURCE_ID,
      requestedAmount: GIFT_CENTS,
    },
    charity: {
      designationId: 'charity',
      name: 'Eligible public charity',
      designationKind: 'eligiblePublicCharity',
      directFromCustodianAttested: true,
      eligibleOrganizationAttested: true,
      notDonorAdvisedFundOrSupportingOrganizationAttested: true,
      notSplitInterestEntityAttested: true,
      entireDistributionOtherwiseDeductibleAttested: true,
    },
  }
}

function ira(id: string, balance: number): Account {
  const account = traditionalAccount(id, balance, 'p1', 'ira')
  if (account.type !== 'traditional') throw new Error('expected IRA')
  return { ...account, annualReturnPct: 0 }
}

function donorPlan(requests = [qcd()]): Plan {
  const plan = singlePersonPlan({ dob: '1950-03-01', planningAge: 95 })
  plan.id = 'annual-qcd-execution-input'
  plan.accounts = [
    cashAccount('cash', 10_000),
    ira('ira-a', 300_000),
    ira('ira-b', 200_000),
  ]
  plan.strategies.retirementActions = requests
  plan.retirementActionEligibilityFacts = {
    iraClassifications: [{
      sourceAccountId: 'ira-b',
      subtype: 'traditional',
      evidenceId: 'classification-ira-b',
      provenance: { source: 'manual' },
    }],
    sepSimpleActivities: [],
    deductibleIraContributions: Array.from(
      { length: YEAR - 2020 + 1 },
      (_, index) => ({
        donorPersonId: 'p1',
        taxYear: 2020 + index,
        amountCents: asUsdCents(index === 0 ? 10_000 : 0),
        evidenceId: `contribution-${2020 + index}`,
        provenance: { source: 'manual' as const },
      }),
    ),
  }
  return validatePlan(plan)
}

function input(
  overrides: Partial<AnnualQcdExecutionInput> = {},
): AnnualQcdExecutionInput {
  const plan = donorPlan()
  return {
    taxYear: YEAR,
    plan,
    primaryPersonId: 'p1',
    requests: [qcd()],
    people: [{ personId: 'p1', dob: '1950-03-01', alive: true }],
    balances: [
      {
        accountId: 'cash',
        ownerPersonId: 'p1',
        isAggregatedIra: false,
        balancePlanDollars: 10_000,
        preDistributionBalancePlanDollars: 0,
      },
      {
        accountId: 'ira-b',
        ownerPersonId: 'p1',
        isAggregatedIra: true,
        balancePlanDollars: 19_999.999,
        preDistributionBalancePlanDollars: 200_000,
      },
      {
        accountId: 'ira-a',
        ownerPersonId: 'p1',
        isAggregatedIra: true,
        balancePlanDollars: 300_000,
        preDistributionBalancePlanDollars: 300_000,
      },
    ],
    ownerRmd: [{
      ownerPersonId: 'p1',
      requiredPlanDollars: 20_000,
      unsatisfiedPlanDollars: 5_000,
    }],
    ownerBasis: [{ ownerPersonId: 'p1', basisPlanDollars: 10_000 }],
    priorOffsets: [{ donorPersonId: 'p1', consumedAmountCents: 3_000 }],
    offsetHistoryUnprovableDonorIds: [],
    ...overrides,
  }
}

describe('annualQcdExecutionInput', () => {
  it('builds the executor input from floored capacity and complete owner pools', () => {
    // Independent worksheet, not production output:
    // - spending capacity: floor($19,999.999 × 100) = 1,999,999 cents;
    // - staged gift: min(2,000,000 requested, 1,999,999 capacity);
    // - Form 8606 year-end pool: $300,000 + $200,000 - $19,999.99
    //   = $480,000.01 = 48,000,001 cents.
    // The capacity floor prevents the executor from drawing a rounded-up cent;
    // the complete pool is the Form 8606 denominator described in
    // DOCS/domain/domain-rules-reference/06-rmds-secure-20.md.
    const result = annualQcdExecutionInput(input())

    expect(result.status).toBe('ready')
    if (result.status !== 'ready') throw new Error('expected ready input')
    expect(result.executorInput.physicalInput.openingBalances).toEqual([{
      accountId: 'ira-b',
      openingBalance: 1_999_999,
    }])
    expect(result.executorInput.physicalInput.rmdPools).toEqual([expect.objectContaining({
      donorPersonId: 'p1',
      sourceAccountIds: ['ira-a', 'ira-b'],
      rmdRequiredAmount: 2_000_000,
      rmdSatisfiedBefore: 1_500_000,
      rmdRemainingBefore: 500_000,
    })])
    expect(
      result.executorInput.physicalInput.runtimeEvidence.priorQcdOffsetEvidence,
    ).toEqual([expect.objectContaining({ priorOffsetApplied: 3_000 })])

    const pool = result.executorInput.poolCapacityInputs[0]
    expect(pool?.annualFacts.openingBasisAmount).toBe(1_000_000)
    expect(pool?.completePoolEvidence.accountIds).toEqual(['ira-a', 'ira-b'])
    expect(pool?.completePoolEvidence.yearEndApplicablePoolBalanceAmount)
      .toBe(48_000_001)
    expect(pool?.poolMembers.map((member) => [
      member.sourceAccountId,
      member.yearEndApplicableBalanceAmount,
    ])).toEqual([
      ['ira-a', 30_000_000],
      ['ira-b', 18_000_001],
    ])
  })

  it('starts the section 219 sweep in the 846-month threshold year', () => {
    // IRC 408(d)(8)(A)'s second sentence counts section 219 deductions for
    // taxable years ending on or after age 70½. Born 1950-12-31 reaches 70½
    // on 2021-06-30, so the fixture's sole positive 2020 deduction is outside
    // the sweep. Using 840 months (age 70) would incorrectly apply 3,000 cents.
    // See rule records irc-408-d-8-A-post-70-half-deduction-offset and
    // irc-408-d-8-B-ii-age-70-half. The latter registers the exact leap-day /
    // month-end convention as unsettled; this annual filter consumes only the
    // resulting threshold year, while the exact-date prerequisite suite owns
    // the day-level contrary-reading tests.
    const result = annualQcdExecutionInput(input({
      people: [{ personId: 'p1', dob: '1950-12-31', alive: true }],
    }))

    expect(result.status).toBe('ready')
    if (result.status !== 'ready') throw new Error('expected ready input')
    expect(
      result.executorInput.physicalInput.runtimeEvidence
        .priorQcdOffsetEvidence,
    ).toEqual([expect.objectContaining({ priorOffsetApplied: 0 })])
  })

  it('omits an unprovable prior-offset fact instead of inventing zero', () => {
    // Notice 2020-68 reads the IRC 408(d)(8)(A) reduction as a lifetime
    // running total. A positive post-70½ section 219 total with unprovable
    // prior consumption therefore has no honest zero fact to publish; omission
    // lets the prerequisite refuse qcd-contribution-history-unknown.
    const result = annualQcdExecutionInput(input({
      offsetHistoryUnprovableDonorIds: ['p1'],
    }))

    expect(result.status).toBe('ready')
    if (result.status !== 'ready') throw new Error('expected ready input')
    expect(
      result.executorInput.physicalInput.runtimeEvidence.priorQcdOffsetEvidence,
    ).toEqual([])
  })

  it('fails missing donor runtime facts closed', () => {
    const result = annualQcdExecutionInput(input({ people: [] }))

    expect(result.status).toBe('ready')
    if (result.status !== 'ready') throw new Error('expected ready input')
    expect(
      result.executorInput.physicalInput.runtimeEvidence.personAliveEvidence,
    ).toEqual([expect.objectContaining({ alive: false })])
    expect(
      result.executorInput.physicalInput.runtimeEvidence.priorQcdOffsetEvidence,
    ).toEqual([])
  })

  it('returns no executor input when the annual pass has no named QCD', () => {
    const plan = donorPlan([])
    const result = annualQcdExecutionInput(input({ plan, requests: [] }))

    expect(result).toEqual({
      status: 'notRequested',
      prerequisite: undefined,
      executorInput: null,
    })
  })

  it('forwards a blocked prerequisite without constructing executor input', () => {
    const result = annualQcdExecutionInput(input({ taxYear: 0 }))

    expect(result.status).toBe('blocked')
    expect(result.executorInput).toBeNull()
    expect(result.prerequisite?.issues[0]?.kind).toBe('invalidInput')
  })

  it('publishes frozen result, executor, evidence, and pool envelopes', () => {
    const result = annualQcdExecutionInput(input())

    expect(Object.isFrozen(result)).toBe(true)
    if (result.status !== 'ready') throw new Error('expected ready input')
    expect(Object.isFrozen(result.executorInput)).toBe(true)
    expect(Object.isFrozen(result.executorInput.physicalInput)).toBe(true)
    expect(Object.isFrozen(
      result.executorInput.physicalInput.runtimeEvidence.personAliveEvidence,
    )).toBe(true)
    expect(Object.isFrozen(result.executorInput.poolCapacityInputs)).toBe(true)
    expect(Object.isFrozen(result.executorInput.poolCapacityInputs[0])).toBe(true)
  })

  // Every ID this module publishes is a `deriveActionStructuralId` digest, not
  // an interpolated `JSON.stringify` payload. The digests are written out
  // rather than recomputed here: these strings cross the module boundary into
  // the executor and are re-embedded by downstream evidence, so a change to
  // the minter or to any part list has to fail in this file. Two identities
  // repeat by construction — the per-action pair shares
  // ['qcd-action', 'p1', 2026, '2026-08-01'] and the five per-owner IDs share
  // ['annual-qcd-execution-input', 'p1', 2026] — so the prefix, not the
  // digest, is what separates them.
  it('mints every published identity with the hardened structural minter', () => {
    const ACTION_DIGEST =
      '0b2342c8fa2d6964b204a3f32edeb3bce43f3473ce9341317553ef5681b3f4aa'
    const OWNER_DIGEST =
      'e8be33278183f929a9f1b8d721a088072cb794089f43d001abdce8c10ca96fd9'
    const IRA_A_DIGEST =
      'b23ea66123c712a97349d69f822ee7bc66d5c3c3cd5da1d18b0bbb9fa239e3fc'
    const IRA_B_DIGEST =
      'b020baa28d73376c3c397dd00f018cecf083fceb190bff6251e343a9884faf21'

    const result = annualQcdExecutionInput(input())
    if (result.status !== 'ready') throw new Error('expected ready input')
    const physical = result.executorInput.physicalInput
    const pool = result.executorInput.poolCapacityInputs[0]
    if (pool === undefined) throw new Error('expected an owner pool')

    expect(physical.runtimeEvidence.personAliveEvidence?.[0]?.evidenceId)
      .toBe(`projection-alive:${ACTION_DIGEST}`)
    expect(physical.runtimeEvidence.priorQcdOffsetEvidence?.[0]?.evidenceId)
      .toBe(`projection-prior-qcd-offset:${ACTION_DIGEST}`)
    expect(physical.rmdPools[0]?.poolId)
      .toBe(`projection-owned-ira-rmd-pool:${OWNER_DIGEST}`)
    expect(physical.rmdPools[0]?.upstreamEvidenceId)
      .toBe(`projection-owner-ira-rmd-satisfaction:${OWNER_DIGEST}`)
    expect(pool.ownerWideNonRothIraPoolId)
      .toBe(`projection-owned-ira-pool:${OWNER_DIGEST}`)
    expect(pool.completePoolEvidence.evidenceId)
      .toBe(`projection-owned-ira-pool-evidence:${OWNER_DIGEST}`)
    expect(pool.annualBasisRecordEvidenceId)
      .toBe(`projection-owned-ira-annual-basis:${OWNER_DIGEST}`)
    expect(pool.poolMembers.map((member) => [
      member.iraClassificationEvidenceId,
      member.accountOwnershipEvidenceId,
    ])).toEqual([
      [
        `projection-owned-ira-classification:${IRA_A_DIGEST}`,
        `projection-owned-ira-ownership:${IRA_A_DIGEST}`,
      ],
      [
        `projection-owned-ira-classification:${IRA_B_DIGEST}`,
        `projection-owned-ira-ownership:${IRA_B_DIGEST}`,
      ],
    ])

    // The per-account identity moves with the account and the per-owner
    // identity moves with the plan: neither is a constant.
    expect(IRA_A_DIGEST).not.toBe(IRA_B_DIGEST)
    const otherPlan = annualQcdExecutionInput(input({
      plan: { ...donorPlan(), id: 'another-plan' },
    }))
    if (otherPlan.status !== 'ready') throw new Error('expected ready input')
    expect(otherPlan.executorInput.poolCapacityInputs[0]
      ?.ownerWideNonRothIraPoolId)
      .not.toBe(`projection-owned-ira-pool:${OWNER_DIGEST}`)
  })
})
