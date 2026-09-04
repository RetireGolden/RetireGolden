/**
 * Hostile delegation proof for named Roth-conversion input preparation.
 *
 * Each mutation changes one coordinator-owned output channel without changing
 * the Plan. The annual ledger must follow the hostile output rather than
 * rebuilding opening capacity or eligibility evidence inline.
 *
 * Scaffolding and the policy behind it live in
 * `simulate.seamGuard.test-support.ts`; the sentinels stay here.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  AnnualRothConversionExecutionInput,
  AnnualRothConversionExecutionInputResult,
} from './internal/annualRothConversionExecutionInput.js'
import type {
  AnnualRetirementActionSettlementPublicationInput,
} from './internal/annualRetirementActionSettlementPublication.js'

type InputMutation =
  | 'none'
  | 'withholdExecution'
  | 'zeroSource'
  | 'dropRmd'
  | 'revokeLinkedGroup'

const hostile = vi.hoisted(() => ({
  mutation: 'none' as InputMutation,
  settlementCalls: [] as AnnualRetirementActionSettlementPublicationInput[],
}))

const seam = await vi.hoisted(
  async () =>
    (
      await import('./simulate.seamGuard.test-support.js')
    ).createSeamRecorder<
      Readonly<AnnualRothConversionExecutionInput>,
      Readonly<AnnualRothConversionExecutionInputResult>
    >(),
)

vi.mock(
  './internal/annualRothConversionExecutionInput.js',
  async (importOriginal) =>
    seam.through(
      await importOriginal<
        typeof import('./internal/annualRothConversionExecutionInput.js')
      >(),
      'annualRothConversionExecutionInput',
      (
        production,
        { input },
      ): Readonly<AnnualRothConversionExecutionInputResult> => {
        if (production.status !== 'ready') return production
        switch (hostile.mutation) {
          case 'withholdExecution':
            return Object.freeze({
              status: 'notRequested' as const,
              executorInput: null,
              effectiveLinkedWithdrawalGroups:
                production.effectiveLinkedWithdrawalGroups,
            })
          case 'zeroSource':
            return Object.freeze({
              ...production,
              executorInput: Object.freeze({
                ...production.executorInput,
                openingBalances: Object.freeze(
                  production.executorInput.openingBalances.map((balance) =>
                    Object.freeze({
                      ...balance,
                      openingBalance: balance.accountId === 'ira-a'
                        ? 0 as typeof balance.openingBalance
                        : balance.openingBalance,
                    })),
                ),
              }),
            })
          case 'dropRmd':
            return Object.freeze({
              ...production,
              executorInput: Object.freeze({
                ...production.executorInput,
                runtimeEvidence: Object.freeze({
                  ...production.executorInput.runtimeEvidence,
                  ownerIraRmdSatisfactionEvidence: Object.freeze([]),
                }),
              }),
            })
          case 'revokeLinkedGroup':
            return Object.freeze({
              ...production,
              effectiveLinkedWithdrawalGroups:
                input.observedLinkedWithdrawalGroups,
            })
          case 'none':
            return production
        }
      },
    ),
)

vi.mock(
  './internal/annualRetirementActionSettlementPublication.js',
  async (importOriginal) => {
    const original = await importOriginal<
      typeof import('./internal/annualRetirementActionSettlementPublication.js')
    >()
    return {
      ...original,
      annualRetirementActionSettlementPublication: (
        input: AnnualRetirementActionSettlementPublicationInput,
      ) => {
        hostile.settlementCalls.push(input)
        return original.annualRetirementActionSettlementPublication(input)
      },
    }
  },
)

import {
  parseRetirementActionRequest,
  type RothConversionRequest,
} from '../actions/index.js'
import type { Account, Plan } from '../model/plan.js'
import {
  recurringOrdinaryIncome,
  singlePersonPlan,
  validatePlan,
} from '../testing/planFixtures.js'
import { createFlatTaxCalculator } from '../testing/flatTax.js'
import { simulatePlan } from './simulate.js'

const TAX_YEAR = 2026
const CONVERSION_DOLLARS = 10_000
const LINKED_CONVERSION_DOLLARS = 40_000
const LINKED_WITHDRAWAL_DOLLARS = 8_800
const LINKED_CONVERSION_ID = 'linked-conversion'
const LINKED_WITHDRAWAL_ID = 'linked-withdrawal'

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

function namedConversion(): RothConversionRequest {
  const parsed = parseRetirementActionRequest({
    actionId: 'named-conversion',
    kind: 'rothConversion',
    personId: 'p1',
    year: TAX_YEAR,
    executionDate: `${TAX_YEAR}-06-15`,
    executionSequence: 1,
    requestedAmount: CONVERSION_DOLLARS * 100,
    allocations: [{
      allocationId: 'named-conversion-allocation',
      sourceAccountId: 'ira-a',
      requestedAmount: CONVERSION_DOLLARS * 100,
    }],
    destinationRothAccountId: 'roth-a',
    taxFunding: { kind: 'noneExpected' },
    provenance: { source: 'manual' },
  })
  if (!parsed.ok || parsed.request.kind !== 'rothConversion') {
    throw new Error('invalid named-conversion fixture')
  }
  return parsed.request
}

function linkedWithdrawal() {
  const parsed = parseRetirementActionRequest({
    actionId: LINKED_WITHDRAWAL_ID,
    kind: 'ordinaryWithdrawal',
    personId: 'p1',
    year: TAX_YEAR,
    executionDate: `${TAX_YEAR}-06-14`,
    executionSequence: 1,
    requestedAmount: LINKED_WITHDRAWAL_DOLLARS * 100,
    allocations: [{
      allocationId: 'linked-withdrawal-allocation',
      sourceAccountId: 'cash-a',
      requestedAmount: LINKED_WITHDRAWAL_DOLLARS * 100,
    }],
    purpose: { kind: 'taxPayment', referenceId: LINKED_CONVERSION_ID },
    provenance: { source: 'manual' },
  })
  if (!parsed.ok || parsed.request.kind !== 'ordinaryWithdrawal') {
    throw new Error('invalid linked-withdrawal fixture')
  }
  return parsed.request
}

function linkedConversion(): RothConversionRequest {
  const parsed = parseRetirementActionRequest({
    actionId: LINKED_CONVERSION_ID,
    kind: 'rothConversion',
    personId: 'p1',
    year: TAX_YEAR,
    executionDate: `${TAX_YEAR}-06-15`,
    executionSequence: 2,
    requestedAmount: LINKED_CONVERSION_DOLLARS * 100,
    allocations: [{
      allocationId: 'linked-conversion-allocation',
      sourceAccountId: 'ira-a',
      requestedAmount: LINKED_CONVERSION_DOLLARS * 100,
    }],
    destinationRothAccountId: 'roth-a',
    taxFunding: {
      kind: 'linkedWithdrawal',
      withdrawalActionId: LINKED_WITHDRAWAL_ID,
    },
    provenance: { source: 'manual' },
  })
  if (!parsed.ok || parsed.request.kind !== 'rothConversion') {
    throw new Error('invalid linked-conversion fixture')
  }
  return parsed.request
}

function plan(): Plan {
  const target = singlePersonPlan({ planningAge: 60, dob: '1970-01-01' })
  target.id = 'annual-roth-conversion-execution-input-delegation'
  target.assumptions.inflationPct = 0
  target.assumptions.defaultReturnPct = 0
  target.expenses.baseAnnual = 0
  target.accounts = [
    cash('cash-a', 1_000_000),
    traditionalIra('ira-a', 100_000),
    rothIra('roth-a'),
  ]
  target.retirementActionEligibilityFacts = {
    iraClassifications: [{
      evidenceId: 'ira-a-classification',
      provenance: { source: 'manual' },
      sourceAccountId: 'ira-a',
      subtype: 'traditional',
    }],
    sepSimpleActivities: [],
    deductibleIraContributions: [],
  }
  target.strategies.retirementActions = [namedConversion()]
  return validatePlan(target)
}

function linkedPlan(): Plan {
  const target = singlePersonPlan({ planningAge: 60, dob: '1970-01-01' })
  const linkedIra = traditionalIra('ira-a', 400_000)
  if (linkedIra.type !== 'traditional') throw new Error('invalid IRA fixture')
  linkedIra.nondeductibleBasis = 0
  target.id = 'annual-roth-conversion-linked-group-delegation'
  target.assumptions.inflationPct = 0
  target.assumptions.defaultReturnPct = 0
  target.incomes = [recurringOrdinaryIncome('pension', 90_000)]
  target.expenses.baseAnnual = 50_000
  target.accounts = [
    cash('cash-a', 1_000_000),
    linkedIra,
    rothIra('roth-a'),
  ]
  target.retirementActionEligibilityFacts = {
    iraClassifications: [{
      evidenceId: 'ira-a-classification',
      provenance: { source: 'manual' },
      sourceAccountId: 'ira-a',
      subtype: 'traditional',
    }],
    sepSimpleActivities: [],
    deductibleIraContributions: [],
  }
  target.strategies.retirementActions = [
    linkedWithdrawal(),
    linkedConversion(),
  ]
  return validatePlan(target)
}

function run(target = plan(), flatTaxRatePct = 0) {
  const result = simulatePlan(target, {
    startYear: TAX_YEAR,
    horizonEndYear: TAX_YEAR,
    taxCalculator: createFlatTaxCalculator(flatTaxRatePct),
  })
  const year = result.years[0]
  if (year === undefined) throw new Error('missing year')
  return year
}

describe('simulatePlan delegates named Roth-conversion execution input', () => {
  beforeEach(() => {
    hostile.mutation = 'none'
    seam.reset()
    hostile.settlementCalls.length = 0
  })

  it('hands the coordinator post-withdrawal balances and owner facts', () => {
    const year = run()
    const call = seam.calls.at(-1)

    expect(year.rothConversionActionExecution?.committed).toBe(true)
    expect(call?.input.requests.map((request) => request.actionId))
      .toEqual(['named-conversion'])
    expect(call?.input.balances.find((balance) =>
      balance.accountId === 'ira-a')).toEqual({
      accountId: 'ira-a',
      balancePlanDollars: 100_000,
    })
    expect(call?.input.ownerRmd).toEqual([{
      ownerPersonId: 'p1',
      requiredPlanDollars: 0,
      unsatisfiedPlanDollars: 0,
    }])
    expect(call?.input.ownerBasis).toEqual([])
    expect(Object.isFrozen(call?.input)).toBe(true)
    expect(Object.isFrozen(call?.input.requests)).toBe(true)
    expect(Object.isFrozen(call?.input.people)).toBe(true)
    expect(Object.isFrozen(call?.input.people[0])).toBe(true)
    expect(Object.isFrozen(call?.input.balances)).toBe(true)
    expect(Object.isFrozen(call?.input.balances[0])).toBe(true)
    expect(Object.isFrozen(call?.input.ownerRmd)).toBe(true)
    expect(Object.isFrozen(call?.input.ownerRmd[0])).toBe(true)
    expect(Object.isFrozen(call?.input.ownerBasis)).toBe(true)
    expect(Object.isFrozen(call?.input.ordinaryWithdrawalEvidence)).toBe(true)
  })

  it.each([
    ['withholdExecution', 'the prepared executor call'],
    ['zeroSource', 'the prepared source-capacity snapshot'],
    ['dropRmd', 'the prepared owner-RMD evidence'],
  ] as const)('consumes %s rather than rebuilding %s inline', (mutation, label) => {
    hostile.mutation = mutation

    const year = run()

    expect(seam.calls.length, label).toBeGreaterThan(0)
    expect(seam.calls.every((call) => call.natural.status === 'ready')).toBe(true)
    expect(year.rothConversionActionExecution?.committed ?? false).toBe(false)
    expect(year.balances['ira-a']).toBeCloseTo(100_000, 6)
    expect(year.balances['roth-a']).toBeCloseTo(0, 6)
  })

  it('hands the coordinator-owned linked-group verdict to settlement', () => {
    hostile.mutation = 'revokeLinkedGroup'

    run(linkedPlan(), 22)

    const revoked = seam.calls.find((call) =>
      call.natural.status === 'ready' &&
      call.natural.effectiveLinkedWithdrawalGroups !==
        call.injected.effectiveLinkedWithdrawalGroups)
    expect(revoked?.natural.effectiveLinkedWithdrawalGroups.groups[0])
      .toMatchObject({ disposition: 'executedAsAtomicGroup' })
    expect(revoked?.injected.effectiveLinkedWithdrawalGroups)
      .toBe(revoked?.input.observedLinkedWithdrawalGroups)
    expect(Object.isFrozen(revoked?.input.ownerBasis[0])).toBe(true)
    expect(Object.isFrozen(revoked?.input.ordinaryWithdrawalEvidence[0]))
      .toBe(true)
    expect(hostile.settlementCalls.some((call) =>
      call.linkedWithdrawalGroups ===
        revoked?.injected.effectiveLinkedWithdrawalGroups)).toBe(true)
  })
})
