/**
 * Hostile seam proof for conversion-linked withdrawal funding coordination.
 *
 * The wrapper first runs production, then replaces an earned authorization with
 * the fail-closed permission. Both authored legs must stop moving; merely calling
 * the coordinator while rebuilding its decision locally fails this test.
 *
 * Scaffolding and the policy behind it live in
 * `simulate.seamGuard.test-support.ts`; the sentinels stay here.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  AnnualConversionLinkedWithdrawalFundingInput,
  AnnualConversionLinkedWithdrawalFundingResult,
} from './internal/annualConversionLinkedWithdrawalFunding.js'

const hostile = vi.hoisted(() => ({ injectRefusal: false }))

const seam = await vi.hoisted(
  async () =>
    (
      await import('./simulate.seamGuard.test-support.js')
    ).createSeamRecorder<
      AnnualConversionLinkedWithdrawalFundingInput,
      Readonly<AnnualConversionLinkedWithdrawalFundingResult>
    >(),
)

vi.mock(
  './internal/annualConversionLinkedWithdrawalFunding.js',
  async (importOriginal) => {
    // The refusal sentinel is an export of the mocked module itself, so this
    // factory keeps a block body to name the original namespace.
    const original = await importOriginal<
      typeof import('./internal/annualConversionLinkedWithdrawalFunding.js')
    >()
    return seam.through(
      original,
      'annualConversionLinkedWithdrawalFunding',
      (natural): Readonly<AnnualConversionLinkedWithdrawalFundingResult> =>
        hostile.injectRefusal && natural.release.kind === 'proven'
          ? {
              ...natural,
              release: original.REFUSE_ANNUAL_CONVERSION_LINKED_WITHDRAWALS,
            }
          : natural,
    )
  },
)

import { expectSeamRanAtLeastOnce } from './simulate.seamGuard.test-support.js'
import { parseRetirementActionRequest } from '../actions/index.js'
import type { Account, Plan } from '../model/plan.js'
import {
  recurringOrdinaryIncome,
  singlePersonPlan,
  validatePlan,
} from '../testing/planFixtures.js'
import { createFlatTaxCalculator } from '../testing/flatTax.js'
import { simulatePlan } from './simulate.js'

const YEAR = 2026
const CONVERSION_ACTION_ID = 'delegated-funded-conversion'
const WITHDRAWAL_ACTION_ID = 'delegated-tax-withdrawal'
const CONVERSION_CENTS = 40_000_00
const WITHDRAWAL_CENTS = 8_800_00

function request(input: Record<string, unknown>) {
  const parsed = parseRetirementActionRequest(input)
  if (!parsed.ok) throw new Error(parsed.issues.join('; '))
  return parsed.request
}

function plan(): Plan {
  const target = singlePersonPlan({ planningAge: 60, dob: '1970-01-01' })
  target.id = 'linked-funding-delegation'
  const accounts: Account[] = [
    {
      type: 'cash',
      id: 'cash-a',
      name: 'cash-a',
      ownerPersonId: 'p1',
      annualReturnPct: 0,
      balance: 1_000_000,
      annualContribution: 0,
    },
    {
      type: 'traditional',
      id: 'ira-a',
      name: 'ira-a',
      ownerPersonId: 'p1',
      annualReturnPct: 0,
      kind: 'ira',
      balance: 400_000,
      annualContribution: 0,
      nondeductibleBasis: 0,
    },
    {
      type: 'roth',
      id: 'roth-a',
      name: 'roth-a',
      ownerPersonId: 'p1',
      annualReturnPct: 0,
      kind: 'ira',
      balance: 0,
      annualContribution: 0,
    },
  ]
  target.accounts = accounts
  target.incomes = [recurringOrdinaryIncome('pension', 90_000)]
  target.expenses.baseAnnual = 50_000
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
    request({
      actionId: WITHDRAWAL_ACTION_ID,
      kind: 'ordinaryWithdrawal',
      personId: 'p1',
      year: YEAR,
      executionDate: `${YEAR}-06-14`,
      executionSequence: 1,
      requestedAmount: WITHDRAWAL_CENTS,
      allocations: [{
        allocationId: `${WITHDRAWAL_ACTION_ID}-allocation`,
        sourceAccountId: 'cash-a',
        requestedAmount: WITHDRAWAL_CENTS,
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
      requestedAmount: CONVERSION_CENTS,
      allocations: [{
        allocationId: `${CONVERSION_ACTION_ID}-allocation`,
        sourceAccountId: 'ira-a',
        requestedAmount: CONVERSION_CENTS,
      }],
      destinationRothAccountId: 'roth-a',
      taxFunding: {
        kind: 'linkedWithdrawal',
        withdrawalActionId: WITHDRAWAL_ACTION_ID,
      },
      provenance: { source: 'manual' },
    }),
  ]
  return validatePlan(target)
}

function actionYear() {
  return simulatePlan(plan(), {
    startYear: YEAR,
    horizonEndYear: YEAR,
    taxCalculator: createFlatTaxCalculator(22),
  }).years[0]!
}

beforeEach(() => {
  hostile.injectRefusal = false
  seam.reset()
})

describe('simulatePlan conversion-linked withdrawal funding delegation', () => {
  it('uses the coordinator permission as the sole commit authority', () => {
    const production = actionYear()
    expect(production.conversionLinkedWithdrawalGroupExecution).toMatchObject({
      status: 'executed',
      movement: 'bothLegs',
    })
    const provenCalls = expectSeamRanAtLeastOnce(seam)
    expect(provenCalls.every((call) =>
      Object.isFrozen(call.input) &&
      call.input.taxUnitId !== null &&
      new Set(call.input.omitActionIds).size === 2 &&
      call.input.omitActionIds.some((actionId) =>
        actionId === CONVERSION_ACTION_ID) &&
      call.input.omitActionIds.some((actionId) =>
        actionId === WITHDRAWAL_ACTION_ID)
    )).toBe(true)
    expect(provenCalls.some((call) => call.natural.release.kind === 'proven'))
      .toBe(true)

    hostile.injectRefusal = true
    seam.reset()
    const refused = actionYear()

    expect(seam.calls.some((call) => call.injected !== call.natural)).toBe(true)
    expect(refused.conversionLinkedWithdrawalGroupExecution).toMatchObject({
      status: 'refused',
      movement: 'none',
    })
    const records = refused.retirementActionPublication?.records ?? []
    expect(records.find((record) =>
      record.actionId === CONVERSION_ACTION_ID)).not.toMatchObject({
      outcome: 'executed',
    })
    expect(records.find((record) =>
      record.actionId === WITHDRAWAL_ACTION_ID)).not.toMatchObject({
      outcome: 'executed',
    })
  })
})
