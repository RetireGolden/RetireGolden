/**
 * Hostile delegation proof for every annual retirement-action preflight output
 * channel that changes simulator control flow.
 *
 * Each seam mutation leaves the authored Plan unchanged and corrupts exactly
 * one coordinator-owned decision. The annual result must follow that hostile
 * output; a simulator that merely called the helper and rebuilt the decision
 * inline would retain the production result.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  AnnualRetirementActionPreflightInput,
  AnnualRetirementActionPreflightResult,
} from './internal/annualRetirementActionPreflight.js'

type PreflightMutation =
  | 'none'
  | 'dropOrdinaryExecution'
  | 'dropQcdExecution'
  | 'dropCollidingQcdFromOrdinary'
  | 'unblockMixedSchedule'
  | 'dropLinkedAssessmentRequests'
  | 'refuseLinkedGroups'

interface PreflightCall {
  readonly input: AnnualRetirementActionPreflightInput
  readonly original: Readonly<AnnualRetirementActionPreflightResult>
  readonly output: Readonly<AnnualRetirementActionPreflightResult>
}

const seam = vi.hoisted(() => ({
  mutation: 'none' as PreflightMutation,
  calls: [] as PreflightCall[],
}))

vi.mock('./internal/annualRetirementActionPreflight.js', async (importOriginal) => {
  const original = await importOriginal<
    typeof import('./internal/annualRetirementActionPreflight.js')
  >()
  return {
    ...original,
    annualRetirementActionPreflight: (
      input: AnnualRetirementActionPreflightInput,
    ): Readonly<AnnualRetirementActionPreflightResult> => {
      const production = original.annualRetirementActionPreflight(input)
      const output = (() => {
        switch (seam.mutation) {
          case 'dropOrdinaryExecution':
            return { ...production, ordinaryExecutionActions: Object.freeze([]) }
          case 'dropQcdExecution':
            return { ...production, qcdExecutionActions: Object.freeze([]) }
          case 'dropCollidingQcdFromOrdinary':
            return {
              ...production,
              ordinaryExecutionActions: Object.freeze(
                production.ordinaryExecutionActions.filter(
                  (request) => request.kind !== 'qcd',
                ),
              ),
            }
          case 'unblockMixedSchedule':
            return { ...production, mixedKindScheduleBlocked: false }
          case 'dropLinkedAssessmentRequests':
            return {
              ...production,
              linkedGroupAssessmentRequests: Object.freeze([]),
            }
          case 'refuseLinkedGroups':
            return {
              ...production,
              conversionLinkedWithdrawalGroups:
                production.observedConversionLinkedWithdrawalGroups,
            }
          case 'none':
            return production
        }
      })()
      seam.calls.push({ input, original: production, output })
      return output
    },
  }
})

import { asUsdCents, parseRetirementActionRequest } from '../actions/index.js'
import type { Account, Plan } from '../model/plan.js'
import {
  recurringOrdinaryIncome,
  singlePersonPlan,
  validatePlan,
} from '../testing/planFixtures.js'
import { createFlatTaxCalculator } from '../testing/flatTax.js'
import { simulatePlan } from './simulate.js'

const YEAR = 2026
const ORDINARY_ACTION_ID = 'delegated-ordinary-withdrawal'
const QCD_ACTION_ID = 'delegated-qcd'
const CONVERSION_ACTION_ID = 'delegated-funded-conversion'
const TAX_WITHDRAWAL_ACTION_ID = 'delegated-tax-withdrawal'

function request(input: Record<string, unknown>) {
  const parsed = parseRetirementActionRequest(input)
  if (!parsed.ok) throw new Error(parsed.issues.join('; '))
  return parsed.request
}

function cash(id: string, balance: number): Account {
  return {
    type: 'cash',
    id,
    name: id,
    ownerPersonId: 'p1',
    annualReturnPct: 0,
    balance,
    annualContribution: 0,
  }
}

function traditionalIra(id: string, balance: number): Account {
  return {
    type: 'traditional',
    id,
    name: id,
    ownerPersonId: 'p1',
    annualReturnPct: 0,
    kind: 'ira',
    balance,
    annualContribution: 0,
    nondeductibleBasis: 0,
  }
}

function rothIra(id: string): Account {
  return {
    type: 'roth',
    id,
    name: id,
    ownerPersonId: 'p1',
    annualReturnPct: 0,
    kind: 'ira',
    balance: 0,
    annualContribution: 0,
  }
}

function ordinaryPlan(): Plan {
  const target = singlePersonPlan({ planningAge: 60, dob: '1970-01-01' })
  target.id = 'retirement-action-preflight-ordinary-delegation'
  target.expenses.baseAnnual = 0
  target.accounts = [cash('cash', 1_000)]
  target.strategies.retirementActions = [request({
    actionId: ORDINARY_ACTION_ID,
    kind: 'ordinaryWithdrawal',
    personId: 'p1',
    year: YEAR,
    executionDate: `${YEAR}-06-01`,
    executionSequence: 1,
    requestedAmount: 10_000,
    allocations: [{
      allocationId: `${ORDINARY_ACTION_ID}-allocation`,
      sourceAccountId: 'cash',
      requestedAmount: 10_000,
    }],
    purpose: { kind: 'spending' },
    provenance: { source: 'manual' },
  })]
  return validatePlan(target)
}

function qcdPlan(withCollision = false): Plan {
  const target = singlePersonPlan({ planningAge: 95, dob: '1950-03-01' })
  target.id = `retirement-action-preflight-qcd-delegation-${withCollision}`
  target.expenses.baseAnnual = 0
  target.accounts = [cash('cash', 1_000), traditionalIra('ira', 500_000)]
  target.retirementActionEligibilityFacts = {
    iraClassifications: [{
      evidenceId: 'ira-classification',
      provenance: { source: 'manual' },
      sourceAccountId: 'ira',
      subtype: 'traditional',
    }],
    sepSimpleActivities: [],
    deductibleIraContributions: Array.from(
      { length: YEAR - 2020 + 1 },
      (_, index) => ({
        donorPersonId: 'p1',
        taxYear: 2020 + index,
        amountCents: asUsdCents(0),
        evidenceId: `deductible-contribution-${2020 + index}`,
        provenance: { source: 'manual' as const },
      }),
    ),
  }
  const executionDate = `${YEAR}-08-01`
  const executionSequence = 1
  const qcd = request({
    actionId: QCD_ACTION_ID,
    kind: 'qcd',
    year: YEAR,
    executionDate,
    executionSequence,
    requestedAmount: 20_000_00,
    provenance: { source: 'manual' },
    donorPersonId: 'p1',
    allocation: {
      allocationId: `${QCD_ACTION_ID}-allocation`,
      sourceAccountId: 'ira',
      requestedAmount: 20_000_00,
    },
    charity: {
      designationId: 'charity',
      name: 'Public charity',
      designationKind: 'eligiblePublicCharity',
      directFromCustodianAttested: true,
      eligibleOrganizationAttested: true,
      notDonorAdvisedFundOrSupportingOrganizationAttested: true,
      notSplitInterestEntityAttested: true,
      entireDistributionOtherwiseDeductibleAttested: true,
    },
  })
  target.strategies.retirementActions = withCollision
    ? [qcd, request({
        actionId: ORDINARY_ACTION_ID,
        kind: 'ordinaryWithdrawal',
        personId: 'p1',
        year: YEAR,
        executionDate,
        executionSequence,
        requestedAmount: 10_000,
        allocations: [{
          allocationId: `${ORDINARY_ACTION_ID}-allocation`,
          sourceAccountId: 'cash',
          requestedAmount: 10_000,
        }],
        purpose: { kind: 'spending' },
        provenance: { source: 'manual' },
      })]
    : [qcd]
  return validatePlan(target)
}

function mixedSchedulePlan(): Plan {
  const target = singlePersonPlan({ planningAge: 60, dob: '1970-01-01' })
  target.id = 'retirement-action-preflight-mixed-delegation'
  target.expenses.baseAnnual = 0
  target.accounts = [
    cash('cash', 1_000_000),
    traditionalIra('ira', 100_000),
    rothIra('roth'),
  ]
  target.retirementActionEligibilityFacts = {
    iraClassifications: [{
      evidenceId: 'ira-classification',
      provenance: { source: 'manual' },
      sourceAccountId: 'ira',
      subtype: 'traditional',
    }],
    sepSimpleActivities: [],
    deductibleIraContributions: [],
  }
  const executionDate = `${YEAR}-06-15`
  const executionSequence = 1
  target.strategies.retirementActions = [
    request({
      actionId: ORDINARY_ACTION_ID,
      kind: 'ordinaryWithdrawal',
      personId: 'p1',
      year: YEAR,
      executionDate,
      executionSequence,
      requestedAmount: 10_000,
      allocations: [{
        allocationId: `${ORDINARY_ACTION_ID}-allocation`,
        sourceAccountId: 'cash',
        requestedAmount: 10_000,
      }],
      purpose: { kind: 'spending' },
      provenance: { source: 'manual' },
    }),
    request({
      actionId: CONVERSION_ACTION_ID,
      kind: 'rothConversion',
      personId: 'p1',
      year: YEAR,
      executionDate,
      executionSequence,
      requestedAmount: 50_000,
      allocations: [{
        allocationId: `${CONVERSION_ACTION_ID}-allocation`,
        sourceAccountId: 'ira',
        requestedAmount: 50_000,
      }],
      destinationRothAccountId: 'roth',
      taxFunding: { kind: 'noneExpected' },
      provenance: { source: 'manual' },
    }),
  ]
  return validatePlan(target)
}

function linkedGroupPlan(): Plan {
  const target = singlePersonPlan({ planningAge: 60, dob: '1970-01-01' })
  target.id = 'retirement-action-preflight-linked-delegation'
  target.accounts = [
    cash('cash', 1_000_000),
    traditionalIra('ira', 400_000),
    rothIra('roth'),
  ]
  target.incomes = [recurringOrdinaryIncome('pension', 90_000)]
  target.expenses.baseAnnual = 50_000
  target.retirementActionEligibilityFacts = {
    iraClassifications: [{
      evidenceId: 'ira-classification',
      provenance: { source: 'manual' },
      sourceAccountId: 'ira',
      subtype: 'traditional',
    }],
    sepSimpleActivities: [],
    deductibleIraContributions: [],
  }
  target.strategies.retirementActions = [
    request({
      actionId: TAX_WITHDRAWAL_ACTION_ID,
      kind: 'ordinaryWithdrawal',
      personId: 'p1',
      year: YEAR,
      executionDate: `${YEAR}-06-14`,
      executionSequence: 1,
      requestedAmount: 8_800_00,
      allocations: [{
        allocationId: `${TAX_WITHDRAWAL_ACTION_ID}-allocation`,
        sourceAccountId: 'cash',
        requestedAmount: 8_800_00,
      }],
      purpose: { kind: 'taxPayment', referenceId: CONVERSION_ACTION_ID },
      provenance: { source: 'manual' },
    }),
    request({
      actionId: CONVERSION_ACTION_ID,
      kind: 'rothConversion',
      personId: 'p1',
      year: YEAR,
      executionDate: `${YEAR}-06-15`,
      executionSequence: 2,
      requestedAmount: 40_000_00,
      allocations: [{
        allocationId: `${CONVERSION_ACTION_ID}-allocation`,
        sourceAccountId: 'ira',
        requestedAmount: 40_000_00,
      }],
      destinationRothAccountId: 'roth',
      taxFunding: {
        kind: 'linkedWithdrawal',
        withdrawalActionId: TAX_WITHDRAWAL_ACTION_ID,
      },
      provenance: { source: 'manual' },
    }),
  ]
  return validatePlan(target)
}

function run(plan: Plan, mutation: PreflightMutation, flatRatePct = 0) {
  seam.mutation = mutation
  seam.calls.length = 0
  return simulatePlan(plan, {
    startYear: YEAR,
    horizonEndYear: YEAR,
    taxCalculator: createFlatTaxCalculator(flatRatePct),
  }).years[0]!
}

beforeEach(() => {
  seam.mutation = 'none'
  seam.calls.length = 0
})

describe('simulatePlan annual retirement-action preflight delegation', () => {
  it('consumes the ordinary execution route as the action movement authority', () => {
    const production = run(ordinaryPlan(), 'none')
    expect(production.retirementActionExecution?.committed).toBe(true)
    expect(production.withdrawals.cash).toBe(100)
    expect(seam.calls.every((call) =>
      Object.isFrozen(call.input) &&
      Object.isFrozen(call.input.retirementActions) &&
      Object.isFrozen(call.input.balances) &&
      call.input.balances.every(Object.isFrozen)
    )).toBe(true)
    expect(seam.calls.some((call) =>
      call.original.ordinaryExecutionActions.some(
        (candidate) => candidate.actionId === ORDINARY_ACTION_ID,
      ))).toBe(true)

    const delegated = run(ordinaryPlan(), 'dropOrdinaryExecution')
    expect(seam.calls.every(
      (call) => call.output.ordinaryExecutionActions.length === 0,
    )).toBe(true)
    expect(delegated.retirementActionExecution).toBeUndefined()
    expect(delegated.withdrawals.cash).toBe(0)
  })

  it('consumes the QCD execution route instead of rebuilding the named gift', () => {
    const production = run(qcdPlan(), 'none')
    expect(production.qcd).toBe(20_000)
    expect(production.qcdActionPrerequisites?.map((entry) => entry.actionId))
      .toContain(QCD_ACTION_ID)

    const delegated = run(qcdPlan(), 'dropQcdExecution')
    expect(seam.calls.every((call) =>
      call.output.qcdExecutionActions.length === 0)).toBe(true)
    expect(delegated.qcd).toBe(0)
    expect(delegated.qcdActionPrerequisites).toBeUndefined()
  })

  it('consumes cross-executor QCD collision routing from the ordinary batch', () => {
    const production = run(qcdPlan(true), 'none')
    expect(seam.calls.some((call) =>
      call.original.qcdExecutionActions.length === 0 &&
      call.original.ordinaryExecutionActions.some(
        (candidate) => candidate.kind === 'qcd',
      ))).toBe(true)
    expect(production.withdrawals.cash).toBe(0)

    const delegated = run(qcdPlan(true), 'dropCollidingQcdFromOrdinary')
    expect(seam.calls.every((call) =>
      call.output.ordinaryExecutionActions.every(
        (candidate) => candidate.kind !== 'qcd',
      ))).toBe(true)
    expect(delegated.withdrawals.cash).toBe(100)
  })

  it('consumes the mixed-kind block before invoking the conversion executor', () => {
    const production = run(mixedSchedulePlan(), 'none')
    expect(seam.calls.some((call) =>
      call.original.mixedKindScheduleBlocked)).toBe(true)
    expect(production.rothConversionActionExecution).toBeUndefined()

    expect(() => run(mixedSchedulePlan(), 'unblockMixedSchedule'))
      .toThrow('Duplicate annual retirement-action request')
    expect(seam.calls.every((call) =>
      !call.output.mixedKindScheduleBlocked)).toBe(true)
  })

  it('uses the linked-group request union during settlement', () => {
    const production = run(linkedGroupPlan(), 'none', 22)
    expect(production.conversionLinkedWithdrawalGroupExecution).toMatchObject({
      status: 'executed',
      movement: 'bothLegs',
    })
    expect(seam.calls.some((call) =>
      call.original.linkedGroupAssessmentRequests.length > 0)).toBe(true)

    const delegated = run(linkedGroupPlan(), 'dropLinkedAssessmentRequests', 22)
    expect(seam.calls.every((call) =>
      call.output.linkedGroupAssessmentRequests.length === 0)).toBe(true)
    expect(delegated.conversionLinkedWithdrawalGroupExecution).not.toMatchObject({
      status: 'executed',
      movement: 'bothLegs',
    })
  })

  it('uses the shared linked-group assessment as both executors authority', () => {
    const production = run(linkedGroupPlan(), 'none', 22)
    expect(production.conversionLinkedWithdrawalGroupExecution).toMatchObject({
      status: 'executed',
      movement: 'bothLegs',
    })
    expect(seam.calls.some((call) =>
      call.original.observedConversionLinkedWithdrawalGroups.groups.length > 0 &&
      call.original.conversionLinkedWithdrawalGroups.groups.some(
        (group) => group.disposition === 'executedAsAtomicGroup',
      ))).toBe(true)

    const delegated = run(linkedGroupPlan(), 'refuseLinkedGroups', 22)
    expect(seam.calls.every((call) =>
      call.output.conversionLinkedWithdrawalGroups ===
        call.original.observedConversionLinkedWithdrawalGroups)).toBe(true)
    expect(delegated.conversionLinkedWithdrawalGroupExecution).toMatchObject({
      status: 'refused',
      movement: 'none',
    })
  })
})
