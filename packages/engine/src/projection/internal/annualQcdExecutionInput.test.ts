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

  it('omits an unprovable prior-offset fact instead of inventing zero', () => {
    const result = annualQcdExecutionInput(input({
      offsetHistoryUnprovableDonorIds: ['p1'],
    }))

    expect(result.status).toBe('ready')
    if (result.status !== 'ready') throw new Error('expected ready input')
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
})
